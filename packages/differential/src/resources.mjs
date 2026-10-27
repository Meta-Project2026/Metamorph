import {
  command,
  requireSuccess,
} from "../../target-worker/src/controller.mjs";
import { atomicJson } from "./private-run.mjs";
import { requireCheck } from "./strict.mjs";

export class Resources {
  constructor(ledger, record) {
    this.ledger = ledger;
    this.record = record;
    this.names = {
      containers: [],
      volumes: [],
      prefixes: ["mmp007-provenance-"],
    };
    this.persist();
  }
  persist() {
    atomicJson(this.ledger, this.names);
  }
  track(args) {
    const index = args.indexOf("--name");
    const name = index >= 0 ? args[index + 1] : undefined;
    if (
      name &&
      /^(mmp-reference-|mmp-inspector-|mmp008a-clock-)[a-f0-9-]{36}$/.test(
        name,
      ) &&
      !this.names.containers.includes(name)
    )
      this.names.containers.push(name);
    if (args[0] === "volume" && args[1] === "create") {
      const volume = args.at(-1);
      if (
        /^mmp-reference-state-[a-f0-9-]{36}$/.test(volume) &&
        !this.names.volumes.includes(volume)
      )
        this.names.volumes.push(volume);
    }
    this.persist();
  }
  target(runId) {
    requireCheck(/^mmp007-[a-f0-9-]{36}$/.test(runId), "RESOURCE_ID");
    this.names.prefixes.push(`${runId}-`);
    this.persist();
  }
  async inventory() {
    return inventory(this.names);
  }
  async reap() {
    const before = await this.inventory();
    for (const name of before.containers)
      this.record(
        "reap-container",
        await command(["rm", "--force", name], { timeoutMs: 5000 }),
      );
    for (const name of before.volumes)
      this.record(
        "reap-volume",
        await command(["volume", "rm", name], { timeoutMs: 5000 }),
      );
    const after = await this.inventory();
    this.record("resource-inventory", { before, after });
    requireCheck(
      after.containers.length === 0 && after.volumes.length === 0,
      "CLEANUP_ERROR",
    );
    return { before, after };
  }
}
export async function inventory(names) {
  requireCheck(
    Array.isArray(names.prefixes) &&
      names.prefixes.every(
        (p) => p === "mmp007-provenance-" || /^mmp007-[a-f0-9-]{36}-$/.test(p),
      ) &&
      names.containers.every((n) =>
        /^(mmp-reference-|mmp-inspector-|mmp008a-clock-)[a-f0-9-]{36}$/.test(n),
      ) &&
      names.volumes.every((n) => /^mmp-reference-state-[a-f0-9-]{36}$/.test(n)),
    "RESOURCE_LEDGER",
  );
  const listed = async (args, kind) => {
    const result = requireSuccess(await command(args, { timeoutMs: 5000 }));
    return result.stdout
      .trim()
      .split(/\s+/)
      .filter(
        (name) =>
          names[kind].includes(name) ||
          names.prefixes.some((p) => name.startsWith(p)),
      );
  };
  return {
    containers: await listed(
      ["container", "ls", "--all", "--format", "{{.Names}}"],
      "containers",
    ),
    volumes: await listed(["volume", "ls", "--format", "{{.Name}}"], "volumes"),
  };
}
