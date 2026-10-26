import {
  GateResultSchema,
  ModelUsageSchema,
  type RunEvent,
  type Verdict,
} from "@metamorph/contracts";
import { z } from "zod";

export type Tier = "spark" | "wonder";
export type Action = "generate" | "repair" | "escalate";
export type State = Extract<RunEvent, { type: "run-state-changed" }>["state"];

const protectedName =
  /^(?:reference|oracle|held[-_]?out|fixtures?|tests?|specs?|policy|ci|con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export const SourceChangesSchema = z
  .array(
    z.strictObject({
      path: z
        .string()
        .max(240)
        .refine((path) => {
          if (!/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(path)) {
            return false;
          }
          return path
            .slice(4, -3)
            .split("/")
            .every((part) => !protectedName.test(part));
        }, "Only candidate src/**/*.ts with unprotected names is writable"),
      content: z.string().max(1024 * 1024),
    }),
  )
  .min(1)
  .max(64)
  .refine(
    (changes) =>
      new Set(changes.map((change) => change.path.toLowerCase())).size ===
      changes.length,
    "Duplicate candidate paths",
  );
export type SourceChange = z.infer<typeof SourceChangesSchema>[number];

export const ModelResponseSchema = z.strictObject({
  changes: SourceChangesSchema,
  usage: ModelUsageSchema,
});
export type ModelResponse = z.infer<typeof ModelResponseSchema>;

export interface ModelRequest {
  readonly unitId: string;
  readonly tier: Tier;
  readonly action: Action;
  readonly attempt: number;
  // The verifier explicitly declassifies this summary. Never forward raw findings.
  readonly repairFeedback: string | null;
}

export interface ModelProvider {
  readonly billing: "synthetic" | "paid";
  // Trusted adapter's guaranteed upper bound per call, not a model-supplied price.
  readonly maxRequestCostUsd: number | null;
  generate(request: ModelRequest, signal: AbortSignal): Promise<unknown>;
}

export interface CandidateWriter {
  readonly root: string;
  write(changes: readonly SourceChange[], signal: AbortSignal): Promise<void>;
}

export const VerificationReportSchema = z.strictObject({
  results: z.array(GateResultSchema).max(5),
  executedScenarioIds: z.array(z.string().min(1)),
  repairFeedback: z.string().max(4096).nullable(),
});
export type VerificationReport = z.infer<typeof VerificationReportSchema>;

export interface Verifier {
  readonly evidenceKind: "synthetic" | "external";
  verify(candidateRoot: string, signal: AbortSignal): Promise<unknown>;
}

export interface RunResult {
  readonly verdict: Verdict;
  readonly reason: string;
  readonly evidenceKind: Verifier["evidenceKind"];
  readonly events: readonly RunEvent[];
  readonly attempts: readonly ModelRequest[];
  readonly repairsByUnit: Readonly<Record<string, number>>;
  readonly escalations: number;
  readonly knownModelSpendUsd: number;
  readonly totalModelSpendUsd: number | null;
  readonly reservedModelSpendUsd: number;
}
