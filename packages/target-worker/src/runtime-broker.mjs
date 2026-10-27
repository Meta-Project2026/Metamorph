// Trusted host adapter, never an input/provider-facing image registry.
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "./admission.mjs";
import { command, requireSuccess, sandboxArgs } from "./controller.mjs";

const issued = new WeakSet();
export const isTrustedRuntime = (value) =>
  typeof value === "object" && value !== null && issued.has(value);

export async function buildTrustedRuntime(record = async () => {}) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../runtime");
  const files = (await readdir(root))
    .filter(
      (name) =>
        /\.mjs$/.test(name) ||
        ["Dockerfile", "package.json", "package-lock.json"].includes(name),
    )
    .sort();
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [
        name,
        sha256(await readFile(join(root, name))),
      ]),
    ),
  );
  const tag = `metamorph-target-worker:${randomUUID()}`;
  const build = await command(["build", "--pull", "--tag", tag, root], {
    timeoutMs: 240000,
  });
  await record("image-build.json", build);
  requireSuccess(build);
  const inspected = requireSuccess(await command(["image", "inspect", tag]));
  await record("image-inspect.json", inspected);
  const image = JSON.parse(inspected.stdout)[0];
  if (
    !/^sha256:[a-f0-9]{64}$/.test(image?.Id) ||
    image.Architecture !== "amd64" ||
    image.Config.User !== "10001:10001"
  )
    throw new Error("ENVIRONMENT_ERROR");
  const name = `mmp007-provenance-${randomUUID()}`;
  let receipt;
  try {
    receipt = requireSuccess(
      await command([
        "run",
        ...sandboxArgs(name),
        image.Id,
        "node",
        "/opt/worker/provenance.mjs",
      ]),
    );
    await record("runtime-provenance.json", receipt);
  } finally {
    const removal = await command(["rm", "--force", name]);
    await record("provenance-cleanup.json", removal);
    requireSuccess(removal, "CLEANUP_ERROR");
  }
  const measured = JSON.parse(receipt.stdout);
  if (
    measured.node !== "v24.11.0" ||
    measured.sqlite !== "3.50.4" ||
    measured.typescript !== "5.9.3" ||
    measured.faketime !== "0.9.10-2.1" ||
    measured.clockPolicy !== "libfaketime-real-monotonic-v1"
  )
    throw new Error("ENVIRONMENT_ERROR");
  for (const [name, hash] of Object.entries(hashes)) {
    if (name !== "Dockerfile" && measured.hashes[name] !== hash)
      throw new Error("ENVIRONMENT_ERROR");
  }
  const provenance = Object.freeze({
    recipeSha: sha256(JSON.stringify(hashes)),
    hashes,
    measured,
    imageId: image.Id,
    repoDigests: image.RepoDigests,
    trust: "host-owned-build-and-inspect; not cryptographic attestation",
  });
  const runtime = Object.freeze({ imageId: image.Id, provenance });
  issued.add(runtime);
  return runtime;
}
