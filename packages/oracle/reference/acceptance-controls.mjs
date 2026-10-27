import { compareHttp, compareSqlite } from "../dist/index.js";
import { decodeHttp } from "../dist/reference/docker.js";
import {
  ensure,
  MANIFEST,
  SOURCE,
  stepId,
} from "../dist/reference/manifest.js";
import { PhpReferenceWorker } from "../dist/reference/worker.js";
import { digest } from "./acceptance.mjs";

export async function syntheticControls(snapshot) {
  const results = [];
  const base = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: Buffer.from('{"success":true,"count":1}'),
  };
  const httpCase = (id, mutate, expected) => {
    const x = structuredClone(base);
    mutate(x);
    ensure(digest(x) !== digest(base), "CONTROL_NOT_MUTATED");
    let codes;
    try {
      codes = compareHttp(base, x).map((v) => v.code);
    } catch {
      codes = ["ERROR"];
    }
    ensure(codes.includes(expected), "CONTROL_INEFFECTIVE");
    results.push({
      id,
      kind: "SYNTHETIC_MUTATION",
      effective: true,
      codes: [...new Set(codes)],
    });
  };
  httpCase(
    "http-status",
    (x) => {
      x.status = 503;
    },
    "HTTP_STATUS",
  );
  httpCase(
    "http-field",
    (x) => {
      x.body = Buffer.from('{"success":false,"count":1}');
    },
    "HTTP_JSON_VALUE",
  );
  httpCase(
    "http-type",
    (x) => {
      x.body = Buffer.from('{"success":true,"count":"1"}');
    },
    "HTTP_JSON_TYPE",
  );
  httpCase(
    "http-encoding",
    (x) => {
      x.body = Buffer.from([0xff]);
    },
    "ERROR",
  );
  httpCase(
    "http-body",
    (x) => {
      x.body = Buffer.from('{"success":');
    },
    "ERROR",
  );
  const dbCase = (id, mutate, expected) => {
    const x = structuredClone(snapshot);
    mutate(x);
    ensure(digest(x) !== digest(snapshot), "CONTROL_NOT_MUTATED");
    let codes;
    try {
      codes = compareSqlite(snapshot, x).map((v) => v.code);
    } catch {
      codes = ["ERROR"];
    }
    ensure(codes.includes(expected), "CONTROL_INEFFECTIVE");
    results.push({
      id,
      kind: "SYNTHETIC_MUTATION",
      effective: true,
      codes: [...new Set(codes)],
    });
  };
  dbCase(
    "db-ddl",
    (x) => {
      x.schema.find((v) => v.name === "typed").sql += " /*mutant*/";
    },
    "DB_SCHEMA",
  );
  dbCase(
    "db-default",
    (x) => {
      const s = x.schema.find((v) => v.name === "typed");
      ensure(s.sql.includes("'default'"));
      s.sql = s.sql.replace("'default'", "'changed'");
    },
    "DB_SCHEMA",
  );
  dbCase(
    "db-pk",
    (x) => {
      x.tables.find((v) => v.name === "composite").primaryKey.reverse();
    },
    "DB_STATE",
  );
  dbCase(
    "db-index",
    (x) => {
      x.schema = x.schema.filter((v) => v.name !== "typed_n");
    },
    "DB_SCHEMA",
  );
  dbCase(
    "db-sequence",
    (x) => {
      x.tables.find((v) => v.name === "sqlite_sequence").rows[0][1].value =
        "999";
    },
    "DB_STATE",
  );
  dbCase(
    "db-type",
    (x) => {
      const r = x.tables.find((v) => v.name === "typed").rows[0];
      r[1] = { type: "text", value: r[1].value };
    },
    "DB_STATE",
  );
  dbCase(
    "db-value",
    (x) => {
      x.tables.find((v) => v.name === "typed").rows[0][1].value = "12";
    },
    "DB_STATE",
  );
  dbCase(
    "db-multiplicity",
    (x) => {
      x.tables.find((v) => v.name === "multiset").rows.pop();
    },
    "DB_STATE",
  );
  // Explicitly synthetic transport fault injection, never presented as PHP execution.
  const memory = { write() {} };
  const http = () => ({ observation: structuredClone(base), raw: {} });
  const fault = async (id, action, expected, overrides = {}) => {
    const transport = {
      reset: async () => {},
      http: async () => http(),
      inspect: async () => ({
        snapshot: structuredClone(snapshot),
        legacySha256: SOURCE.initialSha256,
        raw: {},
      }),
      close: async () => {},
      ...overrides,
    };
    const worker = new PhpReferenceWorker(
      transport,
      memory,
      MANIFEST.map((s) => s.id),
    );
    let code;
    try {
      await action(worker);
    } catch (e) {
      code = e.code ?? "ERROR";
    }
    ensure(code === expected, "CONTROL_INEFFECTIVE");
    try {
      await worker.close(AbortSignal.timeout(1000));
    } catch {
      /* injected cleanup fault */
    }
    results.push({
      id,
      kind: "SYNTHETIC_MUTATION",
      effective: true,
      codes: [code],
    });
  };
  const signal = () => AbortSignal.timeout(1000);
  await fault(
    "step-reorder",
    async (w) => {
      await w.reset(signal());
      await w.requestStep(
        MANIFEST[0].id,
        stepId(1),
        MANIFEST[0].requests[1],
        signal(),
      );
    },
    "STEP_ID",
  );
  await fault(
    "step-replay",
    async (w) => {
      await w.reset(signal());
      await w.requestStep(
        MANIFEST[0].id,
        stepId(0),
        MANIFEST[0].requests[0],
        signal(),
      );
      await w.requestStep(
        MANIFEST[0].id,
        stepId(0),
        MANIFEST[0].requests[0],
        signal(),
      );
    },
    "STEP_ID",
  );
  await fault("dirty-reset", (w) => w.reset(signal()), "DIRTY_RESET", {
    inspect: async () => ({
      snapshot: structuredClone(snapshot),
      legacySha256: "0".repeat(64),
      raw: {},
    }),
  });
  let corrupt = false;
  try {
    decodeHttp(
      Buffer.from(
        JSON.stringify({
          status: 200,
          headers: base.headers,
          rawHeaders: [],
          bodyBase64: "%%%",
        }),
      ),
    );
  } catch {
    corrupt = true;
  }
  ensure(corrupt, "CONTROL_INEFFECTIVE");
  // A malformed snapshot must also fail independently of HTTP wire validation.
  const malformed = structuredClone(snapshot);
  malformed.tables[0].rows.push([]);
  let invalid = false;
  try {
    compareSqlite(snapshot, malformed);
  } catch {
    invalid = true;
  }
  ensure(invalid, "CONTROL_INEFFECTIVE");
  results.push({
    id: "corrupt-snapshot",
    kind: "SYNTHETIC_MUTATION",
    effective: true,
    codes: ["ERROR"],
  });
  await fault(
    "cleanup-failure",
    async (w) => {
      await w.close(signal());
    },
    "CLEANUP_ERROR",
    {
      close: async () => {
        const e = new Error("synthetic");
        e.code = "CLEANUP_ERROR";
        throw e;
      },
    },
  );
  return results;
}
