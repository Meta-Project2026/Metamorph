// SYNTHETIC process adapter only: execute the unchanged real finalizers against
// the socket selected by the actual PowerShell launcher's mount arguments.
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const [statePath, socketDaemon] = process.argv.slice(2);
const state = JSON.parse(readFileSync(statePath, "utf8"));
const foreignContainer = "mmp007-provenance-foreign-after-preflight";
const foreignVolume = "mmp007-provenance-foreign-after-preflight";
const names = {
  host: { containers: new Set([foreignContainer]), volumes: new Set([foreignVolume]) },
  dedicated: { containers: new Set(), volumes: new Set() },
};
state.controlCalls = [];
childProcess.spawn = (executable, args, options) => {
  assert.ok(executable === "docker" || executable === "/usr/bin/docker");
  if (executable === "/usr/bin/docker") assert.equal(options.env.DOCKER_HOST, undefined);
  state.controlCalls.push({ executable, args, socketDaemon });
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.kill = () => {};
  child.stdin.end = () => queueMicrotask(() => {
    const selected = names[socketDaemon];
    let output = "";
    if (args[0] === "container") output = [...selected.containers].join("\n");
    else if (args[0] === "volume" && args[1] === "ls") output = [...selected.volumes].join("\n");
    else if (args[0] === "rm") selected.containers.delete(args.at(-1));
    else if (args[0] === "volume" && args[1] === "rm") selected.volumes.delete(args.at(-1));
    else throw new Error("UNEXPECTED_SYNTHETIC_DOCKER_OPERATION");
    child.stdout.emit("data", Buffer.from(output));
    child.emit("close", 0, null);
  });
  return child;
};
syncBuiltinESMExports();
const { finalizeCustody } = await import("../../packages/agent-real/src/custody-checkpoint.mjs");
const { Resources } = await import("../../packages/differential/src/resources.mjs");
await finalizeCustody(null);
state.foreignSurvivedFinalizer = names.host.containers.has(foreignContainer) && names.host.volumes.has(foreignVolume);
names.host.containers.add(foreignContainer);
names.host.volumes.add(foreignVolume);
// Filesystem durability is covered independently; retain the real inventory and
// reap implementation while avoiding POSIX private-ledger mode bits on Windows.
Resources.prototype.persist = () => {};
const resources = new Resources("SYNTHETIC_UNUSED_LEDGER", () => {});
await resources.reap();
state.foreignSurvivedLedger = names.host.containers.has(foreignContainer) && names.host.volumes.has(foreignVolume);
state.socketDaemon = socketDaemon;
writeFileSync(statePath, JSON.stringify(state));
