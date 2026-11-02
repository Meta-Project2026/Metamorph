// Offline synthetic controls for the MMP-135 owner helper. Only throwaway
// TEST identities generated in a temp directory are used; no real identity,
// secret, network, Docker, model call or paid action is involved. The helper
// is never executed as a process here and never runs on import; the e2e cases
// below exercise its exported check function directly and are skipped
// honestly (TEST_NOT_RUN, no auto-download) when no local age-keygen is
// provided via MMP135_TEST_KEYGEN.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import {
  classifyOutcome,
  createPrompter,
  EXIT_CODES,
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

test("unqualified Windows and Linux tools are refused before any spawn", async (t) => {
  // If the substituted executable were spawned, node would exit nonzero and
  // the verdict would be ERROR. NOT_AVAILABLE therefore proves the refused
  // tool was never invoked with the identity path.
  for (const platform of ["win32", "linux"]) {
    const { code } = await check(t, [dummyIdentity, process.execPath], {
      platform,
    });
    assert.equal(code, "NOT_AVAILABLE");
  }
});

test("prompter never echoes typed input, even in terminal mode", async () => {
  const input = new PassThrough();
  const out = [];
  const prompter = createPrompter({ input, write: (text) => out.push(text) });
  const pending = prompter.ask("Identity file path:");
  input.write("C:\\secret\\identity.txt\r\n");
  assert.equal(await pending, "C:\\secret\\identity.txt");
  prompter.close();
  assert.equal(out.join(""), "Identity file path: \n");
});

const helperPath = fileURLToPath(
  new URL("./check-owner-key.mjs", import.meta.url),
);
const cliEnv = {
  PATH: process.env.PATH ?? "",
  SystemRoot: process.env.SystemRoot ?? "",
  SystemDrive: process.env.SystemDrive ?? "",
};

test("interactive CLI prints labels plus one status and never echoes paths", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp135-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const identity = join(dir, "identity.txt");
  writeFileSync(
    identity,
    "dummy input file for tool-existence controls only\n",
  );
  const child = spawnSync(process.execPath, [helperPath], {
    env: cliEnv,
    input: `${identity}\r\n${join(dir, "no-such-keygen")}\r\n`,
    maxBuffer: 65536,
    timeout: 15000,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(child.status, EXIT_CODES.NOT_AVAILABLE);
  assert.deepEqual(child.stdout.split(/\r?\n/).filter(Boolean), [
    "Identity file path: ",
    "age-keygen path: ",
    "NOT_AVAILABLE",
  ]);
  assert.equal(child.stderr, "");
  assert.ok(!child.stdout.includes(dir)); // no echoed path reaches the output
});

const keygen = process.env.MMP135_TEST_KEYGEN ?? "";
const keygenReady = keygen !== "" && existsSync(keygen);

test("real age-keygen output shape feeds the classifier correctly on TEST identities", {
  skip: keygenReady
    ? false
    : "TEST_NOT_RUN: no local age-keygen provided via MMP135_TEST_KEYGEN; auto-download is forbidden",
}, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp135-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const spawnTool = (args) =>
    spawnSync(keygen, args, {
      env: { PATH: process.env.PATH ?? "" },
      maxBuffer: 65536,
      timeout: 10000,
      windowsHide: true,
    });
  const identityA = join(dir, "test-a.identity");
  assert.equal(spawnTool(["--output", identityA]).status, 0);
  const realA = spawnTool(["-y", identityA]);
  const expectedA = realA.stdout.toString("utf8").trim();
  assert.ok(RECIPIENT_FORMAT.test(expectedA));
  // Real single-line output classifies by exact equality; this proves output
  // shape handling, never owner possession.
  assert.equal(classifyOutcome(realA, expectedA), "MATCH");
  const identityB = join(dir, "test-b.identity");
  assert.equal(spawnTool(["--output", identityB]).status, 0);
  const realB = spawnTool(["-y", identityB]);
  assert.notEqual(realB.stdout.toString("utf8").trim(), expectedA);
  assert.equal(classifyOutcome(realB, expectedA), "MISMATCH");
  const corrupt = join(dir, "corrupt.identity");
  writeFileSync(corrupt, Buffer.alloc(64, 7));
  const refused = spawnTool(["-y", corrupt]);
  assert.notEqual(refused.status, 0);
  assert.equal(classifyOutcome(refused, expectedA), "ERROR");
});

const pinnedReady =
  keygenReady &&
  process.platform === "linux" &&
  createHash("sha256").update(readFileSync(keygen)).digest("hex") ===
    DIAGNOSTIC_POLICY.keygenSha256;

test("pinned Linux age-keygen full flow with throwaway TEST identities", {
  skip: pinnedReady
    ? false
    : "TEST_NOT_RUN: the full flow needs the pinned linux-amd64 age-keygen (DIAGNOSTIC_POLICY.keygenSha256) on a Linux host; Windows refuses closed by design (review P1)",
}, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp135-flow-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const spawnTool = (args) =>
    spawnSync(keygen, args, {
      env: { PATH: process.env.PATH ?? "" },
      maxBuffer: 65536,
      timeout: 10000,
      windowsHide: true,
    });
  const identityA = join(dir, "test-a.identity");
  assert.equal(spawnTool(["--output", identityA]).status, 0);
  const expectedA = spawnTool(["-y", identityA]).stdout.toString("utf8").trim();
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
  assert.equal(spawnTool(["--output", identityB]).status, 0);
  assert.notEqual(
    spawnTool(["-y", identityB]).stdout.toString("utf8").trim(),
    expectedA,
  );
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
