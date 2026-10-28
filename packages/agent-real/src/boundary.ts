import type {
  CandidateWriter,
  ModelProvider,
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
