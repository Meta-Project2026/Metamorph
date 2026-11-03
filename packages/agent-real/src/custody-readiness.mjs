// Credential-free pre-send custody readiness probe. Read-only: verifies the
// pinned age tool, the encrypt worker file, the Docker daemon and the pinned
// encryptor image BEFORE any paid request, so environmental custody failures
// cost nothing. Fixed allowlisted verdicts only; no error text, paths beyond
// the checked constants, credentials or candidate bytes ever surface. The
// verdict grants nothing by itself — capture keeps every existing gate.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { diagnosticCommand } from "./encrypt-diagnostics.mjs";

export const CUSTODY_READINESS = Object.freeze([
  "READY",
  "AGE_TOOL_MISSING",
  "AGE_TOOL_HASH_MISMATCH",
  "ENCRYPT_WORKER_MISSING",
  "DOCKER_UNAVAILABLE",
  "ENCRYPT_IMAGE_MISSING",
  "PROBE_ERROR",
]);

function sha256File(path) {
  const st = statSync(path);
  if (!st.isFile() || st.size <= 0 || st.size > 16 * 1024 * 1024)
    throw new Error("BAD_TOOL_FILE");
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Verdict is evidence for the operator and the pre-send gate in paid-run;
 * it never grants custody, Oracle access or product standing. runDocker is
 * injectable for offline tests; production uses the pinned diagnostic
 * command path. */
export async function custodyReadiness({
  agePath,
  workerPath,
  image,
  expectedAgeSha256,
  runDocker = (args) => diagnosticCommand(args, { timeoutMs: 15000 }),
}) {
  try {
    if (!existsSync(agePath)) return "AGE_TOOL_MISSING";
    if (sha256File(agePath) !== expectedAgeSha256)
      return "AGE_TOOL_HASH_MISMATCH";
    if (!existsSync(workerPath)) return "ENCRYPT_WORKER_MISSING";
    const daemon = await runDocker([
      "version",
      "--format",
      "{{.Server.Version}}",
    ]);
    if (!daemon.ok) return "DOCKER_UNAVAILABLE";
    const imagePresent = await runDocker(["image", "inspect", image]);
    if (!imagePresent.ok) return "ENCRYPT_IMAGE_MISSING";
    return "READY";
  } catch {
    return "PROBE_ERROR";
  }
}
