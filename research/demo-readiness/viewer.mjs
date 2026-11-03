import {
  MAX_BYTES,
  RECEIPT_NAMES,
  readBundle,
  readFuture,
} from "./adapter.mjs";
import { readIncident } from "./incident-adapter.mjs";
import { PINS } from "./pins.mjs";
import { REAL_AI_NAMES, readRealBundle } from "./real-ai-adapter.mjs";
import { REAL_AI_PINS } from "./real-ai-pins.mjs";
import { readTrackE } from "./track-e-adapter.mjs";
import { TRACK_E_PINS } from "./track-e-pins.mjs";

const INCIDENT_DIRECTORY = "evidence/mmp-104";

const byId = (id) => document.getElementById(id);
let bundle = null;
let generation = 0;
let chapter = 0;
const availableTracks = new Map();
const TRACK_SECTIONS = {
  A: "historical-model",
  B: "historical-replay",
  C: "real-ai",
  D: "incident",
  E: "parity",
};
const CHAPTERS = [
  [
    null,
    "A response is a beginning. Verification is the question.",
    "Explore five historical tracks: admission, a scripted control and three genuine AI responses. C failed build; D ended in a verifier error; E passed all public builds but failed JSON type parity. No migration runs in this viewer.",
  ],
  [
    "A",
    "A / Before generation",
    "The historical provider was not admitted. Zero generated requests, no candidate, unknown cost. NOT_RUN belongs to this snapshot; later runs do not rewrite it.",
  ],
  [
    "B",
    "B / First, test the verifier",
    "A known-good replay passes scoped checks. A deliberate mutation fails G2/G3. A scripted repair passes them again. All three execute 17 HTTP and 20 SQLite comparisons. This control is not AI generation.",
  ],
  [
    "C",
    "C / Real generation. Build failure.",
    "29 October: one genuine AI response creates a TypeScript candidate. Generation PASS; isolated G1 FAIL / BUILD_FAILED. HTTP 0/17, SQLite 0/20. G2/G3 remain INCONCLUSIVE. The original compiler diagnostics are UNKNOWN.",
  ],
  [
    "D",
    "D / One build passes. Verification stops.",
    "1 November: generation PASS and workshop-business per-pair G1 PASS. Aggregate G1 remains INCONCLUSIVE / BUILD_NOT_RUN. G2/G3 ERROR / VERIFIER_ERROR: HTTP 0/17 completed, SQLite 1/20. Candidate source UNAVAILABLE; historical root cause UNKNOWN.",
  ],
  [
    "E",
    "E / All builds pass. HTTP types still differ.",
    "2 November: genuine generation, aggregate G1 PASS across three scenarios and six typecheck/build IDs. G2/G3 FAIL / HTTP_JSON_TYPE, with 17/17 HTTP and 20/20 SQLite comparisons executed. Compared SQLite snapshots match within this manifest. The exact HTTP field is UNCONFIRMED; PRODUCT NOT_ESTABLISHED.",
  ],
  [
    null,
    "What would establish acceptance?",
    "An independent complete target, the applicable mandatory G0–G4 gates and complete mandatory scenario evidence for that exact candidate. These receipts do not establish that. PRODUCT NOT_ESTABLISHED. Newer experiments are outside this snapshot.",
  ],
];
const STAGES = [
  "A frozen PHP source and explicit public scope make the inputs inspectable. No source code executes in this viewer.",
  "A bounded agent requests a model response. Track A did not generate; C, D and E record genuine responses. No request is sent now.",
  "The generated TypeScript candidate has its own content hash. A candidate identity is not a build result; D's historical candidate source is unavailable.",
  "Independent isolated checks cover G0 completeness, G1 build, G2 HTTP, G3 stateful parity and G4 independent controls. These receipts do not establish all gates.",
  "Recorded outcomes retain FAIL, ERROR, INCONCLUSIVE and NOT_RUN. A matching receipt pin proves snapshot byte identity, not new execution or product acceptance.",
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function definitions(items) {
  const list = element("dl");
  for (const [label, value] of items)
    list.append(element("dt", label), element("dd", value));
  return list;
}
function reset() {
  bundle = null;
  availableTracks.clear();
  byId("overview").hidden = true;
  byId("empty-state").hidden = false;
  byId("track-cards").replaceChildren();
  byId("gate-matrix").replaceChildren();
  byId("evidence").hidden = true;
  byId("future").hidden = true;
  for (const id of [
    "historical-model",
    "historical-replay",
    "historical-context",
    "real-ai",
    "incident",
    "parity",
  ])
    byId(id).hidden = true;
  for (const id of [
    "attempts",
    "raw",
    "future-content",
    "receipt",
    "model-label",
    "model-alias",
    "model-metrics",
    "model-gates",
    "cleanup",
    "scope",
    "identities",
    "real-metrics",
    "real-gates",
    "real-timeline",
    "real-identities",
    "incident-metrics",
    "incident-gates",
    "incident-timeline",
    "incident-identities",
    "parity-metrics",
    "parity-gates",
    "parity-identities",
  ])
    byId(id).replaceChildren();
  updateGuide();
}
function selectTrack(track) {
  if (!availableTracks.has(track)) return;
  for (const [id, section] of Object.entries(TRACK_SECTIONS))
    byId(section).hidden = id !== track;
  byId("historical-context").hidden = track !== "A" && track !== "B";
  for (const button of byId("track-cards").children)
    button.setAttribute("aria-pressed", String(button.dataset.track === track));
}
function updateGuide() {
  const [track, title, description] = CHAPTERS[chapter];
  byId("guide-title").textContent = title;
  byId("guide-description").textContent = description;
  byId("guide-position").textContent =
    `CHAPTER ${String(chapter + 1).padStart(2, "0")} / ${String(CHAPTERS.length).padStart(2, "0")}`;
  byId("guide-progress").textContent =
    `${chapter + 1} of ${CHAPTERS.length} · no automatic transitions`;
  byId("guide-prev").disabled = chapter === 0;
  byId("guide-next").disabled = chapter === CHAPTERS.length - 1;
  for (const button of document.querySelectorAll("[data-chapter]")) {
    if (Number(button.dataset.chapter) === chapter)
      button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
  const loaded = track && availableTracks.has(track);
  byId("guide-evidence-note").textContent = loaded
    ? `Track ${track} is loaded from validated pinned bytes. Inspect its recorded results below.`
    : track
      ? `Track ${track} is not loaded (${track}_NOT_LOADED). The narration describes the historical snapshot; it is not loaded evidence.`
      : "This is a recorded walkthrough, with no live execution or automatic transitions.";
  byId("guide-target").setAttribute(
    "href",
    loaded
      ? `#${TRACK_SECTIONS[track]}`
      : chapter === CHAPTERS.length - 1
        ? "#acceptance"
        : "#receipt-desk",
  );
  byId("guide-target").textContent = loaded
    ? `Inspect track ${track} ↓`
    : chapter === CHAPTERS.length - 1
      ? "Revisit product acceptance ↑"
      : "Load and inspect receipts ↓";
  if (loaded) selectTrack(track);
}
function renderOverview(historical, real, incident, parity) {
  const matrix = [];
  function row(label, gates, http, sqlite) {
    const tr = element("tr");
    const heading = element("th", label);
    heading.scope = "row";
    tr.append(heading);
    for (const gate of ["G0", "G1", "G2", "G3", "G4"])
      tr.append(element("td", gates[gate], `verdict-${gates[gate]}`));
    tr.append(element("td", http), element("td", sqlite));
    matrix.push(tr);
  }
  if (historical) {
    availableTracks.set("A", [
      "No generation",
      "HISTORICAL ADMISSION",
      "NOT_RUN",
      "0 generated requests · candidate null",
      "HTTP NOT_RUN · SQLite NOT_RUN",
    ]);
    availableTracks.set("B", [
      "Scripted control",
      "DOCKER REPLAY · NOT AI",
      "PASS → FAIL → PASS",
      "G2/G3 per attempt · scripted repair",
      "HTTP 17/17 · SQLite 20/20 per attempt",
    ]);
    row("A · No generation", historical.model.gates, "NOT_RUN", "NOT_RUN");
    for (const attempt of historical.replay.attempts)
      row(
        `B · ${attempt.label}`,
        Object.fromEntries(attempt.gates.map((g) => [g.gate, g.verdict])),
        `${attempt.coverage.http}/${attempt.coverage.requiredHttp}`,
        `${attempt.coverage.sqlite}/${attempt.coverage.requiredSqlite}`,
      );
  }
  if (real) {
    availableTracks.set("C", [
      "Real AI · build failure",
      "29 OCT 2026 · REAL AI",
      `G1 ${real.gates.G1}`,
      "Generation PASS · G2/G3 INCONCLUSIVE",
      `HTTP ${real.coverage.http}/${real.coverage.requiredHttp} · SQLite ${real.coverage.sqlite}/${real.coverage.requiredSqlite}`,
    ]);
    row(
      "C · Real AI",
      real.gates,
      `${real.coverage.http}/${real.coverage.requiredHttp}`,
      `${real.coverage.sqlite}/${real.coverage.requiredSqlite}`,
    );
  }
  if (incident) {
    availableTracks.set("D", [
      "Real AI · verifier error",
      "1 NOV 2026 · REAL AI",
      `G2/G3 ${incident.gates.G2}`,
      "Per-pair G1 PASS · aggregate INCONCLUSIVE",
      `HTTP ${incident.coverage.http}/${incident.coverage.requiredHttp} · SQLite ${incident.coverage.sqlite}/${incident.coverage.requiredSqlite}`,
    ]);
    row(
      "D · Real AI",
      incident.gates,
      `${incident.coverage.http}/${incident.coverage.requiredHttp}`,
      `${incident.coverage.sqlite}/${incident.coverage.requiredSqlite}`,
    );
  }
  if (parity) {
    availableTracks.set("E", [
      "Real AI · JSON type failure",
      "2 NOV 2026 · REAL AI",
      `G2/G3 ${parity.gates.G2}`,
      "Aggregate G1 PASS · all 3 scenarios",
      `HTTP ${parity.coverage.http}/${parity.coverage.requiredHttp} · SQLite ${parity.coverage.sqlite}/${parity.coverage.requiredSqlite} executed`,
    ]);
    row(
      "E · Real AI",
      parity.gates,
      `${parity.coverage.http}/${parity.coverage.requiredHttp}`,
      `${parity.coverage.sqlite}/${parity.coverage.requiredSqlite}`,
    );
  }
  for (const [
    id,
    [title, provenance, outcome, distinction, coverage],
  ] of availableTracks) {
    const button = element("button", undefined, `track-card track-${id}`);
    button.type = "button";
    button.dataset.track = id;
    button.setAttribute("aria-controls", TRACK_SECTIONS[id]);
    button.setAttribute("aria-pressed", "false");
    button.append(
      element("span", id, "track-letter"),
      element("span", provenance, "eyebrow"),
      element("strong", title),
      element(
        "span",
        outcome,
        id === "C" || id === "D" || id === "E"
          ? "outcome verdict-ERROR"
          : "outcome verdict-INCONCLUSIVE",
      ),
      element("span", distinction, "track-distinction"),
      element("span", coverage, "track-coverage"),
    );
    button.addEventListener("click", () => {
      chapter = CHAPTERS.findIndex(([track]) => track === id);
      updateGuide();
    });
    byId("track-cards").append(button);
  }
  byId("gate-matrix").append(...matrix);
  byId("overview").hidden = false;
  byId("empty-state").hidden = true;
  selectTrack(availableTracks.keys().next().value);
  updateGuide();
}
function renderHistorical(value) {
  for (const id of [
    "historical-model",
    "historical-replay",
    "historical-context",
  ])
    byId(id).hidden = false;
  byId("model-label").textContent = value.model.label;
  byId("model-alias").textContent =
    `Producer receipt: ${value.model.receiptLabel} / modelGeneration=NOT_RUN`;
  for (const [label, number] of [
    ["Generated requests", value.model.requests],
    ["Candidate SHA", value.model.candidateSha],
    ["Total cost USD", value.model.costUsd],
  ]) {
    const metric = element("div", undefined, "metric");
    metric.append(
      element("span", label),
      element("strong", number === null ? "null / unknown" : number),
    );
    byId("model-metrics").append(metric);
  }
  for (const [gate, status] of Object.entries(value.model.gates))
    byId("model-gates").append(
      element("span", `${gate} ${status}`, `verdict-${status}`),
    );
  for (const attempt of value.replay.attempts) {
    const row = element("tr");
    const label = element("td", attempt.label);
    label.append(element("small", attempt.candidateSha));
    row.append(label);
    for (const gate of attempt.gates)
      row.append(element("td", gate.verdict, `verdict-${gate.verdict}`));
    row.append(
      element(
        "td",
        `${attempt.coverage.http}/${attempt.coverage.requiredHttp}`,
      ),
      element(
        "td",
        `${attempt.coverage.sqlite}/${attempt.coverage.requiredSqlite}`,
      ),
    );
    byId("attempts").append(row);
  }
  const cleanup = value.replay.cleanup;
  const finalizer = value.replay.finalizer;
  byId("cleanup").textContent =
    `Replay normal cleanup: ${cleanup.inventory.containers} containers / ${cleanup.inventory.volumes} volumes / emergencyRemoved=${cleanup.emergencyRemoved}. Independent finalizer: ${finalizer.status}, ${finalizer.inventory.containers}/${finalizer.inventory.volumes}, emergencyRemoved=${finalizer.emergencyRemoved}. Runtime controls: ${value.replay.runtimeControls.filter((c) => c.outcome === "PASS").length}/${value.replay.runtimeControls.length} PASS. Formal G4 remains INCONCLUSIVE.`;
  byId("scope").append(
    definitions([
      ["Source repository", value.source.repository],
      ["Public API actions", value.source.actions.join(" · ")],
      ["PHP functions / classes", `${value.source.functions} / 0`],
      [
        "All PHP-extension files: physical / nonblank PHP-region lines incl. comments",
        `${value.source.phpPhysicalLines} / ${value.source.phpRegionLines}`,
      ],
    ]),
  );
  byId("identities").append(
    definitions([
      ["Execution head SHA", PINS.headSha],
      ["Evidence documentation commit (PR #70)", PINS.evidenceCommit],
      ["Source SHA", PINS.sourceSha],
      [
        "Hosted run",
        `https://github.com/Meta-Project2026/Metamorph/actions/runs/${PINS.runId}`,
      ],
    ]),
  );
}
function renderReal(value) {
  const g = value.generation;
  byId("real-metrics").append(
    definitions([
      ["Model / generation", `${g.modelId} / ${g.status} (generation only)`],
      [
        "Attempted requests / confirmed responses",
        `${g.attemptedRequests} / ${g.confirmedResponseCount}`,
      ],
      ["Input / output tokens", `${g.inputTokens} / ${g.outputTokens}`],
      ["Estimated cost USD (ESTIMATE_ONLY)", g.estimatedCostUsd],
      [
        "Charged cost USD",
        g.chargedCostUsd === null
          ? "null / unknown — settled charge unavailable"
          : g.chargedCostUsd,
      ],
    ]),
  );
  for (const [gate, status] of Object.entries(value.gates))
    byId("real-gates").append(
      element("span", `${gate} ${status}`, `verdict-${status}`),
    );
  for (const text of [
    `Source frozen: ${REAL_AI_PINS.sourceSha}.`,
    `One authorized request on 29 October 2026: ${g.provider} / ${g.modelId}.`,
    `One model response; TS candidate ${g.candidateSha}. Generation PASS.`,
    "Isolated Docker typecheck: G1 FAIL / BUILD_FAILED. Original compiler diagnostics UNKNOWN.",
    `HTTP ${value.coverage.http}/${value.coverage.requiredHttp} and SQLite ${value.coverage.sqlite}/${value.coverage.requiredSqlite}: not executed; G2/G3 INCONCLUSIVE / MISSING_COVERAGE.`,
    `Cleanup ${value.trial.cleanup.status}: 0 containers / 0 volumes / 0 emergency removals. Independent finalizer ${value.finalizer.status}: 0/0/0.`,
  ])
    byId("real-timeline").append(element("li", text));
  byId("real-identities").append(
    definitions([
      ["Actual MMP-081 run", REAL_AI_PINS.runId],
      ["Execution head SHA", REAL_AI_PINS.headSha],
      ["Frozen source SHA", REAL_AI_PINS.sourceSha],
      ["Generated candidate SHA", REAL_AI_PINS.candidateSha],
      [
        "Original artifact ID / ZIP SHA-256",
        `${REAL_AI_PINS.artifactId} / ${REAL_AI_PINS.zipSha256}`,
      ],
    ]),
  );
  byId("real-ai").hidden = false;
}
function renderIncident(value) {
  const g = value.generation;
  byId("incident-metrics").append(
    definitions([
      ["Model / generation", `${g.modelId} / ${g.status} (generation only)`],
      [
        "Attempted requests / confirmed responses",
        `${g.attemptedRequests} / ${g.confirmedResponseCount}`,
      ],
      ["Input / output tokens", `${g.inputTokens} / ${g.outputTokens}`],
      ["Estimated cost USD (ESTIMATE_ONLY)", g.estimatedCostUsd],
      [
        "Charged cost USD",
        g.chargedCostUsd === null
          ? "null / unknown — settled charge unavailable"
          : g.chargedCostUsd,
      ],
      [
        "First pair / build",
        `${value.firstPair.scenarioId} · per-pair G1 ${value.firstPair.g1Verdict} · diagnostics ${value.firstPair.diagnosticStatus}`,
      ],
      [
        "Aggregate G1",
        "INCONCLUSIVE / BUILD_NOT_RUN — only workshop-business typecheck + build ran",
      ],
      [
        "Preservation",
        `${value.preservation.status} · encrypted upload ${value.preservation.upload}`,
      ],
      [
        "Stage classification",
        `${value.stageClassification} — production telemetry was added later, not present in this run`,
      ],
      ["Historical root cause", value.historicalRootCause],
    ]),
  );
  for (const [gate, status] of Object.entries(value.gates))
    byId("incident-gates").append(
      element("span", `${gate} ${status}`, `verdict-${status}`),
    );
  const http = `${value.coverage.http}/${value.coverage.requiredHttp}`;
  const sqlite = `${value.coverage.sqlite}/${value.coverage.requiredSqlite}`;
  for (const text of [
    `Generation PASS: one authorized POST, HTTP ${g.httpStatus}, ${g.confirmedResponseCount} confirmed response from ${g.modelId}.`,
    "First pair build PASS: workshop-business typecheck + build completed — the first per-pair G1 PASS for a real AI candidate.",
    "Aggregate G1 INCONCLUSIVE / BUILD_NOT_RUN: the other pairs' builds never executed, so the full build is not established.",
    `G3 ERROR / VERIFIER_ERROR: ${sqlite} typed SQLite comparisons — only workshop-business:initial was recorded.`,
    `G2 ERROR / VERIFIER_ERROR: ${http} completed HTTP comparisons; zero completed comparisons does not mean zero requests reached the services.`,
    `Normal cleanup ${value.cleanup.status}; independent finalizer ${value.finalizer.status}: ${value.finalizer.containers} containers / ${value.finalizer.volumes} volumes / ${value.finalizer.emergencyRemoved} emergency removals.`,
    `Generated candidate source ${value.historicalCandidateSource}; private operation packs ${value.privateOperationPacks}; historical root cause ${value.historicalRootCause}. Estimate USD ${g.estimatedCostUsd}; charged cost null — attempt ledger ${value.attemptLedger.status}.`,
  ])
    byId("incident-timeline").append(element("li", text));
  byId("incident-identities").append(
    definitions([
      ["Run / job", `${value.runId} / ${value.jobId}`],
      ["Execution head SHA", value.headSha],
      ["Frozen source SHA", value.sourceSha],
      ["Generated candidate SHA", value.candidateSha256],
      [
        "Derived summary (hash identity only)",
        `${value.summarySourcePath} · ${value.summaryBytes} bytes · SHA-256 ${value.summarySha256}`,
      ],
      [
        "Hosted run",
        `https://github.com/Meta-Project2026/Metamorph/actions/runs/${value.runId}`,
      ],
    ]),
  );
  byId("incident").hidden = false;
}
function renderTrackE(value) {
  const g = value.generation;
  const p = value.provenance;
  byId("parity-metrics").append(
    definitions([
      ["Model / generation", `${g.modelId} / ${g.status} (generation only)`],
      [
        "Requests / confirmed responses / provider HTTP",
        `${g.attemptedRequests} / ${g.confirmedResponseCount} / ${g.httpStatus}`,
      ],
      [
        "Aggregate G1",
        `${value.gates.G1} · 3 scenarios · ${value.executed.G1.length} typecheck/build IDs`,
      ],
      [
        "G2 / completed HTTP comparisons",
        `${value.gates.G2} / HTTP_JSON_TYPE · ${value.coverage.http}/${value.coverage.requiredHttp} executed`,
      ],
      [
        "G3 / typed SQLite comparisons",
        `${value.gates.G3} / HTTP_JSON_TYPE · ${value.coverage.sqlite}/${value.coverage.requiredSqlite} executed`,
      ],
      [
        "SQLite conclusion (bounded inference)",
        "Compared initial/post-step snapshots match within this manifest; G3 also includes HTTP findings.",
      ],
      ["Input / output tokens", `${g.inputTokens} / ${g.outputTokens}`],
      [
        "Estimated USD / charged USD",
        `${g.estimatedCostUsd} ESTIMATE_ONLY / null (UNKNOWN, not zero)`,
      ],
      [
        "Cleanup / independent finalizer",
        `${value.cleanup.status} / ${value.finalizer.status} · 0 containers / 0 volumes / 0 emergency removals`,
      ],
      ["Formal held-out / product", "NOT_RUN / NOT_ESTABLISHED"],
    ]),
  );
  for (const [gate, status] of Object.entries(value.gates))
    byId("parity-gates").append(
      element("span", `${gate} ${status}`, `verdict-${status}`),
    );
  byId("parity-identities").append(
    definitions([
      ["Run / attempt", `${p.runId} / ${p.runAttempt}`],
      ["Execution head SHA", p.headSha],
      ["Frozen source SHA", p.sourceSha],
      ["Generated candidate SHA", p.candidateSha256],
      [
        "Original PUBLIC artifact ID / ZIP SHA-256",
        `${p.artifactId} / ${p.zipSha256}`,
      ],
      [
        "Pinned derived public snapshot",
        `${TRACK_E_PINS.filename} · ${TRACK_E_PINS.bytes} bytes · SHA-256 ${TRACK_E_PINS.sha256}`,
      ],
    ]),
  );
  byId("parity").hidden = false;
}
function renderBundles(historical, real, incident, parity) {
  bundle = { receipts: {} };
  if (historical) renderHistorical(historical);
  if (real) renderReal(real);
  if (incident) renderIncident(incident);
  if (parity) renderTrackE(parity);
  for (const [label, value] of [
    ["Historical #70", historical],
    ["Real AI #81", real],
    ["Incident #104", incident],
    ["Real AI #137", parity],
  ]) {
    if (!value) continue;
    for (const [name, receipt] of Object.entries(value.receipts)) {
      const key = `${label} / ${name}`;
      bundle.receipts[key] = receipt;
      const option = element("option", key);
      option.value = key;
      byId("receipt").append(option);
    }
  }
  showRaw();
  renderOverview(historical, real, incident, parity);
  byId("evidence").hidden = false;
}
function showRaw() {
  if (bundle)
    byId("raw").textContent = JSON.stringify(
      bundle.receipts[byId("receipt").value],
      null,
      2,
    );
}
async function load(getFiles) {
  const current = ++generation;
  reset();
  byId("status").className = "";
  byId("status").textContent = "Validating selected files…";
  try {
    const input = await getFiles();
    let future;
    let historical;
    let real;
    let incident;
    let parity;
    if (Array.isArray(input)) {
      if (input.length === 1 && input[0].name === "future-model.json")
        future = readFuture(input[0].name, input[0].bytes);
      else if (input.length === 1 && input[0].name === "incident.json")
        incident = await readIncident(input[0].bytes);
      else if (input.length === 1 && input[0].name === TRACK_E_PINS.filename)
        parity = await readTrackE(input[0].name, input[0].bytes);
      else if (
        input.some(
          (file) =>
            file.name === "generation.json" ||
            file.name === "mmp078-40900698372-attempt.json",
        )
      )
        real = await readRealBundle(input);
      else historical = await readBundle(input);
    } else {
      // All bundled tracks are validated before displaying any results; one invalid
      // or missing track fails the whole load and clears prior results.
      [historical, real, incident, parity] = await Promise.all([
        readBundle(input.historical),
        readRealBundle(input.real),
        readIncident(input.incident.bytes),
        readTrackE(input.parity.name, input.parity.bytes),
      ]);
    }
    if (current !== generation) return;
    if (future) {
      byId("future-content").textContent = JSON.stringify(future, null, 2);
      byId("future").hidden = false;
    } else renderBundles(historical, real, incident, parity);
    const loaded = [
      historical && "historical A/B (5 receipts)",
      real && "PINNED_REAL_AI_SNAPSHOT C (4 receipts)",
      incident && "PINNED_INCIDENT_SUMMARY D (1 receipt)",
      parity && "PINNED_PUBLIC_PARITY_SUMMARY E (1 public projection)",
    ].filter(Boolean);
    byId("status").textContent = future
      ? "NOT_VERIFIED — declaration only; no independent execution established."
      : `${loaded.join(" + ")}. Recorded evidence; this viewer executes no model or Oracle run.`;
  } catch (error) {
    if (current !== generation) return;
    reset();
    byId("status").className = "error";
    const code = /^[A-Z_]{3,40}$/.test(error.message)
      ? error.message
      : "READ_OR_VALIDATION_ERROR";
    byId("status").textContent =
      `NOT_VERIFIED / ${code}. No selected receipt results are displayed.`;
  }
}
byId("load").addEventListener("click", () =>
  load(async () => {
    const fetchFiles = (names, directory) =>
      Promise.all(
        names.map(async (name) => {
          const response = await fetch(`/${directory}/${name}`, {
            credentials: "omit",
            redirect: "error",
            cache: "no-store",
          });
          if (
            !response.ok ||
            Number(response.headers.get("Content-Length")) > MAX_BYTES
          )
            throw new Error("MISSING_OR_OVERSIZED_RECEIPT");
          // Bounded streaming prevents a replaced local server from forcing an unbounded allocation.
          const reader = response.body.getReader();
          const chunks = [];
          let size = 0;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BYTES) {
              await reader.cancel();
              throw new Error("SIZE_LIMIT");
            }
            chunks.push(value);
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          return { name, bytes };
        }),
      );
    const [historical, real, incidentFiles, parityFiles] = await Promise.all([
      fetchFiles(RECEIPT_NAMES, "evidence"),
      fetchFiles(REAL_AI_NAMES, REAL_AI_PINS.directory),
      fetchFiles(["incident.json"], INCIDENT_DIRECTORY),
      fetchFiles([TRACK_E_PINS.filename], TRACK_E_PINS.directory),
    ]);
    return {
      historical,
      real,
      incident: incidentFiles[0],
      parity: parityFiles[0],
    };
  }),
);
byId("files").addEventListener("change", (event) => {
  const selected = Array.from(event.target.files);
  // Capture before the async read; no path, URL, drag/drop HTML or executable input.
  load(async () => {
    if (selected.length > 5 || selected.some((file) => file.size > MAX_BYTES))
      throw new Error("SIZE_LIMIT");
    if (
      selected.some(
        (file) =>
          !RECEIPT_NAMES.includes(file.name) &&
          !REAL_AI_NAMES.includes(file.name) &&
          file.name !== "future-model.json" &&
          file.name !== "incident.json" &&
          file.name !== TRACK_E_PINS.filename,
      )
    )
      throw new Error("FILE_NOT_ALLOWLISTED");
    // Derived D/E summaries are lone selections, never mixed with another track.
    if (
      selected.some(
        (file) =>
          file.name === "incident.json" || file.name === TRACK_E_PINS.filename,
      ) &&
      selected.length > 1
    )
      throw new Error("MIXED_SELECTION");
    return Promise.all(
      selected.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
  });
  event.target.value = "";
});
byId("receipt").addEventListener("change", showRaw);
for (const button of document.querySelectorAll("[data-chapter]"))
  button.addEventListener("click", () => {
    chapter = Number(button.dataset.chapter);
    updateGuide();
  });
for (const [id, direction] of [
  ["guide-prev", -1],
  ["guide-next", 1],
])
  byId(id).addEventListener("click", () => {
    chapter = Math.max(0, Math.min(CHAPTERS.length - 1, chapter + direction));
    updateGuide();
  });
for (const button of document.querySelectorAll("[data-stage]"))
  button.addEventListener("click", () => {
    const stage = Number(button.dataset.stage);
    for (const item of document.querySelectorAll("[data-stage]"))
      item.setAttribute("aria-pressed", String(item === button));
    byId("stage-detail").textContent = `0${stage + 1} / ${STAGES[stage]}`;
  });
