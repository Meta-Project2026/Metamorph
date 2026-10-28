// Versioned public envelope. Digests authenticate bytes, not operator honesty.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPublic } from "../mmp-049/verify.mjs";
import { artifact, json, PUBLIC, ROLES } from "./lib.mjs";
import { validateTopology } from "./network.mjs";

export const HOST_IDS = [
  "host-ipv4",
  "host-ipv6",
  "host-dns",
  "host-registry",
  "host-github",
];
export function verifyEnvelope(receipt, head) {
  assert.equal(receipt.format, "mmp054-offline-v1");
  assert.equal(receipt.headSha, head);
  assert.equal(receipt.status, "OFFLINE_PUBLIC_PASS_SCOPED");
  assert.equal(receipt.mode, "isolated-linux-context-native-daemon-v1");
  assert.equal(receipt.provider, "offline-deterministic-replay");
  assert.equal(receipt.localLlm, "LOCAL_LLM_GENERATION_NOT_RUN");
  assert.equal(receipt.remoteAi, "NOT_RUN");
  assert.equal(receipt.paidCalls, 0);
  assert.equal(receipt.G0, "INCONCLUSIVE");
  assert.equal(receipt.G4, "INCONCLUSIVE");
  assert.equal(receipt.product, "NOT_ESTABLISHED");
  assert.equal(receipt.historicalAudit, "UNCHANGED");
  assert.deepEqual(Object.keys(receipt.images).sort(), [
    "node",
    "php",
    "phpRuntime",
    "targetRuntime",
  ]);
  for (const id of Object.values(receipt.images))
    assert.match(id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(receipt.runner.platform, "linux/amd64");
  assert.match(receipt.runner.node, /^v(?:22|24)\./);
  assert.equal(receipt.runner.pnpm, "11.25.0");
  assert.equal(receipt.runner.dockerServer.Os, "linux");
  assert.equal(receipt.runner.dockerServer.Arch, "amd64");
  for (const key of ["osReleaseSha256", "daemonIdSha256"])
    assert.match(receipt.runner[key], /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(receipt.runner.tools).sort(), [
    "docker",
    "git",
    "node",
    "pnpm",
  ]);
  for (const t of Object.values(receipt.runner.tools)) {
    assert.match(t.sha256, /^[a-f0-9]{64}$/);
    assert.ok(t.bytes > 0);
  }
  assert.ok(receipt.errorCode === undefined || receipt.errorCode === null);
  assert.deepEqual(receipt.coverage, {
    pairs: 42,
    http: 110,
    sqlite: 152,
    agentPairs: 6,
    agentHttp: 34,
    agentSqlite: 40,
  });
  for (const t of [receipt.network.before, receipt.network.after])
    validateTopology(t);
  for (const controls of [
    receipt.network.controlsBefore,
    receipt.network.controlsAfter,
  ]) {
    assert.deepEqual(
      controls.map((c) => c.id),
      HOST_IDS,
    );
    assert.ok(
      controls.every(
        (c) => c.status === "DENIED" && typeof c.code === "string",
      ),
    );
  }
  assert.deepEqual(
    receipt.network.workers.map((w) => w.role),
    ROLES,
  );
  for (const w of receipt.network.workers) {
    assert.equal(w.status, "DENIED");
    assert.equal(w.exitCode, 0);
    assert.equal(w.network, "none");
    assert.deepEqual(w.tests, ["ipv4", "ipv6", "dns"]);
    assert.equal(w.cleanup, "PASS");
    assert.match(w.imageId, /^sha256:[a-f0-9]{64}$/);
    const key =
      w.role === "php-probe"
        ? "php"
        : w.role === "node-probe"
          ? "node"
          : w.role.startsWith("php")
            ? "phpRuntime"
            : "targetRuntime";
    assert.equal(w.imageId, receipt.images[key], "WORKER_IMAGE_DRIFT");
  }
  assert.equal(receipt.network.daemonRegistry, "DENIED");
  assert.equal(receipt.network.remoteFallback, "DENIED_BEFORE_NETWORK");
  assert.equal(receipt.network.missingImage, "REJECTED_BEFORE_NETWORK");
  assert.equal(receipt.network.gatewayErrors, 0);
  assert.ok(receipt.network.preparedPhpUses >= 2);
  assert.ok(receipt.network.preparedTsUses >= 2);
  assert.ok(receipt.network.localArchiveUses >= 2);
  assert.equal(receipt.offlineInstall, "PASS");
  assert.deepEqual(receipt.cleanup, {
    status: "PASS",
    containers: 0,
    volumes: 0,
    emergencyRemoved: 0,
  });
  assert.deepEqual(
    receipt.steps.map((s) => s.name),
    ["probe", "proof", "agent", "finalizer"],
  );
  assert.ok(receipt.steps.every((s) => s.exitCode === 0));
  assert.ok(
    Number.isFinite(receipt.elapsedMs) &&
      receipt.elapsedMs > 0 &&
      receipt.elapsedMs <= 60 * 60 * 1000,
  );
  for (const key of ["bundleSha256", "gatewayLogSha256", "transportLogSha256"])
    assert.match(receipt[key], /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(receipt.publicFiles).sort(), [...PUBLIC].sort());
  for (const a of Object.values(receipt.publicFiles)) {
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
    assert.ok(a.bytes > 0);
  }
  return receipt.status;
}
export function verify(directory, head) {
  assert.match(head, /^[a-f0-9]{40}$/);
  const r = json(join(directory, "offline.json"));
  verifyEnvelope(r, head);
  for (const n of PUBLIC)
    assert.deepEqual(
      artifact(join(directory, n)),
      r.publicFiles[n],
      "PUBLIC_RECEIPT_CORRUPT",
    );
  const parity = verifyPublic((n) => readFileSync(join(directory, n)), head);
  const proof = json(join(directory, "summary.json"));
  const agent = json(join(directory, "agent.json"));
  assert.deepEqual(r.coverage, {
    pairs: 42,
    http: 110,
    sqlite: 152,
    agentPairs: 6,
    agentHttp: 34,
    agentSqlite: 40,
  });
  assert.equal(
    proof.groups.reduce((n, g) => n + g.result.pairs, 0),
    r.coverage.pairs,
  );
  assert.equal(
    proof.groups.reduce((n, g) => n + g.result.http, 0),
    r.coverage.http,
  );
  assert.equal(
    proof.groups.reduce((n, g) => n + g.result.sqlite, 0),
    r.coverage.sqlite,
  );
  assert.equal(
    agent.attempts.reduce((n, a) => n + a.pairs.length, 0),
    r.coverage.agentPairs,
  );
  assert.equal(r.images.phpRuntime, proof.runtime.phpImageId);
  assert.equal(r.images.targetRuntime, proof.runtime.targetImageId);
  assert.equal(r.images.phpRuntime, agent.phpImageId);
  assert.equal(r.images.targetRuntime, agent.targetImageId);
  assert.equal(r.sourceSha256, proof.runtime.sourceSha256);
  return {
    status: r.status,
    parity,
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(JSON.stringify(verify(...process.argv.slice(2)), null, 2));
}
