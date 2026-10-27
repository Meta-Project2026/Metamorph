// Trusted wrapper: child diagnostics and original smoke receipts remain private.
import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicJson } from "./private-run.mjs";
import { requireCheck } from "./strict.mjs";

process.umask(0o077);
const parent = mkdtempSync(join(tmpdir(), "mmp008b-regressions-"));
const output = process.env.WORKSHOP_PUBLIC_OUTPUT;
mkdirSync(output, { recursive: true });
const results = [];
for (const kind of ["items-smoke", "original-mismatch-pilot"]) {
  const raw = join(parent, kind);
  mkdirSync(raw, { mode: 0o700 });
  const fd = openSync(join(raw, "child.log"), "wx", 0o600);
  let child;
  try {
    child = spawnSync(
      process.execPath,
      [
        kind === "items-smoke"
          ? "packages/target-worker/src/smoke.mjs"
          : "packages/differential/src/pilot.mjs",
      ],
      {
        env: {
          ...process.env,
          TARGET_WORKER_EVIDENCE: raw,
          TARGET_WORKER_HEAD_SHA: process.env.PILOT_HEAD_SHA,
          PILOT_PRIVATE_PARENT: join(parent, "pilot-private"),
          PILOT_PUBLIC_OUTPUT: raw,
        },
        stdio: ["ignore", fd, fd],
        timeout: 14 * 60 * 1000,
        killSignal: "SIGTERM",
      },
    );
  } finally {
    closeSync(fd);
  }
  let passed = false;
  try {
    requireCheck(child.status === 0, "REGRESSION_EXIT");
    const s = JSON.parse(readFileSync(join(raw, "summary.json"), "utf8"));
    if (kind === "items-smoke") {
      requireCheck(
        s.sourceHead === process.env.PILOT_HEAD_SHA &&
          s.procedure === "PASS" &&
          s.cases.length === 30 &&
          s.cases.every((c) => c.cleanupVerified === true),
        "ITEMS_REGRESSION",
      );
      results.push({
        id: kind,
        status: "PASS",
        cases: s.cases.length,
        cleanup: "VERIFIED_ZERO_RESOURCES",
      });
    } else {
      requireCheck(
        s.checkedOutSha === process.env.PILOT_HEAD_SHA &&
          s.cleanup === "VERIFIED_ZERO_RESOURCES" &&
          s.comparisons.http === 0 &&
          s.comparisons.db === 1 &&
          s.gates[0].verdict === "INCONCLUSIVE" &&
          s.gates[1].verdict === "FAIL" &&
          s.gates[2].verdict === "INCONCLUSIVE" &&
          JSON.stringify(s.initialDifferenceCodes) ===
            JSON.stringify(["DB_SCHEMA", "DB_STATE"]),
        "NEGATIVE_REGRESSION",
      );
      results.push({
        id: kind,
        status: "PASS",
        G2: "INCONCLUSIVE",
        G3: "FAIL",
        G4: "INCONCLUSIVE",
        httpComparisons: 0,
        initialDbComparisons: 1,
        differenceCodes: ["DB_SCHEMA", "DB_STATE"],
        cleanup: "VERIFIED_ZERO_RESOURCES",
      });
    }
    passed = true;
  } catch {
    results.push({ id: kind, status: "ERROR" });
  }
  if (!passed) process.exitCode = 1;
  console.log(`${kind}: ${passed ? "PASS" : "ERROR"}`);
}
atomicJson(
  join(output, "regressions.json"),
  {
    headSha: process.env.PILOT_HEAD_SHA,
    results,
    externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
  },
  0o644,
);
