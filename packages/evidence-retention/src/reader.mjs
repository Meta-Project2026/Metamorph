import { basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import {
  bytes,
  canonical,
  check,
  LIMITS,
  publicSummary,
  RetentionError,
} from "./core.mjs";
import { signed, verifyCatalogWitness } from "./crypto.mjs";
import { restore } from "./engine.mjs";
import { Journal } from "./journal.mjs";
import { Directory } from "./secure-fs.mjs";
import { LocalStore } from "./store.mjs";

function restrictedFile(path, limit) {
  const dir = new Directory(dirname(path));
  try {
    return dir.read(basename(path), limit);
  } finally {
    dir.close();
  }
}
/** The sole argument is a reader-administered config, not writer-selected
 * commitments. It pins both prior witness hashes and the out-of-band trust key. */
export function readConfigured(configPath) {
  const config = canonical(restrictedFile(configPath, LIMITS.metadata));
  check(
    config.format === "mmp-evidence-reader-config-v1" &&
      config.deployment === "SYNTHETIC_ONLY",
    "READER_CONFIG",
  );
  const witness = canonical(
    restrictedFile(config.witnessPath, LIMITS.metadata),
  );
  const storageWitness = canonical(
    restrictedFile(config.storageWitnessPath, LIMITS.metadata),
  );
  const witnessPublicKey = restrictedFile(
    config.witnessPublicKeyPath,
    16_384,
  ).toString();
  const trust = {
    witnessPublicKey,
    witnessSha256: config.witnessSha256,
    storageWitnessSha256: config.storageWitnessSha256,
    grantSha256: config.grantSha256,
  };
  const frozen = verifyCatalogWitness(
    witness,
    witnessPublicKey,
    config.witnessSha256,
  );
  const journal = new Journal(
    config.journalRoot,
    frozen.catalog.admission.maxJournalBytes,
  );
  const store = new LocalStore(config.store);
  try {
    const privateKey = restrictedFile(config.privateKeyPath, 32_768);
    const signingKey = restrictedFile(config.signingKeyPath, 16_384);
    try {
      const grant = config.grantPath
        ? canonical(restrictedFile(config.grantPath, 16_384))
        : null;
      const receipt = restore({
        witness,
        storageWitness,
        trust,
        store,
        principal: config.principal,
        privateKey,
        destinationParent: config.destinationParent,
        journal,
        purpose: config.purpose,
        grant,
        revoked: config.revoked,
      });
      const output = new Directory(dirname(config.receiptPath));
      try {
        output.publish(
          basename(config.receiptPath),
          bytes(signed(receipt, signingKey)),
        );
      } finally {
        output.close();
      }
      return publicSummary({
        runId: frozen.catalog.identity.runId,
        status: receipt.status,
        packCount: receipt.packCount,
        commitment: frozen.commitment,
      });
    } finally {
      privateKey.fill(0);
      signingKey.fill(0);
    }
  } finally {
    store.close();
    journal.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    check(process.argv.length === 3, "READER_ARGUMENT");
    process.stdout.write(
      `${JSON.stringify(readConfigured(process.argv[2]))}\n`,
    );
  } catch (error) {
    // Intentionally no native exception text, path, stack, per-file hash or key.
    process.stdout.write(
      `${JSON.stringify({ format: "mmp-evidence-reader-result-v1", status: "NOT_VERIFIED", code: error instanceof RetentionError ? error.code : "RESTORE_ERROR", G4: "INCONCLUSIVE" })}\n`,
    );
    process.exitCode = 1;
  }
}
