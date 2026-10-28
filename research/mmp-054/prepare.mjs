// ONLINE preparation is explicit and never constitutes offline evidence.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  artifact,
  assertHead,
  dependencies,
  generated,
  git,
  outside,
  root,
  run,
  sha,
  tree,
  write,
} from "./lib.mjs";

const [directory, head] = process.argv.slice(2);
assert.equal(
  process.argv.length,
  4,
  "USAGE: prepare.mjs ABSOLUTE_BUNDLE EXACT_SHA",
);
assert.equal(process.platform, "linux", "PREPARE_REQUIRES_LINUX");
assert.equal(process.arch, "x64");
assertHead(head);
const bundle = outside(directory);
process.umask(0o077);
mkdirSync(bundle, { mode: 0o700 }); // Existing bundles cannot silently be overwritten.
const docker = run("/usr/bin/which", ["docker"]);
const pnpm = run("/usr/bin/which", ["pnpm"]);
assert.ok(
  !realpathSync(pnpm).includes("corepack"),
  "INSTALL_REAL_PINNED_PNPM_NOT_COREPACK",
);
assert.equal(run(pnpm, ["--version"]), "11.25.0");
const store = join(bundle, "store");
run(pnpm, ["install", "--frozen-lockfile", "--store-dir", store]);
// Check offline installation against this prepared workspace, not a fresh machine.
run(pnpm, ["install", "--offline", "--frozen-lockfile", "--store-dir", store]);
run(pnpm, ["build"]);
const { SOURCE } = await import(
  "../../packages/oracle/dist/reference/manifest.js"
);
const { verifyPins } = await import("../mmp-044/config.mjs");
verifyPins();
const info = JSON.parse(run(docker, ["info", "--format", "{{json .}}"]));
assert.equal(info.OSType, "linux");
assert.ok(["x86_64", "amd64"].includes(info.Architecture));
const nodeRef = readFileSync(
  join(root, "packages/target-worker/runtime/Dockerfile"),
  "utf8",
)
  .split("\n")[0]
  .slice(5)
  .trim();
for (const image of [SOURCE.image, nodeRef])
  run(docker, ["pull", "--platform", "linux/amd64", image]);
run(docker, [
  "build",
  "--pull",
  "--platform",
  "linux/amd64",
  "--build-arg",
  `PHP_IMAGE=${SOURCE.image}`,
  "--iidfile",
  join(bundle, "php.iid"),
  "-f",
  "packages/oracle/probes/Dockerfile",
  "packages/oracle/probes",
]);
run(docker, [
  "build",
  "--pull",
  "--platform",
  "linux/amd64",
  "--iidfile",
  join(bundle, "target.iid"),
  "packages/target-worker/runtime",
]);
const refs = {
  php: SOURCE.image,
  node: nodeRef,
  phpRuntime: readFileSync(join(bundle, "php.iid"), "utf8").trim(),
  targetRuntime: readFileSync(join(bundle, "target.iid"), "utf8").trim(),
};
const images = {};
for (const [name, ref] of Object.entries(refs)) {
  const i = JSON.parse(run(docker, ["image", "inspect", ref]))[0];
  images[name] = {
    id: i.Id,
    ref: ref.includes("@") ? ref : null,
    repoDigests: i.RepoDigests ?? [],
    arch: i.Architecture,
    os: i.Os,
    bytes: i.Size,
  };
}
const response = await fetch(
  `https://codeload.github.com/${SOURCE.repository}/tar.gz/${SOURCE.commit}`,
  { redirect: "error", signal: AbortSignal.timeout(45000) },
);
assert.equal(response.status, 200);
const archive = Buffer.from(await response.arrayBuffer());
assert.ok(archive.length < 10 * 1024 * 1024);
assert.equal(sha(archive), SOURCE.archiveSha256);
writeFileSync(join(bundle, "source.tgz"), archive, { flag: "wx", mode: 0o444 });
// License bytes only; tar is never asked to extract paths or execute application code.
const { execFileSync } = await import("node:child_process");
const licenseBytes = execFileSync("tar", [
  "-xOf",
  join(bundle, "source.tgz"),
  `car-workshop-${SOURCE.commit}/LICENSE`,
]);
assert.equal(sha(licenseBytes), SOURCE.licenseSha256);
writeFileSync(join(bundle, "SOURCE-LICENSE"), licenseBytes, { flag: "wx" });
run(docker, [
  "save",
  "--output",
  join(bundle, "images.tar"),
  ...new Set(Object.values(images).map((i) => i.id)),
]);
assertHead(head);
write(join(bundle, "prepared.json"), {
  format: "mmp054-prepared-v1",
  headSha: head,
  baseSha: git(
    "merge-base",
    "HEAD",
    "bcf8275cb2673abbda7a340e25f8c8d5b01198bb",
  ),
  platform: "linux/amd64",
  node: process.version,
  pnpm,
  pnpmVersion: "11.25.0",
  dockerVersion: run(docker, ["version", "--format", "{{json .}}"]),
  toolchain: Object.fromEntries(
    Object.entries({
      node: process.execPath,
      pnpm,
      docker,
      git: run("/usr/bin/which", ["git"]),
    }).map(([n, path]) => [n, { path, ...artifact(path) }]),
  ),
  source: SOURCE,
  images,
  lockSha256: sha(readFileSync(join(root, "pnpm-lock.yaml"))),
  artifacts: Object.fromEntries(
    ["source.tgz", "images.tar"].map((n) => [n, artifact(join(bundle, n))]),
  ),
  dependencies: dependencies(),
  store: tree(store),
  compiled: generated(),
  license: {
    source: SOURCE.licenseSha256,
    dependencies:
      "Notices retained in node_modules and image filesystems; see README.md",
    modelWeights: "NONE",
  },
  offlineProof: "OFFLINE_PROOF_NOT_RUN",
});
console.log("PREPARED; OFFLINE_PROOF_NOT_RUN");
