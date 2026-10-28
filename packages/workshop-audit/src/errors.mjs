// Total, reconstructing error serializer. Never evaluates gates/identity or
// copies diagnostics while handling an independent publication failure.
import { atomicJson } from "../../differential/src/private-run.mjs";
import { DECLARED } from "./corpus.mjs";

const ids = new Set([
  "audit-public-positive",
  "audit-public-negative",
  ...DECLARED.map((d) => d.id),
]);
const phases = new Set([
  "freeze",
  "runtime",
  "public-controls",
  "publication",
  ...DECLARED.map((d) => d.family),
]);
const codes = new Set([
  "EVALUATOR_ERROR",
  "HEAD_IDENTITY",
  "FREEZE_IDENTITY",
  "FREEZE_REQUIRED",
  "CORPUS_SHAPE",
  "PAIR_STATE",
  "PAIR_IDENTITY",
  "PROVISION_ERROR",
  "CLOCK_ERROR",
  "REFERENCE_ERROR",
  "ORACLE_ERROR",
  "RETENTION_ERROR",
  "COVERAGE_ERROR",
  "CANCELLED",
  "TIMEOUT",
  "CLEANUP_ERROR",
  "EVIDENCE_CREATE_ERROR",
  "EVIDENCE_CATALOG_ERROR",
  "EVIDENCE_SEAL_ERROR",
  "EVIDENCE_STATUS_ERROR",
  "EVIDENCE_REGISTRY_ERROR",
  "EVIDENCE_PROVENANCE_ERROR",
  "PUBLICATION_ERROR",
  "PUBLIC_COVERAGE",
  "INDEPENDENT_CONTROL",
  "BUILD_FAILED",
  "ENVIRONMENT_ERROR",
]);
const hash = (x) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
export const safeCode = (x) => (codes.has(x) ? x : "EVALUATOR_ERROR");
// Trusted operation codes only; never promote exception messages/diagnostics.
const detailCodes = new Set([
  "ADMISSION_REJECTED",
  "BUILD_FAILED",
  "RUNTIME_FAILED",
  "TIMEOUT",
  "CANCELLED",
  "OBSERVATION_ERROR",
  "CLEANUP_ERROR",
  "ENVIRONMENT_ERROR",
  "RESET_FIELDS",
  "RESET_IDENTITY",
  "STALE_RUNTIME",
  "INSPECTOR_RECEIPT",
  "INSPECTOR_ACTION",
  "INSPECTOR_MOUNT",
  "SNAPSHOT_RECEIPT",
  "HTTP_RECEIPT",
  "DIRTY_TARGET_RESET",
  "UNCOMMANDED_TARGET_WRITE",
  "SCENARIO_BINDING",
  "STEP_BINDING",
  "DB_WIRE",
  "DB_FORMAT",
  "DB_IDENTITY",
  "DB_SCHEMA",
  "DB_SCHEMA_ORDER",
  "DB_MISSING_TABLE",
  "DB_TABLE",
  "DB_COLUMN",
  "WIRE_DUPLICATE_KEY",
  "WIRE_JSON",
  "BOOTSTRAP",
  "DIRTY_REFERENCE_RESET",
  "UNCOMMANDED_REFERENCE_WRITE",
  "AGGREGATE_TIMEOUT",
  "ADAPTER_OPERATION_ERROR",
]);
export const safeDetailCode = (value) =>
  detailCodes.has(value) ? value : "ADAPTER_OPERATION_ERROR";

function failureReceipt({
  headSha,
  phase,
  pairs = [],
  cleanup,
  provenance,
  primaryCode,
  secondaryCodes = [],
}) {
  const base = {
    format: "independent-workshop-audit-error-v2",
    headSha: /^[a-f0-9]{40}$/.test(headSha ?? "") ? headSha : null,
    verdict: "AUDIT_ERROR",
    phase: phases.has(phase) ? phase : "UNKNOWN",
    code: safeCode(primaryCode),
    secondaryCodes: Array.isArray(secondaryCodes)
      ? [...new Set(secondaryCodes.map(safeCode))]
      : ["EVALUATOR_ERROR"],
    cleanup: cleanup === "VERIFIED_ZERO_RESOURCES" ? cleanup : "ERROR",
    pairs: [],
    provenance: { status: "ERROR", sha256: null },
    canonicalG4: "INCONCLUSIVE",
    G0: "NOT_RUN",
    product: "NOT_ESTABLISHED",
    formalHeldOut: "HELDOUT_ISOLATION_NOT_PROVEN",
    externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
  };
  try {
    base.pairs = pairs
      .filter((p) => ids.has(p.id))
      .slice(0, 9)
      .map((p) => ({
        id: p.id,
        status:
          p.status === "FINALIZED_PRIVATE_COMPLETE"
            ? p.status
            : "FINALIZED_PRIVATE_ERROR",
        primaryCode: p.primaryCode === null ? null : safeCode(p.primaryCode),
        detailCode: p.detailCode === null ? null : safeDetailCode(p.detailCode),
        secondaryCodes: Array.isArray(p.secondaryCodes)
          ? [...new Set(p.secondaryCodes.map(safeCode))]
          : ["EVALUATOR_ERROR"],
        cleanup: p.cleanup === "VERIFIED_ZERO_RESOURCES" ? p.cleanup : "ERROR",
        catalog: ["COMPLETE", "INCOMPLETE", "ERROR"].includes(p.catalog)
          ? p.catalog
          : "ERROR",
        packs: ["php", "bridge", "oracle"].map((type) => {
          const r = p.packs?.find((x) => x.type === type);
          const verified =
            r?.status === "VERIFIED" &&
            hash(r.sha256) &&
            Number.isSafeInteger(r.entries) &&
            r.entries > 0 &&
            r.entries <= 10000;
          return {
            type,
            status: verified ? "VERIFIED" : "ERROR",
            sha256: verified ? r.sha256 : null,
            entries: verified ? r.entries : 0,
          };
        }),
      }));
    if (provenance?.status === "VERIFIED" && hash(provenance.sha256))
      base.provenance = { status: "VERIFIED", sha256: provenance.sha256 };
    base.code =
      base.pairs.find((p) => p.primaryCode)?.primaryCode ??
      safeCode(primaryCode);
    return base;
  } catch {
    return {
      ...base,
      code: "PUBLICATION_ERROR",
      pairs: [],
      provenance: { status: "ERROR", sha256: null },
    };
  }
}

export function safeFailureReceipt(input) {
  try {
    return failureReceipt(input);
  } catch {
    return {
      format: "independent-workshop-audit-error-v2",
      headSha: null,
      verdict: "AUDIT_ERROR",
      phase: "UNKNOWN",
      code: "PUBLICATION_ERROR",
      secondaryCodes: [],
      cleanup: "ERROR",
      pairs: [],
      provenance: { status: "ERROR", sha256: null },
      canonicalG4: "INCONCLUSIVE",
      G0: "NOT_RUN",
      product: "NOT_ESTABLISHED",
      formalHeldOut: "HELDOUT_ISOLATION_NOT_PROVEN",
      externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
    };
  }
}
export function publishFailure(
  path,
  input,
  { write = atomicJson, report = (code) => console.error(code) } = {},
) {
  const receipt = safeFailureReceipt(input);
  try {
    write(path, receipt, 0o644);
    return { published: true, receipt };
  } catch {
    try {
      report("AUDIT_ERROR_PUBLICATION_FAILED");
    } catch {}
    return { published: false, receipt };
  }
}
