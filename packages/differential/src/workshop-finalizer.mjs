// Dedicated disposable Actions daemon only. Never print daemon names/diagnostics.
import { join } from "node:path";
import {
  command,
  requireSuccess,
} from "../../target-worker/src/controller.mjs";
import { atomicJson } from "./private-run.mjs";

const owned = (n) =>
  /^(mmp007-|mmp-reference-|mmp-reference-state-|mmp-inspector-|mmp008a-clock-)[a-z0-9-]+$/.test(
    n,
  );
const list = async (volume) =>
  requireSuccess(
    await command(
      volume
        ? ["volume", "ls", "--format", "{{.Name}}"]
        : ["container", "ls", "--all", "--format", "{{.Names}}"],
    ),
  )
    .stdout.trim()
    .split(/\s+/)
    .filter(owned);
try {
  const before = { containers: await list(false), volumes: await list(true) };
  for (const n of before.containers)
    requireSuccess(await command(["rm", "--force", n]));
  for (const n of before.volumes)
    requireSuccess(await command(["volume", "rm", n]));
  const after = {
    containers: (await list(false)).length,
    volumes: (await list(true)).length,
  };
  const removed = before.containers.length + before.volumes.length;
  atomicJson(
    join(process.env.WORKSHOP_PUBLIC_OUTPUT, "finalizer.json"),
    {
      headSha: process.env.PILOT_HEAD_SHA,
      inventory: after,
      emergencyRemoved: removed,
      status: removed || after.containers || after.volumes ? "ERROR" : "PASS",
    },
    0o644,
  );
  if (removed || after.containers || after.volumes)
    throw Error("CLEANUP_ERROR");
  console.log(
    "Final inventory verified: containers=0 volumes=0 emergencyRemoved=0",
  );
} catch {
  console.error("WORKSHOP_FINALIZER_ERROR");
  process.exitCode = 1;
}
