export {
  type Comparators,
  type ControlReport,
  type ControlResult,
  runControls,
} from "./controls.js";
export {
  createFailureTelemetry,
  FAILURE_STAGES,
  FAILURE_TELEMETRY_FORMAT,
  FAILURE_TELEMETRY_MAX_BYTES,
  type FailureTelemetryContext,
  type FailureTelemetryRecord,
  finishFailureTelemetry,
  isFailureTelemetryContext,
  projectFailureTelemetry,
  unavailableFailureTelemetry,
  validateFailureTelemetry,
} from "./failure-telemetry.js";
export {
  compareHttp,
  type Difference,
  type HttpObservation,
  NORMALIZATION_VERSION,
  STABLE_HEADERS,
} from "./http.js";
export {
  DockerReferenceTransport,
  provisionRuntime,
  type Runtime,
} from "./reference/docker.js";
export { PrivateEvidence, RETENTION } from "./reference/evidence.js";
export {
  BOOTSTRAP,
  MANIFEST,
  MANIFEST_SHA256,
  SOURCE,
} from "./reference/manifest.js";
export { mapPhpSnapshot } from "./reference/mapping.js";
export { dockerCommand } from "./reference/process.js";
export {
  PhpReferenceWorker,
  type ReferenceTransport,
} from "./reference/worker.js";
export {
  type PublicScenario,
  type ScenarioRequest,
  type VerificationResult,
  verifyPair,
  type WorkerAdapter,
} from "./runner.js";
export {
  compareSqlite,
  type SqliteSnapshot,
  type SqliteTable,
  type SqliteValue,
  snapshotSqlite,
} from "./sqlite.js";
