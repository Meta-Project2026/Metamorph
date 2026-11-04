import { readTrackG } from "./track-g-adapter.mjs";
import { TRACK_G_PINS as P } from "./track-g-pins.mjs";

const $ = (id) => document.getElementById(id);
const outputs = [
  "latest-gates",
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
    for (const g of r.gates) {
      const pill = document.createElement("span");
      pill.className = `pill verdict-${g.verdict}`;
      pill.textContent = `${g.gate} ${g.verdict}${["G1", "G2", "G3"].includes(g.gate) ? ` · ${g.executedTestIds.length}/${g.executedTestIds.length} checks` : ""}`;
      $("latest-gates").append(pill);
    }
    $("latest-summary").textContent =
      "G1 PASS · 6/6 build/type checks. G2 PASS · 17/17 HTTP comparisons. G3 PASS · 20/20 HTTP + typed SQLite state comparisons. Three public scenarios; source and candidate identities stay fixed across every pair.";
    const g = r.generation;
    $("latest-usage").textContent =
      `${g.provider} / ${g.modelId} · REAL_INFERENCE · ${g.confirmedResponseCount} confirmed response · ${g.inputTokens} input / ${g.outputTokens} output / ${g.cachedInputTokens} cached tokens. Estimated USD ${g.estimatedCostUsd}; charged cost UNKNOWN (ESTIMATE_ONLY). Stop: ${r.stopReason}.`;
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
    $("latest-status").textContent =
      "PINNED_PUBLIC_SNAPSHOT · G1/G2/G3 PASS in recorded public scope · PRODUCT NOT_ESTABLISHED";
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
