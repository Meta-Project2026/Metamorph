// Parse only: never import or execute a research entrypoint.
import { spawnSync } from "node:child_process";
import { ROOT, validate } from "./validate.mjs";

const { syntaxFiles } = validate();
let failed = 0;
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT,
    timeout: 10000,
    maxBuffer: 65536,
    encoding: "utf8",
  });
  if (result.status !== 0) failed++;
}
console.log(
  JSON.stringify({
    status: failed ? "FAIL" : "PASS",
    checked: syntaxFiles.length,
    failed,
    scope: "syntax only; modules never executed",
  }),
);
process.exitCode = failed ? 1 : 0;
