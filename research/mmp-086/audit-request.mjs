// Read-only reconstruction of the real request encoder. No provider construction.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareMetaMigration } from "../../packages/agent-real/src/meta-migration.mjs";
import { paidProjection } from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import {
  MANIFEST_PIN,
  RECIPE_PIN,
} from "../../packages/agent-real/src/runtime.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert.ok(!process.env.MODEL_API_KEY);
const context = bindMigrationContext(
  readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"),
);
const request = {
  unitId: "workshop-api",
  tier: "spark",
  action: "generate",
  attempt: 1,
  repairFeedback: null,
};
const body = prepareMetaMigration(context, request);
const wire = JSON.parse(body);
const prompt = JSON.parse(wire.messages[1].content);
const result = {
  format: "mmp086-request-audit-v1",
  headSha: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  contextSha256: context.contextSha256,
  requestSha256: sha256(body),
  requestBytes: Buffer.byteLength(body),
  messageBytes: wire.messages.reduce(
    (n, m) => n + Buffer.byteLength(m.content),
    0,
  ),
  userMessageSha256: sha256(wire.messages[1].content),
  developerMessage: wire.messages[0].content,
  target: prompt.context.target,
  responseFormat: wire.response_format,
  model: wire.model,
  reasoningEffort: wire.reasoning_effort,
  maxCompletionTokens: wire.max_completion_tokens,
  sourceSha: context.sourceSha,
  sourceArchiveSha256: context.sourceArchiveSha256,
  manifestSha256: context.manifestSha256,
  manifestPin: MANIFEST_PIN,
  recipePin: RECIPE_PIN,
  sourceFiles: prompt.context.source.files.map(({ path, content, sha256 }) => ({
    path,
    sha256,
    bytes: Buffer.byteLength(content),
  })),
  orderedUnitCount: prompt.context.orderedUnits.length,
  routes: prompt.context.routes,
  projection: paidProjection(body),
  metaRequests: 0,
  paidAuthorization: "NOT_REQUESTED",
};
if (process.argv[2])
  writeFileSync(process.argv[2], `${JSON.stringify(result, null, 2)}\n`);
else console.log(JSON.stringify(result, null, 2));
