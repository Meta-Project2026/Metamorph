import {
  MAX_BYTES,
  RECEIPT_NAMES,
  readBundle,
  readFuture,
} from "./adapter.mjs";
import { PINS } from "./pins.mjs";
import { REAL_AI_NAMES, readRealBundle } from "./real-ai-adapter.mjs";
import { REAL_AI_PINS } from "./real-ai-pins.mjs";

const byId = (id) => document.getElementById(id);
let bundle = null;
let generation = 0;

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
  byId("evidence").hidden = true;
  byId("future").hidden = true;
  for (const id of [
    "historical-model",
    "historical-replay",
    "historical-context",
    "real-ai",
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
  ])
    byId(id).replaceChildren();
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
function renderBundles(historical, real) {
  bundle = { receipts: {} };
  if (historical) renderHistorical(historical);
  if (real) renderReal(real);
  for (const [label, value] of [
    ["Historical #70", historical],
    ["Real AI #81", real],
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
    if (Array.isArray(input)) {
      if (input.length === 1 && input[0].name === "future-model.json")
        future = readFuture(input[0].name, input[0].bytes);
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
      // All bundled tracks are validated before displaying any results.
      [historical, real] = await Promise.all([
        readBundle(input.historical),
        readRealBundle(input.real),
      ]);
    }
    if (current !== generation) return;
    if (future) {
      byId("future-content").textContent = JSON.stringify(future, null, 2);
      byId("future").hidden = false;
    } else renderBundles(historical, real);
    byId("status").textContent = future
      ? "NOT_VERIFIED — declaration only; no independent execution established."
      : `PINNED_PUBLIC_SNAPSHOT — ${historical ? "historical A/B (5 receipts)" : ""}${historical && real ? " + " : ""}${real ? "PINNED_REAL_AI_SNAPSHOT C (4 receipts)" : ""}. Recorded evidence; this viewer executes no model or Oracle run.`;
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
    const [historical, real] = await Promise.all([
      fetchFiles(RECEIPT_NAMES, "evidence"),
      fetchFiles(REAL_AI_NAMES, REAL_AI_PINS.directory),
    ]);
    return { historical, real };
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
          file.name !== "future-model.json",
      )
    )
      throw new Error("FILE_NOT_ALLOWLISTED");
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
