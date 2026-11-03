// Trusted harness boundary, never a worker/model supplied attestation. Both the
// inherited-environment and scrubbed command routes must see the dedicated daemon.
import { command, requireSuccess } from "../../packages/target-worker/src/controller.mjs";
import { diagnosticCommand } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";

const failure = () => { throw new Error("MMP151_DEDICATED_DAEMON_REJECTED"); };
function identity(info, env) {
  if (!info || info.ID !== env.MMP151_DAEMON_ID || info.DockerRootDir !== "/var/lib/docker" ||
      !Array.isArray(info.Labels) || !info.Labels.includes(`metamorph.mmp151.run=${env.MMP151_DAEMON_RUN}`)) failure();
}
async function diagnostic(args) {
  const result = await diagnosticCommand(args, { timeoutMs: 10000, limit: 65536 });
  if (!result.ok) failure();
  return result.bytes.toString("utf8");
}
export async function requireDedicatedDaemon(env = process.env) {
  if (!/^[a-f0-9]{32}$/.test(env.MMP151_DAEMON_RUN ?? "") ||
      !/^[A-Za-z0-9:-]{1,256}$/.test(env.MMP151_DAEMON_ID ?? "") ||
      ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"].some((key) => env[key])) failure();
  const args = ["info", "--format", "{{json .}}"];
  identity(JSON.parse(await diagnostic(args)), env);
  identity(JSON.parse(requireSuccess(await command(args, { timeoutMs: 10000 })).stdout), env);
}
export async function auditDedicatedDaemon(env = process.env) {
  await requireDedicatedDaemon(env);
  const containers = (await diagnostic(["container", "ls", "--all", "--format", "{{.Names}}"]))
    .trim().split(/\s+/).filter(Boolean);
  const volumes = (await diagnostic(["volume", "ls", "--format", "{{.Name}}"]))
    .trim().split(/\s+/).filter(Boolean).sort();
  const allowed = ["work", "private", "output"].map((kind) => `mmp151-${kind}-${env.MMP151_DAEMON_RUN}`).sort();
  if (containers.length || JSON.stringify(volumes) !== JSON.stringify(allowed)) failure();
  const inspected = JSON.parse(await diagnostic(["volume", "inspect", ...allowed]));
  if (!Array.isArray(inspected) || inspected.length !== allowed.length || inspected.some((volume, index) =>
    volume.Name !== allowed[index] || volume.Labels?.["metamorph.mmp151.run"] !== env.MMP151_DAEMON_RUN ||
    volume.Driver !== "local" || (volume.Options && Object.keys(volume.Options).length) ||
    volume.Mountpoint !== `/var/lib/docker/volumes/${allowed[index]}/_data`)) failure();
  return { status: "VERIFIED_DEDICATED_DAEMON", containers: 0, volumes: allowed.length };
}
