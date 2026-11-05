import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { readTrackG } from "./track-g-adapter.mjs";
import { TRACK_G_PINS as P } from "./track-g-pins.mjs";

const source = (
  await readFile(new URL("latest.mjs", import.meta.url), "utf8")
).replace(/^import .*;\r?\n/gm, "");
const bytes = await readFile(
  new URL(`${P.directory}/${P.filename}`, import.meta.url),
);

// Run the real controller against the real byte validator, with only DOM and HTTP mocked.
function harness() {
  const nodes = new Map();
  const element = () => ({
    children: [],
    hidden: true,
    value: "",
    set textContent(value) {
      this.value = value;
      this.children = [];
    },
    get textContent() {
      return this.value + this.children.map((n) => n.textContent).join("");
    },
    append(...children) {
      this.children.push(...children);
    },
    addEventListener(_, handler) {
      this.click = handler;
    },
  });
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  let mode = "valid";
  runInNewContext(source, {
    document: { getElementById: get, createElement: element },
    readTrackG,
    P,
    Uint8Array,
    fetch: async () => {
      if (mode === "missing") return { ok: false };
      const body = Uint8Array.from(bytes);
      if (mode === "tampered") body[100] ^= 1;
      return {
        ok: true,
        headers: { get: () => String(body.length) },
        arrayBuffer: async () => body.buffer,
      };
    },
  });
  return {
    get,
    setMode: (value) => {
      mode = value;
    },
    load: () => get("load-latest").click(),
  };
}

test("recorded overview renders verified model, estimate, counts and audit statuses", async () => {
  const h = harness();
  assert.equal(h.get("latest-cost").textContent, "");
  await h.load();
  assert.equal(h.get("latest-evidence").hidden, false);
  assert.equal(
    h.get("latest-model").textContent,
    "Meta Model API · Muse Spark 1.3",
  );
  assert.equal(h.get("latest-cost").textContent, "~$0.056");
  assert.equal(
    h.get("latest-gates").textContent,
    "Build & types6/6 PASSHTTP behavior17/17 PASSDatabase state20/20 PASS",
  );
  assert.match(
    h.get("latest-boundary").textContent,
    /Full verification pending/,
  );
  assert.match(
    h.get("latest-formal").textContent,
    /Genuine candidate G0NOT_RUNAggregate G0INCONCLUSIVEG4INCONCLUSIVEHeld-outNOT_RUNProductNOT_ESTABLISHEDPrivate custodyNOT_INDEPENDENTLY_VERIFIED/,
  );
  assert.match(h.get("latest-usage").textContent, /USD 0.05568625/);
  assert.match(
    h.get("latest-usage").textContent,
    /Actual charged cost: unknown \(null\)/,
  );
  assert.equal(h.get("latest-scenarios").children.length, 3);
});

for (const mode of ["missing", "tampered"]) {
  test(`${mode} receipt clears a previously verified overview and audit, then recovers`, async () => {
    const h = harness();
    await h.load();
    h.setMode(mode);
    await h.load();
    assert.equal(h.get("latest-evidence").hidden, true);
    assert.match(h.get("latest-status").textContent, /NOT_VERIFIED/);
    for (const id of [
      "latest-gates",
      "latest-model",
      "latest-cost",
      "latest-boundary",
      "latest-response",
      "latest-formal",
      "latest-scenarios",
      "latest-json",
      "latest-usage",
      "latest-identities",
    ])
      assert.equal(h.get(id).textContent, "");
    h.setMode("valid");
    await h.load();
    assert.equal(h.get("latest-evidence").hidden, false);
    assert.equal(h.get("latest-cost").textContent, "~$0.056");
  });
}
