// Exact historical PUBLIC artifact inspection only. No provider, network or source.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MEMBERS = Object.freeze({
  "generation.json": [
    2152,
    "9b61d8a35307a309ac2c62f7a4b1f10979c721f4492ee064c52b5a81c8befc97",
  ],
  "trial.json": [
    8493,
    "715e6bb68af4db48d7ca64c8a347a1dc4f188523699d1fa3c5a33ec828a5c4ff",
  ],
  "finalizer.json": [
    165,
    "56ca31959920fe9ff87a31b38b7d8221fd5084bd32e1321245e0ad338ed897b1",
  ],
  "preservation.json": [
    451,
    "c0cbf38399434ad3bd90e57ece211572a850ff5a322aaf6b01073cedef222658",
  ],
  "mmp078-41327197036-attempt.json": [
    765,
    "7e337639cdc19afb7cb179224a785044cfcaa5287ca0c5f050690ae80eb3c05f",
  ],
  "policy.json": [
    137,
    "3adfaf34b2fdcc96a5c7aaf40ec63cab5d67369ed1854c6aa068efd7e8b6bd23",
  ],
});
const ARCHIVES = Object.freeze({
  "public.zip": [
    4884,
    "c97b875427c2acd80d921b6cfab213fb8f29d590c113dbd7f797b8c7b3c4ec3a",
  ],
  "policy.zip": [
    250,
    "020530465e345aa7f750d8c7657ea5fd6bd0f40835a8117354fc40351884a006",
  ],
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const requireFact = (condition) => {
  if (!condition) throw new Error("INCIDENT_PUBLIC_INPUT_REJECTED");
};
export function inspectIncident(directory) {
  const files = {};
  const identities = [];
  for (const [name, [size, expected]] of Object.entries({
    ...ARCHIVES,
    ...MEMBERS,
  })) {
    const path = join(directory, name);
    const st = lstatSync(path);
    requireFact(st.isFile() && !st.isSymbolicLink() && st.size === size);
    const bytes = readFileSync(path);
    const sha256 = hash(bytes);
    requireFact(bytes.length === size && sha256 === expected);
    identities.push({ name, bytes: size, sha256 });
    if (name.endsWith(".json"))
      files[name] = JSON.parse(bytes.toString("utf8"));
  }
  const t = files["trial.json"],
    g = files["generation.json"],
    p = files["preservation.json"],
    f = files["finalizer.json"];
  const ledger = files["mmp078-41327197036-attempt.json"],
    policy = files["policy.json"];
  const head = "d199510fd802693d4af852bd5ed8498b5461d185";
  requireFact(
    t.headSha === head &&
      f.headSha === head &&
      policy.main === head &&
      ledger.headSha === head,
  );
  requireFact(
    t.candidateSha === g.candidateSha &&
      t.attempts.length === 1 &&
      t.attempts[0].pairs.length === 1,
  );
  const a = t.attempts[0],
    pair = a.pairs[0];
  requireFact(
    pair.compilerDiagnostics.candidateSha === t.candidateSha &&
      ledger.attemptedRequests === 1,
  );
  const gates = a.gates.map(
    ({ gate, verdict, executedTestIds, findingCodes }) => ({
      gate,
      verdict,
      executedTestIds,
      findingCodes,
    }),
  );
  return {
    format: "mmp104-public-incident-v1",
    runId: "41327197036",
    jobId: "124909546925",
    headSha: head,
    artifactIds: { public: "13091408776", policy: "13091647657" },
    files: identities,
    candidateSha256: t.candidateSha,
    sourceSha: t.sourceSha,
    sourceArchiveSha256: t.sourceArchiveSha256,
    contextSha256: t.contextSha256,
    manifestSha256: t.manifestSha256,
    requestSha256: g.inputSha256,
    generation: {
      status: g.status,
      generationKind: g.generationKind,
      modelId: g.modelId,
      attemptedRequests: g.attemptedRequests,
      confirmedResponseCount: g.confirmedResponseCount,
      httpStatus: g.httpStatus,
      networkSend: g.networkSend,
      inputTokens: g.inputTokens,
      outputTokens: g.outputTokens,
      cachedInputTokens: g.cachedInputTokens,
      estimatedCostUsd: g.estimatedCostUsd,
      chargedCostUsd: g.chargedCostUsd,
    },
    gates,
    coverage: {
      http: a.coverage.http,
      sqlite: a.coverage.sqlite,
      requiredHttp: a.coverage.requiredHttp,
      requiredSqlite: a.coverage.requiredSqlite,
    },
    firstPair: {
      scenarioId: pair.scenarioId,
      g1Verdict: pair.compilerDiagnostics.g1Verdict,
      diagnosticStatus: pair.compilerDiagnostics.status,
      cleanup: pair.cleanup,
    },
    cleanup: {
      status: t.cleanup.status,
      containers: t.cleanup.containers,
      volumes: t.cleanup.volumes,
      emergencyRemoved: t.cleanup.emergencyRemoved,
    },
    finalizer: {
      status: f.status,
      containers: f.inventory.containers,
      volumes: f.inventory.volumes,
      emergencyRemoved: f.emergencyRemoved,
    },
    preservation: {
      status: p.status,
      identity: p.identity,
      ciphertextSha256: p.ciphertextSha256,
      ciphertextBytes: p.ciphertextBytes,
      upload: p.upload,
    },
    policy: {
      status: policy.status,
      main: policy.main,
      reviewers: policy.reviewers,
      waitTimer: policy.waitTimer,
      branch: policy.branch,
    },
    attemptLedger: {
      actor: ledger.actor,
      runId: ledger.runId,
      status: ledger.status,
      attemptedRequests: ledger.attemptedRequests,
      chargedCostUsd: ledger.chargedCostUsd,
    },
    product: t.product,
    G0: t.G0,
    G4: t.G4,
    historicalRootCause: "UNKNOWN",
    historicalCandidateSource: "UNAVAILABLE",
    privateOperationPacks: "UNAVAILABLE",
    stageClassification: "NOT_RECORDED",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv.length !== 3) throw new Error();
    console.log(JSON.stringify(inspectIncident(process.argv[2]), null, 2));
  } catch {
    console.error("INCIDENT_PUBLIC_INPUT_REJECTED");
    process.exitCode = 1;
  }
}
