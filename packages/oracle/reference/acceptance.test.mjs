import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { snapshotSqlite } from "../dist/index.js";
import { MANIFEST, stepId } from "../dist/reference/manifest.js";
import {
  assertRepeat,
  CONTROL_IDS,
  digest,
  publicCorpus,
  shape,
  TABLES,
} from "./acceptance.mjs";
import { syntheticControls } from "./acceptance-controls.mjs";
import { Resources } from "./acceptance-resources.mjs";

const scratch = mkdtempSync(join(tmpdir(), "mmp009a-original-test-"));
const path = join(scratch, "original.sqlite");
const db = new DatabaseSync(path);
db.exec(readFileSync(new URL("fixture.sql", import.meta.url), "utf8"));
db.close();
const original = snapshotSqlite(path);
test.after(() => rmSync(scratch, { recursive: true, force: true }));

test("18 original synthetic negative controls are effective through unchanged comparators/worker", async () => {
  const controls = await syntheticControls(original);
  assert.deepEqual(
    controls.map((v) => v.id),
    CONTROL_IDS.slice(0, 18),
  );
  assert.ok(
    controls.every(
      (v) => v.effective && v.codes.length && v.kind === "SYNTHETIC_MUTATION",
    ),
  );
});
test("raw body repeatability is stronger than JSON semantic equality", () => {
  const http = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: Buffer.from('{"success":true}'),
  };
  const a = { http, before: original, after: original };
  assertRepeat(a, structuredClone(a));
  assert.throws(
    () =>
      assertRepeat(a, {
        ...a,
        http: { ...http, body: Buffer.from('{ "success": true }') },
      }),
    { code: "REPLAY_HTTP" },
  );
  const b = structuredClone(a);
  b.before.tables[0].rows.pop();
  assert.throws(() => assertRepeat(a, b), { code: "REPLAY_DATABASE" });
});
test("structural shapes strip values and reject unexpected property names", () => {
  assert.deepEqual(
    shape({
      success: true,
      message: "DO_NOT_DISCLOSE",
      appointments: [{ client_name: "PRIVATE", id: "1" }],
    }),
    {
      appointments: { array: [{ client_name: "string", id: "string" }] },
      message: "string",
      success: "boolean",
    },
  );
  assert.throws(() => shape({ rawBody: "PRIVATE" }), {
    code: "CORPUS_FIELD_NAME",
  });
});
function input() {
  const database = () =>
    Object.entries(TABLES).map(([name, columns]) => ({
      name,
      columns,
      primaryKey: name === "sqlite_sequence" ? [] : [0],
      rows: 0,
      cellTypes: [],
    }));
  return {
    headSha: "a".repeat(40),
    imageId: `sha256:${"b".repeat(64)}`,
    packSha256: Array(3).fill("c".repeat(64)),
    sourceFiles: {
      apiPhpSha256:
        "7d66dc6ad489972a00c6b93619c13024ea3f6d577206579bc2e97f58cf74fd77",
      configPhpSha256:
        "11216d306900f8a2e304908cebab52b9375cba83c1ead99a90278ec14b2c21bd",
    },
    inventory: { containers: 0, volumes: 0 },
    controls: CONTROL_IDS.map((id, i) => ({
      id,
      kind: i >= 18 ? "ISOLATED_PROCESS" : "SYNTHETIC_MUTATION",
      effective: true,
      codes: ["ERROR"],
    })),
    passes: [1, 2].map((pass) => ({
      pass,
      scenarios: MANIFEST.map((s) => ({
        scenarioId: s.id,
        initialSha256: "d".repeat(64),
        initialDatabase: database(),
        bootstrapSha256: "e".repeat(64),
        steps: s.requests.map((request, i) => ({
          scenarioId: s.id,
          stepId: stepId(i),
          requestSha256: digest(request),
          status: 200,
          contentType: "application/json; charset=utf-8",
          responseShape: { success: "boolean", message: "string" },
          outcome: "SUCCESS",
          httpSha256: "f".repeat(64),
          beforeSha256: "0".repeat(64),
          afterSha256: "1".repeat(64),
          database: database(),
        })),
      })),
    })),
  };
}
test("public serializer emits only structural/versioned data and preserves 34 distinct step slots", () => {
  const result = publicCorpus(input());
  assert.equal(
    result.passes.flatMap((p) => p.scenarios.flatMap((s) => s.steps)).length,
    34,
  );
  assert.equal(result.phpTsGates.G3, "NOT_RUN");
  assert.equal(result.product, "NOT_ESTABLISHED");
});
for (const [name, mutate] of [
  [
    "outer raw output",
    (x) => {
      x.rawBody = "secret";
    },
  ],
  [
    "nested raw output",
    (x) => {
      x.passes[0].scenarios[0].steps[0].stderr = "secret";
    },
  ],
  [
    "response value masquerading as type",
    (x) => {
      x.passes[0].scenarios[0].steps[0].responseShape.message = "secret";
    },
  ],
  [
    "unknown response key",
    (x) => {
      x.passes[0].scenarios[0].steps[0].responseShape.hidden = "string";
    },
  ],
  [
    "missing step",
    (x) => {
      x.passes[1].scenarios[2].steps.pop();
    },
  ],
  [
    "reordered step",
    (x) => {
      x.passes[1].scenarios[2].steps.reverse();
    },
  ],
  [
    "wrong request binding",
    (x) => {
      x.passes[0].scenarios[0].steps[0].requestSha256 = "0".repeat(64);
    },
  ],
  [
    "source drift",
    (x) => {
      x.sourceFiles.apiPhpSha256 = "0".repeat(64);
    },
  ],
  [
    "cleanup failure",
    (x) => {
      x.inventory.volumes = 1;
    },
  ],
  [
    "ineffective control",
    (x) => {
      x.controls[0].effective = false;
    },
  ],
  [
    "arbitrary control error text",
    (x) => {
      x.controls[0].codes = ["PRIVATE ERROR"];
    },
  ],
])
  test(`public serializer rejects ${name}`, () => {
    const x = input();
    mutate(x);
    assert.throws(() => publicCorpus(x));
  });

test("resource cleanup preserves failures even when a retry sees zero resources", async () => {
  const container = "mmp009a-control-00000000-0000-0000-0000-000000000000";
  let live = true;
  const raw = async (args) => {
    if (args[0] === "rm") {
      live = false;
      throw new Error("synthetic cleanup failure");
    }
    return {
      stdout: Buffer.from(args[0] === "ps" && live ? `${container}\n` : ""),
    };
  };
  const ledger = new Resources(raw, scratch);
  ledger.containers.add(container);
  await assert.rejects(ledger.reap(), { code: "CLEANUP_ERROR" });
});
test("resource cleanup never deletes an unowned container", async () => {
  const calls = [];
  const ledger = new Resources(async (args) => {
    calls.push(args);
    return { stdout: Buffer.from(args[0] === "ps" ? "unrelated\n" : "") };
  }, scratch);
  await assert.rejects(ledger.reap(), { code: "CLEANUP_ERROR" });
  assert.ok(!calls.some((args) => args[0] === "rm"));
});
