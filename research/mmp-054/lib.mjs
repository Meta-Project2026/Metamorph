// Trusted host infrastructure only. No application source is imported or executed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = realpathSync(
  fileURLToPath(new URL("../../", import.meta.url)),
);
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (path) => JSON.parse(readFileSync(path, "utf8"));
export const write = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
export const PUBLIC = [
  "summary.json",
  "semantics.json",
  "agent.json",
  "finalizer.json",
];
export const ROLES = [
  "php-probe",
  "node-probe",
  "php-reference",
  "php-inspector",
  "ts-build",
  "ts-runtime",
  "ts-inspector",
  "ts-provenance",
];
export function run(executable, args, options = {}) {
  const r = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 300000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
  assert.equal(r.error, undefined, `PROCESS_ERROR:${r.error?.code}`);
  assert.equal(r.signal, null, "PROCESS_SIGNAL");
  assert.equal(r.status, 0, `PROCESS_EXIT:${executable}:${r.status}`);
  return r.stdout.trim();
}
export const git = (...args) => run("git", args);
export function outside(path) {
  assert.ok(isAbsolute(path), "ABSOLUTE_PATH_REQUIRED");
  const p = resolve(path);
  const rel = relative(root, p);
  assert.ok(
    rel.startsWith("..") || isAbsolute(rel),
    "OUTPUT_MUST_BE_OUTSIDE_CHECKOUT",
  );
  assert.ok(!p.includes(","), "DOCKER_BIND_PATH");
  return p;
}
export function assertHead(head) {
  assert.match(head, /^[a-f0-9]{40}$/);
  assert.equal(git("rev-parse", "HEAD"), head, "WRONG_SHA");
  assert.equal(
    git("status", "--porcelain", "--untracked-files=normal"),
    "",
    "DIRTY_CHECKOUT",
  );
}
export function tree(directory) {
  const result = {};
  function walk(path, name) {
    const st = lstatSync(path);
    if (st.isSymbolicLink()) result[name] = { link: readlinkSync(path) };
    else if (st.isDirectory())
      for (const n of readdirSync(path).sort())
        walk(join(path, n), name ? `${name}/${n}` : n);
    else {
      assert.ok(st.isFile(), "NONREGULAR_ARTIFACT");
      result[name] = { bytes: st.size, sha256: sha(readFileSync(path)) };
    }
  }
  walk(directory, "");
  return result;
}
export function generated() {
  const result = {};
  for (const group of ["apps", "packages"])
    for (const name of readdirSync(join(root, group)).sort()) {
      const path = join(root, group, name, "dist");
      try {
        result[`${group}/${name}/dist`] = tree(path);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  return result;
}
export function dependencies() {
  const result = { node_modules: tree(join(root, "node_modules")) };
  for (const group of ["apps", "packages"])
    for (const name of readdirSync(join(root, group)).sort()) {
      const key = `${group}/${name}/node_modules`;
      try {
        result[key] = tree(join(root, key));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  return result;
}
export function validateBundle(bundle, head) {
  assert.equal(bundle.format, "mmp054-prepared-v1");
  assert.equal(bundle.headSha, head, "WRONG_SHA");
  assert.equal(bundle.platform, "linux/amd64");
  assert.equal(bundle.node, process.version, "TOOLCHAIN_DRIFT");
  assert.equal(bundle.pnpmVersion, "11.25.0");
  assert.ok(isAbsolute(bundle.pnpm), "PACKAGE_MANAGER_PATH");
  assert.match(bundle.source.archiveSha256, /^[a-f0-9]{64}$/);
  assert.match(bundle.source.image, /@sha256:[a-f0-9]{64}$/);
  assert.match(bundle.images.node.ref, /@sha256:[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(bundle.images).sort(), [
    "node",
    "php",
    "phpRuntime",
    "targetRuntime",
  ]);
  for (const image of Object.values(bundle.images)) {
    assert.match(image.id, /^sha256:[a-f0-9]{64}$/, "WRONG_IMAGE_DIGEST");
    assert.equal(image.arch, "amd64");
    assert.equal(image.os, "linux");
    assert.ok(Number.isSafeInteger(image.bytes) && image.bytes > 0);
  }
  for (const name of ["source.tgz", "images.tar"]) {
    assert.match(bundle.artifacts[name].sha256, /^[a-f0-9]{64}$/);
    assert.ok(bundle.artifacts[name].bytes > 0);
  }
  assert.ok(Object.keys(bundle.dependencies).length > 0, "PREFETCH_MISSING");
  assert.ok(Object.keys(bundle.store).length > 0, "PREFETCH_MISSING");
  assert.ok(Object.keys(bundle.compiled).length > 0, "PREFETCH_MISSING");
  assert.deepEqual(Object.keys(bundle.toolchain).sort(), [
    "docker",
    "git",
    "node",
    "pnpm",
  ]);
  for (const tool of Object.values(bundle.toolchain)) {
    assert.ok(isAbsolute(tool.path));
    assert.match(tool.sha256, /^[a-f0-9]{64}$/);
    assert.ok(tool.bytes > 0);
  }
}
export function artifact(path) {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  const fd = openSync(path, "r");
  let bytes = 0;
  try {
    for (;;) {
      const n = readSync(fd, buffer);
      if (!n) break;
      bytes += n;
      hash.update(buffer.subarray(0, n));
    }
  } finally {
    closeSync(fd);
  }
  return { bytes, sha256: hash.digest("hex") };
}
export function checkPrepared(directory, head, docker) {
  const b = json(join(directory, "prepared.json"));
  validateBundle(b, head);
  assertHead(head);
  for (const [name, value] of Object.entries(b.artifacts)) {
    assert.ok(
      ["source.tgz", "images.tar"].includes(name),
      "UNEXPECTED_ARTIFACT",
    );
    assert.deepEqual(artifact(join(directory, name)), value, "PREFETCH_DIGEST");
  }
  assert.equal(
    sha(readFileSync(join(directory, "source.tgz"))),
    b.source.archiveSha256,
  );
  assert.equal(sha(readFileSync(join(root, "pnpm-lock.yaml"))), b.lockSha256);
  assert.deepEqual(dependencies(), b.dependencies, "DEPENDENCY_DRIFT");
  assert.deepEqual(tree(join(directory, "store")), b.store, "PREFETCH_MISSING");
  assert.deepEqual(generated(), b.compiled, "COMPILED_DRIFT");
  assert.equal(run(b.pnpm, ["--version"]), b.pnpmVersion);
  assert.equal(b.pnpm, b.toolchain.pnpm.path, "TOOLCHAIN_PATH_DRIFT");
  assert.equal(process.execPath, b.toolchain.node.path, "TOOLCHAIN_PATH_DRIFT");
  assert.equal(docker, b.toolchain.docker.path, "TOOLCHAIN_PATH_DRIFT");
  assert.equal(
    run("/usr/bin/which", ["git"]),
    b.toolchain.git.path,
    "TOOLCHAIN_PATH_DRIFT",
  );
  for (const tool of Object.values(b.toolchain))
    assert.deepEqual(
      artifact(tool.path),
      { bytes: tool.bytes, sha256: tool.sha256 },
      "TOOLCHAIN_DRIFT",
    );
  for (const image of Object.values(b.images)) {
    const actual = JSON.parse(run(docker, ["image", "inspect", image.id]))[0];
    assert.equal(actual.Id, image.id, "WRONG_IMAGE_DIGEST");
    assert.equal(actual.Architecture, image.arch);
    assert.equal(actual.Os, image.os);
  }
  return b;
}
