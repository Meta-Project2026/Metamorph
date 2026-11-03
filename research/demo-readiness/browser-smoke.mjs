// Optional developer smoke. Supply an already-installed Playwright module and
// browser; the viewer itself has no dependency on either. No downloads or APIs.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PINS } from "./pins.mjs";
import { REAL_AI_PINS } from "./real-ai-pins.mjs";
import { makeServer } from "./serve.mjs";
import { TRACK_E_PINS } from "./track-e-pins.mjs";

const [modulePath, browserPath, outputPath] = process.argv.slice(2);
if (!modulePath || !browserPath || !outputPath)
  throw new Error(
    "Usage: node browser-smoke.mjs <local-playwright-module> <browser-executable> <output-directory>",
  );
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const output = resolve(outputPath);
await mkdir(output, { recursive: true });
const server = makeServer();
await new Promise((accept, reject) => {
  server.once("error", reject);
  server.listen(4171, "127.0.0.1", accept);
});
let browser;
const checks = [];
const errors = [];
const externalRequests = [];
const captures = [];
function checked(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
try {
  browser = await chromium.launch({
    executablePath: resolve(browserPath),
    headless: true,
    args: ["--no-proxy-server"],
  });
  const context = await browser.newContext({
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:4171")
      return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  async function capture(name, requestedRegion) {
    const position = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollX,
      scrollY,
      deviceScaleFactor: devicePixelRatio,
    }));
    await page.screenshot({ path: resolve(output, name) });
    captures.push({ name, requestedRegion, ...position });
  }
  const load = async () => {
    await page.locator("#load").click();
    await page.locator("#evidence").waitFor({ state: "visible" });
    assert.equal(await page.locator("#track-cards button").count(), 5);
  };
  const empty = async (preview = false) => {
    await page.locator("#evidence").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#overview").isVisible(), false);
    assert.equal(await page.locator("#track-cards").textContent(), "");
    assert.equal(await page.locator("#gate-matrix").textContent(), "");
    if (!preview) {
      assert.equal(await page.locator("#future").isVisible(), false);
      assert.equal(await page.locator("#future-content").textContent(), "");
    }
    for (const id of [
      "raw",
      "attempts",
      "real-identities",
      "incident-identities",
      "model-gates",
      "real-gates",
      "incident-gates",
      "parity-gates",
      "parity-identities",
      "parity-metrics",
    ])
      assert.equal(await page.locator(`#${id}`).textContent(), "");
    assert.match(await page.locator("#status").textContent(), /NOT_VERIFIED/);
  };
  await page.goto("http://127.0.0.1:4171/");
  assert.equal(await page.locator("#evidence").isVisible(), false);
  assert.equal(await page.locator("#track-cards button").count(), 0);
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await page.locator('[data-stage="3"]').focus();
  await page.keyboard.press("Enter");
  assert.match(
    await page.locator("#stage-detail").textContent(),
    /G3 stateful parity/,
  );
  const focus = await page.locator('[data-stage="3"]').evaluate((node) => ({
    width: getComputedStyle(node).outlineWidth,
    style: getComputedStyle(node).outlineStyle,
  }));
  assert.deepEqual(focus, { width: "3px", style: "solid" });
  checked("empty state, skip link, keyboard stage selection and visible focus");
  await load();
  assert.equal(await page.locator("#receipt option").count(), 11);
  assert.equal(await page.locator("#gate-matrix tr").count(), 7);
  for (const [id, section] of [
    ["A", "historical-model"],
    ["B", "historical-replay"],
    ["C", "real-ai"],
    ["D", "incident"],
    ["E", "parity"],
  ]) {
    await page.locator(`[data-track="${id}"]`).focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator(`#${section}`).isVisible(), true);
    assert.equal(
      await page.locator(`[data-track="${id}"]`).getAttribute("aria-pressed"),
      "true",
    );
  }
  assert.match(
    await page.locator('[data-track="C"]').textContent(),
    /HTTP 0\/17 · SQLite 0\/20/,
  );
  assert.match(
    await page.locator('[data-track="D"]').textContent(),
    /HTTP 0\/17 · SQLite 1\/20/,
  );
  assert.match(
    await page.locator("#incident-gates").textContent(),
    /G1 INCONCLUSIVEG2 ERRORG3 ERROR/,
  );
  assert.match(
    await page.locator('[data-track="E"]').textContent(),
    /HTTP 17\/17 · SQLite 20\/20 executed/,
  );
  assert.match(
    await page.locator("#parity-gates").textContent(),
    /G1 PASSG2 FAILG3 FAIL/,
  );
  checked(
    "all five pinned tracks, seven gate rows, C/D/E outcomes and executed counts",
  );
  const chapterCount = await page.locator("[data-chapter]").count();
  assert.equal(chapterCount, 7);
  const trackIds = ["A", "B", "C", "D", "E"];
  for (let i = 0; i < chapterCount; i++) {
    await page.locator(`[data-chapter="${i}"]`).click();
    assert.equal(
      await page.locator(`#guide-position`).textContent(),
      `CHAPTER ${String(i + 1).padStart(2, "0")} / ${String(chapterCount).padStart(2, "0")}`,
    );
    if (i > 0 && i <= trackIds.length)
      assert.equal(
        await page
          .locator(`[data-track="${trackIds[i - 1]}"]`)
          .getAttribute("aria-pressed"),
        "true",
      );
  }
  assert.equal(await page.locator("#guide-next").isDisabled(), true);
  await page.locator("#guide-prev").click();
  assert.equal(
    await page.locator('[data-chapter="5"]').getAttribute("aria-current"),
    "step",
  );
  await page.locator("#json-inspector summary").click();
  await page.locator("#receipt").selectOption("Incident #104 / incident.json");
  assert.match(await page.locator("#raw").textContent(), /41327197036/);
  checked(
    "seven manual chapters, previous/next boundaries and JSON drill-down",
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const id of trackIds) {
      await page.locator(`[data-track="${id}"]`).click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${width} / ${id}`,
      );
    }
    await page.locator(".matrix-details summary").click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width} / open matrix`,
    );
    await page.locator(".matrix-details summary").click();
    if (width !== 768) {
      await page.locator("#parity").scrollIntoViewIfNeeded();
      await capture(`track-e-${width}.png`, "Track E selected details");
    }
    await page.locator("#receipt-desk").scrollIntoViewIfNeeded();
    await capture(
      `evidence-${width}.png`,
      "Evidence desk, A–E loaded, E selected",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(`home-${width}.png`, "Home, scroll reset to zero");
    checked(
      `responsive ${width}px, A/B/C/D/E and expanded matrix, screenshots`,
    );
  }
  const history = await Promise.all(
    Object.keys(PINS.files).map(async (name) => ({
      name,
      mimeType: "application/json",
      buffer: await readFile(new URL(`evidence/${name}`, import.meta.url)),
    })),
  );
  const real = await Promise.all(
    Object.keys(REAL_AI_PINS.files).map(async (name) => ({
      name,
      mimeType: "application/json",
      buffer: await readFile(
        new URL(`${REAL_AI_PINS.directory}/${name}`, import.meta.url),
      ),
    })),
  );
  const incident = {
    name: "incident.json",
    mimeType: "application/json",
    buffer: await readFile(
      new URL("../mmp-104/incident.json", import.meta.url),
    ),
  };
  const parity = {
    name: TRACK_E_PINS.filename,
    mimeType: "application/json",
    buffer: await readFile(
      new URL(
        `${TRACK_E_PINS.directory}/${TRACK_E_PINS.filename}`,
        import.meta.url,
      ),
    ),
  };
  for (const [files, count] of [
    [history, 2],
    [real, 1],
    [[incident], 1],
    [[parity], 1],
  ]) {
    await page.locator("#files").setInputFiles(files);
    await page.locator("#evidence").waitFor({ state: "visible" });
    assert.equal(await page.locator("#track-cards button").count(), count);
  }
  checked("picker accepts complete historical, C, lone D and lone E sets");
  await page.locator('[data-chapter="1"]').click();
  assert.match(
    await page.locator("#guide-evidence-note").textContent(),
    /Track A is not loaded/,
  );
  assert.equal(
    await page.locator("#guide-target").getAttribute("href"),
    "#receipt-desk",
  );
  assert.equal(await page.locator("#parity").isVisible(), true);
  await page.locator("#files").setInputFiles([incident]);
  await page.locator("#evidence").waitFor({ state: "visible" });
  await page.locator('[data-chapter="5"]').click();
  assert.match(
    await page.locator("#guide-evidence-note").textContent(),
    /E_NOT_LOADED/,
  );
  assert.equal(await page.locator("#parity").isVisible(), false);
  assert.equal(await page.locator('[data-track="E"]').count(), 0);
  checked("E_NOT_LOADED stays distinct from a loaded FAIL or INCONCLUSIVE");
  // Synthetic declaration tests the preview boundary, never execution evidence.
  const declaration = {
    format: "mmp071-model-preview-v1",
    kind: "REAL_MODEL_GENERATION",
    headSha: PINS.headSha,
    sourceSha: PINS.sourceSha,
    candidateSha: "a".repeat(64),
    runId: "123",
    provider: "test-only",
    modelId: "synthetic-preview-control",
    generatedRequests: 1,
    totalCostUsd: null,
    outcome: "FAIL",
    gates: {
      G0: "INCONCLUSIVE",
      G1: "FAIL",
      G2: "NOT_RUN",
      G3: "NOT_RUN",
      G4: "INCONCLUSIVE",
    },
    coverage: null,
    product: "NOT_ESTABLISHED",
  };
  await page.locator("#files").setInputFiles([
    {
      name: "future-model.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(declaration)),
    },
  ]);
  await page.locator("#future").waitFor({ state: "visible" });
  await empty(true);
  assert.match(
    await page.locator("#future-content").textContent(),
    /NOT_VERIFIED/,
  );
  checked(
    "missing chapter stays narration; future declaration clears trusted overview and stays NOT_VERIFIED",
  );
  await page
    .locator("#files")
    .setInputFiles([{ ...parity, buffer: Buffer.from("{}") }]);
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("NOT_VERIFIED"),
  );
  await empty();
  checked("failed E selection clears prior future preview and trusted DOM");
  const forged = JSON.parse(incident.buffer);
  forged.gates[2].verdict = "PASS";
  for (const [name, files] of [
    ["incomplete C", [real[0]]],
    [
      "forged D PASS",
      [{ ...incident, buffer: Buffer.from(JSON.stringify(forged)) }],
    ],
    [
      "malformed JSON",
      [{ ...history[0], buffer: Buffer.from('{"a":') }, ...history.slice(1)],
    ],
    ["mixed D/C", [incident, real[0]]],
    ["mixed D/E", [incident, parity]],
    [
      "modified E",
      [
        {
          ...parity,
          buffer: Buffer.from(
            parity.buffer
              .toString()
              .replace('"verdict": "FAIL"', '"verdict": "PASS"'),
          ),
        },
      ],
    ],
    [
      "unknown filename",
      [
        {
          name: "unsafe.json",
          mimeType: "application/json",
          buffer: Buffer.from("{}"),
        },
      ],
    ],
  ]) {
    await load();
    await page.locator("#files").setInputFiles(files);
    await page.waitForFunction(() =>
      document.getElementById("status").textContent.includes("NOT_VERIFIED"),
    );
    await empty();
    checked(`fail-closed picker: ${name}, old details and summary cleared`);
  }
  await load();
  await page.route("**/evidence/mmp-104/incident.json", (route) =>
    route.fulfill({ status: 200, body: "{}", contentType: "application/json" }),
  );
  await page.locator("#load").click();
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("NOT_VERIFIED"),
  );
  await empty();
  await page.unroute("**/evidence/mmp-104/incident.json");
  checked(
    "atomic load: replaced D rejects all five tracks and clears old evidence",
  );
  for (const status of [200, 404]) {
    await load();
    await page.route(`**/${TRACK_E_PINS.filename}`, (route) =>
      route.fulfill({ status, body: "{}", contentType: "application/json" }),
    );
    await page.locator("#load").click();
    await page.waitForFunction(() =>
      document.getElementById("status").textContent.includes("NOT_VERIFIED"),
    );
    await empty();
    await page.unroute(`**/${TRACK_E_PINS.filename}`);
  }
  checked("bad or missing E fails entire A–E bundled load, without fallback");
  // A pending older successful load must not overwrite a newer failed selection.
  let release;
  let intercepted;
  const entered = new Promise((accept) => {
    intercepted = accept;
  });
  const hold = new Promise((accept) => {
    release = accept;
  });
  await page.route("**/evidence/mmp-104/incident.json", async (route) => {
    intercepted();
    await hold;
    await route.continue();
  });
  await page.locator("#load").click();
  await entered;
  await page.locator("#files").setInputFiles([real[0]]);
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("NOT_VERIFIED"),
  );
  release();
  await page.waitForResponse((response) =>
    response.url().endsWith("/evidence/mmp-104/incident.json"),
  );
  // Wait until validation of the released response completes, then another task.
  await page.evaluate(() => new Promise((accept) => setTimeout(accept, 150)));
  await empty();
  await page.unroute("**/evidence/mmp-104/incident.json");
  checked("stale successful load cannot overwrite newer failed selection");
  await page.evaluate((name) => {
    const original = File.prototype.arrayBuffer;
    window.restoreFileReader = () => {
      File.prototype.arrayBuffer = original;
    };
    File.prototype.arrayBuffer = async function () {
      const bytes = await original.call(this);
      if (this.name !== name) return bytes;
      window.heldFileReadEntered = true;
      return new Promise((accept) => {
        window.releaseFileRead = () => accept(bytes);
      });
    };
  }, TRACK_E_PINS.filename);
  await page.locator("#files").setInputFiles([parity]);
  await page.waitForFunction(() => window.heldFileReadEntered);
  await page.locator("#files").setInputFiles([real[0]]);
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.includes("NOT_VERIFIED"),
  );
  await page.evaluate(() => {
    window.releaseFileRead();
    window.restoreFileReader();
  });
  await page.evaluate(() => new Promise((accept) => setTimeout(accept, 150)));
  await empty();
  checked(
    "stale successful E file read cannot overwrite a newer failed selection",
  );
  await load();
  await page
    .locator("#receipt")
    .selectOption(`Real AI #137 / ${TRACK_E_PINS.filename}`);
  assert.match(await page.locator("#raw").textContent(), /41505679809/);
  assert.match(
    await page.locator("#raw").textContent(),
    /"chargedCostUsd": null/,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await context.close();
  checked(
    "recovery, reduced-motion mode, no JS exceptions or external requests",
  );
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        checks,
        errors,
        externalRequests,
        browser: browser.version(),
        capturedUtc: new Date().toISOString(),
        captures,
        humanTimedRehearsal: "NOT_RUN",
        screenReaderAudit: "NOT_RUN",
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((accept) => server.close(accept));
}
