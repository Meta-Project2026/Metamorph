// Trusted test preload for the fresh paid-path validator, never a candidate import.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { SOURCE } from "../../packages/oracle/dist/index.js";

assert.ok(!process.env.MODEL_API_KEY);
let sourceFetches = 0;
let blockedRequests = 0;
const deny = () => {
  blockedRequests++;
  throw Error("NETWORK_NOT_ADMITTED");
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, ...args) => {
  if (
    String(input) !==
    `https://codeload.github.com/${SOURCE.repository}/tar.gz/${SOURCE.commit}`
  )
    return deny();
  sourceFetches++;
  return originalFetch(input, ...args);
};
http.request = http.get = https.request = https.get = deny;
syncBuiltinESMExports();
process.on("exit", () =>
  writeFileSync(
    join(process.env.RUNNER_TEMP, "meta-paid-public/network.json"),
    `${JSON.stringify({ format: "mmp086-network-guard-v1", sourceFetches, blockedRequests, metaProviderConstructed: false, metaCredentialMapped: false })}\n`,
    { mode: 0o600 },
  ),
);
