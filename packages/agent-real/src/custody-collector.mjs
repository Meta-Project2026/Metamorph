// Fresh credential-free collector. Receives selected source via stdin, never a pack/path.
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256 } from "../../target-worker/src/admission.mjs";
import {
  CUSTODY,
  parseCapsule,
  receiptFor,
  requireCustody,
} from "./custody-contract.mjs";
import {
  commitPrivate,
  commitRecord,
  privateDirectory,
} from "./custody-files.mjs";
import { encryptDiagnostic } from "./encrypt-diagnostics.mjs";

export async function collectCapsule(input, env, signal) {
  requireCustody(
    process.platform === "linux" &&
      !env.MODEL_API_KEY &&
      !env.GH_TOKEN &&
      !env.ACTIONS_RUNTIME_TOKEN &&
      !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  );
  const expected = {
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    headSha: env.GITHUB_SHA,
  };
  const capsule = parseCapsule(input, expected),
    spool = join(env.RUNNER_TEMP, "mmp115-custody");
  signal.throwIfAborted();
  privateDirectory(env.RUNNER_TEMP, false, false);
  privateDirectory(spool, true);
  let plaintext;
  try {
    plaintext = Buffer.from(JSON.stringify(capsule));
    const started = performance.now();
    const result = await encryptDiagnostic(plaintext, {
      agePath: join(env.RUNNER_TEMP, "mmp089-tools/age"),
      workerPath: fileURLToPath(
        new URL(
          "../../../research/mmp-089/encrypt-worker.mjs",
          import.meta.url,
        ),
      ),
      signal,
    });
    signal.throwIfAborted();
    requireCustody(
      performance.now() - started <= CUSTODY.deadlineMs &&
        result.cleanup === "VERIFIED_ZERO_RESOURCES" &&
        result.ciphertext.length <= CUSTODY.ciphertext,
    );
    commitPrivate(
      join(spool, "candidate.age"),
      result.ciphertext,
      CUSTODY.ciphertext,
    );
    signal.throwIfAborted();
    const record = receiptFor(
      "CAPTURED_UNVERIFIED",
      capsule.identity,
      { sha256: sha256(result.ciphertext), bytes: result.ciphertext.length },
      result.cleanup,
    );
    commitRecord(join(spool, "capture.json"), record);
    return record;
  } finally {
    input.fill(0);
    plaintext?.fill(0);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const controller = new AbortController(),
    chunks = [];
  let input;
  const stop = () => {
    controller.abort();
    process.stdin.destroy();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const timer = setTimeout(stop, CUSTODY.deadlineMs);
  try {
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      requireCustody(size <= CUSTODY.plaintext);
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks);
    await collectCapsule(input, process.env, controller.signal);
  } catch {
    process.stderr.write("CUSTODY_CAPTURE_FAILED\n");
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    input?.fill(0);
    for (const c of chunks) c.fill(0);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
