// SYNTHETIC: execute the actual launcher and actual global finalizers while
// replacing only git/Docker process I/O. No daemon or candidate runs on the host.
import assert from "node:assert/strict";
import childProcess, { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditDedicatedDaemon,
  requireDedicatedDaemon,
} from "../../../research/mmp-151/daemon-boundary.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const shell = process.platform === "win32" ? "pwsh.exe" : "pwsh";
const available = spawnSync(shell, ["-NoProfile", "-Command", "exit 0"], {
  timeout: 15000,
  windowsHide: true,
});
function daemonModel(t, mutate = () => {}) {
  const env = {
    MMP151_DAEMON_RUN: "a".repeat(32),
    MMP151_DAEMON_ID: "dedicated-id",
  };
  const volumes = ["work", "private", "output"]
    .map((kind) => `mmp151-${kind}-${env.MMP151_DAEMON_RUN}`)
    .sort();
  const calls = [];
  t.mock.method(childProcess, "spawn", (executable, args) => {
    calls.push({ executable, args });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.kill = () => {};
    child.stdin.end = () =>
      queueMicrotask(() => {
        let value;
        if (args[0] === "info")
          value = {
            ID: env.MMP151_DAEMON_ID,
            DockerRootDir: "/var/lib/docker",
            Labels: [`metamorph.mmp151.run=${env.MMP151_DAEMON_RUN}`],
          };
        else if (args[0] === "container" && args[1] === "ls") value = "";
        else if (args[0] === "volume" && args[1] === "ls")
          value = volumes.join("\n");
        else if (args[0] === "volume" && args[1] === "inspect")
          value = volumes.map((Name) => ({
            Name,
            Driver: "local",
            Options: null,
            Labels: { "metamorph.mmp151.run": env.MMP151_DAEMON_RUN },
            Mountpoint: `/var/lib/docker/volumes/${Name}/_data`,
          }));
        else assert.fail("destructive or unexpected Docker command");
        value = mutate(value, executable, args) ?? value;
        child.stdout.emit(
          "data",
          Buffer.from(
            typeof value === "string" ? value : JSON.stringify(value),
          ),
        );
        child.emit("close", 0, null);
      });
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return { env, calls };
}
test("dedicated daemon audit executes both Docker routes and checks exact owned volumes", async (t) => {
  const m = daemonModel(t);
  const r = await auditDedicatedDaemon(m.env);
  assert.equal(r.status, "VERIFIED_DEDICATED_DAEMON");
  assert.ok(m.calls.some((c) => c.executable === "docker"));
  assert.ok(m.calls.some((c) => c.executable === "/usr/bin/docker"));
});
for (const wrongRoute of ["docker", "/usr/bin/docker"]) {
  test(`daemon identity mismatch through ${wrongRoute} fails without deleting resources`, async (t) => {
    const m = daemonModel(t, (v, executable, args) =>
      args[0] === "info" && executable === wrongRoute
        ? { ...v, ID: "host-id" }
        : v,
    );
    await assert.rejects(
      requireDedicatedDaemon(m.env),
      /MMP151_DEDICATED_DAEMON_REJECTED/,
    );
    assert.ok(m.calls.every((c) => c.args[0] === "info"));
  });
}
test("foreign resource created after dedicated preflight causes non-destructive audit refusal", async (t) => {
  let foreign = false;
  const m = daemonModel(t, (v, _executable, args) =>
    foreign && args[0] === "container" ? "mmp007-foreign-after-preflight" : v,
  );
  await auditDedicatedDaemon(m.env);
  foreign = true;
  await assert.rejects(
    auditDedicatedDaemon(m.env),
    /MMP151_DEDICATED_DAEMON_REJECTED/,
  );
  assert.equal(foreign, true);
  assert.ok(m.calls.every((c) => !c.args.includes("rm")));
});
test("MMP151 launcher keeps resources created after preflight on a foreign daemon", {
  skip:
    available.error?.code === "ENOENT"
      ? "PowerShell unavailable; launcher integration NOT_RUN"
      : false,
}, () => {
  assert.equal(available.status, 0);
  const scratch = mkdtempSync(join(tmpdir(), "mmp151-daemon-test-"));
  try {
    const state = join(scratch, "state.json");
    const result = spawnSync(
      shell,
      [
        "-NoProfile",
        "-File",
        join(root, "research/mmp-151/daemon-launcher.fake.ps1"),
        "-Launcher",
        join(root, "research/mmp-151/Invoke-DockerSmoke.ps1"),
        "-State",
        state,
        "-Scratch",
        scratch,
      ],
      {
        cwd: root,
        env: { ...process.env, MMP151_TEST_NODE: process.execPath },
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(readFileSync(state, "utf8"));
    assert.equal(
      receipt.foreignSurvivedFinalizer,
      true,
      "actual finalizeCustody deleted the foreign resource created after preflight",
    );
    assert.equal(
      receipt.foreignSurvivedLedger,
      true,
      "actual Resources.reap deleted the foreign provenance resource",
    );
    assert.equal(receipt.socketDaemon, "dedicated");
    assert.ok(
      receipt.controlCalls.some(
        (call) => call.executable === "/usr/bin/docker",
      ),
    );
    assert.ok(
      receipt.controlCalls.some((call) => call.executable === "docker"),
    );
    assert.deepEqual(receipt.containers, {});
    assert.deepEqual(receipt.volumes, {});
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
