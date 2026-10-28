import { createHash, randomBytes } from "node:crypto";

export const FORMAT = "mmp-local-evidence-v1";
export const DAY = 86_400_000;
export const LIMITS = Object.freeze({
  packs: 16,
  scenarios: 100,
  requests: 10_000,
  record: 16 * 1024 * 1024,
  pack: 128 * 1024 * 1024,
  total: 256 * 1024 * 1024,
  journal: 4 * 1024 * 1024,
  metadata: 8 * 1024 * 1024,
  header: 64 * 1024,
  events: 4096,
});
export class RetentionError extends Error {
  constructor(code) {
    super(code);
    this.name = "RetentionError";
    this.code = code;
  }
}
export function check(ok, code = "INVALID") {
  if (!ok) throw new RetentionError(code);
}
export const sha = (data) => createHash("sha256").update(data).digest("hex");
export const bytes = (value) => Buffer.from(JSON.stringify(value));
export const equal = (a, b) => bytes(a).equals(bytes(b));
export const digest = (value) => sha(bytes(value));
export const opaque = () => randomBytes(16).toString("hex");
export function keys(value, expected) {
  check(value && typeof value === "object" && !Array.isArray(value));
  check(equal(Object.keys(value).sort(), [...expected].sort()), "FIELDS");
}
export function id(value) {
  check(
    typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value),
    "ID",
  );
  return value;
}
export function hex(value) {
  check(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), "HASH");
  return value;
}
export function integer(n, min, max) {
  check(Number.isSafeInteger(n) && n >= min && n <= max, "BUDGET");
  return n;
}
export function timestamp(value) {
  check(
    typeof value === "string" && Number.isFinite(Date.parse(value)),
    "TIME",
  );
  check(new Date(value).toISOString() === value, "TIME");
  return Date.parse(value);
}
export function canonical(data, limit = LIMITS.metadata) {
  check(Buffer.isBuffer(data) && data.length <= limit, "BUDGET");
  let value;
  try {
    value = JSON.parse(data.toString("utf8"));
  } catch {
    throw new RetentionError("JSON");
  }
  // Also refuses duplicate keys, invalid UTF-8, alternate numbers and trailing data.
  check(bytes(value).equals(data), "CANONICAL_JSON");
  return value;
}
export function identity(value) {
  keys(value, [
    "format",
    "runId",
    "epochId",
    "registrationCommitment",
    "candidateCommitment",
    "attemptId",
    "terminalReceiptAt",
    "witnessRef",
    "custodyScopeId",
  ]);
  check(value.format === "mmp-evidence-identity-v1", "VERSION");
  for (const k of [
    "runId",
    "epochId",
    "attemptId",
    "witnessRef",
    "custodyScopeId",
  ])
    id(value[k]);
  hex(value.registrationCommitment);
  hex(value.candidateCommitment);
  timestamp(value.terminalReceiptAt);
  return value;
}
export function admission(value) {
  keys(value, [
    "format",
    "maxPacks",
    "maxScenariosPerPack",
    "maxRequestsPerPack",
    "maxPackBytes",
    "maxTotalBytes",
    "maxRecordBytes",
    "maxJournalBytes",
  ]);
  check(value.format === "mmp-evidence-admission-v1", "VERSION");
  integer(value.maxPacks, 1, LIMITS.packs);
  integer(value.maxScenariosPerPack, 1, LIMITS.scenarios);
  integer(value.maxRequestsPerPack, 1, LIMITS.requests);
  check(value.maxRequestsPerPack <= value.maxScenariosPerPack * 100, "BUDGET");
  integer(value.maxRecordBytes, 1, LIMITS.record);
  integer(value.maxPackBytes, 1, LIMITS.pack);
  integer(value.maxTotalBytes, value.maxPackBytes, LIMITS.total);
  integer(value.maxJournalBytes, 4096, LIMITS.journal);
  const rawFiles =
    6 + 3 * value.maxScenariosPerPack + 6 * value.maxRequestsPerPack;
  // Provenance, catalog, finalization and partial/error diagnostics, plus index.
  const maxFilesPerPack = rawFiles + 16;
  const manifestOverheadPerPack = 2048 + maxFilesPerPack * 256;
  check(manifestOverheadPerPack <= LIMITS.metadata, "BUDGET");
  const rootCatalogMaxBytes =
    64 * 1024 + value.maxPacks * manifestOverheadPerPack;
  check(rootCatalogMaxBytes <= LIMITS.metadata, "BUDGET");
  // The external witness is the trust anchor, never the sole retained root.
  const archiveOverhead =
    4 + manifestOverheadPerPack + rootCatalogMaxBytes + 256;
  check(value.maxJournalBytes >= (16 + 3 * value.maxPacks) * 4096, "BUDGET");
  // Binary archive preserves original file bytes; AEAD is +16, not base64.
  const maxCipherBytesPerPack =
    value.maxPackBytes + archiveOverhead + LIMITS.header + 28;
  const maxStorageBytes =
    2 *
    (value.maxTotalBytes +
      value.maxPacks * (archiveOverhead + LIMITS.header + 28 + 4096));
  const workingSetBound =
    4 * (value.maxPackBytes + archiveOverhead + LIMITS.header) +
    value.maxJournalBytes;
  return Object.freeze({
    ...value,
    rawFiles,
    maxFilesPerPack,
    maxDepth: 2,
    manifestOverheadPerPack,
    maxCipherBytesPerPack,
    maxStorageBytes,
    workingSetBound,
    rootCatalogMaxBytes,
    archiveOverhead,
  });
}
export function publicSummary({ runId, status, packCount, commitment }) {
  id(runId);
  check(
    ["NOT_VERIFIED", "ERROR", "SIMULATED_RESTORED"].includes(status),
    "STATUS",
  );
  integer(packCount, 0, LIMITS.packs);
  hex(commitment);
  return Object.freeze({
    format: "mmp-evidence-public-v1",
    runId,
    status,
    packCount,
    commitment,
    G4: "INCONCLUSIVE",
    PRODUCT: "NOT_ESTABLISHED",
    EXTERNAL_RETENTION: "NOT_RUN",
  });
}
