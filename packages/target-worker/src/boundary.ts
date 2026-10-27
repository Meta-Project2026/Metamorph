// Owner-scoped PROPOSAL, deliberately not exported through shared packages.
export interface RuntimePolicy {
  readonly memoryMiB: 256;
  readonly cpus: 1;
  readonly pids: 64;
  readonly operationTimeoutMs: 15000;
  readonly lifetimeMs: 180000;
  readonly clock: "real" | "fixed-experiment";
}
export interface SourceFile {
  readonly path: string;
  readonly sha256: string;
  readonly content: string;
}
export interface HttpCapture {
  readonly stepId: string;
  readonly requestId: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyBase64: string;
}
export type WorkerError =
  | "ADMISSION_REJECTED"
  | "BUILD_FAILED"
  | "RUNTIME_FAILED"
  | "TIMEOUT"
  | "CANCELLED"
  | "OBSERVATION_ERROR"
  | "CLEANUP_ERROR"
  | "ENVIRONMENT_ERROR";
export interface ProposedTargetWorker {
  provision(
    runId: string,
    candidateSha: string,
    policy: RuntimePolicy,
  ): Promise<unknown>;
  reset(scenarioId: string): Promise<unknown>;
  request(
    stepId: string,
    method: "GET" | "POST",
    path: string,
    body?: string,
  ): Promise<HttpCapture>;
  snapshot(stepId: string): Promise<unknown>;
  close(): Promise<unknown>;
  kill(): Promise<unknown>;
}
