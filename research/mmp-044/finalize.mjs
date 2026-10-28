// Independent process; restores this job's owner-only resource ledger only.
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resources } from "../../packages/differential/src/resources.mjs";
import { atomicJson } from "../../packages/differential/src/private-run.mjs";
import { requireCheck } from "../../packages/differential/src/strict.mjs";
import { errorCode } from "./driver.mjs";

export async function finalize(parent, record = () => {}) {
  const path = join(parent, "resources.json");
  // No ledger means provision never started. Still query Docker independently.
  const resources = Object.create(Resources.prototype);
  resources.ledger = path;
  resources.record = record;
  resources.names = { containers: [], volumes: [], prefixes: [] };
  if (existsSync(path)) {
    const st = lstatSync(path);
    requireCheck(st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && st.size < 65536 &&
      st.uid === process.getuid() && (st.mode & 0o077) === 0, "CLEANUP_ERROR");
    resources.names = JSON.parse(readFileSync(path, "utf8"));
    // The driver removes the broker's global prefix; only exact run prefixes remain.
    requireCheck(!resources.names.prefixes.includes("mmp007-provenance-"), "CLEANUP_ERROR");
  }
  const before = await resources.inventory();
  const count = before.containers.length + before.volumes.length;
  let failure = false;
  try { if (count) await resources.reap(); } catch { failure = true; }
  const after = await resources.inventory();
  return {
    status: failure || count || after.containers.length || after.volumes.length ? "ERROR" : "PASS",
    normalCleanup: count ? "ERROR" : "PASS", emergencyRemoved: count,
    inventory: { containers: after.containers.length, volumes: after.volumes.length },
    inventoryScope: "EXACT_JOB_LEDGER",
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = await finalize(process.env.MMP044_PARENT); }
  catch (error) { result = { status: "ERROR", errorCode: errorCode(error), emergencyRemoved: null, inventory: null }; }
  result.headSha = process.env.MMP044_HEAD_SHA;
  atomicJson(join(process.env.MMP044_OUTPUT, "finalizer.json"), result, 0o644);
  console.log(JSON.stringify(result));
  if (result.status !== "PASS") process.exitCode = 1;
}
