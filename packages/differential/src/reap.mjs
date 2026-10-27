// Emergency finalizer for this dedicated disposable job; no raw diagnostics to stdout.
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { command } from "../../target-worker/src/controller.mjs";
import { inventory } from "./resources.mjs";
import { requireCheck, strictJson } from "./strict.mjs";

try {
  const fd = openSync(
    join(process.env.PILOT_PRIVATE_PARENT, "resources.json"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  let names;
  try {
    const st = fstatSync(fd);
    requireCheck(
      st.uid === process.getuid() &&
        st.nlink === 1 &&
        (st.mode & 0o077) === 0 &&
        st.size < 65536,
    );
    names = strictJson(readFileSync(fd, "utf8"), 65536);
  } finally {
    closeSync(fd);
  }
  const before = await inventory(names);
  for (const name of before.containers)
    await command(["rm", "--force", name], { timeoutMs: 5000 });
  for (const name of before.volumes)
    await command(["volume", "rm", name], { timeoutMs: 5000 });
  const after = await inventory(names);
  requireCheck(!after.containers.length && !after.volumes.length);
  console.log(
    JSON.stringify({
      finalInventory: { containers: 0, volumes: 0 },
      emergencyRemoved: before.containers.length + before.volumes.length,
    }),
  );
} catch {
  console.error("DIFFERENTIAL_FINALIZER_ERROR");
  process.exitCode = 1;
}
