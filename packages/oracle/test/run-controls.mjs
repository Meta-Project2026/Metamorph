import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { verifyPair } from "../dist/index.js";
import { createFixture, scenarios } from "./fixtures.mjs";

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
if (args.length > 1) throw new Error("Expected one evidence output directory");
const output = resolve(args[0] ?? "../../.oracle-evidence");
await mkdir(output, { recursive: true });
const results = [];
for (const [mutant, expected] of [
  ["none", "PASS"],
  ["http-status", "FAIL"],
  ["http-type", "FAIL"],
  ["db-row", "FAIL"],
  ["db-sequence", "FAIL"],
  ["snapshot-error", "ERROR"],
]) {
  const work = await mkdtemp(`${tmpdir()}/metamorph-public-`);
  let reference;
  let candidate;
  try {
    reference = await createFixture(work, "reference");
    candidate = await createFixture(work, "candidate", mutant);
    const result = await verifyPair({
      reference,
      candidate,
      scenarios,
      artifactParent: output,
      operationTimeoutMs: 2000,
    });
    const verdict = result.gateResults.find(
      (gate) => gate.gate === "G3",
    ).verdict;
    assert.equal(verdict, expected, mutant);
    results.push({
      mutant,
      expected,
      actual: verdict,
      evidenceDirectory: result.evidenceDirectory,
    });
  } finally {
    await reference?.close();
    await candidate?.close();
    await rm(work, { recursive: true, force: true });
  }
}
await writeFile(
  resolve(output, "summary.json"),
  `${JSON.stringify({ scope: "original-public-synthetic-controls", productVerdict: "NOT_RUN", results }, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
