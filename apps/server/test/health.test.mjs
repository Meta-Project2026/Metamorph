import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { HealthResponseSchema } from "@metamorph/contracts";
import { buildServer } from "../dist/app.js";

const expected = {
  status: "ok",
  service: "metamorph-server",
  scope: "foundation",
  capabilities: {
    migration: "not_implemented",
    oracle: "not_implemented",
    metaApi: "not_integrated",
    benchmark: "undecided",
  },
};

test("health describes only foundation readiness; run routes do not exist", async (t) => {
  const server = buildServer();
  t.after(() => server.close());
  const response = await server.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /^application\/json/);
  assert.deepEqual(HealthResponseSchema.parse(response.json()), expected);
  assert.equal(
    (await server.inject({ method: "POST", url: "/api/runs", payload: {} }))
      .statusCode,
    404,
  );
});

test("built CLI serves real HTTP without Meta credentials or a PHP executable on PATH", {
  timeout: 15000,
}, async (t) => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../dist/start.js", import.meta.url))],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      // Do not inherit credentials or PATH. SystemRoot is needed by Windows.
      env: {
        PORT: "0",
        ...(process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const exited = new Promise((resolve) => child.once("close", resolve));
  const lines = createInterface({ input: child.stdout });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  t.after(async () => {
    lines.close();
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  });

  const address = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Server startup timeout: ${stderr}`));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);
      lines.off("line", onLine);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Server exited ${code}: ${stderr}`));
    };
    const onLine = (line) => {
      try {
        const event = JSON.parse(line);
        if (event.event === "listening") {
          cleanup();
          resolve(event.address);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    child.once("error", onError);
    child.once("exit", onExit);
    lines.on("line", onLine);
  });
  assert.match(address, /^http:\/\/127\.0\.0\.1:\d+$/);
  const response = await fetch(`${address}/api/health`, {
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(HealthResponseSchema.parse(await response.json()), expected);
});
