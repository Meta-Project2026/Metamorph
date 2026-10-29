import type {
  CandidateWriter,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  Verifier,
} from "@metamorph/agent";

/** Host-only ports. MJS adapters have runtime schema and negative tests.
 * Candidate sources are excluded from every host build/typecheck/test command. */
export interface ReplayProvider extends ModelProvider {
  readonly billing: "synthetic";
  readonly maxRequestCostUsd: 0;
}
export interface SourceSession {
  readonly writer: CandidateWriter;
}
export interface RealVerifier extends Verifier {
  readonly evidenceKind: "external";
  waitForIdle(): Promise<void>;
}

declare const manualPaidBrand: unique symbol;
/** Issued only by the trusted signed-workflow adapter; never a caller flag.
 * Separate from ModelProvider's guaranteed-dollar admission contract. */
export interface ManualPaidAuthorization {
  readonly [manualPaidBrand]: true;
  readonly kind: "mmp078-manual-paid-estimate-v1";
  readonly actor: "barbalatv" | "l1ncolny";
  readonly runId: string;
  readonly headSha: string;
  readonly sourceSha: string;
  readonly contextSha256: string;
  readonly manifestSha256: string;
  readonly bodySha256: string;
  readonly model: "muse-spark-1.3";
  readonly tariff: "meta-standard-2026-10-29";
  readonly maxEstimatedUsd: number;
  readonly worstCaseEstimatedUsd: number;
  readonly monetaryCap: "NO_PROVIDER_HARD_CAP";
}
export interface ManualPaidMigrationProvider {
  readonly billing: "paid";
  readonly maxRequestCostUsd: null;
  generate(request: ModelRequest, signal: AbortSignal): Promise<ModelResponse>;
}
