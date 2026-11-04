// TEST_ONLY module graph. registerHooks in g1-recovery-host.test.mjs replaces
// OS/Docker/age boundaries; production entrypoints have no injection port.
// No candidate text is executed. Real source leases, capsules, diagnostics,
// aggregate/publication, MAC journal, OIDC, admission and durable ledger remain.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST } from "@metamorph/oracle";
import { sha256 } from "../../target-worker/src/admission.mjs";
import {
  CUSTODY,
  capsuleFromLease,
  receiptFor,
} from "../src/custody-contract.mjs";
import {
  commitPrivate,
  commitRecord,
  privateDirectory,
} from "../src/custody-files.mjs";
import { aggregateAttempt } from "../src/report.mjs";
import { failedAttempt } from "./g1-recovery-fixture.mjs";

export { CUSTODY_CAPTURE_STAGES } from "../src/custody-capture.mjs";
export * from "../src/custody-checkpoint.mjs";
export const state = {
  code: "TS2339",
  secondFail: false,
  firstPass: false,
  parityFail: false,
  verifications: 0,
  independentBad: false,
  phase: {},
  pending: false,
};
const origins = new WeakSet();
export const trustedFirstTypecheck = (attempt) => origins.has(attempt);
export async function captureLease(token, lease, receipt, signal, attempt) {
  signal.throwIfAborted();
  const capsule = await capsuleFromLease(token, lease, receipt, attempt);
  const spool = join(
    process.env.RUNNER_TEMP,
    `mmp115-custody${attempt === 2 ? "-repair" : ""}`,
  );
  privateDirectory(spool, true);
  const bytes = Buffer.concat([
    Buffer.from("age-encryption.org/v1\n"),
    Buffer.alloc(180, attempt),
  ]);
  commitPrivate(join(spool, "candidate.age"), bytes, CUSTODY.ciphertext);
  const capture = receiptFor(
    "CAPTURED_UNVERIFIED",
    capsule.identity,
    { sha256: sha256(bytes), bytes: bytes.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  commitRecord(join(spool, "capture.json"), capture);
  return capture;
}
export async function finalizeCustody(identity) {
  return {
    format: "mmp115-pre-oracle-finalizer-v1",
    phase: "PRE_ORACLE",
    identity,
    containers: state.independentBad ? 1 : 0,
    volumes: 0,
    emergencyRemoved: 0,
  };
}
export function createEnvironment() {
  return {
    async prepare() {},
    async finish() {
      return {
        cleanup: "VERIFIED_ZERO_RESOURCES",
        inventory: { containers: 0, volumes: 0 },
        emergencyRemoved: 0,
      };
    },
  };
}
export class RealVerifier {
  attempts = [];
  constructor(_environment, session) {
    this.session = session;
  }
  async waitForIdle() {}
  async verify(root, signal) {
    const lease = await this.session.acquire(root, signal);
    const first = state.verifications++ === 0;
    let attempt;
    try {
      if ((first && !state.firstPass) || (!first && state.secondFail)) {
        attempt = failedAttempt(lease.bundle, state.code, state.phase);
        if (
          !state.pending &&
          !state.phase.error &&
          !state.phase.signal &&
          (state.phase.exitCode === undefined || state.phase.exitCode > 0)
        )
          origins.add(attempt);
      } else {
        // Original public comparison receipt shapes only; these are explicitly
        // simulated observations, never a Docker/parity acceptance claim.
        const fixture = JSON.parse(
          readFileSync(
            new URL(
              "fixtures/mmp158-real-trial-41703793337.json",
              import.meta.url,
            ),
            "utf8",
          ),
        );
        const attemptId = randomUUID();
        attempt = {
          attemptId,
          candidateSha: lease.bundle.candidateSha,
          errorCode: null,
          pairs: fixture.attempts[0].pairs.map((p, i) => ({
            ...p,
            attemptId,
            candidateSha: lease.bundle.candidateSha,
            pairId: randomUUID(),
            compilerDiagnostics: undefined,
            packs: p.packs.map((pack) => ({
              ...pack,
              reference: "test/index.json",
            })),
            build: {
              gate: "G1",
              verdict: "PASS",
              executedTestIds: [
                `${MANIFEST[i].id}:typecheck`,
                `${MANIFEST[i].id}:build`,
              ],
              findingCodes: [],
            },
            gates: p.gates.map((g) =>
              g.gate === "G2" || g.gate === "G3"
                ? {
                    ...g,
                    verdict: first && state.parityFail ? "FAIL" : "PASS",
                    findingCodes:
                      first && state.parityFail ? ["HTTP_JSON_TYPE"] : [],
                  }
                : g,
            ),
          })),
        };
      }
      this.attempts.push(attempt);
      return aggregateAttempt(attempt);
    } finally {
      await lease.release();
    }
  }
}
