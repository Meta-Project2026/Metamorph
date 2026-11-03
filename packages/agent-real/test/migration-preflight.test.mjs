import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../target-worker/src/admission.mjs";
import { prepareMetaMigration } from "../src/meta-migration.mjs";
import { PAID_POLICY } from "../src/meta-paid-authorization.mjs";
import { META_STANDARD_TARIFF } from "../src/meta-tariff.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import {
  commitPreflight,
  generationPreflight,
} from "../src/migration-preflight.mjs";

const context = () =>
  bindMigrationContext(
    readFileSync(
      new URL("../../../research/mmp-061/public-source.json", import.meta.url),
      "utf8",
    ),
  );
const options = () => ({
  context: context(),
  headSha: "a".repeat(40),
  workflowBytes: Buffer.from("trusted workflow"),
  actor: "barbalatv",
  maxEstimatedUsd: 0.25,
  now: Date.parse("2026-11-03T16:00:00Z"),
});

test("operator card binds actual source-backed body and workflow, without granting admission", () => {
  const opts = options(),
    card = generationPreflight(opts);
  const body = prepareMetaMigration(opts.context, {
    unitId: "workshop-api",
    tier: "spark",
    action: "generate",
    attempt: 1,
    repairFeedback: null,
  });
  assert.equal(card.requestBodySha256, sha256(body));
  assert.equal(card.workflowSha256, sha256(opts.workflowBytes));
  const { sha256: digest, ...content } = card;
  assert.equal(digest, sha256(JSON.stringify(content)));
  assert.deepEqual(card, generationPreflight(opts));
  assert.equal(card.maximumPosts, 1);
  assert.equal(card.maximumRepairs, 0);
  assert.equal(card.automaticRetries, 0);
  assert.equal(card.admission, "NOT_GRANTED_BY_THIS_CARD");
  assert.equal(card.accountCreditTerms, "UNKNOWN");
  assert.equal(card.availableCreditUsd, null);
  assert.equal(card.chargedCostUsd, null);
  assert.equal(card.tariff.version, PAID_POLICY.tariff);
  assert.equal(card.tariff.expires, PAID_POLICY.tariffExpires);
  assert.doesNotMatch(
    JSON.stringify(card),
    /<\?php|function |MODEL_API_KEY|Bearer/,
  );
});

test("wrong context, owner, head, budget and stale tariff stop before a card exists", () => {
  for (const override of [
    { context: {} },
    { actor: "stranger" },
    { headSha: "branch" },
    { maxEstimatedUsd: 0.1 },
    { maxEstimatedUsd: 1000 },
    { workflowBytes: "not bytes" },
    { workflowBytes: Buffer.alloc(65537) },
    { now: NaN },
    { now: Date.parse("2026-11-02T00:00:00Z") },
    { now: Date.parse(META_STANDARD_TARIFF.expires) },
  ])
    assert.throws(() => generationPreflight({ ...options(), ...override }));
});

test("changing workflow/head/source context/operator/allowance changes the immutable identity", () => {
  const opts = options(),
    original = generationPreflight(opts);
  for (const override of [
    { headSha: "b".repeat(40) },
    { workflowBytes: Buffer.from("changed workflow") },
    { actor: "l1ncolny" },
    { maxEstimatedUsd: 0.5 },
  ])
    assert.notEqual(
      generationPreflight({ ...opts, ...override }).sha256,
      original.sha256,
    );
  const originalSource = JSON.parse(
    readFileSync(
      new URL("../../../research/mmp-061/public-source.json", import.meta.url),
      "utf8",
    ),
  );
  originalSource.files[0].content += "\n";
  assert.throws(() => bindMigrationContext(JSON.stringify(originalSource)));
});

test("durable preflight refuses existing or partial records and never overwrites", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp154-preflight-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "card.json"),
    card = generationPreflight(options());
  commitPreflight(path, card);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), card);
  assert.throws(() => commitPreflight(path, { ...card, maximumPosts: 2 }));
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), card);
  const partial = join(dir, "partial.json");
  writeFileSync(partial, "{");
  assert.throws(() => commitPreflight(partial, card));
  assert.equal(readFileSync(partial, "utf8"), "{");
});
