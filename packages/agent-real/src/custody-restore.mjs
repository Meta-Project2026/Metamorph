// Owner-local verification only. Agent/CI acceptance uses generated TEST identities.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../target-worker/src/admission.mjs";
import {
  CUSTODY,
  parseCapsule,
  plainData,
  requireCustody,
  validateReceipt,
} from "./custody-contract.mjs";
import { cipherAt, readRecord } from "./custody-files.mjs";
import { DIAGNOSTIC_POLICY, readPrivateBytes } from "./private-diagnostics.mjs";
export function verifyAgeRestore({
  agePath,
  identityPath,
  ciphertextPath,
  record,
  // Trusted generated-key controls only. CLI cannot select another recipient.
  testRecipient,
}) {
  record = plainData(record);
  requireCustody(
    process.platform === "linux" &&
      !process.env.MODEL_API_KEY &&
      !process.env.GH_TOKEN &&
      !process.env.ACTIONS_RUNTIME_TOKEN,
  );
  const expected = validateReceipt(record, record.identity, record.state);
  requireCustody(
    ["CAPTURED_UNVERIFIED", "STORED_UNVERIFIED"].includes(expected.state),
  );
  requireCustody(
    sha256(readPrivateBytes(agePath, 32 * 1024 * 1024, false)) ===
      DIAGNOSTIC_POLICY.ageSha256,
  );
  const identity = readPrivateBytes(identityPath, 4096);
  identity.fill(0);
  const keygenPath = join(dirname(agePath), "age-keygen");
  requireCustody(
    sha256(readPrivateBytes(keygenPath, 32 * 1024 * 1024, false)) ===
      DIAGNOSTIC_POLICY.keygenSha256,
  );
  const publicKey = spawnSync(keygenPath, ["-y", identityPath], {
    cwd: "/",
    env: { PATH: "/usr/bin:/bin", HOME: "/nonexistent", TZ: "UTC" },
    timeout: 10000,
    maxBuffer: 4096,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    requireCustody(
      !publicKey.error &&
        publicKey.status === 0 &&
        !publicKey.signal &&
        publicKey.stdout.toString().trim() ===
          (testRecipient ?? DIAGNOSTIC_POLICY.recipient),
    );
  } finally {
    publicKey.stdout?.fill(0);
    publicKey.stderr?.fill(0);
  }
  const result = spawnSync(agePath, ["--decrypt", "--identity", identityPath], {
    input: cipherAt(ciphertextPath, expected),
    cwd: "/",
    env: { PATH: "/usr/bin:/bin", HOME: "/nonexistent", TZ: "UTC" },
    timeout: CUSTODY.deadlineMs,
    maxBuffer: CUSTODY.plaintext,
    stdio: ["pipe", "pipe", "pipe"],
  });
  try {
    requireCustody(!result.error && result.status === 0 && !result.signal);
    return parseCapsule(result.stdout, expected.identity);
  } finally {
    result.stdout?.fill(0);
    result.stderr?.fill(0);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [agePath, identityPath, ciphertextPath, recordPath] =
      process.argv.slice(2);
    const capsule = verifyAgeRestore({
      agePath,
      identityPath,
      ciphertextPath,
      record: readRecord(recordPath),
    });
    process.stdout.write(
      `${JSON.stringify({ format: "mmp115-owner-restore-check-v1", identity: capsule.identity, verification: "UNVERIFIED", byteIdentity: "MATCH", product: "NOT_ESTABLISHED" })}\n`,
    );
  } catch {
    process.stderr.write("CUSTODY_RESTORE_REJECTED\n");
    process.exitCode = 1;
  }
}
