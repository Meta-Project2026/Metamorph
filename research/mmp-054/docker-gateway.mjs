#!/usr/bin/env node
// Explicit offline Docker gateway, placed first in PATH only for this invocation.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { json, root, sha } from "./lib.mjs";

export function plan(args, bundle, checkout = root) {
  assert.ok(Array.isArray(args) && args.every((a) => typeof a === "string"));
  assert.ok(!args[0]?.startsWith("-"), "DOCKER_CONTEXT_FORBIDDEN");
  if (args[0] === "pull") {
    assert.equal(args.length, 2);
    const image = Object.values(bundle.images).find((i) => i.ref === args[1]);
    assert.ok(image, "OFFLINE_IMAGE_MISS");
    return { kind: "cached-pull", args: ["image", "inspect", image.id] };
  }
  if (args[0] === "build") {
    const php = [
      "build",
      "--build-arg",
      `PHP_IMAGE=${bundle.source.image}`,
      "--iidfile",
      args[4],
      "-f",
      join(checkout, "packages/oracle/probes/Dockerfile"),
      join(checkout, "packages/oracle/probes"),
    ];
    const target = [
      "build",
      "--pull",
      "--tag",
      args[3],
      join(checkout, "packages/target-worker/runtime"),
    ];
    if (JSON.stringify(args) === JSON.stringify(php)) {
      assert.ok(
        resolve(args[4]).startsWith(
          `${resolve(process.env.MMP054_PRIVATE ?? "/nonexistent")}/`,
        ),
        "IID_PATH",
      );
      return {
        kind: "prepared-php-toolchain",
        image: bundle.images.phpRuntime.id,
        iidfile: args[4],
      };
    }
    assert.deepEqual(args, target, "OFFLINE_BUILD_RECIPE_MISS");
    assert.match(args[3], /^metamorph-target-worker:[a-f0-9-]{36}$/);
    return {
      kind: "prepared-ts-toolchain",
      image: bundle.images.targetRuntime.id,
      args: ["tag", bundle.images.targetRuntime.id, args[3]],
    };
  }
  const allowed = new Set([
    "version",
    "info",
    "image",
    "inspect",
    "ps",
    "container",
    "volume",
    "run",
    "exec",
    "rm",
    "pause",
    "unpause",
    "cp",
    "stop",
    "wait",
    "logs",
  ]);
  assert.ok(allowed.has(args[0]), "OFFLINE_DOCKER_COMMAND_FORBIDDEN");
  if (args[0] === "image") assert.equal(args[1], "inspect");
  if (args[0] === "container") assert.equal(args[1], "ls");
  if (args[0] === "volume")
    assert.ok(["create", "ls", "rm", "inspect"].includes(args[1]));
  if (args[0] === "run") {
    const network = args[args.indexOf("--network") + 1];
    assert.ok(
      args.includes("--network") &&
        (network === "none" || /^container:[a-f0-9]{64}$/.test(network)),
      "OFFLINE_WORKER_NETWORK",
    );
    assert.ok(
      args.includes("--read-only") &&
        args.includes("--cap-drop") &&
        args.includes("ALL"),
    );
    assert.ok(
      !args.some(
        (a) =>
          a.includes("docker.sock") ||
          a === "--privileged" ||
          a.startsWith("--pull"),
      ),
      "OFFLINE_SOCKET_OR_PULL",
    );
    assert.ok(
      Object.values(bundle.images).some(
        (i) => args.includes(i.id) || (i.ref && args.includes(i.ref)),
      ),
      "OFFLINE_IMAGE_MISS",
    );
    // docker save/load need not preserve RepoDigests. The prepared manifest binds
    // the verified registry digest to its exact local config ID; never resolve it online.
    const local = args
      .slice(1)
      .map(
        (a) => Object.values(bundle.images).find((i) => i.ref === a)?.id ?? a,
      );
    return {
      kind: "isolated-run",
      args: ["run", "--pull=never", ...local],
      network,
    };
  }
  return { kind: "local-docker", args };
}
if (
  (process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)) ||
  (process.env.MMP054_GATEWAY === "1" &&
    process.argv[1]?.endsWith("/bin/docker"))
) {
  try {
    const directory = process.env.MMP054_BUNDLE;
    assert.equal(
      sha(readFileSync(join(directory, "prepared.json"))),
      process.env.MMP054_BUNDLE_SHA,
    );
    const bundle = json(join(directory, "prepared.json"));
    const p = plan(process.argv.slice(2), bundle);
    const docker = process.env.MMP054_REAL_DOCKER;
    const invoke = (args, stdio = "inherit") =>
      spawnSync(docker, args, {
        stdio,
        timeout: 300000,
        env: {
          ...process.env,
          DOCKER_HOST: "unix:///var/run/docker.sock",
          DOCKER_CONTEXT: "",
          DOCKER_CONFIG: process.env.HOME,
        },
      });
    if (p.network?.startsWith("container:")) {
      const result = invoke(
        ["inspect", p.network.slice(10)],
        ["ignore", "pipe", "ignore"],
      );
      assert.equal(result.status, 0);
      assert.equal(
        JSON.parse(result.stdout)[0].HostConfig.NetworkMode,
        "none",
        "SHARED_NETWORK_NOT_NONE",
      );
    }
    if (p.image) {
      const r = invoke(
        ["image", "inspect", "--format", "{{.Id}}", p.image],
        ["ignore", "pipe", "ignore"],
      );
      assert.equal(r.status, 0);
      assert.equal(r.stdout.toString().trim(), p.image, "OFFLINE_IMAGE_MISS");
    }
    if (p.iidfile)
      writeFileSync(p.iidfile, `${p.image}\n`, { flag: "wx", mode: 0o600 });
    const r = p.args ? invoke(p.args) : { status: 0 };
    appendFileSync(
      process.env.MMP054_DOCKER_LOG,
      `${JSON.stringify({ kind: p.kind, status: r.status, network: p.network ?? null })}\n`,
      { mode: 0o600 },
    );
    process.exitCode = r.status ?? 1;
  } catch {
    console.error("OFFLINE_DOCKER_REJECTED");
    process.exitCode = 1;
  }
}
