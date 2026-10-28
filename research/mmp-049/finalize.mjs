// Independent process: only explicit per-stage owned resource ledgers are used.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { atomic, finalize } from "../mmp-044/finalize.mjs";

const output = process.env.MMP049_OUTPUT;
mkdirSync(output, { recursive: true });
const stages = [];
for (const [name, parent] of [
  ["probe", process.env.MMP049_PROBE_PARENT],
  ["proof", process.env.MMP049_PROOF_PARENT],
  ["agent", process.env.MMP049_AGENT_PARENT],
]) {
  if (!parent) continue;
  try {
    stages.push({ name, ...(await finalize(parent)) });
  } catch {
    stages.push({ name, status: "ERROR", inventory: null });
  }
}
const status =
  stages.length > 0 && stages.every((s) => s.status === "PASS")
    ? "PASS"
    : "ERROR";
atomic(join(output, "finalizer.json"), {
  headSha: process.env.MMP049_HEAD_SHA,
  status,
  stages,
});
if (!existsSync(join(output, "summary.json")))
  atomic(join(output, "summary.json"), {
    headSha: process.env.MMP049_HEAD_SHA,
    harness: "ERROR",
    parity: "INCONCLUSIVE",
    errorCode: "NO_PROOF_COMPLETION_RECEIPT",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
  });
console.log(`Independent finalizer: ${status}`);
if (status !== "PASS") process.exitCode = 1;
