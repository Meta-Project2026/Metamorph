import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  capsuleFromLease,
  requireCustody,
  validateReceipt,
} from "./custody-contract.mjs";
import { cipherAt, readRecord } from "./custody-files.mjs";

export async function captureLease(token, lease, receipt, signal, attempt = 1) {
  const capsule = await capsuleFromLease(token, lease, receipt, attempt),
    env = process.env;
  requireCustody(
    process.platform === "linux" &&
      capsule.identity.runId === env.GITHUB_RUN_ID &&
      capsule.identity.headSha === env.GITHUB_SHA &&
      env.GITHUB_RUN_ATTEMPT === "1" &&
      (attempt === 1 || attempt === 2),
  );
  const plaintext = Buffer.from(JSON.stringify(capsule));
  try {
    signal.throwIfAborted();
    const spool = `mmp115-custody${attempt === 2 ? "-repair" : ""}`;
    const ok = await new Promise((resolveResult) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL("./custody-collector.mjs", import.meta.url))],
        {
          cwd: "/",
          shell: false,
          stdio: ["pipe", "ignore", "pipe"],
          env: {
            PATH: "/usr/local/bin:/usr/bin:/bin",
            HOME: "/nonexistent",
            TZ: "UTC",
            RUNNER_TEMP: env.RUNNER_TEMP,
            GITHUB_RUN_ID: env.GITHUB_RUN_ID,
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_SHA: env.GITHUB_SHA,
            MMP115_SPOOL: spool,
          },
        },
      );
      let failed = false,
        bytes = 0;
      const stop = () => {
        failed = true;
        child.kill("SIGTERM");
      };
      const timer = setTimeout(stop, 45000),
        kill = setTimeout(() => {
          failed = true;
          child.kill("SIGKILL");
        }, 85000);
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
      child.stderr.on("data", (b) => {
        bytes += b.length;
        if (bytes > 4096) stop();
      });
      child.on("error", () => {
        failed = true;
      });
      child.stdin.on("error", () => {
        failed = true;
      });
      child.on("close", (code, term) => {
        clearTimeout(timer);
        clearTimeout(kill);
        signal.removeEventListener("abort", stop);
        resolveResult(!failed && code === 0 && !term);
      });
      child.stdin.end(plaintext);
    });
    requireCustody(ok && !signal.aborted);
    await lease.assertUnchanged();
    const spoolPath = join(env.RUNNER_TEMP, spool);
    const record = validateReceipt(
      readRecord(join(spoolPath, "capture.json")),
      capsule.identity,
      "CAPTURED_UNVERIFIED",
    );
    cipherAt(join(spoolPath, "candidate.age"), record);
    return record;
  } finally {
    plaintext.fill(0);
  }
}
