// Independent process, including when package compilation failed. No Oracle import.
import {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  command,
  requireSuccess,
} from "../../packages/target-worker/src/controller.mjs";

export function atomic(path, value) {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  renameSync(`${path}.tmp`, path);
}
function check(ok) {
  if (!ok) throw Error("CLEANUP_ERROR");
}
function readOwned(path) {
  const st = lstatSync(path);
  check(
    st.isFile() &&
      !st.isSymbolicLink() &&
      st.nlink === 1 &&
      st.size < 65536 &&
      st.uid === process.getuid() &&
      (st.mode & 0o077) === 0,
  );
  return JSON.parse(readFileSync(path, "utf8"));
}
export async function cleanupInventory(
  names,
  execute = command,
  history = { normalCleanupError: false, emergencyRemoved: 0 },
  save = () => {},
) {
  check(
    Array.isArray(names.containers) &&
      names.containers.every((n) =>
        /^(mmp-reference-|mmp-inspector-|mmp008a-clock-)[a-f0-9-]{36}$/.test(n),
      ) &&
      Array.isArray(names.volumes) &&
      names.volumes.every((n) =>
        /^mmp-reference-state-[a-f0-9-]{36}$/.test(n),
      ) &&
      Array.isArray(names.prefixes) &&
      names.prefixes.every((n) => /^mmp007-[a-f0-9-]{36}-$/.test(n)) &&
      Array.isArray(names.brokerContainers ?? []) &&
      (names.brokerContainers ?? []).every((n) =>
        /^mmp007-provenance-[a-f0-9-]{36}$/.test(n),
      ),
  );
  check(
    typeof history.normalCleanupError === "boolean" &&
      Number.isSafeInteger(history.emergencyRemoved) &&
      history.emergencyRemoved >= 0,
  );
  const run = async (args) =>
    requireSuccess(await execute(args, { timeoutMs: 5000 }));
  const list = async (volume) =>
    (
      await run(
        volume
          ? ["volume", "ls", "--format", "{{.Name}}"]
          : ["container", "ls", "--all", "--format", "{{.Names}}"],
      )
    ).stdout
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .filter(
        (n) =>
          (volume
            ? names.volumes
            : [...names.containers, ...(names.brokerContainers ?? [])]
          ).includes(n) || names.prefixes.some((p) => n.startsWith(p)),
      );
  const before = { containers: await list(false), volumes: await list(true) };
  const count = before.containers.length + before.volumes.length;
  history.emergencyRemoved += count;
  history.normalCleanupError ||= count > 0;
  save(history); // Persist before removals; final zero cannot erase emergency history.
  for (const [kind, entries] of [
    ["container", before.containers],
    ["volume", before.volumes],
  ]) {
    for (const name of entries) {
      try {
        await run(
          kind === "container"
            ? ["rm", "--force", name]
            : ["volume", "rm", name],
        );
      } catch {
        history.normalCleanupError = true;
        save(history);
      }
    }
  }
  const after = { containers: await list(false), volumes: await list(true) };
  if (after.containers.length || after.volumes.length) {
    history.normalCleanupError = true;
    save(history);
  }
  return {
    status: history.normalCleanupError ? "ERROR" : "PASS",
    normalCleanup: history.normalCleanupError ? "ERROR" : "PASS",
    emergencyRemoved: history.emergencyRemoved,
    inventory: {
      containers: after.containers.length,
      volumes: after.volumes.length,
    },
    inventoryScope: "EXACT_JOB_LEDGER",
  };
}
export async function finalize(parent, record = () => {}) {
  check(isAbsolute(parent));
  let names = { containers: [], volumes: [], prefixes: [] };
  let history = { normalCleanupError: false, emergencyRemoved: 0 };
  if (existsSync(parent)) {
    const st = lstatSync(parent);
    check(
      st.isDirectory() &&
        !st.isSymbolicLink() &&
        st.uid === process.getuid() &&
        (st.mode & 0o077) === 0,
    );
    if (existsSync(join(parent, "resources.json")))
      names = readOwned(join(parent, "resources.json"));
    if (existsSync(join(parent, "cleanup-history.json")))
      history = readOwned(join(parent, "cleanup-history.json"));
  }
  const result = await cleanupInventory(names, command, history, (value) => {
    if (existsSync(parent)) atomic(join(parent, "cleanup-history.json"), value);
  });
  record("final-inventory", result);
  return result;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let result;
  try {
    result = await finalize(process.env.MMP044_PARENT);
  } catch {
    result = {
      status: "ERROR",
      errorCode: "CLEANUP_ERROR",
      emergencyRemoved: null,
      inventory: null,
    };
  }
  result.headSha = process.env.MMP044_HEAD_SHA;
  atomic(join(process.env.MMP044_OUTPUT, "finalizer.json"), result);
  const summary = join(process.env.MMP044_OUTPUT, "summary.json");
  if (!existsSync(summary))
    atomic(summary, {
      headSha: process.env.MMP044_HEAD_SHA,
      classification: "NOT_ESTABLISHED",
      harness: "ERROR",
      runtimeExecution: "DOCKER_NOT_RUN_OR_INTERRUPTED",
      errorCode: "DRIVER_NOT_COMPLETED",
      coverage: {
        completedPairs: 0,
        http: 0,
        sqlite: 0,
        counts: "NO_COMPLETION_RECEIPT",
      },
      parity: "INCONCLUSIVE",
      product: "NOT_ESTABLISHED",
      G4: "INCONCLUSIVE",
      cleanup: result,
    });
  console.log(JSON.stringify(result));
  if (result.status !== "PASS") process.exitCode = 1;
}
