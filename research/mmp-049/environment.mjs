// Additive trusted caller of unchanged workers; no candidate is imported on host.
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { validateTargetClock } from "../../packages/differential/src/clock.mjs";
import { Resources } from "../../packages/differential/src/resources.mjs";
import { strictJson } from "../../packages/differential/src/strict.mjs";
import {
  DockerReferenceTransport,
  provisionRuntime,
} from "../../packages/oracle/dist/reference/docker.js";
import { dockerCommand } from "../../packages/oracle/dist/reference/process.js";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import {
  FIXED_ENV,
  requireSuccess,
  TargetWorker,
} from "../../packages/target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../packages/target-worker/src/runtime-broker.mjs";

export function createRuntime(root, parent, evidence) {
  let serial = 0;
  const record = (kind, value) =>
    evidence.write(
      `record-${++serial}-${kind.replaceAll(/[^a-z0-9-]/g, "-")}`,
      value,
    );
  const resources = new Resources(join(parent, "resources.json"), record);
  resources.names.prefixes = [];
  resources.persist();
  const rawCommand = dockerCommand(evidence);
  const tracked = (args, ...rest) => {
    resources.track(args);
    return rawCommand(args, ...rest);
  };
  return {
    record,
    resources,
    async prepare(signal, recipeSha) {
      this.php = await provisionRuntime({
        command: tracked,
        directory: mkdtempSync(join(parent, "source-")),
        oracleRoot: join(root, "packages/oracle"),
        signal,
        evidence,
      });
      chmodSync(this.php.archivePath, 0o444);
      this.target = await buildTrustedRuntime((name, receipt) => {
        const i = receipt.args?.indexOf("--name") ?? -1;
        const owned =
          i >= 0
            ? receipt.args[i + 1]
            : name === "provenance-cleanup.json"
              ? receipt.args.at(-1)
              : null;
        if (owned && /^mmp007-provenance-[a-f0-9-]{36}$/.test(owned)) {
          resources.names.brokerContainers = [
            ...new Set([...(resources.names.brokerContainers ?? []), owned]),
          ];
          resources.persist();
        }
        record("runtime", { name, receipt });
      });
      signal.throwIfAborted();
      assert.equal(this.target.provenance.recipeSha, recipeSha);
    },
    pair(bundle) {
      const target = new TargetWorker(this.target, bundle, "fixed-experiment", {
        profile: WORKSHOP_PROFILE,
      });
      resources.target(target.runId);
      const php = new DockerReferenceTransport(this.php, tracked);
      return {
        target,
        php,
        resources,
        identity: (identity) => ({
          runtimeId: identity.runtimeId,
          volume: target.runtime.volume,
        }),
        cleanupVerified: () => target.evidence.cleanupVerified === true,
        async clock(signal) {
          const receipt = requireSuccess(
            await target.cmd(
              [
                "exec",
                ...FIXED_ENV,
                target.runtime.name,
                "node",
                "/opt/worker/clock.mjs",
              ],
              { signal },
            ),
          );
          const clock = strictJson(receipt.stdout);
          validateTargetClock(clock);
          record("clock", clock);
          return {
            fixedUtc: clock.before.date,
            monotonicDeltaMs: clock.monotonicDeltaMs,
            node: clock.node,
            sqlite: clock.sqlite,
          };
        },
      };
    },
  };
}
