// Explicit lint for research files outside the root Biome includes.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = join(root, "research/mmp-049");
const files = readdirSync(directory).filter((name) => name.endsWith(".mjs"));
for (const name of files) {
  const path = join(directory, name);
  const source = readFileSync(path, "utf8");
  const syntax = spawnSync(process.execPath, ["--check", path], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(syntax.status, 0, `${name}: ${syntax.stderr}`);
  const lint = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/@biomejs/biome/bin/biome"),
      "check",
      "--write",
      `--stdin-file-path=packages/target-worker/src/mmp049-${name}`,
    ],
    { cwd: root, input: source, encoding: "utf8", windowsHide: true },
  );
  assert.equal(lint.status, 0, `${name}: ${lint.stderr}`);
  if (process.argv.includes("--fix")) writeFileSync(path, lint.stdout);
  else
    assert.equal(
      lint.stdout,
      source,
      `${name}: formatting/import/lint changes required`,
    );
}
console.log(`MMP-049 research syntax/lint: ${files.length} files PASS`);
