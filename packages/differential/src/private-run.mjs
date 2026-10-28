import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
export { retainOracle } from "./oracle-retention.mjs";
