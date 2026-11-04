import { generateKeyPairSync, sign } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkpointMessage,
  createSyntheticTestRegistry,
  verifySignatures,
} from "../src/core.mjs";
import { createSyntheticRegistry } from "../src/index.mjs";
import { apply, initialState } from "../src/state.mjs";
import { canonical, hash } from "../src/validation.mjs";

const ids = [
  "synthetic-alice",
  "synthetic-bob",
  "synthetic-custodian",
  "synthetic-reviewer",
  "synthetic-witness",
  "synthetic-storage",
  "synthetic-recovery",
];
const temporaryDirectories = new Set();
process.on("exit", () => {
  for (const directory of temporaryDirectories)
    rmSync(directory, { recursive: true, force: true });
});

export function fixture({ deterministic = true } = {}) {
  const keys = Object.fromEntries(
    ids.map((id) => [id, generateKeyPairSync("ed25519")]),
  );
  const trust = {
    principals: Object.fromEntries(
      ids.map((id) => [
        id,
        keys[id].publicKey.export({ format: "pem", type: "spki" }),
      ]),
    ),
    owners: ["synthetic-alice", "synthetic-bob"],
    author: "synthetic-alice",
    custodian: "synthetic-custodian",
    reviewer: "synthetic-reviewer",
    witness: "synthetic-witness",
    storageAdmins: ["synthetic-storage"],
    recoveryDelegates: ["synthetic-recovery"],
  };
  const directory = mkdtempSync(join(tmpdir(), "mmp056-synthetic-"));
  temporaryDirectories.add(directory);
  const witnessPath = join(directory, "witness.ndjson");
  let seq = 0;
  let head = "0".repeat(64);
  let witnessState = initialState();
  let invalidWitness = false;
  let failAfterWitness = false;
  const signedCheckpoint = () => ({
    seq,
    hash: head,
    signature: sign(
      null,
      Buffer.from(checkpointMessage(seq, head), "hex"),
      invalidWitness
        ? keys["synthetic-alice"].privateKey
        : keys["synthetic-witness"].privateKey,
    ).toString("base64"),
  });
  const witness = {
    checkpoint: signedCheckpoint,
    record: (record) => {
      if (record.seq !== seq + 1 || record.prev !== head)
        throw new Error("WITNESS_REPLAY");
      verifySignatures(record.event, record.signatures, trust);
      if (
        hash(
          canonical({ event: record.event, signatures: record.signatures }),
        ) !== record.hash
      )
        throw new Error("WITNESS_EVENT_MISMATCH");
      witnessState = apply(witnessState, record.event, trust, record.hash);
      seq = record.seq;
      head = record.hash;
      const checkpoint = signedCheckpoint();
      const fd = openSync(witnessPath, "a", 0o600);
      try {
        writeFileSync(fd, `${JSON.stringify({ record, checkpoint })}\n`);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      if (failAfterWitness) throw new Error("SYNTHETIC_WITNESS_DISCONNECT");
      return checkpoint;
    },
  };
  let deny = null;
  let forged = null;
  let denyType = null;
  const authorize = (intentHash, required, type) =>
    Object.fromEntries(
      required
        .filter(
          (principal) =>
            principal !== deny || (denyType !== null && denyType !== type),
        )
        .map((principal) => [
          principal,
          sign(
            null,
            Buffer.from(intentHash, "hex"),
            keys[forged === principal ? "synthetic-storage" : principal]
              .privateKey,
          ).toString("base64"),
        ]),
    );
  let entropyCounter = 0;
  let entropyFail = false;
  let entropyConstant = false;
  const entropy = {
    bytes: (size) => {
      if (entropyFail) throw new Error("SYNTHETIC_ENTROPY_FAILURE");
      return Buffer.alloc(size, entropyConstant ? 1 : ++entropyCounter);
    },
    int: (maximum) => {
      if (entropyFail) throw new Error("SYNTHETIC_ENTROPY_FAILURE");
      return entropyCounter++ % maximum;
    },
  };
  const journalPath = join(directory, "journal.ndjson");
  const config = { journalPath, trust, witness, authorize };
  const create = () =>
    deterministic
      ? createSyntheticTestRegistry(config, entropy)
      : createSyntheticRegistry(config);
  const registry = create();
  const registration = {
    format: "mmp-056-synthetic-registration-v1",
    benchmarkId: "synthetic-benchmark",
    version: "synthetic-v1",
    epochId: "synthetic-epoch",
    registrationId: "synthetic-registration",
    runId: "synthetic-run",
    custodyScopeId: "synthetic-custody",
    source: {
      kind: "SYNTHETIC_PUBLIC_FIXTURE",
      repository: "https://example.invalid/synthetic-project",
      commit: "a".repeat(40),
      license: "MIT",
      noticeSha256: "b".repeat(64),
    },
    scope: {
      routes: ["synthetic-route-a", "synthetic-route-b"],
      units: ["synthetic-unit-a", "synthetic-unit-b"],
      unitRoutes: [
        { unit: "synthetic-unit-a", route: "synthetic-route-a" },
        { unit: "synthetic-unit-b", route: "synthetic-route-b" },
      ],
      unsupported: ["synthetic-unsupported-upload"],
      comparator: { id: "synthetic-comparator-v1", sha256: "c".repeat(64) },
      runtime: { id: "synthetic-runtime-v1", sha256: "d".repeat(64) },
      gates: { G0: true, G1: true, G2: true, G3: true, G4: true },
    },
    custody: {
      profile: "INDEPENDENT_CUSTODIAN",
      sharedRoot: false,
      exposures: ids.map((principal) => ({
        principal,
        cases: false,
        answers: false,
        entropy: false,
        rawDifferences: false,
      })),
      adminDomains: ids.map((principal) => ({
        id: `${principal}-domain`,
        principals: [principal],
      })),
    },
    pool: [
      {
        id: "synthetic-case-a",
        stratum: "synthetic-stratum-a",
        unit: "synthetic-unit-a",
        route: "synthetic-route-a",
      },
      {
        id: "synthetic-case-b",
        stratum: "synthetic-stratum-a",
        unit: "synthetic-unit-a",
        route: "synthetic-route-a",
      },
      {
        id: "synthetic-case-c",
        stratum: "synthetic-stratum-a",
        unit: "synthetic-unit-a",
        route: "synthetic-route-a",
      },
      {
        id: "synthetic-case-d",
        stratum: "synthetic-stratum-b",
        unit: "synthetic-unit-b",
        route: "synthetic-route-b",
      },
      {
        id: "synthetic-case-e",
        stratum: "synthetic-stratum-b",
        unit: "synthetic-unit-b",
        route: "synthetic-route-b",
      },
    ].map((entry) => ({
      ...entry,
      fixtureSha256: hash(Buffer.from(entry.id, "utf8")),
    })),
    policy: {
      algorithm: "stratified-fisher-yates-v1",
      strata: [
        { id: "synthetic-stratum-a", count: 2 },
        { id: "synthetic-stratum-b", count: 1 },
      ],
      mandatoryCaseIds: ["synthetic-case-a", "synthetic-case-d"],
      maxAttempts: 2,
      retryOn: ["ENVIRONMENT_ERROR", "HARNESS_ERROR"],
    },
    budgets: { wallMs: 5000, memoryMiB: 256, pids: 32, maxLogBytes: 4096 },
  };
  const freeze = {
    registrationId: registration.registrationId,
    epochId: registration.epochId,
    candidateGitSha: "e".repeat(40),
    candidateBundleSha256: "f".repeat(64),
    workspaceManifestSha256: "1".repeat(64),
    buildSha256: "2".repeat(64),
    runtimeSha256: registration.scope.runtime.sha256,
    g0ReceiptSha256: "3".repeat(64),
    g1ReceiptSha256: "4".repeat(64),
    evaluatorSha256: "5".repeat(64),
  };
  const mutate = {
    deny: (principal, type = null) => {
      deny = principal;
      denyType = type;
    },
    forge: (principal) => {
      forged = principal;
    },
    invalidWitness: (value) => {
      invalidWitness = value;
    },
    entropyFail: (value) => {
      entropyFail = value;
    },
    entropyConstant: (value) => {
      entropyConstant = value;
    },
    failAfterWitness: (value) => {
      failAfterWitness = value;
    },
  };
  const records = () =>
    readFileSync(journalPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  return {
    registry,
    registration,
    freeze,
    trust,
    config,
    create,
    mutate,
    records,
    journalPath,
  };
}

export function registered(f) {
  f.registry.register(f.registration);
}
export function frozen(f) {
  registered(f);
  f.registry.freeze(f.freeze);
}
export function selected(f) {
  frozen(f);
  f.registry.draw({ drawId: "synthetic-draw" });
}
export function authorized(f, attemptId = "synthetic-attempt-1") {
  selected(f);
  return f.registry.authorizeAttempt({
    attemptId,
    retryOf: null,
    selectionReusable: false,
    validUntil: validUntil(),
  });
}
export function validUntil() {
  return new Date(Date.now() + 60000).toISOString();
}
export function started(f, attemptId = "synthetic-attempt-1") {
  const receipt = authorized(f, attemptId);
  f.registry.startAttempt({
    attemptId,
    freeze: f.freeze,
    authorizationHash: receipt.witnessRef,
  });
}
export function finish(
  f,
  outcome = "PASS",
  errorClass = null,
  attemptId = "synthetic-attempt-1",
) {
  return f.registry.finishAttempt({
    attemptId,
    freeze: f.freeze,
    outcome,
    errorClass,
    executedCaseIds: outcome === "PASS" ? f.registry.syntheticSelection() : [],
  });
}
