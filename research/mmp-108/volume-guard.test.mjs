// MMP-108 shell-level negative controls for harness volume ownership
// (review B2). A stateful stub `docker` on PATH records every invocation; no
// real Docker daemon and no destructive call against real state is involved.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(
  new URL("./harness/volume-guard.sh", import.meta.url),
);

function readLines(path) {
  try {
    return readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// The stub models exactly the surface volume-guard.sh may use: inspect
// (existence and owner label), rm (recorded, state changes so the removed
// volume stops existing), and nothing else. Everything else exits 0.
function stubDocker(root, { existing, labels }) {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const docker = join(bin, "docker");
  const labelCases = Object.entries(labels).map(
    ([name, label]) => `      ${name}) echo "${label}";;`,
  );
  const existingCases = existing.map((name) => `      ${name}) exit 0;;`);
  const knownNames = [...existing, ...Object.keys(labels)].join("|");
  writeFileSync(
    docker,
    [
      "#!/bin/sh",
      "printf '%s\\n' \"$*\" >> calls.log",
      'if [ "$1" = "volume" ] && [ "$2" = "rm" ]; then',
      "  printf '%s\\n' \"$3\" >> removed.log",
      "  exit 0",
      "fi",
      'if [ "$1" = "volume" ] && [ "$2" = "inspect" ]; then',
      '  name=""',
      `  for arg in "$@"; do case "$arg" in ${knownNames}) name="$arg";; esac; done`,
      '  if [ -f removed.log ] && grep -qx "$name" removed.log; then exit 1; fi',
      '  if [ "$3" = "--format" ]; then',
      '    case "$name" in',
      ...labelCases,
      '      *) echo "";;',
      "    esac",
      "    exit 0",
      "  fi",
      '  case "$name" in',
      ...existingCases,
      "    *) exit 1;;",
      "  esac",
      "fi",
      "exit 0",
    ].join("\n"),
  );
  chmodSync(docker, 0o755);
  return {
    path: bin,
    calls: () => readLines(join(root, "calls.log")),
    removed: () => readLines(join(root, "removed.log")),
  };
}

function runGuard(root, stub, args) {
  // The stub dir must precede the real PATH for the shell. On Windows the
  // child PATH stays Windows-style with ";" separators (MSYS sh converts it),
  // which also lets node resolve sh.exe; on POSIX ":" with the stub first.
  const delimiter = process.platform === "win32" ? ";" : ":";
  return spawnSync("sh", [guard, ...args], {
    encoding: "utf8",
    timeout: 30000,
    cwd: root,
    env: {
      PATH: `${stub.path}${delimiter}${process.env.PATH ?? ""}`,
      HOME: root,
    },
  });
}

test("B2: require-free refuses preexisting volumes without any removal", () => {
  const root = mkdtempSync(join(tmpdir(), "mmp108-guard-"));
  try {
    const stub = stubDocker(root, {
      existing: ["owned", "foreign"],
      labels: {},
    });
    const refused = runGuard(root, stub, ["require-free", "owned"]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /VOLUME_COLLISION owned/);
    assert.deepEqual(stub.removed(), []);
    const free = runGuard(root, stub, ["require-free", "fresh-name"]);
    assert.equal(free.status, 0);
    assert.deepEqual(stub.removed(), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("B2: verify-owner and remove-owned refuse volumes not owned by this run", () => {
  const root = mkdtempSync(join(tmpdir(), "mmp108-guard-"));
  try {
    const stub = stubDocker(root, {
      existing: ["owned", "foreign"],
      labels: { owned: "run-abc", foreign: "someone-else" },
    });
    for (const [command, volume] of [
      ["verify-owner", "foreign"],
      ["remove-owned", "foreign"],
    ]) {
      const refused = runGuard(root, stub, [command, volume, "run-abc"]);
      assert.equal(refused.status, 1, `${command} must refuse ${volume}`);
      assert.match(refused.stderr, /VOLUME_NOT_OWNED/);
    }
    assert.deepEqual(stub.removed(), [], "unowned state must never be removed");
    const missingId = runGuard(root, stub, ["remove-owned", "owned"]);
    assert.equal(missingId.status, 1);
    assert.match(missingId.stderr, /RUN_ID_REQUIRED/);
    assert.deepEqual(stub.removed(), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("B2: remove-owned removes exactly the owned volume and verifies removal", () => {
  const root = mkdtempSync(join(tmpdir(), "mmp108-guard-"));
  try {
    const stub = stubDocker(root, {
      existing: ["owned", "foreign"],
      labels: { owned: "run-abc", foreign: "someone-else" },
    });
    const ok = runGuard(root, stub, ["remove-owned", "owned", "run-abc"]);
    assert.equal(ok.status, 0);
    assert.deepEqual(stub.removed(), ["owned"]);
    assert.ok(
      stub.calls().some((line) => /^volume rm owned$/.test(line)),
      "exactly the owned volume must be passed to rm",
    );
    // An unrecognised guard command must fail closed without removing.
    const unknown = runGuard(root, stub, ["destroy", "foreign", "run-abc"]);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /UNKNOWN_COMMAND/);
    assert.deepEqual(stub.removed(), ["owned"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
