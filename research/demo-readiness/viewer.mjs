import {
  MAX_BYTES,
  RECEIPT_NAMES,
  readBundle,
  readFuture,
} from "./adapter.mjs";
import { PINS } from "./pins.mjs";

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
  ])
    byId(id).replaceChildren();
}
function render(value) {
  bundle = value;
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
  for (const name of RECEIPT_NAMES) {
    const option = element("option", name);
    option.value = name;
    byId("receipt").append(option);
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
    const files = await getFiles();
    let result;
    if (files.length === 1 && files[0].name === "future-model.json")
      result = readFuture(files[0].name, files[0].bytes);
    else result = await readBundle(files);
    if (current !== generation) return;
    if (result.verification === "NOT_VERIFIED") {
      byId("future-content").textContent = JSON.stringify(result, null, 2);
      byId("future").hidden = false;
    } else render(result);
    byId("status").textContent =
      result.verification === "NOT_VERIFIED"
        ? "NOT_VERIFIED — declaration only; no independent execution established."
        : "PINNED_PUBLIC_SNAPSHOT — 5 exact public receipts loaded. This viewer has executed no model or Oracle run.";
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
  load(async () =>
    Promise.all(
      RECEIPT_NAMES.map(async (name) => {
        const response = await fetch(`/evidence/${name}`, {
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
    ),
  ),
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
