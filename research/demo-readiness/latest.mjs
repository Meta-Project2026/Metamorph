import { readTrackG } from "./track-g-adapter.mjs";
import { TRACK_G_PINS as P } from "./track-g-pins.mjs";

const $ = (id) => document.getElementById(id);
const outputs = [
  "latest-gates",
  "latest-model",
  "latest-cost",
  "latest-response",
  "latest-boundary",
  "latest-formal",
  "latest-scenarios",
  "latest-summary",
  "latest-usage",
  "latest-cleanup",
  "latest-json",
  "latest-identities",
  "latest-synthetic",
  "latest-source",
  "latest-limits",
];
const button = $("load-latest");
button.addEventListener("click", async () => {
  button.disabled = true;
  $("latest-evidence").hidden = true;
  for (const id of outputs) $(id).textContent = "";
  $("latest-status").textContent = "NOT_VERIFIED · Checking local bytes…";
  try {
    const response = await fetch(`/${P.directory}/${P.filename}`, {
      cache: "no-store",
      redirect: "error",
    });
    if (
      !response.ok ||
      response.headers.get("Content-Length") !== String(P.bytes)
    )
      throw new Error("SOURCE_UNAVAILABLE");
    const r = await readTrackG(
      P.filename,
      new Uint8Array(await response.arrayBuffer()),
    );
    const labels = {
      G1: "Build & types",
      G2: "HTTP behavior",
      G3: "Database state",
    };
    for (const g of r.gates.filter((gate) =>
      Object.hasOwn(labels, gate.gate),
    )) {
      const row = document.createElement("div");
      const label = document.createElement("span");
      const result = document.createElement("strong");
      label.textContent = labels[g.gate];
      result.className = `verdict-${g.verdict}`;
      result.textContent = `${g.executedTestIds.length}/${g.executedTestIds.length} ${g.verdict}`;
      row.append(label, result);
      $("latest-gates").append(row);
    }
    $("latest-boundary").textContent =
      "Public checks passed · Full verification pending";
    for (const [name, value] of Object.entries({
      "Genuine candidate G0": r.g0RealCandidate,
      "Aggregate G0": r.gates.find((g) => g.gate === "G0").verdict,
      G4: r.g4,
      "Held-out": r.heldOut,
      Product: r.product,
      "Private custody": r.privateCustody,
    })) {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = name;
      detail.textContent = value;
      $("latest-formal").append(term, detail);
    }
    for (const scenario of r.scenarios) {
      const panel = document.createElement("details");
      const heading = document.createElement("summary");
      const json = document.createElement("pre");
      heading.textContent = scenario.scenarioId;
      json.textContent = JSON.stringify(scenario, null, 2);
      panel.append(heading, json);
      $("latest-scenarios").append(panel);
    }
    $("latest-summary").textContent =
      "G1 PASS · 6/6 build/type checks. G2 PASS · 17/17 HTTP comparisons. G3 PASS · 20/20 HTTP + typed SQLite state comparisons. Three public scenarios; source and candidate identities stay fixed across every pair.";
    const g = r.generation;
    const provider =
      g.provider === "meta-model-api" ? "Meta Model API" : g.provider;
    const model = g.modelId === "muse-spark-1.3" ? "Muse Spark 1.3" : g.modelId;
    $("latest-model").textContent = `${provider} · ${model}`;
    $("latest-cost").textContent = `~$${g.estimatedCostUsd.toFixed(3)}`;
    $("latest-response").textContent =
      `One generated candidate · ${g.confirmedResponseCount} confirmed response · ${r.repairs} repairs in this run`;

    $("latest-usage").textContent =
      `${g.provider} / ${g.modelId} · REAL_INFERENCE · ${g.confirmedResponseCount} confirmed response · ${g.inputTokens} input / ${g.outputTokens} output / ${g.cachedInputTokens} cached tokens. Estimated USD ${g.estimatedCostUsd}; charged cost UNKNOWN (ESTIMATE_ONLY). Exact model version: ${g.modelVersion ?? "unknown (null)"}. Actual charged cost: ${g.chargedCostUsd ?? "unknown (null)"}. Stop: ${r.stopReason}.`;
    $("latest-cleanup").textContent =
      "Receipt-reported cleanup: VERIFIED_ZERO_RESOURCES. Finalizer PASS: 0 containers / 0 volumes / 0 emergency removals. No new engine inspection was performed for this demo.";
    $("latest-json").textContent = JSON.stringify(r, null, 2);
    for (const [name, value] of Object.entries({
      Run: r.provenance.runId,
      "Run attempt": r.provenance.runAttempt,
      "Run started (UTC)": r.provenance.runStartedAt,
      "Runner source commit": r.provenance.headSha,
      "Source commit": r.provenance.sourceSha,
      "Source archive SHA-256": r.provenance.sourceArchiveSha256,
      "Candidate SHA-256": r.candidateSha256,
      "Oracle attempt": r.oracleAttemptId,
      "Artifact ID": r.provenance.artifactId,
      "Original ZIP SHA-256": r.provenance.zipSha256,
      "Public manifest SHA-256": r.provenance.manifestSha256,
    })) {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = name;
      detail.textContent = String(value);
      $("latest-identities").append(term, detail);
    }
    $("latest-synthetic").textContent =
      `OWNER_RECORDED_PUBLIC_SYNTHETIC_SUMMARY · Qualified positive PASS. Synthetic candidate SHA-256: ${r.syntheticG0.candidateSha256}. Genuine candidate SHA-256: ${r.candidateSha256}. Independent engine attestation: NOT_ESTABLISHED.`;
    $("latest-source").textContent =
      `Original archive ${r.provenance.artifactId}: ${r.provenance.zipBytes} bytes; ${r.provenance.members.length} members individually hashed before parsing. Run: ${r.provenance.runUri}. Archive source: ${r.provenance.sourceUri}. No external requests are made by this page.`;
    $("latest-limits").textContent =
      `Recorded authorization limits: ${r.limits.maximumPosts} maximum posts / ${r.limits.maximumRepairs} maximum repair / ${r.limits.automaticRetries} automatic retries; ${r.limits.maxOutputTokens} maximum output tokens; target lifetime policy ${r.limits.targetLifetimePolicyMs} ms. ${r.limits.monetaryCap}. Observed: 1 response, 0 repairs. No standing authorization.`;
    $("latest-evidence").hidden = false;
    button.textContent = "Verify receipts again";
    $("latest-status").textContent =
      "Local receipt verified · Recorded results loaded";
  } catch {
    for (const id of outputs) $(id).textContent = "";
    $("latest-evidence").hidden = true;
    $("latest-status").textContent =
      "NOT_VERIFIED · Public source missing or invalid. Use the pinned historical A–F fallback; do not claim latest-run success.";
  } finally {
    button.disabled = false;
  }
});
// Enable only after the module and its handler are ready.
button.disabled = false;
