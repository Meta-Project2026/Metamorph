// Offline synthetic controls for the MMP-139 owner exporter. Only synthetic
// TEST capsules, receipts and throwaway temp directories are used: no real
// identity, ciphertext, candidate text, network, Docker, model call or paid
// action is involved, and no candidate code is ever imported or executed.
// The exporter is never started as the owner CLI with real inputs here; the
// flow cases exercise `runOwnerExport` directly with injected restore/pins
// (module-only test controls the manual CLI can never pass), so the
// production pins stay fixed in every case. POSIX mode/uid/symlink controls
// run only on Linux/WSL and skip honestly elsewhere (TEST_NOT_RUN); Windows
// executes the static, refusal and classification subsets.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
import {
  classifyDestination,
  createPrompter,
  EXIT_CODES,
  EXPORT_PINS,
  MANIFEST_FORMAT,
  MANIFEST_LABEL,
  planExport,
  REFUSAL_ENV,
  receiptMatchesPins,
  runOwnerExport,
  STATUS_READY,
  STATUS_REJECTED,
  selectExportableFiles,
} from "./owner-export.mjs";

const helperPath = fileURLToPath(
  new URL("./owner-export.mjs", import.meta.url),
);
const cliEnv =
  process.platform === "win32"
    ? {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
        SystemDrive: process.env.SystemDrive ?? "",
      }
    : { PATH: process.env.PATH ?? "" };
const rejected = (invocation) =>
  assert.throws(invocation, (error) => error.message === STATUS_REJECTED);

// --- synthetic fixtures (TEST-only; never the real candidate) ---

const MARKER = "MMP139-SYNTHETIC-FIXTURE-DO-NOT-EXECUTE";
const LICENSE = "// SPDX-License-Identifier: MIT\n";
const MAIN_TS = `${LICENSE}// ${MARKER}\nexport const run = (): number => 41 + 1;\n`;
const UTIL_TS = `${LICENSE}export const bump = (n: number): number => n + 1;\n`;
const fileOf = (path, content) => ({
  path,
  content,
  sha256: sha256(content),
});
const SYNTHETIC_FILES = Object.freeze([
  fileOf("src/main.ts", MAIN_TS),
  fileOf("src/lib/util.ts", UTIL_TS),
]);
const synthetic = selectExportableFiles(SYNTHETIC_FILES);
assert.equal(synthetic.ok, true);
const SYNTHETIC_CANDIDATE_SHA = sha256(JSON.stringify(synthetic.files));
const TEST_ATTEMPT_ID = "3f0e8d6c-1111-4abc-9def-223344556677";
const TEST_PINS = Object.freeze({
  runId: "271828",
  runAttempt: "1",
  headSha: "b".repeat(40),
  sourceSha: "c".repeat(40),
  candidateSha: SYNTHETIC_CANDIDATE_SHA,
  ciphertextSha256: "d".repeat(64),
  ciphertextBytes: 4321,
});
const mockCapsule = (files = SYNTHETIC_FILES, identityPatch = {}) => ({
  identity: {
    runId: TEST_PINS.runId,
    runAttempt: TEST_PINS.runAttempt,
    headSha: TEST_PINS.headSha,
    sourceSha: TEST_PINS.sourceSha,
    candidateSha: TEST_PINS.candidateSha,
    attemptId: TEST_ATTEMPT_ID,
    ...identityPatch,
  },
  files,
});
const productionCapsule = () =>
  mockCapsule(
    SYNTHETIC_FILES,
    Object.fromEntries(
      ["runId", "runAttempt", "headSha", "sourceSha", "candidateSha"].map(
        (key) => [key, EXPORT_PINS[key]],
      ),
    ),
  );
const mockReceipt = (patch = {}) => ({
  ciphertextSha256: TEST_PINS.ciphertextSha256,
  ciphertextBytes: TEST_PINS.ciphertextBytes,
  identity: { candidateSha: TEST_PINS.candidateSha },
  ...patch,
});
const productionReceipt = () => ({
  ciphertextSha256: EXPORT_PINS.ciphertextSha256,
  ciphertextBytes: EXPORT_PINS.ciphertextBytes,
  identity: { candidateSha: EXPORT_PINS.candidateSha },
});
const scriptedAsk = (answers) => {
  let index = 0;
  return async () => answers[index++] ?? "";
};

const posixSkip =
  process.platform === "linux"
    ? false
    : "TEST_NOT_RUN: POSIX mode/uid/symlink controls require Linux/WSL; Windows covers static, refusal and classification controls";

function tempFixture(t) {
  const fixture = mkdtempSync(join(tmpdir(), "mmp139-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  return fixture;
}

// Flow fixtures cannot live under os.tmpdir(): the tool by design refuses
// transient destinations, so the POSIX tests stage receipts and output
// parents in a clearly-named throwaway directory under the invoking user's
// HOME (the only unprivileged non-transient location on a default WSL).
// Every test removes its fixture afterwards; nothing is ever scanned or read
// outside these self-created directories.
function flowFixture(t) {
  const fixture = mkdtempSync(
    join(process.env.HOME ?? homedir(), ".mmp139-flow-"),
  );
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  return fixture;
}

function writeReceipt(directory, receipt) {
  const path = join(directory, "receipt.json");
  writeFileSync(path, JSON.stringify(receipt));
  chmodSync(path, 0o600);
  return path;
}

function listRelative(root) {
  const out = [];
  const walk = (rel) => {
    out.push(rel);
    const st = lstatSync(join(root, rel));
    if (st.isDirectory())
      for (const entry of readdirSync(join(root, rel)).sort())
        walk(rel === "" ? entry : `${rel}/${entry}`);
  };
  walk("");
  return out.slice(1);
}

// --- static source and inertness controls ---

test("source performs no dynamic capability and reuses only the trusted core", () => {
  const source = readFileSync(helperPath, "utf8");
  for (const pattern of [
    /child_process/,
    /\bspawn/i,
    /\bexec(File|Sync)?\s*\(/,
    /\beval\s*\(/,
    /new\s+Function/,
    /\bimport\s*\(/,
    /\brequire\s*\(/,
    /\bfetch\s*\(/,
    /node:http/,
    /node:net/,
    /node:dns/,
    /node:tls/,
    /node:dgram/,
  ])
    assert.equal(pattern.test(source), false, `forbidden: ${pattern}`);
  assert.ok(
    source.includes('from "../../packages/agent-real/src/custody-restore.mjs"'),
    "must reuse the approved verifyAgeRestore",
  );
  assert.ok(
    source.includes('from "../../packages/agent-real/src/custody-files.mjs"'),
    "must reuse the approved readRecord/privateDirectory/commitPrivate",
  );
  assert.ok(
    source.includes(
      "import.meta.url === pathToFileURL(resolve(process.argv[1])).href",
    ),
    "CLI must stay guarded on direct execution",
  );
});

test("module import is inert: no writes, prompts, output or temp cwd changes", (t) => {
  const cwd = tempFixture(t);
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(pathToFileURL(helperPath).href)}); process.stdout.write("INERT_OK\\n");`,
    ],
    {
      cwd,
      env: cliEnv,
      input: "",
      encoding: "utf8",
      timeout: 20000,
      windowsHide: true,
      maxBuffer: 65536,
    },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.ok(child.stdout.endsWith("INERT_OK\n"), child.stdout);
  assert.ok(!child.stdout.includes("path:"));
  assert.deepEqual(readdirSync(cwd), []);
});

test("export pins are exactly the canonical published run facts", () => {
  assert.deepEqual(
    { ...EXPORT_PINS },
    {
      runId: "41505679809",
      runAttempt: "1",
      headSha: "a01bb65f8bb58c02c7a59e06ffedc9662576478e",
      sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
      candidateSha:
        "6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38",
      ciphertextSha256:
        "1afcc2a061a72f322f4a888bd03a93686babaf5a3e268a5d45dcc7c17bc997cb",
      ciphertextBytes: 31094,
    },
  );
  assert.ok(Object.isFrozen(EXPORT_PINS));
  assert.ok(/^[a-f0-9]{40}$/.test(EXPORT_PINS.headSha));
  assert.ok(/^[a-f0-9]{40}$/.test(EXPORT_PINS.sourceSha));
  assert.ok(/^[a-f0-9]{64}$/.test(EXPORT_PINS.candidateSha));
  assert.ok(/^[a-f0-9]{64}$/.test(EXPORT_PINS.ciphertextSha256));
  assert.ok(Number.isSafeInteger(EXPORT_PINS.ciphertextBytes));
  assert.ok(
    [
      "MODEL_API_KEY",
      "GH_TOKEN",
      "ACTIONS_RUNTIME_TOKEN",
      "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    ].every((name) => REFUSAL_ENV.includes(name)),
  );
});

// --- pure filter and plan controls ---

test("canonical synthetic bundle passes and sorts deterministically", () => {
  assert.equal(synthetic.ok, true);
  assert.deepEqual(
    synthetic.files.map((file) => file.path),
    ["src/lib/util.ts", "src/main.ts"],
  );
  assert.equal(sha256(JSON.stringify(synthetic.files)), TEST_PINS.candidateSha);
});

test("rejection matrix covers paths, content, sizes, counts, entrypoint and duplicates", () => {
  const cases = [
    ["COUNT", []],
    [
      "COUNT",
      Array.from({ length: 65 }, (_, i) => fileOf(`src/f${i}.ts`, "x;\n")),
    ],
    ["SHAPE", [null]],
    ["SHAPE", [{ path: "src/main.ts", content: "x" }]],
    [
      "SHAPE",
      [{ path: "src/main.ts", content: "x", sha256: sha256("x"), extra: 1 }],
    ],
    ["PATH", [fileOf("../evil.ts", "x;\n")]],
    ["PATH", [fileOf("/abs/main.ts", "x;\n")]],
    ["PATH", [fileOf("src/../evil.ts", "x;\n")]],
    ["PATH", [fileOf("src/reference.ts", "x;\n")]],
    ["PATH", [fileOf("src/tests/main.ts", "x;\n")]],
    ["PATH", [fileOf("src/oracle/contract.ts", "x;\n")]],
    ["PATH", [fileOf("src/held-out/secret.ts", "x;\n")]],
    ["PATH", [fileOf("src/fixtures/data.ts", "x;\n")]],
    ["PATH", [fileOf("src/foo.js", "x;\n")]],
    ["PATH", [fileOf("src/aux.ts", "x;\n")]],
    ["PATH", [fileOf(`src/${"a".repeat(250)}.ts`, "x;\n")]],
    ["CONTENT", [fileOf("src/main.ts", "x\0y;\n")]],
    ["SIZE", [fileOf("src/main.ts", `x\n`.repeat(256 * 1024))]],
    [
      "HASH",
      [{ path: "src/main.ts", content: MAIN_TS, sha256: "0".repeat(64) }],
    ],
    ["HASH", [fileOf("src/main.ts", MAIN_TS), fileOf("src/Main.ts", "y;\n")]],
    ["ENTRYPOINT", [fileOf("src/util.ts", "export const u = 1;\n")]],
  ];
  for (const [reason, files] of cases)
    assert.deepEqual(
      selectExportableFiles(files),
      { ok: false, reason },
      reason,
    );
  for (const bad of [undefined, null, "x", 7, {}])
    assert.equal(selectExportableFiles(bad).ok, false);
});

test("planExport builds a deterministic minimal UNVERIFIED_PRODUCT manifest", () => {
  const first = planExport(mockCapsule(), TEST_PINS);
  const second = planExport(mockCapsule(), TEST_PINS);
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.manifest, {
    format: MANIFEST_FORMAT,
    label: MANIFEST_LABEL,
    candidateSha: TEST_PINS.candidateSha,
    files: [
      {
        path: "src/lib/util.ts",
        bytes: Buffer.byteLength(UTIL_TS),
        sha256: sha256(UTIL_TS),
      },
      {
        path: "src/main.ts",
        bytes: Buffer.byteLength(MAIN_TS),
        sha256: sha256(MAIN_TS),
      },
    ],
  });
  assert.deepEqual(Object.keys(first.manifest).sort(), [
    "candidateSha",
    "files",
    "format",
    "label",
  ]);
  for (const entry of first.manifest.files)
    assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
  assert.equal(first.digest, sha256(first.bytes));
  assert.equal(first.bytes.toString("utf8").endsWith("\n"), false);
});

test("planExport enforces identity pins, attempt id, structure and secret scan", () => {
  rejected(() => planExport(mockCapsule())); // production defaults: synthetic content can never match the real candidate SHA
  rejected(() => planExport(null, TEST_PINS));
  rejected(() => planExport([mockCapsule()], TEST_PINS));
  rejected(() => planExport({ files: [] }, TEST_PINS));
  rejected(() =>
    planExport(
      mockCapsule(SYNTHETIC_FILES, { attemptId: "not-a-uuid" }),
      TEST_PINS,
    ),
  );
  rejected(() =>
    planExport(
      mockCapsule(SYNTHETIC_FILES, { attemptId: undefined }),
      TEST_PINS,
    ),
  );
  for (const key of [
    "runId",
    "runAttempt",
    "headSha",
    "sourceSha",
    "candidateSha",
  ]) {
    const wrong =
      key === "runAttempt" ? "2" : key === "runId" ? "999999" : "e".repeat(64);
    rejected(() =>
      planExport(mockCapsule(SYNTHETIC_FILES, { [key]: wrong }), TEST_PINS),
    );
  }
  rejected(() =>
    planExport(
      mockCapsule([
        {
          path: "src/main.ts",
          content: `${MAIN_TS}tail`,
          sha256: sha256(MAIN_TS),
        },
      ]),
      TEST_PINS,
    ),
  );
  rejected(() =>
    planExport(
      mockCapsule([
        fileOf(
          "src/main.ts",
          'const k = "AGE-SECRET-KEY-1ABCDEFGHJKLMNPQRSTUVWXYZ234567890abcdefghijklm";\n',
        ),
      ]),
      TEST_PINS,
    ),
  ); // static secret tripwire (partial check) rejects before any write
});

test("receipt pins bind ciphertext SHA/length and candidate SHA exactly", () => {
  assert.equal(receiptMatchesPins(mockReceipt(), TEST_PINS), true);
  assert.equal(receiptMatchesPins(productionReceipt()), true);
  assert.equal(
    receiptMatchesPins(
      mockReceipt({ ciphertextSha256: "0".repeat(64) }),
      TEST_PINS,
    ),
    false,
  );
  assert.equal(
    receiptMatchesPins(
      mockReceipt({ ciphertextBytes: TEST_PINS.ciphertextBytes + 1 }),
      TEST_PINS,
    ),
    false,
  );
  assert.equal(
    receiptMatchesPins(mockReceipt({ ciphertextBytes: "31094" }), TEST_PINS),
    false,
  );
  assert.equal(
    receiptMatchesPins(
      mockReceipt({ identity: { candidateSha: "1".repeat(64) } }),
      TEST_PINS,
    ),
    false,
  );
  assert.equal(
    receiptMatchesPins(mockReceipt({ identity: null }), TEST_PINS),
    false,
  );
  assert.equal(receiptMatchesPins(mockReceipt(), EXPORT_PINS), false);
  assert.equal(receiptMatchesPins(null, TEST_PINS), false);
  assert.equal(receiptMatchesPins([mockReceipt()], TEST_PINS), false);
  assert.equal(receiptMatchesPins("receipt", TEST_PINS), false);
});

// --- destination classification controls ---

test("destination classification refuses checkout, WSL mounts, transient and sync trees", () => {
  const repo = "/repo";
  const cases = [
    ["OK", "/home/user/export"],
    ["NOT_ABSOLUTE", "relative/path"],
    ["NOT_ABSOLUTE", "C:\\temp\\export"],
    ["NOT_ABSOLUTE", ""],
    ["NOT_ABSOLUTE", 42],
    ["NOT_NORMALIZED", "/home/user/../user/export"],
    ["NOT_NORMALIZED", "/home/user/export/"],
    ["NOT_NORMALIZED", "//tmp/export"],
    ["NOT_NORMALIZED", "/"],
    ["WSL_MOUNT", "/mnt"],
    ["WSL_MOUNT", "/mnt/c/Users/owner/export"],
    ["TRANSIENT", "/tmp/export"],
    ["TRANSIENT", "/var/tmp/export"],
    ["TRANSIENT", "/dev/shm/export"],
    ["TRANSIENT", "/run/export"],
    ["TRANSIENT", "/srv/export"],
    ["TRANSIENT", "/var/www/export"],
    ["CHECKOUT", "/repo"],
    ["CHECKOUT", "/repo/research/mmp-139"],
    ["SYNC_OR_BACKUP", "/home/u/Dropbox/export"],
    ["SYNC_OR_BACKUP", "/home/u/OneDrive/export"],
    ["SYNC_OR_BACKUP", "/home/u/gdrive/export"],
    ["SYNC_OR_BACKUP", "/home/u/icloud/export"],
    ["SYNC_OR_BACKUP", "/home/u/backups/export"],
    ["SYNC_OR_BACKUP", "/home/u/my-sync-dir/export"],
    ["OK", "/repository/export"],
    ["OK", "/home/user/exports"],
  ];
  for (const [expected, destination] of cases)
    assert.equal(classifyDestination(destination, repo), expected, destination);
});

// --- refusal controls that touch no filesystem ---

test("non-Linux platforms and credential-bearing environments refuse before any prompt", async () => {
  const cases = [
    { platform: "win32" },
    { platform: "darwin" },
    { platform: "freebsd" },
    ...REFUSAL_ENV.map((name) => ({ env: { [name]: "1" } })),
  ];
  for (const options of cases) {
    let asked = 0;
    const emitted = [];
    const result = await runOwnerExport({
      ask: async () => {
        asked += 1;
        return "";
      },
      emit: (line) => emitted.push(line),
      env: options.env ?? {},
      platform: options.platform ?? "linux",
    });
    assert.equal(result.status, STATUS_REJECTED, JSON.stringify(options));
    assert.equal(result.digest, null);
    assert.equal(asked, 0, JSON.stringify(options));
    assert.deepEqual(emitted, [STATUS_REJECTED]);
  }
  // An empty-string value is not a credential: the flow reaches the first prompt.
  let asked = 0;
  const result = await runOwnerExport({
    ask: async () => {
      asked += 1;
      return "";
    },
    emit: () => {},
    env: { CI: "", GH_TOKEN: "" },
    platform: "linux",
  });
  assert.equal(result.status, STATUS_REJECTED);
  assert.equal(asked, 1);
});

test("aborted, empty, relative and unsafe answers reject without touching the filesystem", async () => {
  const base = ["/opt/age/age", "/opt/age/identity.txt", "/data/candidate.age"];
  const runs = [
    { answers: [], asked: 1 }, // abort at the first prompt
    { answers: ["/opt/age/age"], asked: 2 }, // abort at the second prompt
    { answers: [...base, "receipt.json", "/home/u/export"], asked: 5 },
    { answers: [...base, "/data/receipt.json", "export"], asked: 5 },
    { answers: [...base, "/data/receipt.json", "/tmp/export"], asked: 5 },
    { answers: [...base, "/data/receipt.json", " /home/u/export "], asked: 5 },
  ];
  for (const run of runs) {
    let asked = 0;
    const emitted = [];
    const result = await runOwnerExport({
      ask: async () => {
        asked += 1;
        return run.answers[asked - 1] ?? "";
      },
      emit: (line) => emitted.push(line),
      env: {},
      platform: "linux",
      readRecordFn: () => {
        throw new Error("RECEIPT_MUST_NOT_BE_READ");
      },
    });
    assert.equal(result.status, STATUS_REJECTED, JSON.stringify(run));
    assert.deepEqual(emitted, [STATUS_REJECTED]);
    assert.equal(asked, run.asked, JSON.stringify(run));
  }
});

// --- POSIX full-flow controls (Linux/WSL) ---

test("owner flow exports a byte-identical 0700/0600 tree with one READY line", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const destination = join(parent, "export");
  const receiptPath = writeReceipt(fixture, mockReceipt());
  const emitted = [];
  const capsule = mockCapsule();
  const expected = planExport(capsule, TEST_PINS);
  const result = await runOwnerExport({
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      receiptPath,
      destination,
    ]),
    emit: (line) => emitted.push(line),
    env: {},
    pins: TEST_PINS,
    restore: () => capsule,
  });
  assert.equal(result.status, STATUS_READY);
  assert.equal(result.digest, expected.digest);
  assert.deepEqual(emitted, [`${STATUS_READY} ${expected.digest}`]);
  assert.deepEqual(listRelative(destination).sort(), [
    "manifest.json",
    "src",
    "src/lib",
    "src/lib/util.ts",
    "src/main.ts",
  ]);
  assert.equal(lstatSync(destination).mode & 0o777, 0o700);
  assert.equal(lstatSync(join(destination, "src")).mode & 0o777, 0o700);
  assert.equal(lstatSync(join(destination, "src/lib")).mode & 0o777, 0o700);
  for (const rel of ["manifest.json", "src/main.ts", "src/lib/util.ts"])
    assert.equal(lstatSync(join(destination, rel)).mode & 0o777, 0o600, rel);
  assert.equal(readFileSync(join(destination, "src/main.ts"), "utf8"), MAIN_TS);
  assert.equal(
    readFileSync(join(destination, "src/lib/util.ts"), "utf8"),
    UTIL_TS,
  );
  const manifest = JSON.parse(
    readFileSync(join(destination, "manifest.json"), "utf8"),
  );
  assert.deepEqual(manifest, JSON.parse(JSON.stringify(expected.manifest)));
  const output = emitted.join("\n");
  assert.ok(!output.includes(fixture));
  assert.ok(!output.includes(MARKER));
  assert.equal(EXIT_CODES[STATUS_READY], 0);
});

test("production defaults are active in the flow: any identity or content drift rejects", {
  skip: posixSkip,
}, async (t) => {
  const cases = [
    [
      "canonical-sha",
      productionCapsule(), // identity matches production pins; synthetic content cannot match the real candidate SHA
    ],
    [
      "candidate-pin",
      mockCapsule(
        SYNTHETIC_FILES,
        Object.fromEntries(
          ["runId", "runAttempt", "headSha", "sourceSha"].map((key) => [
            key,
            EXPORT_PINS[key],
          ]),
        ),
      ),
    ],
  ];
  for (const [label, capsule] of cases) {
    const fixture = flowFixture(t);
    const parent = join(fixture, "out");
    mkdirSync(parent, { mode: 0o700 });
    const emitted = [];
    const result = await runOwnerExport({
      ask: scriptedAsk([
        "/opt/age/age",
        "/opt/age/identity.txt",
        join(fixture, "candidate.age"),
        writeReceipt(fixture, productionReceipt()),
        join(parent, "export"),
      ]),
      emit: (line) => emitted.push(line),
      env: {},
      restore: () => capsule,
    });
    assert.equal(result.status, STATUS_REJECTED, label);
    assert.deepEqual(emitted, [STATUS_REJECTED]);
    assert.deepEqual(readdirSync(parent), []);
  }
});

test("a rejected or failing restore never creates the output directory", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const emitted = [];
  let restored = 0;
  const result = await runOwnerExport({
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      writeReceipt(fixture, mockReceipt()),
      join(parent, "export"),
    ]),
    emit: (line) => emitted.push(line),
    env: {},
    pins: TEST_PINS,
    restore: () => {
      restored += 1;
      throw new Error("CUSTODY_REJECTED");
    },
  });
  assert.equal(result.status, STATUS_REJECTED);
  assert.equal(restored, 1);
  assert.deepEqual(emitted, [STATUS_REJECTED]);
  assert.deepEqual(readdirSync(parent), []);
  assert.equal(EXIT_CODES[STATUS_REJECTED], 1);
});

test("missing, unreadable-format and pin-mismatched receipts reject before restore", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const good = writeReceipt(fixture, mockReceipt());
  const mismatched = writeReceipt(
    fixture,
    mockReceipt({ ciphertextSha256: "0".repeat(64) }),
  );
  writeFileSync(join(fixture, "broken.json"), "{not json");
  chmodSync(join(fixture, "broken.json"), 0o600);
  const cases = [
    join(fixture, "no-such-receipt.json"),
    join(fixture, "broken.json"),
    mismatched,
  ];
  for (const [index, receiptPath] of cases.entries()) {
    const emitted = [];
    let restored = 0;
    const result = await runOwnerExport({
      ask: scriptedAsk([
        "/opt/age/age",
        "/opt/age/identity.txt",
        join(fixture, "candidate.age"),
        receiptPath,
        join(parent, `export-${index}`),
      ]),
      emit: (line) => emitted.push(line),
      env: {},
      pins: TEST_PINS,
      restore: () => {
        restored += 1;
        return mockCapsule();
      },
    });
    assert.equal(result.status, STATUS_REJECTED, receiptPath);
    assert.equal(restored, 0, receiptPath);
    assert.deepEqual(emitted, [STATUS_REJECTED]);
  }
  assert.ok(existsSync(good));
  assert.deepEqual(readdirSync(parent), []);
});

test("an existing destination and a destination inside the checkout are rejected untouched", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const existing = join(parent, "exists");
  mkdirSync(existing, { mode: 0o700 });
  const sentinel = join(existing, "sentinel.txt");
  writeFileSync(sentinel, "keep\n");
  chmodSync(sentinel, 0o600);
  const common = {
    env: {},
    pins: TEST_PINS,
    restore: () => mockCapsule(),
  };
  const existingResult = await runOwnerExport({
    ...common,
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      writeReceipt(fixture, mockReceipt()),
      existing,
    ]),
    emit: () => {},
  });
  assert.equal(existingResult.status, STATUS_REJECTED);
  assert.deepEqual(readdirSync(existing), ["sentinel.txt"]);
  assert.equal(readFileSync(sentinel, "utf8"), "keep\n");
  const checkoutResult = await runOwnerExport({
    ...common,
    repoRoot: fixture,
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      join(fixture, "receipt.json"),
      join(fixture, "research", "export"),
    ]),
    emit: () => {},
  });
  assert.equal(checkoutResult.status, STATUS_REJECTED);
  assert.deepEqual(readdirSync(parent), ["exists"]);
  assert.deepEqual(existsSync(join(fixture, "research")), false);
  const transientResult = await runOwnerExport({
    ...common,
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      join(fixture, "receipt.json"),
      "/tmp/mmp139-should-not-exist",
    ]),
    emit: () => {},
  });
  assert.equal(transientResult.status, STATUS_REJECTED);
  assert.equal(existsSync("/tmp/mmp139-should-not-exist"), false);
});

test("a failing write leaves no partial export: the fresh directory is removed", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const destination = join(parent, "export");
  const emitted = [];
  let commits = 0;
  const result = await runOwnerExport({
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      writeReceipt(fixture, mockReceipt()),
      destination,
    ]),
    emit: (line) => emitted.push(line),
    env: {},
    pins: TEST_PINS,
    restore: () => mockCapsule(),
    commitImpl: (path, bytes, maxBytes) => {
      commits += 1;
      if (commits === 2) throw new Error("CUSTODY_COMMIT_REJECTED");
      assert.equal(typeof path, "string");
      assert.equal(Buffer.isBuffer(bytes), true);
      assert.equal(maxBytes > bytes.length, true);
    },
  });
  assert.equal(result.status, STATUS_REJECTED);
  assert.equal(commits, 2);
  assert.deepEqual(emitted, [STATUS_REJECTED]);
  assert.equal(existsSync(destination), false);
  assert.deepEqual(readdirSync(parent), []);
});

test("an unexpected output file is detected and the whole fresh directory is removed", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const destination = join(parent, "export");
  let staged = false;
  const result = await runOwnerExport({
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      writeReceipt(fixture, mockReceipt()),
      destination,
    ]),
    emit: () => {},
    env: {},
    pins: TEST_PINS,
    restore: () => mockCapsule(),
    commitImpl: (path) => {
      if (staged) return;
      staged = true;
      mkdirSync(join(dirname(path), "rogue-dir"), { mode: 0o700 });
      writeFileSync(join(dirname(path), "rogue.txt"), "unexpected");
      chmodSync(join(dirname(path), "rogue.txt"), 0o600);
    },
  });
  assert.equal(result.status, STATUS_REJECTED);
  assert.equal(existsSync(destination), false);
  assert.deepEqual(readdirSync(parent), []);
});

test("symlinks at the destination and inside its path are rejected without following", {
  skip: posixSkip,
}, async (t) => {
  const fixture = flowFixture(t);
  const parent = join(fixture, "out");
  mkdirSync(parent, { mode: 0o700 });
  const target = join(parent, "real-target");
  mkdirSync(target, { mode: 0o700 });
  symlinkSync(target, join(parent, "link"));
  const common = {
    env: {},
    pins: TEST_PINS,
    restore: () => mockCapsule(),
    emit: () => {},
  };
  const atDestination = await runOwnerExport({
    ...common,
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      join(fixture, "receipt.json"),
      join(parent, "link"),
    ]),
  });
  assert.equal(atDestination.status, STATUS_REJECTED);
  assert.deepEqual(readdirSync(target), []);
  const real = join(parent, "real");
  mkdirSync(real, { mode: 0o700 });
  symlinkSync(real, join(parent, "alias"));
  const insideComponent = await runOwnerExport({
    ...common,
    ask: scriptedAsk([
      "/opt/age/age",
      "/opt/age/identity.txt",
      join(fixture, "candidate.age"),
      join(fixture, "receipt.json"),
      join(parent, "alias", "export"),
    ]),
  });
  assert.equal(insideComponent.status, STATUS_REJECTED);
  assert.deepEqual(readdirSync(real), []);
  assert.equal(lstatSync(join(parent, "alias")).isSymbolicLink(), true);
});

test("a foreign-owned receipt cannot be staged in this unprivileged suite", {
  skip: "TEST_NOT_RUN: staging a foreign-uid file requires root; the trusted uid/mode checks are exercised by the packages/agent-real custody tests",
}, () => {});

// --- prompter and CLI controls ---

test("prompter never echoes typed input, even in terminal mode", async () => {
  const input = new PassThrough();
  const out = [];
  const prompter = createPrompter({ input, write: (text) => out.push(text) });
  const pending = prompter.ask("identity file path:");
  input.write("/secret/identity.txt\r\n");
  assert.equal(await pending, "/secret/identity.txt");
  prompter.close();
  assert.equal(out.join(""), "identity file path: \n");
});

test("CLI refuses closed with a credential variable: exactly one line, exit 1", () => {
  const child = spawnSync(process.execPath, [helperPath], {
    env: { ...cliEnv, CI: "1" },
    input: "",
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
    maxBuffer: 65536,
  });
  assert.equal(child.status, EXIT_CODES[STATUS_REJECTED]);
  assert.equal(child.stdout, `${STATUS_REJECTED}\n`);
  assert.ok(!child.stderr.includes("identity"));
  assert.ok(!child.stdout.includes("path:"));
});

test("CLI on a Windows host refuses closed before any prompt", {
  skip:
    process.platform === "win32"
      ? false
      : "TEST_NOT_RUN: platform-refusal CLI line is a win32-host control; Linux/WSL CLI is covered by the closed-stdin case",
}, () => {
  const child = spawnSync(process.execPath, [helperPath], {
    env: cliEnv,
    input: "",
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
    maxBuffer: 65536,
  });
  assert.equal(child.status, EXIT_CODES[STATUS_REJECTED]);
  assert.equal(child.stdout, `${STATUS_REJECTED}\n`);
});

test("CLI on Linux with closed stdin prints one label then rejects", {
  skip:
    process.platform === "linux"
      ? false
      : "TEST_NOT_RUN: closed-stdin CLI line is a Linux/WSL control",
}, () => {
  const child = spawnSync(process.execPath, [helperPath], {
    env: cliEnv,
    input: "",
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
    maxBuffer: 65536,
  });
  assert.equal(child.status, EXIT_CODES[STATUS_REJECTED]);
  assert.equal(child.stdout, "age binary path: \nEXPORT_REJECTED\n");
});
