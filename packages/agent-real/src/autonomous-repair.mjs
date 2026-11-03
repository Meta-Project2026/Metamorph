// OFFLINE ONLY. Test ports cannot issue paid admission or production custody.
// Production remains blocked by requireMigrationMode; no native transport here.
import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST } from "@metamorph/oracle";
import { sha256 } from "../../target-worker/src/admission.mjs";
import {
  decodeMetaMigration,
  prepareMetaMigration,
} from "./meta-migration.mjs";
import { PAID_POLICY, paidProjection } from "./meta-paid-authorization.mjs";
import { checkMetaHttp } from "./meta-wire.mjs";
import { insist, isMigrationContext } from "./migration-context.mjs";
import {
  CONTROL_IDS,
  checkedGate,
  expectedIds,
  gateResult,
} from "./report.mjs";
import { createSourceSession } from "./source.mjs";

export const REPAIR_POLICY = Object.freeze({
  format: "mmp151-synthetic-repair-v1",
  maxRequests: 2,
  maxRepairs: 1,
  maxAggregateUsd: 1,
  repairWireBytes: 96 * 1024,
  monetaryCap: "NO_PROVIDER_HARD_CAP",
});
const safeCodes = new Set([
  "CONFIG_DENIED",
  "TARIFF_EXPIRED",
  "ESTIMATED_BUDGET_BLOCKED",
  "RUN_ALREADY_CLAIMED",
  "LEDGER_ERROR",
  "SOURCE_IDENTITY",
  "CUSTODY_FAILED",
  "VERIFICATION_INCOMPLETE",
  "G1_FAILED",
  "REPAIR_FEEDBACK",
  "USAGE_UNKNOWN",
  "USAGE_BOUND_EXCEEDED",
  "TIMEOUT",
  "CANCELLED",
  "CLEANUP_ERROR",
  "INPUT_LIMIT",
  "RESPONSE_INVALID",
  "MODEL_MISMATCH",
  "OUTPUT_INVALID",
  "USAGE_INVALID",
  "SYNTHETIC_PORT_ERROR",
]);
const failureCodes = new Set([
  "DB_SCHEMA",
  "DB_STATE",
  "HTTP_STATUS",
  "HTTP_HEADER",
  "HTTP_JSON_TYPE",
  "HTTP_JSON_VALUE",
  "HTTP_JSON_MISSING",
  "HTTP_JSON_LENGTH",
  "HTTP_BODY",
]);
const hash = /^[a-f0-9]{64}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requestFor = (attempt, repairFeedback) => ({
  unitId: "workshop-api",
  tier: "spark",
  action: attempt === 1 ? "generate" : "repair",
  attempt,
  repairFeedback,
});

// Integer nano-USD, rounded up; engineering projections NEVER settle a charge.
const projectionNanos = (bytes) =>
  Math.ceil(
    ((bytes * PAID_POLICY.tokensPerSerializedByte +
      PAID_POLICY.protocolTokens) *
      PAID_POLICY.inputPerMillion +
      PAID_POLICY.maxOutputTokens * PAID_POLICY.outputPerMillion) *
      1000,
  );
export function planSyntheticRepair(context, budgetUsd = 1, now = Date.now()) {
  insist(isMigrationContext(context), "SOURCE_IDENTITY");
  insist(
    Number.isFinite(now) && now < Date.parse(PAID_POLICY.tariffExpires),
    "TARIFF_EXPIRED",
  );
  insist(
    Number.isFinite(budgetUsd) && budgetUsd > 0 && budgetUsd <= 1,
    "ESTIMATED_BUDGET_BLOCKED",
  );
  const body = prepareMetaMigration(context, requestFor(1, null));
  paidProjection(body);
  const reservations = [
    projectionNanos(Buffer.byteLength(body)),
    projectionNanos(REPAIR_POLICY.repairWireBytes),
  ];
  const reservedNanos = reservations.reduce((a, b) => a + b, 0);
  insist(
    reservedNanos <= Math.floor(budgetUsd * 1e9),
    "ESTIMATED_BUDGET_BLOCKED",
  );
  return Object.freeze({
    body,
    reservations: Object.freeze(reservations),
    reservedNanos,
    repairWireBytes: REPAIR_POLICY.repairWireBytes,
  });
}

function durableRecord(path, record) {
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
    writeFileSync(fd, `${JSON.stringify(record)}\n`);
    fsyncSync(fd);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function syncDirectory(path) {
  // Windows lacks portable directory fsync; process restart controls still run.
  // Linux is required for real Docker and future production host admission.
  if (process.platform !== "linux") return;
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function claimRun(parent, runId, record) {
  insist(/^[a-zA-Z0-9-]{1,80}$/.test(runId), "CONFIG_DENIED");
  insist(
    realpathSync(parent) === resolve(parent) &&
      !lstatSync(parent).isSymbolicLink(),
    "LEDGER_ERROR",
  );
  const fromRepo = relative(
    fileURLToPath(new URL("../../../", import.meta.url)),
    resolve(parent),
  );
  insist(
    fromRepo === ".." ||
      fromRepo.startsWith(`..${sep}`) ||
      isAbsolute(fromRepo),
    "LEDGER_ERROR",
  );
  if (process.platform === "linux") {
    const st = lstatSync(parent);
    insist(
      st.uid === process.getuid() && (st.mode & 0o077) === 0,
      "LEDGER_ERROR",
    );
  }
  const directory = join(parent, `mmp151-${runId}`);
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch {
    insist(false, "RUN_ALREADY_CLAIMED");
  }
  // An empty or partially written claim also refuses restart. Never reclaim it.
  syncDirectory(parent);
  durableRecord(join(directory, "reservation.json"), record);
  syncDirectory(directory);
  return directory;
}

const clean = (v) =>
  v?.status === "VERIFIED_ZERO_RESOURCES" &&
  v.containers === 0 &&
  v.volumes === 0 &&
  v.emergencyRemoved === 0;

/** Declassifies only the full public verifier's current-candidate fixed codes.
 * This checks receipts, not their authenticity: only the offline controller uses
 * it. Production still requires its independent opaque custody/Oracle permits. */
export function publicRepairDecision(value, candidateSha) {
  insist(clean(value?.cleanup), "CLEANUP_ERROR");
  insist(
    value.candidateSha === candidateSha &&
      value.G0 === "INCONCLUSIVE" &&
      value.G4 === "INCONCLUSIVE" &&
      value.product === "NOT_ESTABLISHED" &&
      value.attempts?.length === 1,
    "VERIFICATION_INCOMPLETE",
  );
  const a = value.attempts[0];
  insist(
    a.candidateSha === candidateSha && /^[a-f0-9-]{36}$/.test(a.attemptId),
    "SOURCE_IDENTITY",
  );
  insist(
    a.gates?.length === 5 &&
      same(
        a.gates.map((g) => g.gate),
        ["G0", "G1", "G2", "G3", "G4"],
      ),
    "VERIFICATION_INCOMPLETE",
  );
  if (a.gates[1].verdict === "FAIL") insist(false, "G1_FAILED");
  insist(
    a.gates[0].verdict === "INCONCLUSIVE" &&
      a.gates[4].verdict === "INCONCLUSIVE" &&
      same(
        a.gates[4].executedTestIds,
        MANIFEST.flatMap((s) => CONTROL_IDS.map((id) => `${s.id}:${id}`)),
      ) &&
      same(a.gates[4].findingCodes, ["HELD_OUT_NOT_RUN"]),
    "VERIFICATION_INCOMPLETE",
  );
  const gates = ["G1", "G2", "G3"].map((name) => {
    const g = a.gates.find((item) => item.gate === name);
    const ids = MANIFEST.flatMap((s) =>
      name === "G1"
        ? [`${s.id}:typecheck`, `${s.id}:build`]
        : expectedIds(s, name),
    );
    insist(
      g &&
        same(g.executedTestIds, ids) &&
        ["PASS", "FAIL"].includes(g.verdict) &&
        value[`public${name}`] === g.verdict &&
        (name !== "G1" || g.verdict === "PASS"),
      "VERIFICATION_INCOMPLETE",
    );
    checkedGate(
      gateResult(
        name,
        g.verdict,
        g.executedTestIds,
        g.findingCodes,
        a.pairs.flatMap((p) => p.packs.map((pack) => `${pack.id}/index.json`)),
      ),
      name,
      ids,
    );
    return g;
  });
  insist(
    same(a.coverage, {
      http: 17,
      sqlite: 20,
      requiredHttp: 17,
      requiredSqlite: 20,
    }) && a.pairs?.length === MANIFEST.length,
    "VERIFICATION_INCOMPLETE",
  );
  const pairIds = new Set(),
    packIds = new Set();
  for (const [i, p] of a.pairs.entries()) {
    insist(
      p.scenarioId === MANIFEST[i].id &&
        /^[a-f0-9-]{36}$/.test(p.pairId) &&
        !pairIds.has(p.pairId) &&
        p.cleanup === "VERIFIED_ZERO_RESOURCES" &&
        p.packs?.length === 2 &&
        p.gates?.length === 3,
      "VERIFICATION_INCOMPLETE",
    );
    pairIds.add(p.pairId);
    for (const pack of p.packs) {
      insist(
        /^oracle-[a-zA-Z0-9_-]+$/.test(pack.id) &&
          hash.test(pack.sha256) &&
          !packIds.has(pack.id),
        "VERIFICATION_INCOMPLETE",
      );
      packIds.add(pack.id);
    }
    for (const name of ["G2", "G3", "G4"]) {
      const g = p.gates.find((item) => item.gate === name);
      insist(
        g &&
          ["PASS", "FAIL"].includes(g.verdict) &&
          (name !== "G4" || g.verdict === "PASS") &&
          same(g.executedTestIds, expectedIds(MANIFEST[i], name)),
        "VERIFICATION_INCOMPLETE",
      );
      checkedGate(
        gateResult(
          name,
          g.verdict,
          g.executedTestIds,
          g.findingCodes,
          p.packs.map((pack) => `${pack.id}/index.json`),
        ),
        name,
        expectedIds(MANIFEST[i], name),
      );
    }
  }
  for (const name of ["G2", "G3"]) {
    const entries = a.pairs.map((p) => p.gates.find((g) => g.gate === name));
    const aggregate = gates.find((g) => g.gate === name);
    insist(
      aggregate.verdict ===
        (entries.some((g) => g.verdict === "FAIL") ? "FAIL" : "PASS") &&
        same(aggregate.findingCodes, [
          ...new Set(entries.flatMap((g) => g.findingCodes)),
        ]),
      "VERIFICATION_INCOMPLETE",
    );
  }
  const failed = gates.filter((g) => g.verdict === "FAIL");
  const codes = [...new Set(failed.flatMap((g) => g.findingCodes))].sort();
  const feedback = codes.join(";");
  insist(
    !failed.length ||
      (codes.length > 0 &&
        codes.every((c) => failureCodes.has(c)) &&
        Buffer.byteLength(feedback) <= 512),
    "REPAIR_FEEDBACK",
  );
  return {
    verdict: failed.length ? "FAIL" : "PASS",
    feedback: failed.length ? feedback : null,
    attemptId: a.attemptId,
    pairIds: [...pairIds],
    packIds: [...packIds],
  };
}

async function bounded(operation, signal, timeoutMs) {
  const controller = new AbortController();
  let timer, cancel;
  try {
    const aborted = new Promise((_, reject) => {
      cancel = () => {
        controller.abort();
        reject(Object.assign(new Error("CANCELLED"), { code: "CANCELLED" }));
      };
      signal.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error("TIMEOUT"), { code: "TIMEOUT" }));
      }, timeoutMs);
    });
    signal.throwIfAborted();
    const value = await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      aborted,
    ]);
    insist(!signal.aborted && !controller.signal.aborted, "CANCELLED");
    return value;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    controller.abort();
  }
}

/** Explicit offline port composition. No options enable production billing.
 * Ports are trusted synthetic test code; all receipts are always SYNTHETIC.
 * Parent is a private scratch root outside the repository; no raw bytes escape. */
export async function runSyntheticAutonomousRepair({
  context,
  parent,
  runId,
  headSha,
  transport,
  custody,
  verify,
  cleanup,
  signal = new AbortController().signal,
  timeoutMs = 5000,
  oracleTimeoutMs = 600000,
  custodyTimeoutMs = 30000,
  budgetUsd = 1,
}) {
  const result = {
    format: REPAIR_POLICY.format,
    execution: "SYNTHETIC",
    modelId: "muse-spark-1.3",
    status: "ERROR",
    code: null,
    paidRequests: 0,
    simulatedRequests: 0,
    completedOracleVerifications: 0,
    oracleInvocations: 0,
    repairs: 0,
    reservedEstimatedUsd: 0,
    estimatedCostUsd: null,
    chargedCostUsd: null,
    pendingExposureUsd: null,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    candidates: [],
    receipts: [],
    transitions: [],
    cleanup: "NOT_RUN",
  };
  let directory,
    previous = [],
    feedback = null,
    seenOracleIds = new Set();
  const transition = (state) => result.transitions.push(state);
  try {
    insist(
      !process.env.MODEL_API_KEY &&
        /^[a-f0-9]{40}$/.test(headSha) &&
        [transport, custody, verify, cleanup].every(
          (v) => typeof v === "function",
        ) &&
        Number.isInteger(timeoutMs) &&
        timeoutMs > 0 &&
        timeoutMs <= 5000 &&
        Number.isInteger(oracleTimeoutMs) &&
        oracleTimeoutMs > 0 &&
        oracleTimeoutMs <= 1200000,
      "CONFIG_DENIED",
    );
    insist(
      Number.isInteger(custodyTimeoutMs) &&
        custodyTimeoutMs > 0 &&
        custodyTimeoutMs <= 60000,
      "CONFIG_DENIED",
    );
    insist(!signal.aborted, "CANCELLED");
    const plan = planSyntheticRepair(context, budgetUsd);
    directory = claimRun(parent, runId, {
      execution: "SYNTHETIC",
      runId,
      headSha,
      sourceSha: context.sourceSha,
      contextSha256: context.contextSha256,
      manifestSha256: context.manifestSha256,
      tariff: PAID_POLICY.tariff,
      reservedNanos: plan.reservedNanos,
      reservations: plan.reservations,
      chargedCostUsd: null,
      status: "RESERVED_NO_REFUND",
    });
    result.reservedEstimatedUsd = plan.reservedNanos / 1e9;
    result.pendingExposureUsd = result.reservedEstimatedUsd;
    transition("RESERVED_BOTH");
    for (const attempt of [1, 2]) {
      insist(!signal.aborted, "CANCELLED");
      insist(
        Date.now() < Date.parse(PAID_POLICY.tariffExpires),
        "TARIFF_EXPIRED",
      );
      const request = requestFor(attempt, feedback);
      const body = prepareMetaMigration(context, request, previous);
      insist(
        attempt === 1
          ? body === plan.body
          : Buffer.byteLength(body) <= plan.repairWireBytes,
        "INPUT_LIMIT",
      );
      const projection = paidProjection(body);
      insist(
        projectionNanos(Buffer.byteLength(body)) <=
          plan.reservations[attempt - 1],
        "ESTIMATED_BUDGET_BLOCKED",
      );
      const receipt = {
        execution: "SYNTHETIC",
        kind: attempt === 1 ? "NEW_MODEL_GENERATION" : "NEW_MODEL_REPAIR",
        attempt,
        nonce: randomUUID(),
        headSha,
        sourceSha: context.sourceSha,
        contextSha256: context.contextSha256,
        inputSha256: sha256(body),
        promptSha256: sha256(JSON.parse(body).messages[1].content),
        candidateSha: null,
        responseSha256: null,
        status: "UNKNOWN",
        reservedNanos: plan.reservations[attempt - 1],
        estimatedCostUsd: null,
        chargedCostUsd: null,
      };
      durableRecord(join(directory, `send-${attempt}.json`), receipt);
      syncDirectory(directory);
      transition(attempt === 1 ? "GENERATE_RESERVED" : "REPAIR_RESERVED");
      result.receipts.push(receipt);
      const reply = await bounded(
        (sendSignal) => {
          insist(!sendSignal.aborted, "CANCELLED");
          result.simulatedRequests++;
          if (attempt === 2) result.repairs++;
          return transport({ body, signal: sendSignal });
        },
        signal,
        timeoutMs,
      );
      checkMetaHttp(reply);
      const decoded = decodeMetaMigration(reply.body, 0);
      insist(decoded.usageStatus !== "UNKNOWN", "USAGE_UNKNOWN");
      insist(
        decoded.response.usage.inputTokens <=
          projection.inputTokensUpperEstimate &&
          decoded.response.usage.estimatedCostUsd <=
            plan.reservations[attempt - 1] / 1e9,
        "USAGE_BOUND_EXCEEDED",
      );
      receipt.responseSha256 = sha256(reply.body);
      receipt.estimatedCostUsd = decoded.response.usage.estimatedCostUsd;
      const session = createSourceSession(directory);
      await session.writer.write(decoded.response.changes, signal);
      const lease = await session.acquire(session.writer.root, signal);
      try {
        insist(
          lease.bundle.candidateSha === decoded.candidateSha,
          "SOURCE_IDENTITY",
        );
        receipt.candidateSha = decoded.candidateSha;
        result.candidates.push(decoded.candidateSha);
        transition(`CANDIDATE_${attempt}`);
        const stored = await bounded(
          (s) =>
            custody({
              attempt,
              candidateSha: decoded.candidateSha,
              candidateRoot: session.writer.root,
              bundle: lease.bundle,
              signal: s,
            }),
          signal,
          custodyTimeoutMs,
        );
        insist(
          stored?.execution === "SYNTHETIC" &&
            stored.attempt === attempt &&
            stored.candidateSha === decoded.candidateSha &&
            stored.acknowledged === true &&
            stored.cleanup === "VERIFIED_ZERO_RESOURCES" &&
            Buffer.isBuffer(stored.ciphertext) &&
            stored.ciphertext.length > 100 &&
            stored.ciphertext.length <= 3 * 1024 * 1024 &&
            Buffer.isBuffer(stored.readback) &&
            stored.ciphertext.equals(stored.readback) &&
            sha256(stored.readback) === stored.ciphertextSha256,
          "CUSTODY_FAILED",
        );
        await lease.assertUnchanged();
        transition(`CUSTODY_${attempt}_ACKNOWLEDGED`);
        result.oracleInvocations++;
        const verified = await bounded(
          (s) =>
            verify({
              attempt,
              candidateRoot: session.writer.root,
              candidateSha: decoded.candidateSha,
              signal: s,
            }),
          signal,
          oracleTimeoutMs,
        );
        await lease.assertUnchanged();
        const decision = publicRepairDecision(verified, decoded.candidateSha);
        const ids = [
          decision.attemptId,
          ...decision.pairIds,
          ...decision.packIds,
        ];
        insist(
          ids.every((id) => !seenOracleIds.has(id)),
          "VERIFICATION_INCOMPLETE",
        );
        seenOracleIds = new Set([...seenOracleIds, ...ids]);
        result.completedOracleVerifications++;
        receipt.status = decision.verdict;
        transition(`ORACLE_${attempt}_${decision.verdict}`);
        if (decision.verdict === "PASS") {
          result.status = "SYNTHETIC_PUBLIC_PASS";
          break;
        }
        if (attempt === 2) {
          result.status = "SYNTHETIC_PUBLIC_FAIL";
          break;
        }
        feedback = decision.feedback;
        previous = structuredClone(decoded.response.changes);
      } finally {
        await lease.release();
      }
    }
  } catch (error) {
    result.status = "ERROR";
    result.code = signal.aborted
      ? "CANCELLED"
      : safeCodes.has(error?.code)
        ? error.code
        : "SYNTHETIC_PORT_ERROR";
    transition("STOPPED");
  } finally {
    // Independent cleanup after the operation signal expires. No cleanup of an
    // already-claimed other process's run; that process owns its resources.
    if (directory) {
      try {
        const finished = await bounded(
          (s) => cleanup(s),
          new AbortController().signal,
          30000,
        );
        insist(clean(finished), "CLEANUP_ERROR");
        result.cleanup = "VERIFIED_ZERO_RESOURCES";
      } catch {
        result.cleanup = "CLEANUP_ERROR";
        result.status = "ERROR";
        result.code = "CLEANUP_ERROR";
      }
    }
    result.estimatedCostUsd =
      result.receipts.length &&
      result.receipts.every((r) => r.estimatedCostUsd !== null)
        ? result.receipts.reduce((n, r) => n + r.estimatedCostUsd, 0)
        : null;
    if (directory) {
      try {
        durableRecord(join(directory, "outcome.json"), result);
        syncDirectory(directory);
      } catch {
        result.status = "ERROR";
        result.code = "LEDGER_ERROR";
      }
    }
  }
  return result;
}
