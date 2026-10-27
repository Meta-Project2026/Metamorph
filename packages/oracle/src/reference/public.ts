import { RETENTION } from "./evidence.js";
import { ensure, MANIFEST_SHA256, SOURCE } from "./manifest.js";

/** Reject unknown fields rather than recursively copying an observation into a public artifact. */
export function publicSummary(input: {
  headSha: string;
  imageId: string;
  packSha256: string;
  attempts: number;
  steps: number;
  replayEqual: boolean;
  mappingEqual: boolean;
  privateVerified: boolean;
}): object {
  ensure(
    Object.keys(input).sort().join(",") ===
      "attempts,headSha,imageId,mappingEqual,packSha256,privateVerified,replayEqual,steps",
    "PUBLIC_FIELDS",
  );
  ensure(
    /^[a-f0-9]{40}$/.test(input.headSha) &&
      /^sha256:[a-f0-9]{64}$/.test(input.imageId) &&
      /^[a-f0-9]{64}$/.test(input.packSha256),
    "PUBLIC_HASH",
  );
  ensure(
    input.attempts === 6 &&
      input.steps === 34 &&
      input.replayEqual === true &&
      input.mappingEqual === true &&
      input.privateVerified === true,
    "PROOF_INCOMPLETE",
  );
  return {
    format: "php74-reference-summary-v1",
    scope: "reference-only-public-sequential-proposal",
    headSha: input.headSha,
    source: SOURCE,
    imageId: input.imageId,
    manifestSha256: MANIFEST_SHA256,
    attempts: 6,
    steps: 34,
    replayEqual: true,
    mappingEqual: true,
    privatePackVerifiedAfterWorkerClose: true,
    packSha256: input.packSha256,
    retention: RETENTION,
    crossLanguage: "NOT_RUN",
    concurrency: "NOT_RUN",
    clockAdvanceDst: "NOT_RUN",
    crashRecovery: "NOT_RUN",
    gates: {
      G0: "INCONCLUSIVE",
      G1: "NOT_RUN",
      G2: "INCONCLUSIVE",
      G3: "INCONCLUSIVE",
      G4: "INCONCLUSIVE",
    },
    benchmarkRegistration: "NOT_APPROVED",
  };
}
