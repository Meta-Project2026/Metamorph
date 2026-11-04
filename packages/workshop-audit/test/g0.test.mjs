// Trusted Docker CLI simulations and public data only; never execute candidate
// TS, compiled JS, probe programs or a mock application on the host.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { challenge } from "../src/g0/challenge.mjs";
import {
  G0Docker,
  recipe,
  requireAdmittedImage,
  sandbox,
  validateIsolation,
} from "../src/g0/docker.mjs";
import {
  Evidence,
  privatePath,
  readPrivateJson,
  validateLedger,
  verifyEvidence,
} from "../src/g0/evidence.mjs";
import {
  CONTROLS,
  candidateProvenance,
  DRIVERS,
  digest,
  exactIds,
  identity,
  inspectSource,
  makeRunId,
  registerScope,
  requireScope,
  safeCode,
} from "../src/g0/policy.mjs";
import { DENIAL_PROBE, PROCESS_PROBE } from "../src/g0/probes.mjs";
import { assess, consumePass, qualifyAdapter, runG0 } from "../src/g0/run.mjs";
import { publicScope, syntheticCases } from "../src/g0/synthetic.mjs";

const hash = "a".repeat(64),
  head = "b".repeat(40),
  imageId = `sha256:${hash}`;
const runtime = { imageId, recipeSha: hash };
const content = 'export const message = "original synthetic";';
const bundle = validateBundle([
  { path: "src/main.ts", content, sha256: sha256(content) },
]);
const scope = () => publicScope(bundle, runtime, head);
const zero = { containers: 0, volumes: 0, emergencyRemoved: 0 };
const passInput = () => ({
  controls: [...CONTROLS],
  tests: [...scope().testIds],
  scope: scope(),
  cleanup: { ...zero },
  finalizer: { ...zero },
  evidence: { bytes: 100 },
  evidenceVerified: true,
  fault: null,
});
const rejectsCode = (fn, code) => assert.throws(fn, (e) => e.code === code);

test("G0 trusted Docker probe programs parse without executing on the host", () => {
  new Script(DENIAL_PROBE);
  new Script(PROCESS_PROBE);
});

test("G0 scopes bind exact full candidate, manifest, source, runtime and evaluator identities", () => {
  const s = scope();
  requireScope(s);
  assert.ok(Object.isFrozen(s.units[0].files));
  assert.equal(identity(s, makeRunId()).scopeSha, digest(s));
  for (const key of [
    "candidateSha",
    "manifestSha",
    "sourceSha",
    "recipeSha",
    "imageId",
    "evaluatorSha",
    "candidateGitSha",
  ]) {
    const changed = structuredClone(s);
    changed[key] = "wrong";
    assert.throws(() => registerScope(changed, bundle));
  }
  rejectsCode(() => requireScope(structuredClone(s)), "G0_UNTRUSTED_SCOPE");
  const changed = structuredClone(bundle);
  changed.files[0].content += "// drift";
  assert.throws(
    () => registerScope(structuredClone(s), changed),
    /ADMISSION_REJECTED/,
  );
});
test("G0 missing routes/units, extra source, duplicate/missing tests and controls fail closed", () => {
  const mutations = [
    (s) => s.routes.pop(),
    (s) => s.units.pop(),
    (s) => s.units[0].files.pop(),
    (s) => s.units[0].routes.pop(),
    (s) => s.testIds.push(s.testIds[0]),
    (s) => s.testIds.pop(),
    (s) => s.controlIds.push(s.controlIds[0]),
    (s) => s.controlIds.pop(),
    (s) => {
      s.unregistered = true;
    },
  ];
  for (const mutate of mutations) {
    const s = structuredClone(scope());
    mutate(s);
    assert.throws(() => registerScope(s, bundle));
  }
});
test("G0 fully supported scopes allow no exclusions but reject invalid unsupported IDs", () => {
  const s = structuredClone(scope());
  s.unsupported = [];
  assert.deepEqual(registerScope(s, bundle).unsupported, []);
  for (const unsupported of [
    null,
    "none",
    {},
    ["duplicate", "duplicate"],
    ["Invalid"],
    ["has/slash"],
    ["a".repeat(65)],
    [1],
    Array(1),
    Array.from({ length: 65 }, (_, i) => `id-${i}`),
  ]) {
    rejectsCode(
      () => registerScope({ ...s, unsupported }, bundle),
      "G0_UNSUPPORTED",
    );
  }
});
test("G0 exact known bundle SHA and well-formed provenance declarations never attest owner custody", () => {
  assert.equal(
    candidateProvenance(
      "4207053ada23f8e94ecf6301452ee4ea8228a3717c0a478d3e550443cec130e6",
    ),
    "EXACT_PUBLIC_SHA_MATCHED_ATTESTATION_PENDING",
  );
  const declaration = structuredClone(scope());
  declaration.sourceSha = "d".repeat(64);
  declaration.manifestSha = "e".repeat(64);
  declaration.candidateGitSha = "f".repeat(40);
  const registered = registerScope(declaration, bundle);
  assert.equal(
    candidateProvenance(registered.candidateSha),
    "OWNER_ATTESTATION_PENDING",
  );
});
test("G0 secondary integrity faults override behavioral FAIL and unverified catalogs", () => {
  for (const secondary of ["G0_EVIDENCE", "G0_CLEANUP", "G0_INTERNAL"]) {
    const v = passInput();
    v.fault = "G0_CHALLENGE";
    v.faults = [v.fault, secondary];
    assert.equal(assess(v), "ERROR");
  }
  const v = passInput();
  v.fault = "G0_CHALLENGE";
  v.evidenceVerified = false;
  assert.equal(assess(v), "ERROR");
});
test("G0 live receipt evidence, qualification and finalization regressions", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--test",
      "--test-reporter=tap",
      fileURLToPath(new URL("./g0-run-controls.mjs", import.meta.url)),
    ],
    {
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true,
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "NODE_TEST_CONTEXT",
        ),
      ),
    },
  );
  assert.match(output, /# fail 0/);
});
test("G0 forbidden imports/loaders are structural rejection, never Docker evidence", () => {
  inspectSource(bundle);
  for (const text of [
    'import "node:child_process";',
    'import "node:worker_threads";',
    'import("node:fs");',
    'require("node:fs");',
    'import x = require("node:fs");',
    'export * from "foreign-package";',
    'eval("x");',
  ]) {
    const b = validateBundle([
      { path: "src/main.ts", content: text, sha256: sha256(text) },
    ]);
    rejectsCode(() => inspectSource(b), "G0_FORBIDDEN_IMPORT");
  }
  rejectsCode(() => requireAdmittedImage(imageId, hash), "G0_IDENTITY");
});
test("G0 complete scoped simulation can assess PASS; skipped or duplicated checks cannot", () => {
  assert.equal(assess(passInput()), "PASS");
  for (const key of ["tests", "controls"]) {
    const missing = passInput();
    missing[key].pop();
    assert.equal(assess(missing), "INCONCLUSIVE");
    const duplicate = passInput();
    duplicate[key].push(duplicate[key][0]);
    assert.equal(assess(duplicate), "INCONCLUSIVE");
    const extra = passInput();
    extra[key].push("unknown");
    assert.equal(assess(extra), "INCONCLUSIVE");
  }
  exactIds(scope().routes, DRIVERS["items-v1"]);
});
test("G0 partial evidence, environment error and emergency cleanup never become PASS", () => {
  for (const mutate of [
    (v) => {
      v.evidence = null;
    },
    (v) => {
      v.cleanup = null;
    },
    (v) => {
      v.finalizer = null;
    },
    (v) => {
      v.finalizer.emergencyRemoved = 1;
    },
    (v) => {
      v.cleanup.containers = 1;
    },
    (v) => {
      v.cleanup.volumes = 1;
    },
    (v) => {
      v.fault = "G0_TIMEOUT";
    },
    (v) => {
      v.fault = "G0_CANCELLED";
    },
    (v) => {
      v.fault = "G0_EVIDENCE";
    },
    (v) => {
      v.fault = "G0_CONTROL_FAILED";
    },
  ]) {
    const v = passInput();
    mutate(v);
    assert.equal(assess(v), "ERROR");
  }
  const mismatch = passInput();
  mismatch.fault = "G0_CHALLENGE";
  assert.equal(assess(mismatch), "FAIL");
  mismatch.finalizer.emergencyRemoved = 1;
  assert.equal(assess(mismatch), "ERROR");
});
test("G0 forged or historical serialized PASS has no live invocation authority", async () => {
  const forged = { identity: identity(scope(), makeRunId()), verdict: "PASS" };
  for (const r of [
    forged,
    Object.freeze(forged),
    JSON.parse(JSON.stringify(forged)),
  ])
    rejectsCode(() => consumePass(r, forged.identity), "G0_UNTRUSTED_RECEIPT");
  await assert.rejects(
    () => runG0(structuredClone(scope()), bundle, "unused"),
    /G0_UNTRUSTED_SCOPE/,
  );
  assert.equal(safeCode({ code: "secret-path-contents" }), "G0_INTERNAL");
  await assert.rejects(
    () => qualifyAdapter(Array(11).fill(forged)),
    /G0_CONTROL_FAILED/,
  );
});

const env = [
  "PATH=/usr/local/bin:/usr/bin:/bin",
  "NODE_VERSION=24.11.0",
  "NODE_ENV=production",
  "TZ=UTC",
];
function inspection(id, name, runId, owner, role, script) {
  const args = sandbox(name, runId, owner, role);
  const tmpfs = {};
  for (let i = 0; i < args.length; i++)
    if (args[i] === "--tmpfs") {
      const [path, options] = args[i + 1].split(":");
      tmpfs[path] = options;
    }
  return {
    Id: id,
    Name: `/${name}`,
    Image: imageId,
    Config: {
      User: "10001:10001",
      WorkingDir: "/work",
      Env: env,
      Entrypoint: ["node"],
      Cmd: [script],
      Labels: {
        "metamorph.g0.run": runId,
        "metamorph.g0.owner": owner,
        "metamorph.g0.role": role,
      },
    },
    HostConfig: {
      NetworkMode: "none",
      IpcMode: "private",
      PidMode: "",
      UTSMode: "",
      CgroupnsMode: "private",
      Privileged: false,
      ReadonlyRootfs: true,
      NanoCpus: 1000000000,
      Memory: 268435456,
      MemorySwap: 268435456,
      PidsLimit: 64,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      Tmpfs: tmpfs,
    },
    Mounts: [],
  };
}
test("G0 actual-inspection policy rejects reference/PHP/corpus/socket mounts and weakened namespaces", () => {
  const runId = makeRunId(),
    owner =
      "c".repeat(8) +
      "-" +
      "c".repeat(4) +
      "-" +
      "c".repeat(4) +
      "-" +
      "c".repeat(4) +
      "-" +
      "c".repeat(12);
  const expected = {
    id: hash,
    imageId,
    runId,
    owner,
    role: "runtime",
    script: "/opt/worker/launch.mjs",
  };
  const good = inspection(
    hash,
    `${runId}-worker`,
    runId,
    owner,
    "runtime",
    expected.script,
  );
  validateIsolation(good, expected, env);
  for (const target of [
    "/reference",
    "/usr/bin/php",
    "/corpus",
    "/var/run/docker.sock",
    "/state",
    "/work",
  ]) {
    const x = structuredClone(good);
    x.Mounts.push({ Type: "bind", Source: "private", Destination: target });
    rejectsCode(() => validateIsolation(x, expected, env), "G0_ISOLATION");
  }
  for (const mutate of [
    (x) => {
      x.HostConfig.NetworkMode = "host";
    },
    (x) => {
      x.HostConfig.IpcMode = "host";
    },
    (x) => {
      x.HostConfig.PidMode = "host";
    },
    (x) => {
      x.HostConfig.CgroupnsMode = "host";
    },
    (x) => {
      x.HostConfig.Privileged = true;
    },
    (x) => {
      x.HostConfig.ReadonlyRootfs = false;
    },
    (x) => {
      x.HostConfig.PidsLimit = -1;
    },
    (x) => {
      x.HostConfig.Memory = 0;
    },
    (x) => {
      x.HostConfig.NanoCpus = 0;
    },
    (x) => {
      x.HostConfig.Binds = ["host:/state"];
    },
    (x) => {
      x.HostConfig.Tmpfs["/state"] = "rw,size=1g";
    },
    (x) => {
      x.Config.Env = [...env, "SECRET=canary"];
    },
    (x) => {
      x.Config.User = "0";
    },
    (x) => {
      x.Image = "mutable-tag";
    },
  ]) {
    const x = structuredClone(good);
    mutate(x);
    rejectsCode(() => validateIsolation(x, expected, env), "G0_ISOLATION");
  }
});

function harness(options = {}) {
  const containers = new Map(),
    volumes = new Map(),
    calls = [],
    saved = [];
  let sequence = 0;
  const sink = {
    record: (...x) => saved.push(x),
    ledger: (x) => {
      sink.latest = structuredClone(x);
    },
  };
  const receipt = (args, value = "", code = 0, extra = {}) => ({
    args,
    stdout: typeof value === "string" ? value : JSON.stringify(value),
    stderr: "",
    exitCode: code,
    timedOut: false,
    cancelled: false,
    overflow: false,
    spawnError: null,
    ...extra,
  });
  const execute = async (args, config) => {
    calls.push(args);
    if (args[0] === "create") {
      const arg = (key) => args[args.indexOf(key) + 1];
      const labels = args.flatMap((x, i) =>
        x === "--label" ? [args[i + 1]] : [],
      );
      const label = (key) =>
        labels.find((x) => x.startsWith(`${key}=`)).slice(key.length + 1);
      const id = (++sequence).toString(16).padStart(64, "0");
      const v = inspection(
        id,
        arg("--name"),
        label("metamorph.g0.run"),
        label("metamorph.g0.owner"),
        label("metamorph.g0.role"),
        args.at(-1),
      );
      containers.set(id, v);
      if (options.partial) return receipt(args, "", 1, { timedOut: true });
      return receipt(args, id);
    }
    if (args[0] === "inspect") {
      const v = containers.get(args.at(-1));
      return receipt(args, v ? [v] : [], v ? 0 : 1);
    }
    if (args[0] === "container") {
      if (options.missingInventory) return receipt(args, "", 1);
      const run = args[args.indexOf("--filter") + 1].split("=").at(-1);
      return receipt(
        args,
        [...containers.values()]
          .filter((v) => v.Config.Labels["metamorph.g0.run"] === run)
          .map((v) => v.Id)
          .join("\n"),
      );
    }
    if (args[0] === "volume") {
      const run = args[args.indexOf("--filter") + 1].split("=").at(-1);
      return receipt(
        args,
        [...volumes]
          .filter(([, r]) => r === run)
          .map(([n]) => n)
          .join("\n"),
      );
    }
    if (args[0] === "rm") {
      if (options.cleanupFail) return receipt(args, "", 1);
      containers.delete(args.at(-1));
      return receipt(args);
    }
    if (args[0] === "start") {
      return new Promise((resolve) => {
        if (config.signal.aborted)
          return resolve(receipt(args, "", 1, { cancelled: true }));
        config.signal.addEventListener(
          "abort",
          () => resolve(receipt(args, "", 1, { cancelled: true })),
          { once: true },
        );
      });
    }
    if (args[0] === "exec")
      return receipt(
        args,
        typeof options.observation === "function"
          ? options.observation(args)
          : (options.observation ?? {}),
      );
    throw Error("UNMODELLED_TRUSTED_COMMAND");
  };
  const adapter = new G0Docker(makeRunId(), sink, {
    execute,
    cleanupMs: options.cleanupMs ?? 10000,
  });
  adapter.imageId = imageId;
  adapter.imageEnv = env;
  return { adapter, containers, volumes, calls, sink };
}
test("G0 cleanup bounds an abort-ignoring join and issues no uncertain zero receipt", async () => {
  const h = harness({ cleanupMs: 30 });
  const never = new Promise(() => {});
  h.adapter.pending.add(never);
  const started = performance.now();
  let guard;
  try {
    const outcome = await Promise.race([
      h.adapter.close().then(
        () => "PASS",
        (e) => e.code,
      ),
      new Promise((resolve) => {
        guard = setTimeout(() => resolve("HUNG"), 500);
      }),
    ]);
    assert.equal(outcome, "G0_CLEANUP");
    assert.ok(performance.now() - started < 500);
    assert.equal(
      h.calls.length,
      0,
      "uncertain commands prohibit normal mutations",
    );
  } finally {
    clearTimeout(guard);
  }
});
test("G0 normal cleanup and fresh finalizer observe exact ownership and zero resources", async () => {
  const h = harness();
  const id = await h.adapter.create("runtime", "/opt/worker/launch.mjs");
  assert.ok(h.containers.has(id));
  assert.deepEqual(await h.adapter.close(), zero);
  assert.deepEqual(await h.adapter.finalize(), zero);
  assert.ok(
    h.calls
      .filter((a) => a[0] === "rm")
      .every((a) => /^[a-f0-9]{64}$/.test(a.at(-1))),
  );
  validateLedger(h.sink.latest);
});
test("G0 abort-ignoring cleanup commands cannot overrun close or independent finalize budgets", async () => {
  for (const method of ["close", "finalize"]) {
    const h = harness({ cleanupMs: 30 });
    await h.adapter.create("runtime", "/opt/worker/launch.mjs");
    const commands = [];
    h.adapter.execute = (args) => {
      commands.push(args);
      return new Promise(() => {});
    };
    let guard;
    try {
      const outcome = await Promise.race([
        h.adapter[method]().then(
          () => "PASS",
          (e) => e.code,
        ),
        new Promise((resolve) => {
          guard = setTimeout(() => resolve("HUNG"), 500);
        }),
      ]);
      assert.equal(outcome, "G0_CLEANUP");
      assert.equal(
        commands.length,
        1,
        "no new Docker operations after budget expires",
      );
      assert.equal(h.containers.size, 1, "unknown cleanup never reports zero");
    } finally {
      clearTimeout(guard);
    }
  }
});
test("G0 uncertain cleanup blocks another command even before the deadline expires", async () => {
  const h = harness();
  h.adapter.cleanupDeadline = performance.now() + 1000;
  let started = 0;
  h.adapter.execute = () => {
    started++;
    return new Promise(() => {});
  };
  await assert.rejects(
    () =>
      h.adapter.call(["inspect", "test-only"], { cleanup: true, timeoutMs: 5 }),
    /G0_CLEANUP/,
  );
  assert.ok(performance.now() < h.adapter.cleanupDeadline);
  await assert.rejects(
    () => h.adapter.call(["rm", "test-only"], { cleanup: true, timeoutMs: 5 }),
    /G0_CLEANUP/,
  );
  assert.equal(
    started,
    1,
    "no concurrent mutation after a command ignores abort",
  );
});
test("G0 finalizer never deletes a foreign same-prefix container or volume", async () => {
  const h = harness();
  await h.adapter.create("runtime", "/opt/worker/launch.mjs");
  const foreign = "f".repeat(64);
  const v = inspection(
    foreign,
    `${h.adapter.runId}-foreign`,
    makeRunId(),
    h.adapter.owner,
    "runtime",
    "/opt/worker/launch.mjs",
  );
  h.containers.set(foreign, v);
  h.volumes.set(`${h.adapter.runId}-foreign-volume`, "foreign");
  assert.deepEqual(await h.adapter.close(), zero);
  assert.deepEqual(await h.adapter.finalize(), zero);
  assert.ok(h.containers.has(foreign));
  assert.equal(h.volumes.size, 1);
  assert.ok(!h.calls.some((a) => a[0] === "rm" && a.includes(foreign)));
});
test("G0 unknown owner, forged ledger, incomplete inventory and cleanup failure stay ERROR", async () => {
  for (const options of [
    { missingInventory: true },
    { cleanupFail: true },
    {},
  ]) {
    const h = harness(options);
    const id = await h.adapter.create("runtime", "/opt/worker/launch.mjs");
    if (!Object.keys(options).length)
      h.containers.get(id).Config.Labels["metamorph.g0.owner"] = "foreign";
    await assert.rejects(() => h.adapter.close(), /G0_CLEANUP/);
    assert.equal(h.containers.has(id), !options.missingInventory);
    if (!Object.keys(options).length)
      assert.ok(!h.calls.some((a) => a[0] === "rm"));
  }
  const h = harness();
  await h.adapter.create("runtime", "/opt/worker/launch.mjs");
  const ledger = structuredClone(h.sink.latest);
  ledger.resources[0].name = "mmp007-foreign";
  rejectsCode(() => validateLedger(ledger), "G0_OWNERSHIP");
  ledger.resources[0].name = h.sink.latest.resources[0].name;
  ledger.resources.push(ledger.resources[0]);
  rejectsCode(() => validateLedger(ledger), "G0_OWNERSHIP");
});
test("G0 partial create timeout recovers its exact ID and retains honest cleanup", async () => {
  const h = harness({ partial: true });
  await assert.rejects(
    () => h.adapter.create("runtime", "/opt/worker/launch.mjs"),
    /G0_TIMEOUT/,
  );
  assert.equal(h.adapter.ledger[0].id, null);
  assert.deepEqual(await h.adapter.close(), zero);
  assert.equal(h.containers.size, 0);
});
test("G0 cancellation joins attached Docker command and finalizer counts emergency removal", async () => {
  const h = harness();
  await h.adapter.launch([
    { path: "main.js", base64: "eA==", sha256: sha256("x") },
  ]);
  assert.deepEqual(await h.adapter.close(), zero);
  assert.equal(h.adapter.pending.size, 0);
  const emergency = harness();
  await emergency.adapter.create("runtime", "/opt/worker/launch.mjs");
  assert.equal((await emergency.adapter.finalize()).emergencyRemoved, 1);
  const expired = harness();
  expired.adapter.deadline = performance.now() - 1;
  await assert.rejects(
    () => expired.adapter.create("build", "/opt/worker/build.mjs"),
    /G0_TIMEOUT/,
  );
});
test("G0 control execution cannot be skipped or answered by a partial boolean object", async () => {
  const h = harness({
    observation: { absent: true, process: true, environment: true },
  });
  h.adapter.runtimeId = hash;
  await assert.rejects(() => h.adapter.probes(), /G0_ISOLATION/);
  const partial = harness({
    observation: (args) =>
      args.at(-1).includes("const os")
        ? {
            absent: true,
            process: true,
            environment: true,
            namespace: true,
            bounds: true,
            privileges: true,
          }
        : {
            filesystem: true,
            php: true,
            reference: true,
            corpus: true,
            docker: true,
            spawn: true,
            native: true,
            network: false,
            ipc: true,
          },
  });
  partial.adapter.runtimeId = hash;
  await assert.rejects(() => partial.adapter.probes(), /G0_CONTROL_FAILED/);
});

test("G0 foreign resource appearing during work does not prevent best-effort exact-ID teardown", async () => {
  const h = harness();
  const ownId = await h.adapter.create("runtime", "/opt/worker/launch.mjs");
  const foreignId = "f".repeat(64);
  h.containers.set(
    foreignId,
    inspection(
      foreignId,
      `${h.adapter.runId}-foreign`,
      h.adapter.runId,
      "foreign-owner",
      "runtime",
      "/opt/worker/launch.mjs",
    ),
  );
  await assert.rejects(() => h.adapter.close(), /G0_CLEANUP/);
  assert.ok(!h.containers.has(ownId));
  assert.ok(h.containers.has(foreignId));
  assert.ok(!h.calls.some((a) => a[0] === "rm" && a.includes(foreignId)));
});

test("G0 bounded dynamic recipe rejects static golden replay without executing TS on host", async () => {
  // This is an observation model for the trusted challenge, not a target run.
  await assert.rejects(
    () => challenge("items-v1", async () => ({ items: [] })),
    /G0_CHALLENGE/,
  );
  await assert.rejects(
    () =>
      challenge("items-v1", async (method) =>
        method === "POST"
          ? { items: [{ id: 1, value: "unit-public" }] }
          : { items: [] },
      ),
    /G0_CHALLENGE/,
  );
  const cases = await syntheticCases();
  assert.equal(cases.length, 11);
  assert.equal(
    new Set(cases.map((c) => c.bundle.candidateSha)).size,
    cases.length,
  );
  for (const fixture of cases) {
    if (fixture.id === "spawn-import")
      rejectsCode(() => inspectSource(fixture.bundle), "G0_FORBIDDEN_IMPORT");
    else inspectSource(fixture.bundle);
  }
  assert.match((await recipe()).recipeSha, /^[a-f0-9]{64}$/);
});
test("G0 private trace retains partial faults, rejects late writers and seals exact bytes", () => {
  const parent = mkdtempSync(join(tmpdir(), "g0-evidence-"));
  chmodSync(parent, 0o700);
  try {
    const sink = new Evidence(join(parent, "run"));
    sink.record("partial", { code: "G0_TIMEOUT" });
    const proof = sink.seal();
    assert.equal(
      sha256(readFileSync(join(parent, "run/trace.jsonl"))),
      proof.sha256,
    );
    assert.equal(proof.events, 1);
    verifyEvidence(join(parent, "run"), proof);
    writeFileSync(join(parent, "run/trace.jsonl"), "tampered");
    rejectsCode(
      () => verifyEvidence(join(parent, "run"), proof),
      "G0_EVIDENCE",
    );
    rejectsCode(() => sink.record("late", {}), "G0_EVIDENCE");
    const more = new Evidence(join(parent, "more"));
    assert.throws(
      () => more.record("oversized", "x".repeat(33 * 1024 * 1024)),
      /G0_EVIDENCE/,
    );
    // Close the descriptor even after admission rejects the oversized event.
    try {
      more.seal();
    } catch {}
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
test("G0 private registration and ledger parsing reject duplicate or malformed JSON", () => {
  const parent = mkdtempSync(join(tmpdir(), "g0-json-"));
  chmodSync(parent, 0o700);
  try {
    const file = join(parent, "record.json");
    for (const text of [
      '{"runId":"first","runId":"forged"}',
      '{"x":',
      '{"runId":"x","\\u0072unId":"y"}',
    ]) {
      writeFileSync(file, text, { mode: 0o600 });
      rejectsCode(() => readPrivateJson(file), "G0_EVIDENCE");
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
test("POSIX G0 staging and evidence reject links and permission tamper", {
  skip: process.platform === "win32",
}, () => {
  const parent = mkdtempSync(join(tmpdir(), "g0-posix-"));
  chmodSync(parent, 0o700);
  try {
    const file = join(parent, "file");
    writeFileSync(file, "{}", { mode: 0o600 });
    privatePath(file);
    assert.deepEqual(readPrivateJson(file), {});
    chmodSync(file, 0o644);
    rejectsCode(() => privatePath(file), "G0_EVIDENCE");
    chmodSync(file, 0o600);
    const link = join(parent, "link");
    symlinkSync(file, link);
    rejectsCode(() => privatePath(link), "G0_EVIDENCE");
    const hard = join(parent, "hard");
    linkSync(file, hard);
    rejectsCode(() => privatePath(hard), "G0_EVIDENCE");
    const nested = join(parent, "nested");
    mkdirSync(nested, { mode: 0o700 });
    chmodSync(nested, 0o755);
    rejectsCode(() => privatePath(nested, true), "G0_EVIDENCE");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
