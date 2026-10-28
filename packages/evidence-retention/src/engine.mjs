import { isAbsolute, relative, sep } from "node:path";
import { PrivateEvidence } from "@metamorph/oracle";
import { archive, inspect, openArchive } from "./catalog.mjs";
import {
  admission,
  bytes,
  check,
  equal,
  id,
  opaque,
  publicSummary,
  RetentionError,
  timestamp,
} from "./core.mjs";
import {
  authenticated,
  decrypt,
  encrypt,
  signed,
  verifyCatalogWitness,
} from "./crypto.mjs";
import { Directory } from "./secure-fs.mjs";
import { pair } from "./store.mjs";

function disjoint(paths) {
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++) {
      const rel = relative(paths[i], paths[j]);
      const back = relative(paths[j], paths[i]);
      const outside = (p) =>
        p === ".." || p.startsWith(`..${sep}`) || isAbsolute(p);
      check(outside(rel) && outside(back), "OVERLAPPING_ROOTS");
    }
}

function incident(journal, error, payload, at) {
  try {
    journal.append(payload, at);
  } catch (secondary) {
    // Preserve the primary exception even if the audit device is also full or
    // unavailable. This restricted error object is never serialized publicly.
    Object.defineProperty(error, "secondaryErrors", {
      value: [...(error.secondaryErrors ?? []), secondary],
      configurable: true,
    });
  }
}

export function publish({
  input,
  witness,
  witnessPublicKey,
  expectedWitnessSha256,
  stores,
  nonceRoot,
  journal,
}) {
  let nonces;
  const versions = [];
  try {
    const frozen = verifyCatalogWitness(
      witness,
      witnessPublicKey,
      expectedWitnessSha256,
    );
    pair(stores);
    disjoint([
      input.sourceRoot,
      nonceRoot,
      journal.dir.path,
      ...stores.map((s) => s.config.root),
    ]);
    const actual = inspect(input);
    check(equal(actual.catalog, frozen.catalog), "WITNESS_MISMATCH");
    // All size/layout/key/identity admission happens before the first storage write.
    nonces = new Directory(nonceRoot);
    journal.reserve();
    journal.append({
      type: "PUBLISH_STARTED",
      witnessRef: frozen.catalog.identity.witnessRef,
    });
    for (const p of frozen.catalog.packs) {
      const plain = archive(input.sourceRoot, p, actual.budget, frozen.catalog);
      let blob;
      try {
        blob = encrypt(
          plain,
          {
            identity: frozen.catalog.identity,
            pack: p,
            manifestSha256: frozen.manifestSha256,
            recipients: frozen.recipients,
          },
          nonces,
        );
      } finally {
        plain.fill(0);
      }
      check(blob.length <= actual.budget.maxCipherBytesPerPack, "BUDGET");
      for (const store of stores) {
        journal.reserve();
        const receipt = store.put(p.id, blob, {
          manifestSha256: frozen.manifestSha256,
          witnessRef: frozen.catalog.identity.witnessRef,
        });
        versions.push(receipt);
        journal.append({
          type: "COPY_PUBLISHED",
          domainId: receipt.domainId,
          versionId: receipt.versionId,
          packId: p.id,
        });
      }
    }
    // Detect late writers to earlier packs and a changed root after all copies.
    check(equal(inspect(input).catalog, frozen.catalog), "LATE_WRITER");
    for (const receipt of versions)
      stores.find((s) => s.config.domainId === receipt.domainId).get(receipt);
    return {
      versions,
      summary: publicSummary({
        runId: frozen.catalog.identity.runId,
        status: "NOT_VERIFIED",
        packCount: frozen.catalog.packs.length,
        commitment: frozen.commitment,
      }),
    };
  } catch (error) {
    incident(journal, error, {
      type: "INCIDENT",
      code: error instanceof RetentionError ? error.code : "STORAGE_ERROR",
      retainedVersions: versions.length,
    });
    throw error;
  } finally {
    nonces?.close();
  }
}
/** Separate witness opens both stored copies itself. Sign and retain this
 * receipt before configuring/invoking a restore reader. */
export function witnessStorage({
  witness,
  witnessPublicKey,
  expectedWitnessSha256,
  versions,
  stores,
  signingPrivateKey,
  observedAt,
}) {
  const frozen = verifyCatalogWitness(
    witness,
    witnessPublicKey,
    expectedWitnessSha256,
  );
  pair(stores);
  check(timestamp(observedAt) >= timestamp(frozen.observedAt), "TIME");
  check(
    versions.length === 2 * frozen.catalog.packs.length,
    "STORAGE_COVERAGE",
  );
  check(
    new Set(versions.map((v) => `${v.domainId}/${v.packId}`)).size ===
      versions.length,
    "STORAGE_COVERAGE",
  );
  for (const store of stores)
    for (const p of frozen.catalog.packs) {
      const receipt = versions.find(
        (v) => v.domainId === store.config.domainId && v.packId === p.id,
      );
      check(
        receipt &&
          receipt.manifestSha256 === frozen.manifestSha256 &&
          receipt.witnessRef === frozen.catalog.identity.witnessRef,
        "STORAGE_COVERAGE",
      );
      store.get(receipt);
    }
  return signed(
    {
      format: "mmp-evidence-storage-witness-v1",
      catalogWitnessSha256: expectedWitnessSha256,
      observedAt,
      versions,
    },
    signingPrivateKey,
  );
}
function delegation(frozen, principal, grant, trust, now, revoked) {
  const recipient = frozen.recipients.find((r) => r.principal === principal);
  check(recipient, "ACCESS_DENIED");
  if (recipient.role !== "RECOVERY") return;
  check(grant && trust.grantSha256, "RECOVERY_NOT_AUTHORIZED");
  const p = authenticated(grant, trust.witnessPublicKey, trust.grantSha256);
  check(
    p.format === "mmp-evidence-recovery-grant-v1" &&
      p.action === "RECOVER" &&
      p.witnessRef === frozen.catalog.identity.witnessRef &&
      p.principal === principal &&
      timestamp(p.notBefore) <= timestamp(now) &&
      timestamp(p.expiresAt) >= timestamp(now) &&
      !revoked.includes(p.grantId),
    "RECOVERY_NOT_AUTHORIZED",
  );
  id(p.grantId);
}
export function restore({
  witness,
  storageWitness,
  trust,
  store,
  principal,
  privateKey,
  destinationParent,
  journal,
  purpose = "IMMEDIATE",
  now = new Date().toISOString(),
  grant = null,
  revoked = [],
}) {
  journal.reserve();
  try {
    disjoint([destinationParent, store.config.root, journal.dir.path]);
    check(["IMMEDIATE", "DAY90"].includes(purpose), "RESTORE_PURPOSE");
    const frozen = verifyCatalogWitness(
      witness,
      trust.witnessPublicKey,
      trust.witnessSha256,
    );
    const storage = authenticated(
      storageWitness,
      trust.witnessPublicKey,
      trust.storageWitnessSha256,
    );
    check(
      storage.format === "mmp-evidence-storage-witness-v1" &&
        storage.catalogWitnessSha256 === trust.witnessSha256 &&
        timestamp(storage.observedAt) <= timestamp(now),
      "WITNESS_MISMATCH",
    );
    check(
      timestamp(now) >= timestamp(frozen.catalog.teardown.finalizedAt),
      "TEARDOWN",
    );
    delegation(frozen, principal, grant, trust, now, revoked);
    const budget = admission(frozen.catalog.admission);
    const receipts = storage.versions.filter(
      (r) => r.domainId === store.config.domainId,
    );
    check(
      receipts.length === frozen.catalog.packs.length &&
        new Set(receipts.map((r) => r.packId)).size === receipts.length,
      "STORAGE_COVERAGE",
    );
    journal.append(
      {
        type: "RECOVERY_ACCESS",
        principal,
        purpose,
        witnessRef: frozen.catalog.identity.witnessRef,
      },
      now,
    );
    const parent = new Directory(destinationParent);
    const stageName = `restore-stage-${opaque()}`;
    const finalName = `restored-${opaque()}`;
    const stage = parent.child(stageName, true);
    try {
      for (const p of frozen.catalog.packs) {
        const receipt = receipts.find((r) => r.packId === p.id);
        check(
          receipt && receipt.manifestSha256 === frozen.manifestSha256,
          "STORAGE_COVERAGE",
        );
        const blob = store.get(receipt);
        let plain;
        const restored = stage.child(p.relativePath, true);
        try {
          plain = decrypt(blob, frozen, p, principal, privateKey);
          const files = openArchive(plain, p, budget, frozen.catalog);
          for (const [name, value] of files) restored.publish(name, value);
          check(
            PrivateEvidence.verify(
              `${destinationParent}/${stageName}/${p.relativePath}`,
              p.indexSha256,
            ) +
              1 ===
              p.files.length,
            "INDEX",
          );
        } finally {
          plain?.fill(0);
          restored.close();
        }
      }
      const descriptors = frozen.catalog.packs.map(
        ({ bytes: _bytes, files: _files, ...p }) => p,
      );
      const checked = inspect({
        sourceRoot: `${destinationParent}/${stageName}`,
        identity: frozen.catalog.identity,
        admission: frozen.catalog.admission,
        packs: descriptors,
        teardown: frozen.catalog.teardown,
      });
      check(equal(checked.catalog, frozen.catalog), "WITNESS_MISMATCH");
      stage.publish("root-catalog.json", bytes(frozen.catalog));
      stage.close();
      parent.finish(stageName, finalName);
      journal.append(
        {
          type: "RESTORE_VERIFIED",
          domainId: store.config.domainId,
          purpose,
          manifestSha256: frozen.manifestSha256,
        },
        now,
      );
      return {
        format: "mmp-evidence-restore-v1",
        status: "SIMULATED_RESTORED",
        purpose,
        witnessSha256: trust.witnessSha256,
        storageWitnessSha256: trust.storageWitnessSha256,
        domainId: store.config.domainId,
        principal,
        at: now,
        manifestSha256: frozen.manifestSha256,
        packCount: frozen.catalog.packs.length,
        fileCount: frozen.catalog.packs.reduce((n, p) => n + p.files.length, 0),
        restoredName: finalName,
        versions: receipts.map((r) => r.versionId),
      };
    } catch (error) {
      // Failed staging and prior versions deliberately survive for restricted
      // incident review. No automatic recursive cleanup of sole evidence.
      try {
        stage.close();
      } catch {
        /* Already closed before final rename. */
      }
      throw error;
    } finally {
      parent.close();
    }
  } catch (error) {
    incident(
      journal,
      error,
      {
        type: "INCIDENT",
        code: error instanceof RetentionError ? error.code : "RESTORE_ERROR",
      },
      now,
    );
    throw error;
  }
}
