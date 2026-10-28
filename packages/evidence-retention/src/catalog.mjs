import { PrivateEvidence } from "@metamorph/oracle";
import {
  admission,
  bytes,
  canonical,
  check,
  digest,
  equal,
  hex,
  id,
  identity,
  integer,
  keys,
  sha,
  timestamp,
} from "./core.mjs";
import { component, Directory } from "./secure-fs.mjs";

function teardown(value, terminal) {
  keys(value, [
    "writersRevoked",
    "normalTeardown",
    "finalizedAt",
    "primaryErrors",
    "secondaryErrors",
  ]);
  check(value && value.writersRevoked === true, "WRITERS_NOT_REVOKED");
  check(
    ["VERIFIED", "ERROR", "UNKNOWN"].includes(value.normalTeardown),
    "TEARDOWN",
  );
  check(timestamp(value.finalizedAt) >= timestamp(terminal), "TEARDOWN");
  for (const k of ["primaryErrors", "secondaryErrors"]) {
    check(
      Array.isArray(value[k]) &&
        value[k].length <= 128 &&
        value[k].every(
          (s) => typeof s === "string" && /^[A-Z0-9_]{1,80}$/.test(s),
        ),
      "TEARDOWN",
    );
  }
}
function descriptor(p, scope) {
  check(
    equal(
      Object.keys(p).sort(),
      [
        "id",
        "attemptId",
        "terminalReceiptAt",
        "relativePath",
        "pairId",
        "kind",
        "indexSha256",
        "status",
        "outcome",
        "custodyScopeId",
      ].sort(),
    ),
    "PACK_FIELDS",
  );
  id(p.id);
  id(p.attemptId);
  timestamp(p.terminalReceiptAt);
  component(p.relativePath);
  id(p.pairId);
  hex(p.indexSha256);
  check(p.custodyScopeId === scope, "CUSTODY_SCOPE");
  check(["ORACLE", "AUXILIARY"].includes(p.kind), "PACK_KIND");
  check(["COMPLETE", "INCOMPLETE"].includes(p.status), "PACK_STATUS");
  check(
    ["PASS", "FAIL", "ERROR", "ABORTED"].includes(p.outcome),
    "PACK_OUTCOME",
  );
  check(
    p.status !== "COMPLETE" || !["ERROR", "ABORTED"].includes(p.outcome),
    "PACK_STATUS",
  );
}
function validateOracle(data, pack, budget) {
  const raw = data.get("oracle-catalog.json");
  if (!raw) {
    check(
      pack.status === "INCOMPLETE" && data.has("oracle-retention-error.json"),
      "ORACLE_CATALOG_MISSING",
    );
    return;
  }
  const cat = canonical(raw, budget.maxRecordBytes);
  check(
    cat.manifest &&
      cat.manifest.scope === "synthetic-or-public-scenarios-only" &&
      Array.isArray(cat.manifest.scenarioIds) &&
      cat.manifest.scenarioIds.length <= budget.maxScenariosPerPack,
    "ORACLE_MANIFEST",
  );
  integer(cat.manifest.expectedSteps, 0, budget.maxRequestsPerPack);
  integer(cat.fileBudget, 1, budget.rawFiles);
  check(
    cat.fileBudget ===
      6 + 3 * cat.manifest.scenarioIds.length + 6 * cat.manifest.expectedSteps,
    "ORACLE_MANIFEST",
  );
  check(
    cat.status === pack.status && Array.isArray(cat.catalog),
    "ORACLE_CATALOG",
  );
  check(
    cat.catalog.length <= budget.rawFiles && cat.fileBudget <= budget.rawFiles,
    "BUDGET",
  );
  const seen = new Set();
  const recordIds = new Set();
  let total = 0;
  for (const row of cat.catalog) {
    id(row.id);
    hex(row.sha256);
    check(
      typeof row.path === "string" &&
        /^[a-z0-9][a-z0-9./-]{0,180}$/.test(row.path) &&
        !row.path.includes("..") &&
        !seen.has(row.path) &&
        !recordIds.has(row.id),
      "ORACLE_INDEX",
    );
    seen.add(row.path);
    recordIds.add(row.id);
    integer(row.bytes, 1, 12 * 1024 * 1024);
    const record = data.get(`${row.id}.json`);
    check(record, "ORACLE_INDEX");
    const v = canonical(record, budget.maxRecordBytes);
    check(
      v.relativePath === row.path && typeof v.base64 === "string",
      "ORACLE_INDEX",
    );
    const decoded = Buffer.from(v.base64, "base64");
    check(
      decoded.toString("base64") === v.base64 &&
        decoded.length === row.bytes &&
        sha(decoded) === row.sha256,
      "ORACLE_BYTES",
    );
    total += row.bytes;
  }
  check(total === cat.bytes && total <= 64 * 1024 * 1024, "ORACLE_BYTES");
  check(
    [...data.keys()].filter((n) => /^oracle-file-/.test(n)).length ===
      recordIds.size,
    "ORACLE_INDEX",
  );
  if (pack.status === "COMPLETE") {
    check(
      cat.catalog.length === cat.fileBudget &&
        Array.isArray(cat.gateResults) &&
        !cat.gateResults.some((g) => g.verdict === "ERROR"),
      "ORACLE_INCOMPLETE",
    );
    const failed = cat.gateResults.some(
      (g) => ["G2", "G3"].includes(g.gate) && g.verdict === "FAIL",
    );
    check((pack.outcome === "FAIL") === failed, "OUTCOME_CHANGED");
  }
}

/** Read-only, bounded preflight. Call again in an independently controlled
 * witness process before any encrypted storage writes. Only sealed v1 packs. */
export function inspect({
  sourceRoot,
  identity: ident,
  packs,
  admission: admitted,
  teardown: finalizer,
}) {
  identity(ident);
  const budget = admission(admitted);
  teardown(finalizer, ident.terminalReceiptAt);
  check(
    Array.isArray(packs) &&
      packs.length >= 1 &&
      packs.length <= budget.maxPacks,
    "BUDGET",
  );
  check(
    new Set(packs.map((p) => p.id)).size === packs.length &&
      new Set(packs.map((p) => p.relativePath)).size === packs.length,
    "DUPLICATE_PACK",
  );
  check(
    packs.every(
      (p) =>
        timestamp(p.terminalReceiptAt) <= timestamp(ident.terminalReceiptAt),
    ),
    "ATTEMPT_TIME",
  );
  check(
    packs.some(
      (p) =>
        p.attemptId === ident.attemptId &&
        p.terminalReceiptAt === ident.terminalReceiptAt,
    ),
    "ATTEMPT_INDEX",
  );
  const root = new Directory(sourceRoot);
  let total = 0;
  try {
    check(
      equal(root.names(), packs.map((p) => p.relativePath).sort()),
      "ROOT_INDEX",
    );
    const manifests = packs.map((p) => {
      descriptor(p, ident.custodyScopeId);
      const dir = root.child(p.relativePath);
      try {
        const names = dir.names();
        check(names.length <= budget.maxFilesPerPack, "BUDGET");
        // Reuse the unchanged Oracle sealed-index verifier. Our descriptor-pinned
        // read then freezes the full index itself, not only the indexed records.
        PrivateEvidence.verify(
          `${sourceRoot}/${p.relativePath}`,
          p.indexSha256,
        );
        const data = new Map();
        let packBytes = 0;
        const files = names.map((name) => {
          check(/^[a-z0-9][a-z0-9-]{0,119}\.json$/.test(name), "PACK_PATH");
          const value = dir.read(name, budget.maxRecordBytes);
          data.set(name, value);
          packBytes += value.length;
          check(
            packBytes <= budget.maxPackBytes &&
              total + packBytes <= budget.maxTotalBytes,
            "BUDGET",
          );
          return { name, bytes: value.length, sha256: sha(value) };
        });
        const index = canonical(data.get("index.json"), budget.maxRecordBytes);
        check(
          sha(data.get("index.json")) === p.indexSha256 &&
            index.format === "oracle-private-pack-v1",
          "INDEX",
        );
        check(
          equal(
            index.entries
              .map((e) => `${e.id}.json`)
              .concat("index.json")
              .sort(),
            names,
          ),
          "INDEX",
        );
        for (const row of index.entries) {
          const value = data.get(`${row.id}.json`);
          check(
            value && row.bytes === value.length && row.sha256 === sha(value),
            "INDEX",
          );
        }
        if (p.kind === "ORACLE") validateOracle(data, p, budget);
        check(equal(names, dir.names()), "LATE_WRITER");
        dir.assert();
        total += packBytes;
        return { ...p, bytes: packBytes, files };
      } finally {
        dir.close();
      }
    });
    check(
      equal(root.names(), packs.map((p) => p.relativePath).sort()),
      "ROOT_INDEX",
    );
    const catalog = {
      format: "mmp-evidence-catalog-v1",
      identity: ident,
      admission: admitted,
      teardown: finalizer,
      attempts: [...new Set(manifests.map((p) => p.attemptId))].map(
        (attemptId) => {
          const group = manifests.filter((p) => p.attemptId === attemptId);
          check(
            new Set(group.map((p) => p.terminalReceiptAt)).size === 1,
            "ATTEMPT_TIME",
          );
          return {
            attemptId,
            terminalReceiptAt: group[0].terminalReceiptAt,
            packIds: group.map((p) => p.id),
            pairIds: [...new Set(group.map((p) => p.pairId))],
            status: group.every((p) => p.status === "COMPLETE")
              ? "COMPLETE"
              : "INCOMPLETE",
            outcomes: [...new Set(group.map((p) => p.outcome))],
          };
        },
      ),
      status:
        manifests.every((p) => p.status === "COMPLETE") &&
        finalizer.normalTeardown === "VERIFIED" &&
        !finalizer.primaryErrors.length &&
        !finalizer.secondaryErrors.length
          ? "COMPLETE"
          : "INCOMPLETE",
      totalBytes: total,
      packs: manifests,
    };
    check(bytes(catalog).length <= budget.rootCatalogMaxBytes, "BUDGET");
    return {
      catalog: canonical(bytes(catalog)),
      manifestSha256: digest(catalog),
      budget,
    };
  } finally {
    root.close();
  }
}

export function archive(sourceRoot, manifest, budget, rootCatalog) {
  const root = new Directory(sourceRoot);
  const dir = root.child(manifest.relativePath);
  try {
    check(
      equal(
        dir.names(),
        manifest.files.map((r) => r.name),
      ),
      "LATE_WRITER",
    );
    const meta = bytes({
      format: "mmp-evidence-archive-v1",
      manifest,
      rootCatalog,
    });
    check(meta.length <= budget.archiveOverhead - 4, "BUDGET");
    const size = 4 + meta.length + manifest.bytes;
    check(size <= budget.maxPackBytes + budget.archiveOverhead, "BUDGET");
    const output = Buffer.alloc(size);
    output.writeUInt32BE(meta.length, 0);
    meta.copy(output, 4);
    let offset = 4 + meta.length;
    for (const row of manifest.files) {
      const value = dir.read(row.name, budget.maxRecordBytes);
      check(
        value.length === row.bytes && sha(value) === row.sha256,
        "LATE_WRITER",
      );
      value.copy(output, offset);
      offset += value.length;
    }
    check(
      offset === output.length &&
        equal(
          dir.names(),
          manifest.files.map((r) => r.name),
        ),
      "LATE_WRITER",
    );
    return output;
  } finally {
    dir.close();
    root.close();
  }
}

export function openArchive(plain, expected, budget, rootCatalog) {
  check(
    plain.length >= 4 &&
      plain.length <= budget.maxPackBytes + budget.archiveOverhead,
    "ARCHIVE",
  );
  const size = plain.readUInt32BE(0);
  check(
    size <= budget.archiveOverhead - 4 && size + 4 <= plain.length,
    "ARCHIVE",
  );
  const metadata = canonical(
    plain.subarray(4, 4 + size),
    budget.archiveOverhead,
  );
  check(
    metadata.format === "mmp-evidence-archive-v1" &&
      metadata.manifest &&
      metadata.rootCatalog &&
      equal(metadata.manifest, expected) &&
      equal(metadata.rootCatalog, rootCatalog),
    "WITNESS_MISMATCH",
  );
  let offset = 4 + size;
  const files = new Map();
  for (const row of expected.files) {
    check(
      !files.has(row.name) && offset + row.bytes <= plain.length,
      "ARCHIVE",
    );
    const value = plain.subarray(offset, offset + row.bytes);
    check(sha(value) === row.sha256, "ARCHIVE");
    files.set(row.name, value);
    offset += row.bytes;
  }
  check(offset === plain.length, "ARCHIVE");
  return files;
}
