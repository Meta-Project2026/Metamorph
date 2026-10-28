import {
  bytes,
  canonical,
  check,
  DAY,
  digest,
  equal,
  hex,
  id,
  keys,
  LIMITS,
  opaque,
  sha,
  timestamp,
} from "./core.mjs";
import { authenticated, keyId } from "./crypto.mjs";
import { verifyDeletionState } from "./deletion.mjs";
import { Journal } from "./journal.mjs";
import { Directory } from "./secure-fs.mjs";

/** Functional local-disk adapter. Deliberately restricted to synthetic data:
 * strings naming separate principals do not authenticate custody or ACLs. */
export class LocalStore {
  constructor(config) {
    check(config.deployment === "SYNTHETIC_ONLY", "REAL_MEDIA_NOT_DEPLOYED");
    id(config.domainId);
    id(config.principal);
    id(config.administrator);
    id(config.failureDomain);
    this.config = { ...config };
    this.dir = new Directory(config.root);
  }
  put(packId, blob, binding, { versionId = opaque(), failAt = null } = {}) {
    id(packId);
    id(versionId);
    keys(binding, ["manifestSha256", "witnessRef"]);
    hex(binding.manifestSha256);
    id(binding.witnessRef);
    check(
      blob.length <= LIMITS.pack + 2 * LIMITS.metadata + LIMITS.header + 288,
      "BUDGET",
    );
    const version = this.dir.child(versionId, true);
    try {
      const receipt = {
        format: "mmp-evidence-storage-v1",
        domainId: this.config.domainId,
        principal: this.config.principal,
        versionId,
        packId,
        bytes: blob.length,
        sha256: sha(blob),
        ...binding,
      };
      version.publish("blob.bin", blob, failAt);
      version.publish("receipt.json", bytes(receipt));
      // A crash before this marker leaves an immutable incomplete version.
      check(failAt !== "RECEIPT", "INTERRUPTED");
      version.publish("ready.json", bytes({ receiptSha256: digest(receipt) }));
      this.get(receipt);
      return receipt;
    } finally {
      version.close();
    }
  }
  get(expected) {
    check(
      expected.domainId === this.config.domainId &&
        expected.principal === this.config.principal,
      "STORAGE_DOMAIN",
    );
    id(expected.versionId);
    hex(expected.sha256);
    const version = this.dir.child(expected.versionId);
    try {
      check(
        equal(version.names(), ["blob.bin", "ready.json", "receipt.json"]),
        "INCOMPLETE_VERSION",
      );
      const receipt = canonical(version.read("receipt.json", 4096));
      const ready = canonical(version.read("ready.json", 4096));
      check(
        equal(receipt, expected) && ready.receiptSha256 === digest(receipt),
        "STORAGE_RECEIPT",
      );
      const blob = version.read(
        "blob.bin",
        LIMITS.pack + 2 * LIMITS.metadata + LIMITS.header + 288,
      );
      check(
        blob.length === receipt.bytes && sha(blob) === receipt.sha256,
        "CIPHERTEXT_IDENTITY",
      );
      return blob;
    } finally {
      version.close();
    }
  }
  deleteAuthorized(expected, authorization, now = new Date().toISOString()) {
    const authority = this.config.deletionAuthority;
    check(
      authority &&
        authorization &&
        authority.ownerPublicKeys?.length === 2 &&
        keyId(authority.ownerPublicKeys[0]) !==
          keyId(authority.ownerPublicKeys[1]),
      "DELETION_UNAUTHORIZED",
    );
    check(
      timestamp(now) >= timestamp(authority.terminalReceiptAt) + 180 * DAY,
      "PREMATURE_DELETION",
    );
    check(
      authority.versions.some((r) => equal(r, expected)),
      "DELETION_UNAUTHORIZED",
    );
    check(authorization.approvals?.length === 2, "TWO_OWNERS_REQUIRED");
    for (let i = 0; i < 2; i++) {
      const p = authenticated(
        authorization.approvals[i],
        authority.ownerPublicKeys[i],
        digest(authorization.approvals[i]),
      );
      check(
        equal(p, {
          format: "mmp-evidence-owner-action-v1",
          action: "DELETE",
          witnessRef: authority.witnessRef,
          at: now,
          witnessSha256: authority.witnessSha256,
          storageWitnessSha256: authority.storageWitnessSha256,
        }),
        "DELETION_UNAUTHORIZED",
      );
    }
    const review = authenticated(
      authorization.reviewRecord,
      authority.reviewerPublicKey,
      digest(authorization.reviewRecord),
    );
    check(
      equal(review, {
        format: "mmp-evidence-no-hold-v1",
        witnessRef: authority.witnessRef,
        at: now,
        noHold: true,
        witnessSha256: authority.witnessSha256,
        storageWitnessSha256: authority.storageWitnessSha256,
      }),
      "DELETION_UNAUTHORIZED",
    );
    check(authority.ledgerRoot && authorization.plan, "DELETION_PLAN_REQUIRED");
    const ledger = new Journal(authority.ledgerRoot);
    try {
      return ledger.withLock(() => {
        verifyDeletionState(ledger, authority, authorization.plan, now);
        this.get(expected);
        const version = this.dir.child(expected.versionId);
        try {
          ledger.verify(authorization.plan.journalCheckpoint);
          // Keep the original storage receipt and a tombstone, never overwrite history.
          version.remove("blob.bin");
          version.publish(
            "deleted.json",
            bytes({
              format: "mmp-evidence-deletion-v1",
              versionId: expected.versionId,
              ciphertextSha256: expected.sha256,
              deletionPlanSha256: digest(authorization.plan),
            }),
          );
          return {
            domainId: expected.domainId,
            versionId: expected.versionId,
            sha256: expected.sha256,
            status: "SYNTHETIC_DELETED",
          };
        } finally {
          version.close();
        }
      });
    } finally {
      ledger.close();
    }
  }
  close() {
    this.dir.close();
  }
}
export function assessCustody(configs, candidateAdministrator) {
  const shared =
    new Set(configs.map((c) => c.administrator)).size !== configs.length;
  return {
    physical: "NOT_DEPLOYED",
    independence: "NOT_ESTABLISHED",
    sharedAdministrator: shared,
    candidateAdministratorControlsCopy: configs.some(
      (c) => c.administrator === candidateAdministrator,
    ),
    limitation: "SYNTHETIC_ROOTS_AND_PRINCIPALS_ARE_NOT_PHYSICAL_CUSTODY",
  };
}
export function pair(stores) {
  check(stores.length === 2, "TWO_COPIES_REQUIRED");
  const [a, b] = stores;
  check(
    a.config.domainId !== b.config.domainId &&
      a.config.principal !== b.config.principal &&
      a.config.failureDomain !== b.config.failureDomain &&
      a.config.root !== b.config.root &&
      !(
        a.dir.identity.dev === b.dir.identity.dev &&
        a.dir.identity.ino === b.dir.identity.ino
      ),
    "STORAGE_DOMAIN",
  );
}
