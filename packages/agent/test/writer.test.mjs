import assert from "node:assert/strict";
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { createCandidateWriter, SourceChangesSchema } from "../dist/index.js";

const parent = mkdtempSync(join(tmpdir(), "metamorph-agent-test-"));
after(() => {
  // Verify the absolute recursive cleanup target stays in this named temp area.
  assert.equal(dirname(resolve(parent)), resolve(tmpdir()));
  assert.ok(basename(parent).startsWith("metamorph-agent-test-"));
  rmSync(parent, { recursive: true, force: true });
});
const signal = () => new AbortController().signal;
const edit = (path, content = "inert source text") => [{ path, content }];

test("writer allocates fresh roots, writes source text and truncates old contents", async () => {
  const first = createCandidateWriter(parent);
  const second = createCandidateWriter(parent);
  assert.notEqual(first.root, second.root);
  assert.equal(dirname(first.root), parent);
  await first.write(edit("src/nested/unit.ts", "long old content"), signal());
  await first.write(edit("src/nested/unit.ts", "x"), signal());
  assert.equal(
    readFileSync(join(first.root, "src/nested/unit.ts"), "utf8"),
    "x",
  );
  assert.deepEqual(readdirSync(join(second.root, "src")), []);
});

test("all unsafe paths and protected names are rejected before any file write", async () => {
  const writer = createCandidateWriter(parent);
  for (const path of [
    "../reference.ts",
    "/tmp/file.ts",
    "C:/outside.ts",
    "C:\\outside.ts",
    "src/../oracle.ts",
    "src\\unit.ts",
    "src//unit.ts",
    "src/%2e%2e/a.ts",
    ".github/workflows/ci.yml",
    "AGENTS.md",
    "src/.policy.ts",
    "src/unit.ts:stream",
    "src/Oracle/a.ts",
    "src/held-out/a.ts",
    "src/reference.ts",
    "src/fixtures.ts",
    "src/tests/a.ts",
    "src/policy.ts",
    "src/specs/a.ts",
    "src/ci.ts",
    "src/con.ts",
    "src/COM1.ts",
    "src/unit.js",
    "src/a.ts/other.ts",
  ]) {
    await assert.rejects(
      writer.write(
        [{ path: "src/valid.ts", content: "must not write" }, ...edit(path)],
        signal(),
      ),
    );
  }
  assert.deepEqual(readdirSync(join(writer.root, "src")), []);
  assert.equal(
    SourceChangesSchema.safeParse([
      ...edit("src/unit.ts"),
      ...edit("src/UNIT.ts"),
    ]).success,
    false,
  );
});

test("directory symlink/junction cannot redirect writes outside candidate", async () => {
  const writer = createCandidateWriter(parent);
  const outside = join(parent, "reference");
  mkdirSync(outside);
  writeFileSync(join(outside, "keep.ts"), "reference bytes");
  symlinkSync(
    outside,
    join(writer.root, "src", "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    writer.write(edit("src/linked/keep.ts", "corrupt"), signal()),
  );
  assert.equal(
    readFileSync(join(outside, "keep.ts"), "utf8"),
    "reference bytes",
  );
});

test("hardlinked files cannot overwrite external reference bytes", async () => {
  const writer = createCandidateWriter(parent);
  const reference = join(parent, "reference.ts");
  writeFileSync(reference, "original reference");
  linkSync(reference, join(writer.root, "src", "linked.ts"));
  await assert.rejects(
    writer.write(edit("src/linked.ts", "corrupt"), signal()),
  );
  assert.equal(readFileSync(reference, "utf8"), "original reference");
});

test("aborted writes do not mutate source", async () => {
  const writer = createCandidateWriter(parent);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(writer.write(edit("src/unit.ts"), controller.signal));
  assert.deepEqual(readdirSync(join(writer.root, "src")), []);
});
