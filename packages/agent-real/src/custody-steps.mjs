// Manual paid workflow entrypoints; never dispatched by tests. No Meta/key access.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  authenticatedArtifactMetadata,
  checkpointReady,
  finalizeCustody,
  saveTransport,
} from "./custody-checkpoint.mjs";
import { requireCustody, validateReceipt } from "./custody-contract.mjs";
import {
  cipherAt,
  commitRecord,
  privateDirectory,
  readRecord,
} from "./custody-files.mjs";
import { readPrivateJson } from "./private-diagnostics.mjs";

export async function custodyStep(mode, env) {
  requireCustody(!env.MODEL_API_KEY && process.platform === "linux");
  const spool = join(env.RUNNER_TEMP, "mmp115-custody"),
    output = join(env.RUNNER_TEMP, "meta-paid-public");
  const expected = {
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    headSha: env.GITHUB_SHA,
  };
  const capture = validateReceipt(
    readRecord(join(spool, "capture.json")),
    expected,
    "CAPTURED_UNVERIFIED",
  );
  cipherAt(join(spool, "candidate.age"), capture);
  if (mode === "capture") {
    const trial = readPrivateJson(join(output, "trial.json")).value;
    requireCustody(
      trial.modelGeneration === "GENERATED" &&
        trial.candidateSha === capture.identity.candidateSha &&
        trial.headSha === capture.identity.headSha &&
        trial.sourceSha === capture.identity.sourceSha &&
        JSON.stringify(trial.custody) === JSON.stringify(capture),
    );
    commitRecord(join(output, "custody-capture.json"), capture);
    return capture;
  }
  if (mode === "finalize") {
    const finalizer = await finalizeCustody(capture.identity);
    commitRecord(join(spool, "finalizer.json"), finalizer);
    commitRecord(join(output, "custody-finalizer.json"), finalizer);
    // Emergency cleanup is useful but must never satisfy checkpoint readiness.
    checkpointReady(capture, finalizer, expected);
    return finalizer;
  }
  const ready = checkpointReady(
    capture,
    readRecord(join(spool, "finalizer.json")),
    expected,
  );
  if (mode === "prepare-upload") {
    const readback = join(env.RUNNER_TEMP, "mmp115-readback");
    privateDirectory(readback, true);
    commitRecord(join(spool, "ready.json"), ready);
    commitRecord(join(output, "custody-checkpoint.json"), ready);
    return ready;
  }
  requireCustody(
    mode === "verify-download" &&
      env.MMP115_UPLOAD_OUTCOME === "success" &&
      env.MMP115_DOWNLOAD_OUTCOME === "success",
  );
  requireCustody(
    JSON.stringify(readRecord(join(spool, "ready.json"))) ===
      JSON.stringify(ready),
  );
  const { artifact, run } = await authenticatedArtifactMetadata(env);
  const ack = {
    artifactId: env.MMP115_ARTIFACT_ID,
    archiveSha256: env.MMP115_ARCHIVE_SHA256,
    uploadOutcome: env.MMP115_UPLOAD_OUTCOME,
    downloadOutcome: env.MMP115_DOWNLOAD_OUTCOME,
  };
  const stored = saveTransport(
    spool,
    ready,
    artifact,
    run,
    ack,
    join(env.RUNNER_TEMP, "mmp115-readback"),
  );
  commitRecord(join(output, "custody-stored.json"), stored);
  return stored;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await custodyStep(process.argv[2], process.env);
    process.stdout.write("CUSTODY_STEP_COMPLETED_UNVERIFIED\n");
  } catch {
    // Independent cleanup still runs when capture failed or its record is missing.
    if (process.argv[2] === "finalize") {
      try {
        await finalizeCustody(null);
      } catch {
        /* original post-Oracle finalizer also remains always() */
      }
    }
    try {
      const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
      mkdirSync(output, { recursive: true, mode: 0o700 });
      commitRecord(join(output, "custody-failure.json"), {
        format: "mmp115-custody-failure-v1",
        state: "NO_GO",
        verification: "UNVERIFIED",
        phase:
          {
            capture: "CAPTURE",
            finalize: "CHECKPOINT",
            "prepare-upload": "UPLOAD_GATE",
            "verify-download": "READBACK",
          }[process.argv[2]] ?? "UNAVAILABLE",
      });
    } catch {
      /* never replace a committed record */
    }
    process.stderr.write("CUSTODY_STEP_FAILED_NO_GO\n");
    process.exitCode = 1;
  }
}
