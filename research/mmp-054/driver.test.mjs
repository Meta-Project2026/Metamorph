// Host unit/receipt tests only. Synthetic envelopes are NEVER runtime evidence.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { SOURCE } from "../../packages/oracle/dist/reference/manifest.js";
import { plan } from "./docker-gateway.mjs";
import { artifact, PUBLIC, ROLES, root, sha, validateBundle } from "./lib.mjs";
import { validateTopology } from "./network.mjs";
import { offlineFetch } from "./offline-preload.mjs";
import { HOST_IDS, verify, verifyEnvelope } from "./verify.mjs";

const digest = "a".repeat(64);
const head = "b".repeat(40);
const image = {
  id: `sha256:${digest}`,
  ref: null,
  repoDigests: [],
  arch: "amd64",
  os: "linux",
  bytes: 123,
};
function bundle() {
  return {
    format: "mmp054-prepared-v1",
    headSha: head,
    platform: "linux/amd64",
    node: process.version,
    pnpmVersion: "11.25.0",
    pnpm: "/usr/local/bin/pnpm",
    source: SOURCE,
    images: {
      php: { ...image, ref: SOURCE.image },
      node: { ...image, ref: `node@sha256:${digest}` },
      phpRuntime: image,
      targetRuntime: image,
    },
    artifacts: {
      "source.tgz": { sha256: digest, bytes: 1 },
      "images.tar": { sha256: digest, bytes: 1 },
    },
    dependencies: { file: digest },
    store: { file: digest },
    compiled: { file: digest },
    toolchain: Object.fromEntries(
      ["node", "pnpm", "docker", "git"].map((n) => [
        n,
        { path: `/usr/bin/${n}`, bytes: 1, sha256: digest },
      ]),
    ),
  };
}
const topology = () => ({
  platform: "linux",
  arch: "x64",
  interfaces: ["docker0", "lo"],
  defaultRoutes: 0,
  interfaceKinds: { docker0: "virtual-bridge", lo: "virtual-loopback" },
  hostNamespace: "net:[123]",
  daemonNamespace: "net:[123]",
  containerdNamespace: "net:[123]",
  daemonExecutable: "dockerd",
  containerdExecutable: "containerd",
});
function envelope() {
  const controls = HOST_IDS.map((id) => ({
    id,
    status: "DENIED",
    code: "ENETUNREACH",
  }));
  return {
    format: "mmp054-offline-v1",
    headSha: head,
    status: "OFFLINE_PUBLIC_PASS_SCOPED",
    mode: "isolated-linux-context-native-daemon-v1",
    provider: "offline-deterministic-replay",
    localLlm: "LOCAL_LLM_GENERATION_NOT_RUN",
    remoteAi: "NOT_RUN",
    paidCalls: 0,
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    historicalAudit: "UNCHANGED",
    images: Object.fromEntries(
      ["php", "node", "phpRuntime", "targetRuntime"].map((n) => [n, image.id]),
    ),
    offlineInstall: "PASS",
    bundleSha256: digest,
    gatewayLogSha256: digest,
    transportLogSha256: digest,
    elapsedMs: 1000,
    runner: {
      platform: "linux/amd64",
      node: process.version,
      pnpm: "11.25.0",
      dockerServer: { Os: "linux", Arch: "amd64" },
      osReleaseSha256: digest,
      daemonIdSha256: digest,
      tools: Object.fromEntries(
        ["node", "pnpm", "docker", "git"].map((n) => [
          n,
          { bytes: 1, sha256: digest },
        ]),
      ),
    },
    cleanup: { status: "PASS", containers: 0, volumes: 0, emergencyRemoved: 0 },
    steps: ["probe", "proof", "agent", "finalizer"].map((name) => ({
      name,
      exitCode: 0,
    })),
    coverage: {
      pairs: 42,
      http: 110,
      sqlite: 152,
      agentPairs: 6,
      agentHttp: 34,
      agentSqlite: 40,
    },
    publicFiles: Object.fromEntries(
      PUBLIC.map((n) => [n, { bytes: 123, sha256: digest }]),
    ),
    network: {
      before: topology(),
      after: topology(),
      controlsBefore: structuredClone(controls),
      controlsAfter: structuredClone(controls),
      workers: ROLES.map((role) => ({
        role,
        imageId: image.id,
        tests: ["ipv4", "ipv6", "dns"],
        status: "DENIED",
        network: "none",
        exitCode: 0,
        cleanup: "PASS",
      })),
      daemonRegistry: "DENIED",
      remoteFallback: "DENIED_BEFORE_NETWORK",
      missingImage: "REJECTED_BEFORE_NETWORK",
      gatewayErrors: 0,
      preparedPhpUses: 2,
      preparedTsUses: 2,
      localArchiveUses: 2,
    },
  };
}
test("complete synthetic envelope validates its structure only", () => {
  assert.equal(verifyEnvelope(envelope(), head), "OFFLINE_PUBLIC_PASS_SCOPED");
  validateBundle(bundle(), head);
});
for (const [name, mutate] of [
  [
    "wrong source SHA",
    (b) => {
      b.headSha = "c".repeat(40);
    },
  ],
  [
    "wrong image digest",
    (b) => {
      b.images.php = { ...b.images.php, id: "sha256:wrong" };
    },
  ],
  [
    "unpinned image",
    (b) => {
      b.images.node.ref = "node:latest";
    },
  ],
  [
    "prefetch store missing",
    (b) => {
      b.store = {};
    },
  ],
  [
    "dependencies missing",
    (b) => {
      b.dependencies = {};
    },
  ],
  [
    "compiled verifier missing",
    (b) => {
      b.compiled = {};
    },
  ],
  [
    "missing image archive",
    (b) => {
      delete b.artifacts["images.tar"];
    },
  ],
  [
    "wrong architecture",
    (b) => {
      b.platform = "linux/arm64";
    },
  ],
])
  test(`preparation rejects ${name}`, () => {
    const b = bundle();
    mutate(b);
    assert.throws(() => validateBundle(b, head));
  });

for (const [name, args] of [
  ["missing image", ["pull", "registry.invalid/miss:1"]],
  ["online context", ["--context", "remote", "info"]],
  ["registry login", ["login", "registry.invalid"]],
  [
    "unapproved recipe",
    ["build", "--pull", "--tag", "other", "/tmp/untrusted"],
  ],
  ["implicit network", ["run", "--read-only", image.id]],
  ["host network", ["run", "--network", "host", "--read-only", image.id]],
  ["image loading at runtime", ["load", "-i", "images.tar"]],
])
  test(`Docker gateway rejects ${name}`, () =>
    assert.throws(() => plan(args, bundle())));
test("pull becomes exact local inspection, toolchain provisioning uses the prepared image, with no build/pull shell-out", () => {
  const b = bundle();
  assert.deepEqual(plan(["pull", SOURCE.image], b).args, [
    "image",
    "inspect",
    image.id,
  ]);
  const tag = "metamorph-target-worker:00000000-0000-0000-0000-000000000000";
  const p = plan(
    [
      "build",
      "--pull",
      "--tag",
      tag,
      join(root, "packages/target-worker/runtime"),
    ],
    b,
  );
  assert.deepEqual(p.args, ["tag", image.id, tag]);
});
test("every isolated Docker run gets pull=never; shared inspectors must join a verified none network", () => {
  const args = [
    "run",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    image.id,
    "node",
  ];
  assert.deepEqual(plan(args, bundle()).args.slice(0, 2), [
    "run",
    "--pull=never",
  ]);
  assert.equal(
    plan(
      args.map((v) => (v === "none" ? `container:${digest}` : v)),
      bundle(),
    ).network,
    `container:${digest}`,
  );
});
test("local source transport admits exact prepared bytes; remote model/registry and corrupt/missing cache fail before network", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mmp054-unit-"));
  try {
    const bytes = Buffer.from(
      "synthetic source archive, not executable evidence",
    );
    const b = bundle();
    b.source = { ...SOURCE, archiveSha256: sha(bytes) };
    writeFileSync(join(dir, "source.tgz"), bytes);
    const fetch = offlineFetch(b, dir);
    const url = `https://codeload.github.com/${SOURCE.repository}/tar.gz/${SOURCE.commit}`;
    assert.deepEqual(
      Buffer.from(await (await fetch(url)).arrayBuffer()),
      bytes,
    );
    for (const remote of [
      "https://api.meta.com/v1/models",
      "https://registry.npmjs.org/typescript",
      `${url}?fallback=1`,
    ])
      await assert.rejects(fetch(remote), /OFFLINE_REMOTE_FORBIDDEN/);
    writeFileSync(join(dir, "source.tgz"), "corrupt");
    await assert.rejects(fetch(url), /PREFETCH_DIGEST/);
    await assert.rejects(offlineFetch(b, join(dir, "missing"))(url));
  } finally {
    assert.ok(
      resolve(dir).startsWith(resolve(tmpdir()) + "\\") ||
        resolve(dir).startsWith(resolve(tmpdir()) + "/"),
    );
    rmSync(dir, { recursive: true });
  }
});
test("explicit Node preload rejects a remote-provider fallback in a fresh host process", () => {
  const dir = mkdtempSync(join(tmpdir(), "mmp054-unit-"));
  try {
    const bytes = Buffer.from(JSON.stringify(bundle()));
    writeFileSync(join(dir, "prepared.json"), bytes);
    const r = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(join(root, "research/mmp-054/offline-preload.mjs")).href,
        "--input-type=module",
        "-e",
        "try { await fetch('https://api.meta.com/offline-test'); process.exit(9); } catch (e) { if(e.message !== 'OFFLINE_REMOTE_FORBIDDEN') throw e; console.log('DENIED_BEFORE_NETWORK'); }",
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          MMP054_PRELOAD: "1",
          MMP054_BUNDLE: dir,
          MMP054_BUNDLE_SHA: sha(bytes),
          MMP054_TRANSPORT_LOG: join(dir, "transport.jsonl"),
        },
      },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "DENIED_BEFORE_NETWORK");
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "transport.jsonl"))), {
      event: "REMOTE_FALLBACK_DENIED",
    });
  } finally {
    assert.ok(dir.startsWith(join(tmpdir(), "mmp054-unit-")));
    rmSync(dir, { recursive: true });
  }
});
for (const [name, mutate] of [
  ["physical NIC still present", (t) => t.interfaces.push("eth0")],
  [
    "default route",
    (t) => {
      t.defaultRoutes = 1;
    },
  ],
  [
    "renamed external interface",
    (t) => {
      t.interfaceKinds.docker0 = "physical";
    },
  ],
  [
    "peer namespace interface",
    (t) => {
      t.interfaces.push("veth12345");
      t.interfaceKinds.veth12345 = "peer-or-other";
    },
  ],
  [
    "host-only netns with online daemon",
    (t) => {
      t.daemonNamespace = "net:[999]";
    },
  ],
  [
    "containerd outside offline context",
    (t) => {
      t.containerdNamespace = "net:[999]";
    },
  ],
  [
    "remote Docker socket",
    (t) => {
      t.daemonExecutable = "proxy";
    },
  ],
])
  test(`network admission rejects ${name}`, () => {
    const t = topology();
    mutate(t);
    assert.throws(() => validateTopology(t));
  });
for (const [name, mutate] of [
  ["missing finalizer", (r) => r.steps.pop()],
  [
    "failed stage",
    (r) => {
      r.steps[1].exitCode = 1;
    },
  ],
  ["missing host DNS denial", (r) => r.network.controlsBefore.pop()],
  [
    "unexpected egress",
    (r) => {
      r.network.controlsAfter[0].status = "ERROR";
    },
  ],
  ["missing worker boundary", (r) => r.network.workers.pop()],
  ["missing worker DNS control", (r) => r.network.workers[0].tests.pop()],
  [
    "container-only denial",
    (r) => {
      r.network.before.daemonNamespace = "net:[999]";
    },
  ],
  [
    "registry fallback",
    (r) => {
      r.network.remoteFallback = "ALLOWED";
    },
  ],
  [
    "daemon boundary missing",
    (r) => {
      r.network.daemonRegistry = "NOT_RUN";
    },
  ],
  [
    "missing cache path",
    (r) => {
      r.network.localArchiveUses = 0;
    },
  ],
  [
    "wrong pair count",
    (r) => {
      r.coverage.pairs--;
    },
  ],
  [
    "missing initial SQLite",
    (r) => {
      r.coverage.sqlite--;
    },
  ],
  [
    "unknown inventory",
    (r) => {
      r.cleanup.containers = null;
    },
  ],
  [
    "emergency cleanup even after final zero",
    (r) => {
      r.cleanup.emergencyRemoved = 1;
    },
  ],
  [
    "fake local LLM claim",
    (r) => {
      r.localLlm = "GENERATED";
    },
  ],
  [
    "wrong worker image digest",
    (r) => {
      r.network.workers[0].imageId = `sha256:${"c".repeat(64)}`;
    },
  ],
  [
    "paid provider call",
    (r) => {
      r.paidCalls = 1;
    },
  ],
  [
    "product overclaim",
    (r) => {
      r.product = "PASS";
    },
  ],
  [
    "erased primary error",
    (r) => {
      r.errorCode = "PRIOR_ERROR";
    },
  ],
])
  test(`offline receipt rejects ${name}`, () => {
    const r = envelope();
    mutate(r);
    assert.throws(() => verifyEnvelope(r, head));
  });

// Reuse immutable HISTORICAL PUBLIC receipts solely to exercise the complete
// validator. The synthetic envelope below does not turn that online run offline.
const history = join(
  root,
  "specs/016-candidate-compat/evidence/run-40720986007",
);
function historicalTest(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "mmp054-unit-"));
  try {
    for (const n of PUBLIC) copyFileSync(join(history, n), join(dir, n));
    const proof = JSON.parse(readFileSync(join(dir, "summary.json")));
    const r = envelope();
    r.headSha = proof.headSha;
    r.images = {
      ...r.images,
      phpRuntime: proof.runtime.phpImageId,
      targetRuntime: proof.runtime.targetImageId,
    };
    for (const w of r.network.workers)
      w.imageId =
        r.images[
          w.role === "php-probe"
            ? "php"
            : w.role === "node-probe"
              ? "node"
              : w.role.startsWith("php")
                ? "phpRuntime"
                : "targetRuntime"
        ];
    r.sourceSha256 = proof.runtime.sourceSha256;
    if (mutate) mutate(dir, r);
    r.publicFiles = Object.fromEntries(
      PUBLIC.map((n) => [n, artifact(join(dir, n))]),
    );
    writeFileSync(join(dir, "offline.json"), JSON.stringify(r));
    return verify(dir, proof.headSha);
  } finally {
    assert.ok(dir.startsWith(join(tmpdir(), "mmp054-unit-")));
    rmSync(dir, { recursive: true });
  }
}
test("complete validator composes unchanged MMP-049 public checker (historical test fixture only)", () =>
  assert.equal(historicalTest().status, "OFFLINE_PUBLIC_PASS_SCOPED"));
for (const [name, mutate] of [
  [
    "missing original negative control",
    (p) => {
      delete p.httpControls.negative;
    },
  ],
  [
    "wrong negative mutation",
    (p) => {
      p.httpControls.negative.codes = ["DB_STATE"];
    },
  ],
  ["missing mandatory pair", (p) => p.groups[0].cases.pop()],
  [
    "skipped HTTP step",
    (p) => {
      p.groups[0].cases[0].executedHttp--;
    },
  ],
  [
    "emergency finalizer",
    (p) => {
      p.cleanup.emergencyRemoved = 1;
    },
  ],
])
  test(`complete receipt checker rejects ${name}`, () =>
    assert.throws(() =>
      historicalTest((dir) => {
        const path = join(dir, "summary.json");
        const p = JSON.parse(readFileSync(path));
        mutate(p);
        writeFileSync(path, JSON.stringify(p));
      }),
    ));
test("corrupt receipt cannot be accepted by changing its byte digest", () =>
  assert.throws(() =>
    historicalTest((dir) => writeFileSync(join(dir, "agent.json"), "{broken")),
  ));
