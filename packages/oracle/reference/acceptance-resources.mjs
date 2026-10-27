import {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ensure } from "../dist/reference/manifest.js";

const validContainer = (s) =>
  /^(mmp-reference-|mmp-inspector-|mmp009a-control-)[a-f0-9-]{36}$/.test(s);
const validVolume = (s) => /^mmp-reference-state-[a-f0-9-]{36}$/.test(s);
export class Resources {
  constructor(command, parent) {
    this.raw = command;
    this.file = join(parent, "acceptance-resources.json");
    this.containers = new Set();
    this.volumes = new Set();
  }
  save() {
    const temp = `${this.file}.tmp`;
    writeFileSync(
      temp,
      JSON.stringify({
        containers: [...this.containers],
        volumes: [...this.volumes],
      }),
      { mode: 0o600, flag: "wx" },
    );
    renameSync(temp, this.file);
  }
  command = async (args, signal, input, timeout) => {
    if (["run", "create"].includes(args[0]) && args.includes("--name")) {
      const name = args[args.indexOf("--name") + 1];
      ensure(validContainer(name), "RESOURCE_NAME");
      this.containers.add(name);
      this.save();
    }
    if (args[0] === "volume" && args[1] === "create") {
      const name = args.at(-1);
      ensure(validVolume(name), "RESOURCE_NAME");
      this.volumes.add(name);
      this.save();
    }
    return this.raw(args, signal, input, timeout);
  };
  async list() {
    const read = async (args) =>
      (await this.raw(args, AbortSignal.timeout(5000))).stdout
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return {
      containers: await read(["ps", "-a", "--format", "{{.Names}}"]),
      volumes: await read(["volume", "ls", "--format", "{{.Name}}"]),
    };
  }
  async reap() {
    let failed = false;
    const inventory = await this.list();
    for (const name of inventory.containers.filter((n) =>
      this.containers.has(n),
    )) {
      try {
        await this.raw(["rm", "-f", name], AbortSignal.timeout(5000));
      } catch {
        failed = true;
      }
    }
    const remaining = await this.list();
    for (const name of remaining.volumes.filter((n) => this.volumes.has(n))) {
      try {
        await this.raw(["volume", "rm", name], AbortSignal.timeout(5000));
      } catch {
        failed = true;
      }
    }
    const final = await this.list();
    // Dedicated disposable runner: also fail if an unowned resource remains; never delete it.
    ensure(
      !failed && final.containers.length === 0 && final.volumes.length === 0,
      "CLEANUP_ERROR",
    );
    return { containers: 0, volumes: 0 };
  }
  restore() {
    if (!existsSync(this.file)) return;
    const st = lstatSync(this.file);
    ensure(
      st.isFile() &&
        !st.isSymbolicLink() &&
        st.nlink === 1 &&
        (st.mode & 0o077) === 0 &&
        st.uid === process.getuid() &&
        st.size < 65536,
      "RESOURCE_LEDGER",
    );
    const data = JSON.parse(readFileSync(this.file, "utf8"));
    ensure(
      Object.keys(data).sort().join(",") === "containers,volumes" &&
        Array.isArray(data.containers) &&
        Array.isArray(data.volumes) &&
        data.containers.every(validContainer) &&
        data.volumes.every(validVolume),
      "RESOURCE_LEDGER",
    );
    this.containers = new Set(data.containers);
    this.volumes = new Set(data.volumes);
  }
}
