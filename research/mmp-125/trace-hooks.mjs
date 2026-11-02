// Preloaded only into the single trusted MMP123 verifier process, never workers.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resources } from "../../packages/differential/src/resources.mjs";
import { TargetOracleAdapter } from "../../packages/differential/src/target-adapter.mjs";
import {
  DockerReferenceTransport,
  PhpReferenceWorker,
  PrivateEvidence,
} from "../../packages/oracle/dist/index.js";
import { TargetWorker } from "../../packages/target-worker/src/controller.mjs";
import { createObserver, wrapMethod } from "./observer.mjs";

if (
  process.platform !== "linux" ||
  !process.argv[1]?.endsWith("/research/mmp-123/verifier-proof.mjs") ||
  process.argv[2] !== "repair" ||
  process.env.MMP125_HEAD !== process.env.AGENT_HEAD_SHA ||
  !/^[a-f0-9]{40}$/.test(process.env.MMP125_HEAD ?? "") ||
  !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(
    process.env.MMP125_ID ?? "",
  ) ||
  !process.env.MMP125_PRIVATE ||
  process.env.MODEL_API_KEY ||
  process.env.GH_TOKEN ||
  process.env.NODE_OPTIONS
)
  throw Error("MMP125_HOOK_ADMISSION_REJECTED");
const observer = createObserver(),
  privateRoot = process.env.MMP125_PRIVATE;
for (const [prototype, methods, prefix] of [
  [PhpReferenceWorker.prototype, ["request", "snapshot", "close"], "REFERENCE"],
  [TargetOracleAdapter.prototype, ["request", "snapshot", "close"], "TARGET"],
])
  for (const method of methods)
    wrapMethod(
      observer,
      prototype,
      method,
      `${prefix}_${method.toUpperCase()}`,
      method === "request" ? 1 : 0,
    );
wrapMethod(
  observer,
  DockerReferenceTransport.prototype,
  "http",
  "REFERENCE_HTTP_TRANSPORT",
  1,
);
wrapMethod(
  observer,
  DockerReferenceTransport.prototype,
  "inspect",
  "REFERENCE_DB_INSPECT",
  0,
);
wrapMethod(
  observer,
  TargetWorker.prototype,
  "request",
  "TARGET_WORKER_REQUEST",
  4,
);
wrapMethod(
  observer,
  TargetWorker.prototype,
  "snapshot",
  "TARGET_WORKER_SNAPSHOT",
  1,
);
const observe = TargetWorker.prototype.observe;
TargetWorker.prototype.observe = function (action, signal, timeout) {
  const stage =
    action.kind === "http"
      ? "TARGET_HTTP_OBSERVE"
      : action.kind === "snapshot"
        ? "TARGET_DB_OBSERVE"
        : null;
  return stage
    ? observer.invoke(
        stage,
        () => Reflect.apply(observe, this, [action, signal, timeout]),
        signal,
      )
    : Reflect.apply(observe, this, [action, signal, timeout]);
};
const cmd = TargetWorker.prototype.cmd;
TargetWorker.prototype.cmd = async function (...args) {
  const result = await Reflect.apply(cmd, this, args);
  if (!args[1]?.cleanup) observer.process(result);
  return result;
};
const write = PrivateEvidence.prototype.write;
PrivateEvidence.prototype.write = function (id, data) {
  const result = Reflect.apply(write, this, [id, data]);
  if (/^diagnostic-[1-9][0-9]*$/.test(id)) observer.process(data);
  return result;
};
// Private ownership sidecar for bounded host fallback. Never grants new authority
// to model/worker JSON and never includes the ledger's broad provenance prefix.
const persist = Resources.prototype.persist;
Resources.prototype.persist = function () {
  const result = Reflect.apply(persist, this, []);
  try {
    writeFileSync(
      join(privateRoot, "ownership.json"),
      JSON.stringify({
        format: "mmp125-private-ownership-v1",
        diagnosticId: process.env.MMP125_ID,
        containers: this.names.containers,
        volumes: this.names.volumes,
        prefixes: this.names.prefixes.filter((p) =>
          /^mmp007-[a-f0-9-]{36}-$/.test(p),
        ),
      }),
      { mode: 0o600 },
    );
  } catch {
    observer.invalidate();
  }
  return result;
};
process.once("exit", () => {
  try {
    writeFileSync(
      join(privateRoot, "trace.json"),
      JSON.stringify({
        diagnosticId: process.env.MMP125_ID,
        headSha: process.env.MMP125_HEAD,
        candidateSha:
          "0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1",
        trace: observer.seal(),
      }),
      { flag: "wx", mode: 0o600 },
    );
  } catch {
    /* Parent reports missing trace as inconclusive, no invented stage. */
  }
});
