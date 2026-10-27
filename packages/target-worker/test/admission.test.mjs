import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { encode } from "../runtime/sqlite-value.mjs";
import { admitDirectory, sha256, validateBundle } from "../src/admission.mjs";
import {
  parseObservation,
  sandboxArgs,
  TargetWorker,
} from "../src/controller.mjs";

const source = (path = "src/main.ts", content = "export const n = 1;") => ({
  path,
  content,
  sha256: sha256(content),
});
test("SQLite scalar serialization never silently turns nonfinite REAL into null", () => {
  assert.deepEqual(encode(9223372036854775807n), {
    type: "integer",
    value: "9223372036854775807",
  });
  assert.deepEqual(encode(new Uint8Array([0, 255])), {
    type: "blob",
    value: "00ff",
  });
  for (const invalid of [Infinity, -Infinity, NaN, undefined, {}])
    assert.throws(() => encode(invalid), /UNREPRESENTABLE_SQLITE_VALUE/);
});
test("canonical source hashes bind exact bytes and reject wrong hash", () => {
  const bundle = validateBundle([source()]);
  assert.equal(
    validateBundle(bundle.files, bundle.candidateSha).candidateSha,
    bundle.candidateSha,
  );
  assert.throws(
    () => validateBundle(bundle.files, "0".repeat(64)),
    /ADMISSION_REJECTED/,
  );
  assert.throws(
    () => validateBundle([{ ...source(), content: "changed" }]),
    /ADMISSION_REJECTED/,
  );
});
test("traversal, manifests, scripts, protected names, aliases and limits fail closed", () => {
  for (const path of [
    "../main.ts",
    "src/../main.ts",
    "src\\main.ts",
    "/src/main.ts",
    "src/main.ts:stream",
    "package.json",
    "Dockerfile",
    "pnpm-lock.yaml",
    "postinstall.sh",
    "src/reference.ts",
    "src/oracle/worker.ts",
    "src/nul.ts",
    "src/test/a.ts",
  ])
    assert.throws(
      () => validateBundle([source(path)]),
      /ADMISSION_REJECTED/,
      path,
    );
  assert.throws(
    () => validateBundle([source(), source("src/Main.ts")]),
    /ADMISSION_REJECTED/,
  );
  assert.throws(
    () => validateBundle([source("src/main.ts", "x".repeat(256 * 1024 + 1))]),
    /ADMISSION_REJECTED/,
  );
  assert.throws(
    () => validateBundle([{ ...source(), command: "npm install" }]),
    /ADMISSION_REJECTED/,
  );
});
test("filesystem admission rejects hardlinks, symlinks/junctions and forbidden roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "mmp007-admission-"));
  try {
    await mkdir(join(root, "src"));
    const entry = join(root, "src/main.ts");
    await writeFile(entry, source().content);
    assert.equal((await admitDirectory(root)).files.length, 1);
    await link(entry, join(root, "src/alias.ts"));
    await assert.rejects(admitDirectory(root), /ADMISSION_REJECTED/);
    await rm(join(root, "src/alias.ts"));
    const external = await mkdtemp(join(tmpdir(), "mmp007-link-"));
    try {
      await symlink(
        external,
        join(root, "src/linked"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await assert.rejects(admitDirectory(root), /ADMISSION_REJECTED/);
      await rm(join(root, "src/linked"));
    } finally {
      await rm(external, { recursive: true, force: true });
    }
    await writeFile(
      join(root, "package.json"),
      '{"scripts":{"postinstall":"bad"}}',
    );
    await assert.rejects(admitDirectory(root), /ADMISSION_REJECTED/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("missing/corrupt HTTP, wrong DB source and malformed observations never pass", () => {
  const result = (value) => ({ exitCode: 0, stdout: JSON.stringify(value) });
  for (const value of [
    null,
    {},
    { status: 200, bodyBase64: "!", headers: {}, requestId: "a" },
  ])
    assert.throws(() => parseObservation(result(value), "http"));
  for (const value of [
    {},
    {
      format: "target-worker-sqlite-v1-proposed",
      source: "/reference/db.sqlite",
      schema: [],
      tables: [],
    },
  ])
    assert.throws(() => parseObservation(result(value), "snapshot"));
  assert.throws(
    () => parseObservation({ exitCode: 0, stdout: "not JSON" }, "http"),
    /OBSERVATION_ERROR/,
  );
  assert.throws(
    () =>
      parseObservation({ exitCode: 0, stdout: "{}", timedOut: true }, "http"),
    /TIMEOUT/,
  );
  assert.throws(
    () =>
      parseObservation({ exitCode: 0, stdout: "{}", cancelled: true }, "http"),
    /CANCELLED/,
  );
});
test("fixed policy has no host mounts, ports, privileges or mutable candidate flags", () => {
  const args = sandboxArgs("test");
  for (const required of [
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "no-new-privileges",
    "--memory",
    "--pids-limit",
    "--cpus",
  ])
    assert.ok(args.includes(required));
  for (const prohibited of [
    "--privileged",
    "--publish",
    "--volume",
    "--env-file",
    "--pid",
  ])
    assert.ok(!args.includes(prohibited));
  assert.throws(
    () => new TargetWorker("node:latest", validateBundle([source()])),
    /ADMISSION_REJECTED/,
  );
});
test("cleanup timeout fault cannot become PASS and force removal still runs", async () => {
  const worker = new TargetWorker(
    { imageId: `sha256:${"a".repeat(64)}` },
    validateBundle([source()]),
    "real",
    { trustedTest: { command: async () => ({ exitCode: 0, stdout: "" }) } },
  );
  worker.runtime = { name: "fault-runtime" };
  worker.containers.add("fault-runtime");
  worker.volumes.add("fault-volume");
  const calls = [];
  // Explicit trusted controller fault injection, not claimed as a Docker execution.
  worker.cmd = async (args) => {
    calls.push(args);
    return args[0] === "stop"
      ? { exitCode: null, timedOut: true }
      : { exitCode: 0 };
  };
  await assert.rejects(worker.close(), /CLEANUP_ERROR/);
  assert.ok(
    calls.some((args) => args.join(" ") === "rm --force fault-runtime"),
  );
  assert.ok(calls.some((args) => args.join(" ") === "volume rm fault-volume"));
  assert.equal(worker.evidence.cleanupVerified, false);
});
