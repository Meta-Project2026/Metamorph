// Dedicated disposable daemon only. No raw names/paths/diagnostics to stdout.
import { join } from "node:path";
import { atomicJson } from "../../differential/src/private-run.mjs";
import {
  command,
  requireSuccess,
} from "../../target-worker/src/controller.mjs";

const owned = (n) =>
  /^(mmp007-|mmp-reference-|mmp-reference-state-|mmp-inspector-)[a-z0-9-]+$/.test(
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
  for (const name of before.containers)
    requireSuccess(await command(["rm", "--force", name]));
  for (const name of before.volumes)
    requireSuccess(await command(["volume", "rm", name]));
  const inventory = {
      containers: (await list(false)).length,
      volumes: (await list(true)).length,
    },
    emergencyRemoved = before.containers.length + before.volumes.length;
  const status =
    emergencyRemoved || inventory.containers || inventory.volumes
      ? "AUDIT_ERROR"
      : "CLEANUP_PASS";
  atomicJson(
    join(process.env.AUDIT_PUBLIC_OUTPUT, "finalizer.json"),
    {
      headSha: process.env.AUDIT_HEAD_SHA,
      status,
      inventory,
      emergencyRemoved,
    },
    0o644,
  );
  if (status !== "CLEANUP_PASS") process.exitCode = 1;
} catch {
  console.error("AUDIT_FINALIZER_ERROR");
  process.exitCode = 1;
}
