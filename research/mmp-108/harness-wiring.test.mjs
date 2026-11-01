// MMP-108 harness wiring and lifecycle negative controls (re-review B4/B5/B6).
// Static assertions verify entrypoint/build/launch wiring; the run-host
// lifecycle is exercised against a stateful stub `docker` on PATH — no real
// daemon and no destructive call against real state is involved.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
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

const harnessDir = fileURLToPath(new URL("./harness/", import.meta.url));
// Windows working trees may hold CRLF via autocrlf; git clones (what the
// container consumes) are LF. Normalize so assertions and sandbox copies see
// the same bytes a Linux checkout would.
const readHarness = (name) =>
  readFileSync(join(harnessDir, name), "utf8").replaceAll("\r\n", "\n");

test("B4: Dockerfile explicitly names the mmp108-run entrypoint and guard", () => {
  const dockerfile = readHarness("Dockerfile");
  assert.match(
    dockerfile,
    /^COPY run-inner\.sh \/usr\/local\/bin\/mmp108-run$/m,
  );
  assert.match(
    dockerfile,
    /^COPY volume-guard\.sh \/usr\/local\/bin\/volume-guard\.sh$/m,
  );
  assert.match(
    dockerfile,
    /chmod 0755 \/usr\/local\/bin\/mmp108-run \/usr\/local\/bin\/volume-guard\.sh/,
  );
});

test("B4: run-host builds the exact image before provisioning and runs that tag", () => {
  const script = readHarness("run-host.sh");
  const buildAt = script.indexOf("docker build");
  const createAt = script.indexOf("docker volume create");
  assert.ok(buildAt >= 0, "run-host.sh must build the harness image");
  assert.ok(
    buildAt < createAt,
    "the fresh build must precede any volume provisioning",
  );
  assert.match(script, /IMAGE_TAG="metamorph-mmp108-harness:\$RUN_ID"/);
  assert.match(script, /-f "\$\(dirname "\$0"\)\/Dockerfile" -t "\$IMAGE_TAG"/);
  // The primary run executes the freshly built tag, never a bare stale name.
  const runLines = script
    .split("\n")
    .filter((line) => line.includes("docker run"));
  assert.equal(runLines.length, 1);
  assert.match(runLines[0], /if docker run /);
  assert.match(script, /"\$IMAGE_TAG" mmp108-run/);
  assert.ok(
    !runLines[0].includes("metamorph-mmp108-harness:"),
    "primary run must not use a fixed stale tag",
  );
  // Windows Git-Bash conversion must stay enabled for the repository mount.
  assert.ok(!runLines[0].includes("MSYS_NO_PATHCONV"));
});

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "mmp108-host-"));
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  for (const name of ["run-host.sh", "volume-guard.sh"]) {
    writeFileSync(join(root, name), readHarness(name));
  }
  return { root, bin };
}

// Stateful stub docker: models volume inspect (existence + owner label from
// real create calls), create (scenario-controlled failure), rm (recorded),
// build and run (scenario-controlled exit). Everything is logged to files in
// the sandbox; no real daemon is contacted.
function stubDocker(sandboxRoot) {
  writeFileSync(
    join(sandboxRoot, "bin", "docker"),
    [
      "#!/bin/sh",
      "printf '%s\\n' \"$*\" >> calls.log",
      'if [ "$1" = "volume" ] && [ "$2" = "create" ]; then',
      '  name=""',
      '  for arg in "$@"; do case "$arg" in mmp108-*) name="$arg";; esac; done',
      '  if [ "$MMP108_TEST_SCENARIO" = "partial-create" ] && [ "$name" = "mmp108-private" ]; then exit 1; fi',
      '  label=""',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: POSIX parameter expansion inside a generated shell script
      '  for arg in "$@"; do case "$arg" in metamorph.mmp108.run=*) label="${arg#metamorph.mmp108.run=}";; esac; done',
      '  printf \'%s %s\\n\' "$name" "$label" >> created.log',
      "  exit 0",
      "fi",
      'if [ "$1" = "volume" ] && [ "$2" = "rm" ]; then',
      "  printf '%s\\n' \"$3\" >> removed.log",
      "  exit 0",
      "fi",
      'if [ "$1" = "volume" ] && [ "$2" = "inspect" ]; then',
      '  name=""',
      '  for arg in "$@"; do case "$arg" in mmp108-*) name="$arg";; esac; done',
      '  if [ -f removed.log ] && grep -qx "$name" removed.log; then exit 1; fi',
      '  if [ -f created.log ] && grep -q "^$name " created.log; then',
      '    if [ "$3" = "--format" ]; then',
      '      grep "^$name " created.log | head -n 1 | cut -d " " -f 2',
      "    else",
      "      exit 0",
      "    fi",
      "    exit 0",
      "  fi",
      '  if [ "$MMP108_TEST_SCENARIO" = "foreign" ] && [ "$name" = "mmp108-work" ]; then exit 0; fi',
      "  exit 1",
      "fi",
      'if [ "$1" = "build" ]; then',
      '  if [ "$MMP108_TEST_SCENARIO" = "build-fail" ]; then exit 1; fi',
      "  exit 0",
      "fi",
      'if [ "$1" = "run" ]; then',
      '  if [ "$MMP108_TEST_SCENARIO" = "driver-fail" ]; then exit 1; fi',
      "  exit 0",
      "fi",
      'if [ "$1" = "create" ]; then',
      '  if [ "$MMP108_TEST_SCENARIO" = "create-fail" ]; then exit 1; fi',
      '  name=""',
      "  take_next=0",
      '  for arg in "$@"; do',
      '    if [ "$take_next" = "1" ]; then name="$arg"; take_next=0; fi',
      '    if [ "$arg" = "--name" ]; then take_next=1; fi',
      "  done",
      "  printf '%s\\n' \"$name\" >> containers-created.log",
      "  exit 0",
      "fi",
      'if [ "$1" = "cp" ]; then',
      '  if [ "$MMP108_TEST_SCENARIO" = "cp-fail" ]; then exit 1; fi',
      "  exit 0",
      "fi",
      'if [ "$1" = "rm" ]; then',
      "  printf '%s\\n' \"$2\" >> containers-removed.log",
      "  exit 0",
      "fi",
      'if [ "$1" = "container" ] && [ "$2" = "inspect" ]; then',
      '  if [ -f containers-created.log ] && grep -qx "$3" containers-created.log; then',
      '    if [ -f containers-removed.log ] && grep -qx "$3" containers-removed.log; then exit 1; fi',
      "    exit 0",
      "  fi",
      "  exit 1",
      "fi",
      "exit 0",
    ].join("\n"),
  );
  chmodSync(join(sandboxRoot, "bin", "docker"), 0o755);
}

function readLines(root, name) {
  try {
    return readFileSync(join(root, name), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function runHost(sandboxRoot) {
  stubDocker(sandboxRoot);
  const delimiter = process.platform === "win32" ? ";" : ":";
  return spawnSync("sh", [join(sandboxRoot, "run-host.sh")], {
    encoding: "utf8",
    timeout: 120000,
    cwd: sandboxRoot,
    env: {
      PATH: `${join(sandboxRoot, "bin")}${delimiter}${process.env.PATH ?? ""}`,
      HOME: sandboxRoot,
      AGENT_HEAD_SHA: "abcdef1234567890abcdef1234567890abcdef12",
      MMP108_TEST_SCENARIO: process.env.MMP108_TEST_SCENARIO ?? "",
      MSYS_NO_PATHCONV: process.env.MSYS_NO_PATHCONV ?? "",
    },
  });
}

const removedVolumes = (root) =>
  readLines(root, "removed.log").map((line) => line.split(" ").pop());
const removedContainers = (root) => readLines(root, "containers-removed.log");

test("B5/B6: successful run copies receipts to a unique dir and removes owned volumes", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "happy";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(removedVolumes(sandboxRoot).sort(), [
      "mmp108-output",
      "mmp108-private",
      "mmp108-work",
    ]);
    const calls = readLines(sandboxRoot, "calls.log").join("\n");
    assert.match(
      calls,
      /cp mmp108-receipts-[^ ]*:\/o\/\./,
      `receipts must be copied after success\nstatus=${child.status}\nstderr=${child.stderr}\ncalls=${calls}`,
    );
    // Run-scoped unique container name; never the old fixed name.
    assert.ok(!calls.includes("--name mmp108-receipts "));
    const receiptsName = readLines(sandboxRoot, "containers-created.log")[0];
    assert.match(receiptsName, /^mmp108-receipts-mmp108-/);
    assert.deepEqual(removedContainers(sandboxRoot), [receiptsName]);
    const stdout = child.stdout ?? "";
    assert.match(stdout, /local-abcdef12-mmp108-/);
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("B5: driver failure leaves no receipt copy and still removes owned volumes", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "driver-fail";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 1);
    const calls = readLines(sandboxRoot, "calls.log").join("\n");
    assert.ok(
      !calls.includes("mmp108-receipts"),
      "failed runs must not publish receipts",
    );
    assert.deepEqual(removedVolumes(sandboxRoot).sort(), [
      "mmp108-output",
      "mmp108-private",
      "mmp108-work",
    ]);
    assert.ok(
      !existsSync(join(sandboxRoot, "research")),
      "no evidence dir on failure",
    );
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("B5: partial volume-create failure removes already-created volumes only", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "partial-create";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 1);
    const created = readLines(sandboxRoot, "created.log");
    assert.equal(created.length, 1, "only mmp108-work must be created");
    assert.deepEqual(removedVolumes(sandboxRoot), ["mmp108-work"]);
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("B2/B5: preexisting foreign volume refuses the run and removes nothing", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "foreign";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 1);
    assert.match(child.stderr, /VOLUME_COLLISION mmp108-work/);
    assert.deepEqual(removedVolumes(sandboxRoot), []);
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("B4: a failed fresh build never provisions or removes any volume", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "build-fail";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 1);
    assert.deepEqual(removedVolumes(sandboxRoot), []);
    assert.equal(readLines(sandboxRoot, "created.log").length, 0);
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("B5: cp failure after successful create removes the receipt container before volumes", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "cp-fail";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 1, child.stderr);
    // The uniquely named receipt container was created, then removed exactly
    // once by the exit-path cleanup — never left holding the output volume.
    const receiptsName = readLines(sandboxRoot, "containers-created.log")[0];
    assert.match(receiptsName, /^mmp108-receipts-mmp108-/);
    assert.deepEqual(removedContainers(sandboxRoot), [receiptsName]);
    // Ordering: container removal precedes owned-volume removal.
    const calls = readLines(sandboxRoot, "calls.log");
    const containerRmAt = calls.findIndex((line) =>
      line.startsWith(`rm ${receiptsName}`),
    );
    const volumeRmAt = calls.findIndex((line) =>
      line.startsWith("volume rm mmp108-output"),
    );
    assert.ok(containerRmAt >= 0, "container must be removed");
    assert.ok(volumeRmAt >= 0, "owned volumes must be removed");
    assert.ok(
      containerRmAt < volumeRmAt,
      "receipt container must be removed before volume cleanup",
    );
    assert.deepEqual(removedVolumes(sandboxRoot).sort(), [
      "mmp108-output",
      "mmp108-private",
      "mmp108-work",
    ]);
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("B5: a failed receipt-container create removes no container and still cleans volumes", () => {
  const sandboxRoot = sandbox().root;
  process.env.MMP108_TEST_SCENARIO = "create-fail";
  try {
    const child = runHost(sandboxRoot);
    assert.equal(child.status, 1, child.stderr);
    // Nothing was ever created, so nothing foreign is touched or removed.
    assert.deepEqual(readLines(sandboxRoot, "containers-created.log"), []);
    assert.deepEqual(removedContainers(sandboxRoot), []);
    const calls = readLines(sandboxRoot, "calls.log").join("\n");
    assert.ok(
      !calls.includes("docker cp") && !calls.includes("^cp "),
      "no cp after failed create",
    );
    assert.deepEqual(removedVolumes(sandboxRoot).sort(), [
      "mmp108-output",
      "mmp108-private",
      "mmp108-work",
    ]);
  } finally {
    delete process.env.MMP108_TEST_SCENARIO;
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
