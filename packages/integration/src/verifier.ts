import { createHash } from "node:crypto";
import {
  lstat,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { VerificationReport, Verifier } from "@metamorph/agent";
import { type GateResult, RunEventSchema } from "@metamorph/contracts";
import {
  type PublicScenario,
  type VerificationResult,
  verifyPair,
  type WorkerAdapter,
} from "@metamorph/oracle";
import {
  createPublicPair,
  type PairFactory,
  PUBLIC_SCENARIOS,
  parseDemoMarker,
} from "./fixtures.js";
import { checkedGates, safeReport } from "./report.js";

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}
function inside(parent: string, child: string) {
  const rel = relative(parent, child);
  return (
    rel !== "" &&
    !isAbsolute(rel) &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`)
  );
}
async function regular(root: string, path: string) {
  const resolved = await realpath(path);
  const info = await lstat(path);
  if (
    !inside(root, resolved) ||
    info.isSymbolicLink() ||
    !info.isFile() ||
    info.nlink !== 1 ||
    info.size === 0
  )
    throw new Error("INVALID_EVIDENCE_FILE");
}

/** Validate real runner publication and every referenced file before accepting it. */
export async function validateEvidence(
  result: VerificationResult,
  attemptRoot: string,
  scenarios: readonly PublicScenario[],
): Promise<GateResult[]> {
  const root = await realpath(result.evidenceDirectory);
  if (
    !inside(await realpath(attemptRoot), root) ||
    result.scope !== "synthetic-or-public-scenarios-only"
  )
    throw new Error("INVALID_EVIDENCE_ROOT");
  const gates = checkedGates(result.gateResults);
  const g2 = gates.find((g) => g.gate === "G2");
  const g3 = gates.find((g) => g.gate === "G3");
  // An executed ID must have its corresponding raw observation and diff;
  // checking only whatever paths happened to be listed would accept omissions.
  for (const [index, scenario] of scenarios.entries()) {
    const required: [typeof g2, string[]][] = [];
    if (g3?.executedTestIds.includes(`${scenario.id}:initial`)) {
      required.push([
        g3,
        [
          `db/${index}-initial-reference.json`,
          `db/${index}-initial.json`,
          `diffs/${index}-initial.json`,
        ],
      ]);
    }
    for (const step of scenario.requests.keys()) {
      const id = `${scenario.id}:step-${step}`;
      const http = [
        `http/${index}-${step}-reference.json`,
        `http/${index}-${step}.json`,
        `diffs/${index}-${step}-http.json`,
      ];
      if (g2?.executedTestIds.includes(id)) required.push([g2, http]);
      if (g3?.executedTestIds.includes(id))
        required.push([
          g3,
          [
            ...http,
            `db/${index}-${step}-reference.json`,
            `db/${index}-${step}.json`,
            `diffs/${index}-${step}-db.json`,
          ],
        ]);
    }
    if (
      required.some(([gate, paths]) =>
        paths.some((path) => !gate?.evidencePaths.includes(path)),
      )
    )
      throw new Error("INCOMPLETE_EVIDENCE_INDEX");
  }
  for (const path of new Set([
    "manifest.json",
    "gate-results.json",
    "events.jsonl",
    "controls.json",
    "model-usage.json",
    "report.html",
    ...gates.flatMap((g) => g.evidencePaths),
  ])) {
    await regular(root, join(root, path));
  }
  if (
    JSON.stringify(await json(join(root, "gate-results.json"))) !==
    JSON.stringify(gates)
  )
    throw new Error("EVIDENCE_REPORT_MISMATCH");
  const manifest = (await json(join(root, "manifest.json"))) as {
    runId: string;
    scenarioIds: string[];
    expectedSteps: number;
  };
  if (
    JSON.stringify(manifest.scenarioIds) !==
      JSON.stringify(scenarios.map((s) => s.id)) ||
    manifest.expectedSteps !==
      scenarios.reduce((n, s) => n + s.requests.length, 0)
  )
    throw new Error("EVIDENCE_CORPUS_MISMATCH");
  const events = (await readFile(join(root, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => RunEventSchema.parse(JSON.parse(line)));
  if (
    events.length !== 3 ||
    events.some(
      (e) => e.runId !== manifest.runId || e.type !== "gate-result",
    ) ||
    JSON.stringify(
      events.map((e) => (e.type === "gate-result" ? e.result : null)),
    ) !== JSON.stringify(gates)
  )
    throw new Error("EVIDENCE_JOURNAL_MISMATCH");
  return gates;
}

export interface AttemptRecord {
  runId: string;
  verificationAttempt: number;
  candidateSha256: string;
  evidenceDirectory: string;
  gateResults: GateResult[];
  executedScenarioIds: string[];
}
export interface VerifierOptions {
  runId: string;
  candidateRoot: string;
  artifactParent: string;
  operationTimeoutMs: number;
  // Trusted PUBLIC fixture provisioning seam, never supplied by the provider.
  createPair?: PairFactory;
}

export class OracleBackedVerifier implements Verifier {
  readonly evidenceKind = "synthetic" as const;
  readonly #options: VerifierOptions;
  readonly #records: AttemptRecord[] = [];
  #pending: Promise<VerificationReport> | undefined;
  #attempt = 0;
  get attempts(): readonly AttemptRecord[] {
    return structuredClone(this.#records);
  }
  constructor(options: VerifierOptions) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(options.runId) ||
      !Number.isSafeInteger(options.operationTimeoutMs) ||
      options.operationTimeoutMs < 1 ||
      options.operationTimeoutMs > 30000
    )
      throw new Error("INVALID_VERIFIER_OPTIONS");
    this.#options = { ...options };
  }
  async waitForIdle(): Promise<void> {
    await this.#pending?.catch(() => {});
  }
  verify(
    candidateRoot: string,
    signal: AbortSignal,
  ): Promise<VerificationReport> {
    if (this.#pending) return Promise.reject(new Error("VERIFICATION_BUSY"));
    const pending = this.#verify(candidateRoot, signal);
    this.#pending = pending;
    void pending
      .finally(() => {
        this.#pending = undefined;
      })
      .catch(() => {});
    return pending;
  }
  async #verify(
    candidateRoot: string,
    signal: AbortSignal,
  ): Promise<VerificationReport> {
    try {
      signal.throwIfAborted();
      const candidate = await realpath(candidateRoot);
      const artifacts = await realpath(this.#options.artifactParent);
      if (
        candidate !== (await realpath(this.#options.candidateRoot)) ||
        candidate === artifacts ||
        inside(candidate, artifacts) ||
        inside(artifacts, candidate)
      )
        throw new Error("OVERLAPPING_ROOTS");
      const candidatePath = join(candidate, "src", "candidate.ts");
      if (
        JSON.stringify((await readdir(candidate)).sort()) !== '["src"]' ||
        JSON.stringify((await readdir(join(candidate, "src"))).sort()) !==
          '["candidate.ts"]'
      )
        throw new Error("DEMO_SOURCE_SCOPE");
      await regular(candidate, candidatePath);
      if ((await lstat(candidatePath)).size > 128)
        throw new Error("OVERSIZED_MARKER");
      const text = await readFile(candidatePath, "utf8");
      const mode = parseDemoMarker(text);
      const candidateSha256 = createHash("sha256").update(text).digest("hex");
      const verificationAttempt = ++this.#attempt;
      const attemptRoot = await mkdtemp(join(artifacts, "attempt-"));
      signal.throwIfAborted();
      const pair = await (this.#options.createPair ?? createPublicPair)(
        attemptRoot,
        mode,
        signal,
      );
      // The Oracle has per-operation cancellation only. This wrapper stops new
      // work and combines cancellation for cooperative fixture fetches. Close
      // always uses Oracle's fresh cleanup signal, even after external abort.
      const wrap = (worker: WorkerAdapter): WorkerAdapter => ({
        reset: (s) => {
          signal.throwIfAborted();
          return worker.reset(AbortSignal.any([signal, s]));
        },
        request: (r, s) => {
          signal.throwIfAborted();
          return worker.request(r, AbortSignal.any([signal, s]));
        },
        snapshot: (s) => {
          signal.throwIfAborted();
          return worker.snapshot(AbortSignal.any([signal, s]));
        },
        close: (s) => worker.close(s),
      });
      if (pair.reference === pair.candidate) {
        const cleanup = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            Promise.resolve().then(() => pair.reference.close(cleanup.signal)),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                cleanup.abort();
                reject(new Error("CLEANUP_TIMEOUT"));
              }, this.#options.operationTimeoutMs);
            }),
          ]);
        } finally {
          clearTimeout(timer);
          cleanup.abort();
        }
        throw new Error("ALIASED_WORKERS");
      }
      const result = await verifyPair({
        reference: wrap(pair.reference),
        candidate: wrap(pair.candidate),
        scenarios: structuredClone(PUBLIC_SCENARIOS),
        artifactParent: attemptRoot,
        operationTimeoutMs: this.#options.operationTimeoutMs,
      });
      signal.throwIfAborted();
      const gates = await validateEvidence(
        result,
        attemptRoot,
        PUBLIC_SCENARIOS,
      );
      const report = safeReport(gates, PUBLIC_SCENARIOS);
      if ((await readFile(candidatePath, "utf8")) !== text)
        throw new Error("STALE_CANDIDATE");
      const record: AttemptRecord = {
        runId: this.#options.runId,
        verificationAttempt,
        candidateSha256,
        evidenceDirectory: result.evidenceDirectory,
        gateResults: gates,
        executedScenarioIds: report.executedScenarioIds,
      };
      signal.throwIfAborted();
      await writeFile(
        join(attemptRoot, "integration-attempt.json"),
        `${JSON.stringify(record, null, 2)}\n`,
        { flag: "wx", mode: 0o600 },
      );
      signal.throwIfAborted();
      this.#records.push(record);
      return report;
    } catch {
      // No raw fixture paths, exception messages, DB state or expected values.
      throw new Error("INTEGRATION_VERIFICATION_ERROR");
    }
  }
}
