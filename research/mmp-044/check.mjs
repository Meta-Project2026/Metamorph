// Apply the repository's existing Biome rules explicitly to excluded research JS.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = [
  "check.mjs",
  "config.mjs",
  "driver.mjs",
  "driver.test.mjs",
  "finalize.mjs",
  "public-evidence.mjs",
  "run-public.mjs",
  "verify-public.mjs",
];
for (const name of files) {
  const path = join(root, "research/mmp-044", name);
  const source = readFileSync(path, "utf8");
  const syntax = spawnSync(process.execPath, ["--check", path], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(syntax.status, 0, `${name}: syntax`);
  const lint = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/@biomejs/biome/bin/biome"),
      "check",
      "--write",
      `--stdin-file-path=packages/target-worker/src/mmp044-${name}`,
    ],
    { cwd: root, input: source, encoding: "utf8", windowsHide: true },
  );
  assert.equal(lint.status, 0, `${name}: ${lint.stderr}`);
  assert.equal(
    lint.stdout,
    source,
    `${name}: formatting/import/lint changes required`,
  );
}
console.log(
  `Research syntax, formatting, imports and lint: ${files.length} files PASS`,
);
