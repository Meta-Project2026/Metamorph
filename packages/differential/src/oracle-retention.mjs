import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { RETENTION } from "@metamorph/oracle";
import { BridgeError, requireCheck, strictJson } from "./strict.mjs";

// Match verifyPair's admitted 100 scenarios x 100 requests. These are capacity
// bounds, never permission to omit registered files. Pack limits mirror the
// unchanged PrivateEvidence format; include existing occupancy and seal bytes.
const RAW_FILE = 12 * 1024 * 1024;
const RAW_TOTAL = 64 * 1024 * 1024;
const RECORD = 16 * 1024 * 1024;
const PACK = 128 * 1024 * 1024;
const MAX_FILES = 6 + 3 * 100 + 6 * 100 * 100;
const FIXED = [
  "manifest.json",
  "gate-results.json",
  "events.jsonl",
  "model-usage.json",
  "report.html",
];
const DIRS = ["db", "diffs", "http"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stable = (a, b) =>
  ["dev", "ino", "mode", "uid", "nlink", "size", "mtimeNs", "ctimeNs"].every(
    (key) => a[key] === b[key],
  );

function directory(path) {
  requireCheck(resolve(path) === realpathSync(path), "PRIVATE_LINK");
  const st = lstatSync(path, { bigint: true });
  requireCheck(
    st.isDirectory() &&
      st.uid === BigInt(process.getuid()) &&
      (st.mode & 0o077n) === 0n,
    "PRIVATE_PERMISSIONS",
  );
  return st;
}

function file(path, limit) {
  const before = lstatSync(path, { bigint: true });
  requireCheck(!before.isSymbolicLink(), "PRIVATE_LINK");
  requireCheck(
    before.isFile() &&
      before.nlink === 1n &&
      before.uid === BigInt(process.getuid()) &&
      (before.mode & 0o077n) === 0n &&
      before.size > 0n &&
      before.size <= BigInt(limit),
    "PRIVATE_FILE",
  );
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    requireCheck(
      stable(before, fstatSync(fd, { bigint: true })),
      "PRIVATE_CHANGED",
    );
    // Read at most the admitted size + one byte, even if the file grows.
    const bytes = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < bytes.length) {
      const n = readSync(fd, bytes, length, bytes.length - length, length);
      if (!n) break;
      length += n;
    }
    requireCheck(
      length === Number(before.size) &&
        stable(before, fstatSync(fd, { bigint: true })) &&
        stable(before, lstatSync(path, { bigint: true })),
      "PRIVATE_CHANGED",
    );
    return bytes.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}

function inventory(root, maximum = MAX_FILES) {
  const output = new Map();
  let total = 0;
  function walk(path, prefix) {
    const before = directory(path);
    const names = readdirSync(path).sort();
    requireCheck(names.length <= maximum + DIRS.length, "PRIVATE_COUNT");
    for (const name of names) {
      const relativePath = prefix + name;
      const full = join(path, name);
      const st = lstatSync(full);
      requireCheck(!st.isSymbolicLink(), "PRIVATE_LINK");
      if (!prefix && DIRS.includes(name) && st.isDirectory()) {
        walk(full, `${name}/`);
      } else {
        requireCheck(
          !st.isDirectory() &&
            (FIXED.includes(relativePath) ||
              relativePath === "controls.json" ||
              /^(?:db|http|diffs)\/(?:0|[1-9]\d?)-(?:initial(?:-reference)?|(?:0|[1-9]\d?)(?:-reference|-http|-db)?)\.json$/.test(
                relativePath,
              )),
          "ORACLE_INDEX",
        );
        requireCheck(output.size < maximum, "PRIVATE_COUNT");
        requireCheck(total + st.size <= RAW_TOTAL, "PRIVATE_LIMIT");
        const bytes = file(full, RAW_FILE);
        total += bytes.length;
        requireCheck(total <= RAW_TOTAL, "PRIVATE_LIMIT");
        output.set(relativePath, bytes);
      }
    }
    requireCheck(stable(before, directory(path)), "PRIVATE_CHANGED");
  }
  walk(root, "");
  return output;
}

function publication(result, files) {
  const parse = (path) => {
    requireCheck(files.has(path), "ORACLE_INDEX");
    return strictJson(files.get(path).toString("utf8"), RAW_FILE);
  };
  const gates = parse("gate-results.json");
  requireCheck(same(gates, result.gateResults), "ORACLE_PUBLICATION");
  const manifest = parse("manifest.json");
  const ids = manifest.scenarioIds;
  requireCheck(
    manifest.scope === "synthetic-or-public-scenarios-only" &&
      Array.isArray(ids) &&
      ids.length <= 100 &&
      new Set(ids).size === ids.length &&
      ids.every(
        (id) =>
          typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id),
      ) &&
      Number.isSafeInteger(manifest.expectedSteps) &&
      manifest.expectedSteps >= 0 &&
      manifest.expectedSteps <= ids.length * 100,
    "ORACLE_MANIFEST",
  );
  requireCheck(
    Array.isArray(gates) &&
      gates.length === 3 &&
      gates.every(
        (g, i) =>
          g.gate === ["G2", "G3", "G4"][i] &&
          ["PASS", "FAIL", "INCONCLUSIVE", "ERROR"].includes(g.verdict) &&
          Array.isArray(g.executedTestIds) &&
          new Set(g.executedTestIds).size === g.executedTestIds.length &&
          Array.isArray(g.evidencePaths) &&
          new Set(g.evidencePaths).size === g.evidencePaths.length,
      ),
    "ORACLE_INDEX",
  );
  const maximum = 6 + 3 * ids.length + 6 * manifest.expectedSteps;
  requireCheck(files.size <= maximum, "PRIVATE_COUNT");
  const required = new Set(FIXED);
  for (const gate of gates)
    for (const path of gate.evidencePaths) {
      requireCheck(typeof path === "string" && files.has(path), "ORACLE_INDEX");
      required.add(path);
    }
  requireCheck(required.size === files.size, "ORACLE_INDEX");
  for (const path of required) requireCheck(files.has(path), "ORACLE_INDEX");
  const [http, db, controls] = gates;
  requireCheck(
    same(
      controls.evidencePaths,
      files.has("controls.json") ? ["controls.json"] : [],
    ),
    "ORACLE_INDEX",
  );
  const expectedHttp = new Set();
  const expectedDb = new Set();
  const counts = new Map(ids.map((id) => [id, 0]));
  function locate(id) {
    requireCheck(typeof id === "string", "ORACLE_INDEX");
    const match = /^(.*):(initial|step-(0|[1-9]\d?))$/.exec(id);
    const index = match ? ids.indexOf(match[1]) : -1;
    requireCheck(index >= 0, "ORACLE_INDEX");
    return {
      index,
      id: match[1],
      step: match[2] === "initial" ? null : Number(match[3]),
    };
  }
  for (const id of http.executedTestIds) {
    const { index, id: scenario, step } = locate(id);
    requireCheck(
      step !== null && step === counts.get(scenario),
      "ORACLE_INDEX",
    );
    counts.set(scenario, step + 1);
    for (const path of [
      `http/${index}-${step}-reference.json`,
      `http/${index}-${step}.json`,
      `diffs/${index}-${step}-http.json`,
    ])
      expectedHttp.add(path);
  }
  for (const id of db.executedTestIds) {
    const { index, step } = locate(id);
    const prefix = step === null ? `${index}-initial` : `${index}-${step}`;
    if (step !== null)
      requireCheck(http.executedTestIds.includes(id), "ORACLE_INDEX");
    for (const path of [
      `db/${prefix}-reference.json`,
      `db/${prefix}.json`,
      `diffs/${prefix}${step === null ? "" : "-db"}.json`,
    ])
      expectedDb.add(path);
  }
  for (const path of expectedHttp)
    requireCheck(
      http.evidencePaths.includes(path) ||
        (http.verdict === "ERROR" &&
          path.startsWith("diffs/") &&
          !files.has(path)),
      "ORACLE_INDEX",
    );
  for (const path of expectedDb)
    requireCheck(
      db.evidencePaths.includes(path) ||
        (db.verdict === "ERROR" &&
          path.startsWith("diffs/") &&
          !files.has(path)),
      "ORACLE_INDEX",
    );
  for (const path of http.evidencePaths)
    requireCheck(db.evidencePaths.includes(path), "ORACLE_INDEX");
  const complete =
    ids.length > 0 &&
    manifest.expectedSteps > 0 &&
    http.executedTestIds.length === manifest.expectedSteps &&
    db.executedTestIds.length === manifest.expectedSteps + ids.length &&
    ids.every(
      (id) =>
        counts.get(id) > 0 && db.executedTestIds.includes(`${id}:initial`),
    ) &&
    http.executedTestIds.every((id) => db.executedTestIds.includes(id)) &&
    !gates.some((g) => g.verdict === "ERROR");
  if (http.verdict === "PASS")
    requireCheck(
      http.executedTestIds.length === manifest.expectedSteps,
      "ORACLE_INDEX",
    );
  if (db.verdict === "PASS") requireCheck(complete, "ORACLE_INDEX");
  if (complete) {
    requireCheck(
      files.size === maximum &&
        http.evidencePaths.length === expectedHttp.size &&
        db.evidencePaths.length === expectedHttp.size + expectedDb.size,
      "ORACLE_INDEX",
    );
  }
  // ERROR/initial-mismatch publications may include a reference-only observation.
  // It must still be indexed, bounded and bound to a registered scenario/step.
  for (const path of files.keys()) {
    if (!path.includes("/")) continue;
    const match =
      /^(db|http|diffs)\/(\d+)-(initial(?:-reference)?|(\d+)(?:-reference|-http|-db)?)\.json$/.exec(
        path,
      );
    requireCheck(match && Number(match[2]) < ids.length, "ORACLE_INDEX");
    if (match[4] !== undefined)
      requireCheck(
        Number(match[4]) < 100 && Number(match[4]) < manifest.expectedSteps,
        "ORACLE_INDEX",
      );
  }
  return {
    gates,
    manifest,
    maximum,
    complete,
    initialDiffs: files.has("diffs/0-initial.json")
      ? parse("diffs/0-initial.json")
      : [],
  };
}

function packInventory(path) {
  directory(path);
  const entries = [];
  let bytes = 0;
  for (const name of readdirSync(path).sort()) {
    requireCheck(
      /^[a-z0-9][a-z0-9-]{0,119}\.json$/.test(name) && name !== "index.json",
      "PRIVATE_PACK",
    );
    const data = file(join(path, name), RECORD);
    bytes += data.length;
    requireCheck(bytes <= PACK, "PRIVATE_PACK_LIMIT");
    entries.push({
      id: name.slice(0, -5),
      bytes: data.length,
      sha256: hash(data),
    });
  }
  return entries;
}

/** Preserve the existing write/path pack seam, including the audit's guarded wrapper. */
export function retainOracle(result, oracleParent, pack) {
  let copied = 0;
  let catalogAttempted = false;
  try {
    requireCheck(process.platform === "linux", "PRIVATE_PLATFORM");
    directory(oracleParent);
    const root = resolve(result.evidenceDirectory);
    requireCheck(
      root === realpathSync(root) &&
        root.startsWith(`${resolve(oracleParent)}/`),
      "ORACLE_ROOT",
    );
    const files = inventory(root);
    const checked = publication(result, files);
    const records = [...files].map(([path, data], i) => ({
      id: `oracle-file-${i + 1}`,
      value: { relativePath: path, base64: data.toString("base64") },
      entry: {
        id: `oracle-file-${i + 1}`,
        path,
        bytes: data.length,
        sha256: hash(data),
      },
    }));
    const catalog = {
      catalog: records.map((r) => r.entry),
      bytes: [...files.values()].reduce((n, b) => n + b.length, 0),
      manifest: checked.manifest,
      gateResults: checked.gates,
      status: checked.complete ? "COMPLETE" : "INCOMPLETE",
      fileBudget: checked.maximum,
    };
    records.push({ id: "oracle-catalog", value: catalog });
    const existing = packInventory(pack.path);
    const planned = records.map(({ id, value }) => {
      const bytes = jsonBytes(value);
      requireCheck(bytes.length <= RECORD, "PRIVATE_RECORD_LIMIT");
      return { id, bytes: bytes.length, sha256: hash(bytes) };
    });
    const combined = [...existing, ...planned];
    requireCheck(
      new Set(combined.map((e) => e.id)).size === combined.length,
      "PRIVATE_PACK",
    );
    const indexBytes = jsonBytes({
      format: "oracle-private-pack-v1",
      retention: RETENTION,
      entries: combined,
    }).length;
    // Index order can differ from on-disk alphabetical order, but byte length is identical.
    requireCheck(
      indexBytes <= RECORD &&
        combined.reduce((n, e) => n + e.bytes, indexBytes) <= PACK,
      "PRIVATE_PACK_LIMIT",
    );
    for (const record of records.slice(0, -1)) {
      pack.write(record.id, record.value);
      copied++;
    }
    const verifyCopies = (includeCatalog) => {
      const expected = includeCatalog
        ? combined
        : [...existing, ...planned.slice(0, -1)];
      const actual = packInventory(pack.path);
      requireCheck(
        same(
          [...expected].sort((a, b) => a.id.localeCompare(b.id)),
          actual.sort((a, b) => a.id.localeCompare(b.id)),
        ),
        "PRIVATE_COPY_CHANGED",
      );
    };
    verifyCopies(false);
    const finalFiles = inventory(root, checked.maximum);
    requireCheck(
      finalFiles.size === files.size &&
        [...files].every(([path, bytes]) =>
          finalFiles.get(path)?.equals(bytes),
        ),
      "PRIVATE_CHANGED",
    );
    // Only now publish the catalog. Caller still owns final metadata, sealing and
    // post-teardown PrivateEvidence.verify; a catalog alone is never a sealed pack.
    catalogAttempted = true;
    pack.write("oracle-catalog", catalog);
    verifyCopies(true);
    return {
      gates: checked.gates,
      manifest: checked.manifest,
      initialDiffs: checked.initialDiffs,
    };
  } catch (error) {
    const failure =
      error instanceof BridgeError
        ? error
        : new BridgeError("PRIVATE_RETENTION_ERROR");
    if (catalogAttempted) {
      try {
        directory(pack.path);
        // A write may throw after rename. Withdraw the success publication;
        // a stale in-memory seal index must then fail verification, never PASS.
        unlinkSync(join(pack.path, "oracle-catalog.json"));
      } catch {
        /* Preserve the original failure; caller must not accept a failed retain. */
      }
    }
    try {
      pack.write("oracle-retention-error", {
        status: "INCOMPLETE",
        code: failure.code,
        copiedFiles: copied,
      });
    } catch {
      /* Original failure remains authoritative even if the pack is full. */
    }
    throw failure;
  }
}
