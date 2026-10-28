/** Additive MMP-055/056 handoff only. No GateResult/RunEvent changes. */
export interface ReceiptIdentityV1 {
  format: "mmp-evidence-identity-v1";
  runId: string;
  epochId: string;
  registrationCommitment: string;
  candidateCommitment: string;
  attemptId: string;
  terminalReceiptAt: string;
  witnessRef: string;
  custodyScopeId: string;
}

export interface PackInputV1 {
  id: string;
  attemptId: string;
  terminalReceiptAt: string;
  relativePath: string;
  pairId: string;
  kind: "ORACLE" | "AUXILIARY";
  indexSha256: string;
  status: "COMPLETE" | "INCOMPLETE";
  outcome: "PASS" | "FAIL" | "ERROR" | "ABORTED";
  custodyScopeId: string;
}

export interface AdmissionV1 {
  format: "mmp-evidence-admission-v1";
  maxPacks: number;
  maxScenariosPerPack: number;
  maxRequestsPerPack: number;
  maxPackBytes: number;
  maxTotalBytes: number;
  maxRecordBytes: number;
  maxJournalBytes: number;
}

export interface EnvelopeHandshakeV1 extends ReceiptIdentityV1 {
  manifestSha256: string;
}

// Runtime API is intentionally exposed as .mjs, not falsely typed declarations
// for implementation functions. These types describe only the versioned handoff.
