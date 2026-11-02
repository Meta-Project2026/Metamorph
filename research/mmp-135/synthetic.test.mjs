// Offline synthetic controls for the MMP-135 owner helper. Only throwaway
// TEST identities generated in a temp directory are used; no real identity,
// secret, network, Docker, model call or paid action is involved. The helper
// is never executed as a process here and never runs on import; the e2e cases
// below exercise its exported check function directly and are skipped
// honestly (TEST_NOT_RUN, no auto-download) when no local age-keygen is
// provided via MMP135_TEST_KEYGEN.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import {
  classifyOutcome,
  policyConsistent,
  RECIPIENT_FORMAT,
  RESULT_CODES,
  runOwnerCheck,
} from "./check-owner-key.mjs";

const recipient = DIAGNOSTIC_POLICY.recipient;
const otherKey = `age1${"q".repeat(58)}`;

test("policy recipient is pinned, well-formed and the result allowlist is exact", () => {
  assert.equal(policyConsistent(), true);
  assert.ok(RECIPIENT_FORMAT.test(recipient));
  assert.equal(recipient.length, 62);
  assert.deepEqual(RESULT_CODES, [
    "MATCH",
    "MISMATCH",
    "NOT_AVAILABLE",
    "ERROR",
  ]);
});

const ran = (stdout) => ({
  error: null,
  signal: null,
  status: 0,
  stdout: Buffer.from(stdout),
  stderr: Buffer.alloc(0),
});

test("clean single-line derivations classify by exact equality", () => {
  assert.equal(classifyOutcome(ran(`${recipient}\n`), recipient), "MATCH");
  assert.equal(classifyOutcome(ran(recipient), recipient), "MATCH");
  assert.equal(classifyOutcome(ran(`${otherKey}\n`), recipient), "MISMATCH");
  assert.equal(classifyOutcome(ran(recipient), otherKey), "MISMATCH");
});

test("tool-side and output failures stay NOT_AVAILABLE; refusals are ERROR", () => {
  const base = ran("");
  assert.equal(
    classifyOutcome({ ...base, error: { code: "ENOENT" } }, recipient),
    "NOT_AVAILABLE",
  );
  assert.equal(
    classifyOutcome({ ...base, signal: "SIGTERM" }, recipient),
    "NOT_AVAILABLE",
  );
  assert.equal(
    classifyOutcome({ ...base, stdout: Buffer.from(" ") }, recipient),
    "NOT_AVAILABLE",
  );
  assert.equal(
    classifyOutcome(
      { ...base, stdout: Buffer.from(`${recipient}\n${recipient}\n`) },
      recipient,
    ),
    "NOT_AVAILABLE",
  );
  assert.equal(
    classifyOutcome({ ...base, stdout: Buffer.from("not a key") }, recipient),
    "NOT_AVAILABLE",
  );
  assert.equal(
    classifyOutcome(
      { ...base, stdout: Buffer.from(recipient.toUpperCase()) },
      recipient,
    ),
    "NOT_AVAILABLE",
  );
  assert.equal(classifyOutcome({ ...base, status: 1 }, recipient), "ERROR");
});

async function check(t, answers, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "mmp135-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const emitted = [];
  let asked = 0;
  const code = await runOwnerCheck({
    env: options.env ?? {},
    platform: options.platform,
    expected: options.expected,
    ask: async () => {
      const answer = answers[asked++];
      return typeof answer === "function" ? answer(dir) : answer;
    },
    emit: (value) => emitted.push(value),
  });
  assert.deepEqual(emitted, [code]);
  assert.ok(RESULT_CODES.includes(code));
  return { code, asked, dir };
}

test("token-bearing agent/CI environment refuses closed before any prompt", async (t) => {
  for (const env of [
    { CI: "1" },
    { GH_TOKEN: "x" },
    { MODEL_API_KEY: "x" },
    { ACTIONS_RUNTIME_TOKEN: "x" },
  ]) {
    const { code, asked } = await check(t, [], { env });
    assert.equal(code, "ERROR");
    assert.equal(asked, 0);
  }
});

const dummyIdentity = (dir) => {
  const path = join(dir, "test-identity.txt");
  writeFileSync(path, "dummy input file for tool-existence controls only\n");
  return path;
};

test("empty, relative, missing and oversized inputs map to documented codes", async (t) => {
  assert.equal((await check(t, ["", ""])).code, "NOT_AVAILABLE"); // owner aborted
  assert.equal(
    (await check(t, [dummyIdentity, "age-keygen"])).code,
    "ERROR", // relative tool path would resolve via PATH
  );
  assert.equal(
    (await check(t, [(dir) => join(dir, "no-identity"), process.execPath]))
      .code,
    "ERROR", // missing identity input
  );
  assert.equal(
    (await check(t, [dummyIdentity, (dir) => join(dir, "no-such-keygen")]))
      .code,
    "NOT_AVAILABLE", // missing tool
  );
  assert.equal(
    (
      await check(t, [
        (dir) => {
          const path = join(dir, "oversized");
          writeFileSync(path, Buffer.alloc(4097));
          return path;
        },
        process.execPath,
      ])
    ).code,
    "ERROR", // oversized identity input
  );
});

test("Linux pinned-binary qualification refuses a non-pinned tool before spawn", async (t) => {
  const { code } = await check(t, [dummyIdentity, process.execPath], {
    platform: "linux",
  });
  assert.equal(code, "NOT_AVAILABLE");
});

const keygen = process.env.MMP135_TEST_KEYGEN ?? "";
const keygenReady = keygen !== "" && existsSync(keygen);

test("real age-keygen with throwaway TEST identities: match, wrong key, corrupt input", {
  skip: keygenReady
    ? false
    : "TEST_NOT_RUN: no local age-keygen provided via MMP135_TEST_KEYGEN; auto-download is forbidden",
}, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp135-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (args) =>
    spawnSync(keygen, args, {
      env: { PATH: process.env.PATH ?? "" },
      maxBuffer: 65536,
      timeout: 10000,
      encoding: "utf8",
      windowsHide: true,
    });
  const identityA = join(dir, "test-a.identity");
  assert.equal(run(["--output", identityA]).status, 0);
  const expectedA = run(["-y", identityA]).stdout.trim();
  assert.ok(RECIPIENT_FORMAT.test(expectedA));
  const files = () => readdirSync(dir).sort();
  // Positive control: the helper recognizes equality when it exists. This is
  // a generated TEST identity and proves the tool, never owner possession.
  assert.equal(
    (await check(t, [identityA, keygen], { expected: expectedA })).code,
    "MATCH",
  );
  // A TEST identity must never be mistaken for the pinned owner identity.
  assert.equal((await check(t, [identityA, keygen])).code, "MISMATCH");
  const identityB = join(dir, "test-b.identity");
  assert.equal(run(["--output", identityB]).status, 0);
  assert.notEqual(run(["-y", identityB]).stdout.trim(), expectedA);
  assert.equal(
    (await check(t, [identityB, keygen], { expected: expectedA })).code,
    "MISMATCH",
  );
  const corrupt = join(dir, "corrupt.identity");
  writeFileSync(corrupt, Buffer.alloc(64, 7));
  const before = files();
  assert.equal(
    (await check(t, [corrupt, keygen], { expected: expectedA })).code,
    "ERROR",
  );
  assert.deepEqual(files(), before); // the helper wrote nothing to disk
});
