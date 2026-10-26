import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  type GateResult,
  GateResultSchema,
  type RunEvent,
} from "@metamorph/contracts";
import { checkedDifferences, runControls } from "./controls.js";
import {
  compareHttp,
  type Difference,
  type HttpObservation,
  NORMALIZATION_VERSION,
  STABLE_HEADERS,
} from "./http.js";
import { compareSqlite, type SqliteSnapshot } from "./sqlite.js";

export interface ScenarioRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: string;
}

export interface PublicScenario {
  id: string;
  requests: readonly ScenarioRequest[];
}

/** Trusted broker, not a candidate-implemented API. Do not load candidate code here. */
export interface WorkerAdapter {
  reset(signal: AbortSignal): Promise<void>;
  request(
    input: ScenarioRequest,
    signal: AbortSignal,
  ): Promise<HttpObservation>;
  snapshot(signal: AbortSignal): Promise<SqliteSnapshot>;
  close(signal: AbortSignal): Promise<void>;
}

export interface VerificationResult {
  evidenceDirectory: string;
  gateResults: GateResult[];
  scope: "synthetic-or-public-scenarios-only";
}

async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
): Promise<T> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(abort.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(new Error("Worker operation timed out"));
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}

function rawHttp(observation: HttpObservation) {
  return {
    status: observation.status,
    headers: observation.headers,
    bodyBase64: Buffer.from(observation.body).toString("base64"),
  };
}

/** Writes private evidence; callers may publish only reviewed public-control artifacts. */
export async function verifyPair(input: {
  reference: WorkerAdapter;
  candidate: WorkerAdapter;
  scenarios: readonly PublicScenario[];
  artifactParent: string;
  operationTimeoutMs: number;
}): Promise<VerificationResult> {
  if (input.reference === input.candidate)
    throw new Error("Separate worker adapters required");
  if (
    !Number.isSafeInteger(input.operationTimeoutMs) ||
    input.operationTimeoutMs < 1 ||
    input.operationTimeoutMs > 30000
  )
    throw new Error("Explicit operation timeout required (1..30000ms)");
  // Snapshot trusted scenario definitions once. No caller mutations during a run.
  const scenarios = structuredClone(input.scenarios);
  if (
    !Array.isArray(scenarios) ||
    scenarios.length > 100 ||
    new Set(scenarios.map((s) => s.id)).size !== scenarios.length ||
    scenarios.some(
      (s) =>
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(s.id) ||
        !Array.isArray(s.requests) ||
        s.requests.length > 100 ||
        s.requests.some(
          (r: ScenarioRequest) =>
            !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(r.method) ||
            typeof r.path !== "string" ||
            !r.path.startsWith("/") ||
            r.path.startsWith("//") ||
            (r.body !== undefined &&
              (typeof r.body !== "string" ||
                Buffer.byteLength(r.body) > 1024 * 1024)),
        ),
    )
  )
    throw new Error("Invalid public scenario definitions");
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const operation = <T>(fn: (signal: AbortSignal) => Promise<T>) =>
    bounded(fn, input.operationTimeoutMs);
  let evidenceDirectory: string;
  try {
    evidenceDirectory = await mkdtemp(join(input.artifactParent, "oracle-"));
    for (const directory of ["http", "db", "diffs"])
      await mkdir(join(evidenceDirectory, directory));
  } catch (error) {
    await Promise.allSettled([
      operation((signal) => input.reference.close(signal)),
      operation((signal) => input.candidate.close(signal)),
    ]);
    throw error;
  }
  const save = async (path: string, value: unknown) => {
    await writeFile(
      join(evidenceDirectory, path),
      `${JSON.stringify(value, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    return path;
  };
  const executedHttp: string[] = [];
  const executedDb: string[] = [];
  const httpEvidence: string[] = [];
  const dbEvidence: string[] = [];
  const httpFindings: GateResult["findings"] = [];
  const dbFindings: GateResult["findings"] = [];
  const addFindings = (
    findings: GateResult["findings"],
    differences: Difference[],
    scenarioId: string,
  ) => {
    for (const diff of checkedDifferences(differences))
      findings.push({
        code: diff.code,
        message: `Mismatch at ${diff.path}`,
        scenarioId,
      });
  };
  let fatal: string | undefined;
  let controls: ReturnType<typeof runControls> | undefined;
  let controlsSaved = false;
  const missingCoverage =
    scenarios.length === 0 ||
    scenarios.some((scenario) => scenario.requests.length === 0);
  try {
    controls = runControls();
    await save("controls.json", {
      ...controls,
      observations: {
        ...controls.observations,
        http: controls.observations.http.map(rawHttp),
      },
    });
    controlsSaved = true;
    if (controls.verdict !== "PASS")
      throw new Error("Independent controls failed");
    if (!missingCoverage) {
      for (const [scenarioIndex, scenario] of scenarios.entries()) {
        await operation((signal) => input.reference.reset(signal));
        await operation((signal) => input.candidate.reset(signal));
        const initialReference = structuredClone(
          await operation((signal) => input.reference.snapshot(signal)),
        );
        dbEvidence.push(
          await save(
            `db/${scenarioIndex}-initial-reference.json`,
            initialReference,
          ),
        );
        const initialCandidate = structuredClone(
          await operation((signal) => input.candidate.snapshot(signal)),
        );
        const initialPath = await save(`db/${scenarioIndex}-initial.json`, {
          reference: initialReference,
          candidate: initialCandidate,
        });
        dbEvidence.push(initialPath);
        const initialDiffs = compareSqlite(initialReference, initialCandidate);
        executedDb.push(`${scenario.id}:initial`);
        addFindings(dbFindings, initialDiffs, scenario.id);
        dbEvidence.push(
          await save(`diffs/${scenarioIndex}-initial.json`, initialDiffs),
        );
        // A mismatched initial state cannot demonstrate a differential scenario.
        if (initialDiffs.length > 0) continue;
        for (const [step, request] of scenario.requests.entries()) {
          const prefix = `${scenarioIndex}-${step}`;
          const reference = structuredClone(
            await operation((signal) =>
              input.reference.request(structuredClone(request), signal),
            ),
          );
          // Preserve the completed side even if the other worker fails next.
          httpEvidence.push(
            await save(`http/${prefix}-reference.json`, rawHttp(reference)),
          );
          const candidate = structuredClone(
            await operation((signal) =>
              input.candidate.request(structuredClone(request), signal),
            ),
          );
          httpEvidence.push(
            await save(`http/${prefix}.json`, {
              request,
              reference: rawHttp(reference),
              candidate: rawHttp(candidate),
            }),
          );
          const httpDiffs = compareHttp(reference, candidate);
          executedHttp.push(`${scenario.id}:step-${step}`);
          addFindings(httpFindings, httpDiffs, scenario.id);
          httpEvidence.push(await save(`diffs/${prefix}-http.json`, httpDiffs));
          const referenceDb = structuredClone(
            await operation((signal) => input.reference.snapshot(signal)),
          );
          dbEvidence.push(
            await save(`db/${prefix}-reference.json`, referenceDb),
          );
          const candidateDb = structuredClone(
            await operation((signal) => input.candidate.snapshot(signal)),
          );
          dbEvidence.push(
            await save(`db/${prefix}.json`, {
              reference: referenceDb,
              candidate: candidateDb,
            }),
          );
          const dbDiffs = compareSqlite(referenceDb, candidateDb);
          executedDb.push(`${scenario.id}:step-${step}`);
          addFindings(dbFindings, dbDiffs, scenario.id);
          dbEvidence.push(await save(`diffs/${prefix}-db.json`, dbDiffs));
        }
      }
    }
  } catch {
    // Raw provider/worker exception text can contain secrets or held-out data.
    fatal =
      "Worker, observation, comparator or evidence operation failed; inspect private evidence and trusted worker diagnostics";
  } finally {
    const cleanup = await Promise.allSettled([
      operation((signal) => input.reference.close(signal)),
      operation((signal) => input.candidate.close(signal)),
    ]);
    if (cleanup.some((result) => result.status === "rejected"))
      fatal = "Worker cleanup failed or timed out";
  }
  const expectedSteps = scenarios.reduce(
    (count, scenario) => count + scenario.requests.length,
    0,
  );
  const makeGate = (
    gate: "G2" | "G3",
    executed: string[],
    findings: GateResult["findings"],
    paths: string[],
  ): GateResult => {
    const complete =
      !missingCoverage &&
      executed.length ===
        expectedSteps + (gate === "G3" ? scenarios.length : 0);
    const reasons = [...findings];
    if (fatal) reasons.push({ code: "VERIFIER_ERROR", message: fatal });
    else if (!complete)
      reasons.push({
        code: "MISSING_COVERAGE",
        message: "Not all mandatory scenario steps executed",
      });
    return GateResultSchema.parse({
      gate,
      verdict: fatal
        ? "ERROR"
        : findings.length > 0
          ? "FAIL"
          : !complete
            ? "INCONCLUSIVE"
            : "PASS",
      executedTestIds: executed,
      findings: reasons,
      evidencePaths: paths,
    });
  };
  const g2 = makeGate("G2", executedHttp, httpFindings, httpEvidence);
  const g3 = makeGate(
    "G3",
    executedDb,
    [...httpFindings, ...dbFindings],
    [...httpEvidence, ...dbEvidence],
  );
  const g4 = GateResultSchema.parse({
    gate: "G4",
    verdict: controlsSaved
      ? controls?.verdict === "PASS"
        ? "INCONCLUSIVE"
        : controls?.verdict
      : "ERROR",
    executedTestIds: controls?.cases.map((entry) => entry.id) ?? [],
    findings:
      controlsSaved && controls?.verdict === "PASS"
        ? [
            {
              code: "HELD_OUT_NOT_RUN",
              message:
                "Synthetic controls passed; held-out isolation has not been executed",
            },
          ]
        : [
            {
              code: "CONTROL_FAILURE",
              message:
                "Independent synthetic controls did not complete successfully",
            },
          ],
    evidencePaths: controlsSaved ? ["controls.json"] : [],
  });
  const gateResults = [g2, g3, g4];
  await save("manifest.json", {
    runId: basename(evidenceDirectory),
    scope: "synthetic-or-public-scenarios-only",
    productVerdict: "NOT_RUN",
    normalizationVersion: NORMALIZATION_VERSION,
    stableHeaders: STABLE_HEADERS,
    scenarioIds: scenarios.map((scenario) => scenario.id),
    expectedSteps,
    operationTimeoutMs: input.operationTimeoutMs,
    startedAt,
    elapsedMs: performance.now() - started,
    runtime: {
      node: process.version,
      sqlite: process.versions.sqlite,
      platform: process.platform,
      arch: process.arch,
    },
    notRun: [
      "G0 target independence",
      "G1 candidate build",
      "G4 held-out isolation",
      "PHP benchmark qualification",
    ],
  });
  const events: RunEvent[] = gateResults.map((result) => ({
    type: "gate-result",
    runId: basename(evidenceDirectory),
    timestamp: new Date().toISOString(),
    result,
  }));
  await writeFile(
    join(evidenceDirectory, "events.jsonl"),
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  await save("model-usage.json", []);
  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  await writeFile(
    join(evidenceDirectory, "report.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Oracle fixture evidence</title><h1>Oracle fixture evidence</h1><p>Public/synthetic scenario scope only. Product verdict: NOT_RUN. G0/G1, PHP qualification and held-out isolation were not executed.</p><pre>${escapeHtml(JSON.stringify(gateResults, null, 2))}</pre></html>\n`,
    { flag: "wx", mode: 0o600 },
  );
  // Last file is the publication marker. Failure here rejects, never returns PASS.
  await save("gate-results.json", gateResults);
  return {
    evidenceDirectory,
    gateResults,
    scope: "synthetic-or-public-scenarios-only",
  };
}
