import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { PrivateEvidence } from "@metamorph/oracle";
import { requireCheck } from "./strict.mjs";

export function privateRun(publicRoot, provenance) {
  requireCheck(process.platform === "linux", "PRIVATE_PLATFORM");
  const parent =
    process.env.PILOT_PRIVATE_PARENT ??
    mkdtempSync(join(tmpdir(), "mmp008a-private-"));
  if (process.env.PILOT_PRIVATE_PARENT) mkdirSync(parent, { mode: 0o700 });
  else chmodSync(parent, 0o700);
  // PrivateEvidence validates owner, no links, absolute path and exclusion from repo.
  const bridge = new PrivateEvidence(parent, publicRoot, provenance);
  const php = new PrivateEvidence(parent, publicRoot, provenance);
  const oracleParent = join(parent, "oracle-raw");
  mkdirSync(oracleParent, { mode: 0o700 });
  return { parent, bridge, php, oracleParent };
}
export function atomicJson(path, value, mode = 0o600) {
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode,
  });
  renameSync(temp, path);
}
/** Seal a complete private Oracle publication into independently hashed atomic pack records. */
export function retainOracle(result, oracleParent, pack) {
  const root = realpathSync(result.evidenceDirectory);
  requireCheck(
    root.startsWith(`${realpathSync(oracleParent)}/`) &&
      root === resolve(result.evidenceDirectory),
    "ORACLE_ROOT",
  );
  const catalog = [];
  let total = 0;
  function walk(directory) {
    const st = lstatSync(directory);
    requireCheck(
      st.isDirectory() &&
        !st.isSymbolicLink() &&
        st.uid === process.getuid() &&
        (st.mode & 0o077) === 0,
      "PRIVATE_PERMISSIONS",
    );
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stat = lstatSync(path);
      requireCheck(!stat.isSymbolicLink(), "PRIVATE_LINK");
      if (stat.isDirectory()) walk(path);
      else {
        requireCheck(
          catalog.length < 100 &&
            stat.isFile() &&
            stat.nlink === 1 &&
            stat.size > 0 &&
            stat.size <= 12 * 1024 * 1024 &&
            (stat.mode & 0o077) === 0 &&
            stat.uid === process.getuid(),
          "PRIVATE_FILE",
        );
        const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let bytes;
        try {
          const opened = fstatSync(fd);
          requireCheck(
            opened.ino === stat.ino && opened.dev === stat.dev,
            "PRIVATE_FILE",
          );
          bytes = readFileSync(fd);
        } finally {
          closeSync(fd);
        }
        total += bytes.length;
        requireCheck(total <= 64 * 1024 * 1024, "PRIVATE_LIMIT");
        const id = `oracle-file-${catalog.length + 1}`;
        pack.write(id, {
          relativePath: relative(root, path),
          base64: bytes.toString("base64"),
        });
        catalog.push({ id, path: relative(root, path) });
      }
    }
  }
  walk(root);
  const gates = JSON.parse(
    readFileSync(join(root, "gate-results.json"), "utf8"),
  );
  requireCheck(
    JSON.stringify(gates) === JSON.stringify(result.gateResults),
    "ORACLE_PUBLICATION",
  );
  for (const gate of gates)
    for (const path of gate.evidencePaths)
      requireCheck(
        catalog.some((entry) => entry.path === path),
        "ORACLE_INDEX",
      );
  const manifest = JSON.parse(
    readFileSync(join(root, "manifest.json"), "utf8"),
  );
  pack.write("oracle-catalog", {
    catalog,
    bytes: total,
    manifest,
    gateResults: gates,
  });
  return {
    gates,
    manifest,
    initialDiffs: existsSync(join(root, "diffs/0-initial.json"))
      ? JSON.parse(readFileSync(join(root, "diffs/0-initial.json"), "utf8"))
      : [],
  };
}
