// Deliberately narrow: a disconnected Linux VM with a native local Docker daemon.
// A host-only netns or Docker Desktop socket cannot attest the daemon boundary.
import assert from "node:assert/strict";
import { Resolver } from "node:dns/promises";
import {
  existsSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { createConnection } from "node:net";
import { run } from "./lib.mjs";

export function validateTopology(t) {
  assert.equal(t.platform, "linux");
  assert.equal(t.arch, "x64");
  assert.ok(t.interfaces.includes("lo"));
  assert.ok(
    t.interfaces.every(
      (n) => n === "lo" || n === "docker0" || /^br-[a-f0-9]{12}$/.test(n),
    ),
    "OFFLINE_NETWORK_ISOLATION_NOT_PROVEN",
  );
  assert.deepEqual(
    Object.keys(t.interfaceKinds).sort(),
    [...t.interfaces].sort(),
  );
  for (const n of t.interfaces)
    assert.equal(
      t.interfaceKinds[n],
      n === "lo" ? "virtual-loopback" : "virtual-bridge",
      "EXTERNAL_OR_PEER_INTERFACE",
    );
  assert.equal(t.defaultRoutes, 0, "OFFLINE_NETWORK_ISOLATION_NOT_PROVEN");
  assert.equal(
    t.daemonNamespace,
    t.hostNamespace,
    "DAEMON_OUTSIDE_OFFLINE_CONTEXT",
  );
  assert.equal(
    t.containerdNamespace,
    t.hostNamespace,
    "CONTAINERD_OUTSIDE_OFFLINE_CONTEXT",
  );
  assert.equal(t.daemonExecutable, "dockerd");
  assert.equal(t.containerdExecutable, "containerd");
}
export function topology() {
  const pid = readFileSync("/run/docker.pid", "utf8").trim();
  assert.match(pid, /^\d+$/);
  const containerd = run("/usr/bin/pgrep", ["-x", "containerd"]).split("\n");
  assert.equal(containerd.length, 1, "DEDICATED_DAEMON_REQUIRED");
  const ns = (p) => readlinkSync(`/proc/${p}/ns/net`);
  const v4 = readFileSync("/proc/net/route", "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .filter((l) => l.trim().split(/\s+/)[1] === "00000000").length;
  const v6 = readFileSync("/proc/net/ipv6_route", "utf8")
    .trim()
    .split("\n")
    .filter((l) => {
      const f = l.trim().split(/\s+/);
      return f[0] === "0".repeat(32) && f[1] === "00" && f.at(-1) !== "lo";
    }).length;
  const interfaces = readdirSync("/sys/class/net").sort();
  const interfaceKinds = Object.fromEntries(
    interfaces.map((n) => [
      n,
      realpathSync(`/sys/class/net/${n}`).startsWith(
        "/sys/devices/virtual/net/",
      )
        ? n === "lo" &&
          readFileSync(`/sys/class/net/${n}/type`, "utf8").trim() === "772"
          ? "virtual-loopback"
          : existsSync(`/sys/class/net/${n}/bridge`)
            ? "virtual-bridge"
            : "peer-or-other"
        : "physical",
    ]),
  );
  const t = {
    platform: process.platform,
    arch: process.arch,
    interfaces,
    interfaceKinds,
    defaultRoutes: v4 + v6,
    hostNamespace: ns("self"),
    daemonNamespace: ns(pid),
    containerdNamespace: ns(containerd[0]),
    daemonExecutable: readlinkSync(`/proc/${pid}/exe`).split("/").at(-1),
    containerdExecutable: readlinkSync(`/proc/${containerd[0]}/exe`)
      .split("/")
      .at(-1),
  };
  validateTopology(t);
  return t;
}
async function denied(id, action) {
  try {
    await action();
    return { id, status: "ERROR", code: "UNEXPECTED_EGRESS" };
  } catch (e) {
    return { id, status: "DENIED", code: e.code ?? e.name };
  }
}
export async function hostControls() {
  const tcp = (host) =>
    new Promise((resolve, reject) => {
      const s = createConnection({ host, port: 443 });
      s.setTimeout(1500, () =>
        s.destroy(Object.assign(Error(), { code: "TIMEOUT" })),
      );
      s.once("connect", () => {
        s.destroy();
        resolve();
      });
      s.once("error", reject);
    });
  const resolver = new Resolver({ timeout: 1000, tries: 1 });
  resolver.setServers(["1.1.1.1"]);
  const controls = await Promise.all([
    denied("host-ipv4", () => tcp("1.1.1.1")),
    denied("host-ipv6", () => tcp("2606:4700:4700::1111")),
    denied("host-dns", () => resolver.resolve4("registry.npmjs.org")),
    denied("host-registry", () =>
      fetch("https://registry.npmjs.org/pnpm", {
        signal: AbortSignal.timeout(2000),
      }),
    ),
    denied("host-github", () =>
      fetch("https://api.github.com", { signal: AbortSignal.timeout(2000) }),
    ),
  ]);
  assert.ok(
    controls.every((c) => c.status === "DENIED"),
    "NETWORK_DENY_CONTROL_FAILED",
  );
  return controls;
}
export const NODE_DENY = String.raw`const results=[];const net=await import('node:net');const dns=await import('node:dns/promises');for(const [id,host] of [['ipv4','1.1.1.1'],['ipv6','2606:4700:4700::1111']]){try{await new Promise((ok,no)=>{const s=net.createConnection({host,port:443});s.setTimeout(1000,()=>s.destroy(Error('TIMEOUT')));s.once('connect',()=>{s.destroy();ok()});s.once('error',no)});process.exit(9)}catch{results.push(id)}}const r=new dns.Resolver({timeout:1000,tries:1});r.setServers(['1.1.1.1']);try{await r.resolve4('registry.npmjs.org');process.exit(9)}catch{results.push('dns')}console.log(JSON.stringify(results));`;
export const PHP_DENY = String.raw`$r=[];foreach(['tcp://1.1.1.1:443','tcp://[2606:4700:4700::1111]:443','udp://1.1.1.1:53'] as $i=>$url){$s=@stream_socket_client($url,$e,$m,1);if($s){if($i<2)exit(9);stream_set_timeout($s,1);fwrite($s,hex2bin('123401000001000000000000087265676973747279056e706d6a73036f72670000010001'));if(strlen(fread($s,512))>0)exit(9);fclose($s);}$r[]=['ipv4','ipv6','dns'][$i];}echo json_encode($r);`;
