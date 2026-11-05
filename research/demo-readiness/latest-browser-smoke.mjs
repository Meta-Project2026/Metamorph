// Optional local QA. Uses an already-installed browser; no downloads or providers.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { makeServer } from "./serve.mjs";
import { TRACK_G_PINS as P } from "./track-g-pins.mjs";

const [modulePath, browserPath, outputPath] = process.argv.slice(2);
if (!modulePath || !browserPath || !outputPath)
  throw new Error(
    "Usage: latest-browser-smoke.mjs <existing-playwright> <existing-browser> <output>",
  );
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
await mkdir(outputPath, { recursive: true });
const server = makeServer();
await new Promise((accept, reject) => {
  server.once("error", reject);
  server.listen(4171, "127.0.0.1", accept);
});
let browser;
const checks = [];
const errors = [];
const external = [];
const captures = [];
try {
  browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-proxy-server"],
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:4171")
      return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  async function capture(name) {
    await page.screenshot({ path: resolve(outputPath, name) });
    captures.push({
      name,
      capturedAtUtc: new Date().toISOString(),
      ...(await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        scrollY,
      }))),
    });
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("http://127.0.0.1:4171/");
    await page
      .getByRole("link", {
        name: "Open the latest recorded PHP → TypeScript proof →",
      })
      .click();
    assert.equal(await page.locator("#latest-evidence").isVisible(), false);
    assert.match(
      await page.locator("#latest-status").textContent(),
      /NOT_VERIFIED/,
    );
    assert.equal(await page.locator("#latest-cost").textContent(), "");
    await page.waitForFunction(
      () => !document.getElementById("load-latest").disabled,
    );
    await page.locator("#load-latest").focus();
    await page.keyboard.press("Enter");
    await page.locator("#latest-evidence").waitFor({ state: "visible" });
    assert.match(
      await page.locator("#latest-status").textContent(),
      /Local receipt verified/,
    );
    assert.equal(await page.locator("#latest-gates > div").count(), 3);
    assert.match(
      await page.locator("#latest-gates").textContent(),
      /HTTP behavior17\/17 PASS/,
    );
    assert.match(
      await page.locator("#latest-synthetic").textContent(),
      new RegExp(P.syntheticG0.candidateSha256),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await capture(`latest-${width}.png`);
    assert.equal(
      await page.locator("#latest-model").textContent(),
      "Meta Model API · Muse Spark 1.3",
    );
    assert.equal(await page.locator("#latest-cost").textContent(), "~$0.056");
    assert.match(
      await page.locator(".run-cost").textContent(),
      /Estimated model cost for this recorded run/,
    );
    for (const selector of [
      "#latest-model",
      ".run-cost",
      "#latest-gates",
      "#latest-boundary",
    ]) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(
        box.y >= 0 && box.y + box.height <= (width === 390 ? 844 : 900),
        `${selector} above fold at ${width}`,
      );
    }
    await page.locator("#load-latest").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#checks-panel > summary")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#latest-scenarios details").count(), 3);
    await page.locator("#latest-scenarios summary").first().click();
    assert.match(
      await page.locator("#latest-scenarios pre").first().textContent(),
      /workshop-business:step-0/,
    );
    await page.locator("#checks-panel > summary").click();
    await page.locator("#audit-panel > summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#latest-formal").isVisible(), true);
    for (const status of [
      "NOT_RUN",
      "INCONCLUSIVE",
      "NOT_ESTABLISHED",
      "NOT_INDEPENDENTLY_VERIFIED",
    ])
      assert.ok(
        (await page.locator("#latest-formal").textContent()).includes(status),
      );
    assert.match(
      await page.locator("#latest-usage").textContent(),
      /USD 0.05568625/,
    );
    assert.match(
      await page.locator("#latest-identities").textContent(),
      new RegExp(P.candidateSha256),
    );
    await page.locator("#audit-panel").scrollIntoViewIfNeeded();
    await capture(`audit-${width}.png`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.locator("#audit-panel > summary").click();
    checks.push(
      `${width}px: home link, empty state, keyboard load, real and synthetic identities, no overflow`,
    );
  }
  const endpoint = `**/${P.directory}/${P.filename}`;
  for (const mode of ["missing", "tampered", "forged-pass"]) {
    await page.route(endpoint, async (route) => {
      if (mode === "missing") return route.fulfill({ status: 404, body: "" });
      const response = await route.fetch();
      const bytes = await response.body();
      const text =
        mode === "forged-pass"
          ? bytes
              .toString()
              .replace('"product": "NOT_ESTABLISHED"', '"product": "PASS"')
          : bytes.toString().replace("mmp194", "xxx194");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Length": String(Buffer.byteLength(text)) },
        body: text,
      });
    });
    await page.locator("#load-latest").click();
    await page.waitForFunction(
      () => !document.getElementById("load-latest").disabled,
    );
    assert.equal(await page.locator("#latest-evidence").isVisible(), false);
    assert.match(
      await page.locator("#latest-status").textContent(),
      /NOT_VERIFIED/,
    );
    for (const id of [
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
    ])
      assert.equal(await page.locator(`#${id}`).textContent(), "");
    await page.unroute(endpoint);
    await page.locator("#load-latest").click();
    await page.locator("#latest-evidence").waitFor({ state: "visible" });
    checks.push(`${mode}: atomic clear and recovery`);
  }
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("http://127.0.0.1:4171/#receipt-desk");
  await page.locator("#load").click();
  await page.locator("#evidence").waitFor({ state: "visible" });
  assert.equal(await page.locator("#track-cards button").count(), 6);
  checks.push("A–F fallback loads while G unavailable");
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  checks.push("no browser errors or external requests");
  await writeFile(
    resolve(outputPath, "results.json"),
    `${JSON.stringify({ status: "PASS", checks, errors, external, captures }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      groups: checks.length,
      screenshots: captures.length,
    }),
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((accept) => server.close(accept));
}
