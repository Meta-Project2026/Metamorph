// Manual offline preview. Does not read credentials, grant admission or dispatch.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { commitPreflight, generationPreflight } from "../../packages/agent-real/src/migration-preflight.mjs";

export function previewGeneration(actor, allowance, destination) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  if (git("status", "--porcelain", "--untracked-files=normal")) throw Error("CLEAN_CHECKOUT_REQUIRED");
  if (!["0.10", "0.20", "0.25", "0.50", "0.75", "1.00"].includes(allowance)) throw Error("EXPLICIT_ALLOWANCE_REQUIRED");
  if (typeof destination !== "string" || !isAbsolute(destination)) throw Error("ABSOLUTE_DESTINATION_REQUIRED");
  const fromRepo = relative(root, resolve(destination));
  if (!(fromRepo === ".." || fromRepo.startsWith(`..${sep}`) || isAbsolute(fromRepo))) throw Error("DESTINATION_OUTSIDE_CHECKOUT_REQUIRED");
  const card = generationPreflight({
    context: bindMigrationContext(readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8")),
    headSha: git("rev-parse", "HEAD"),
    workflowBytes: readFileSync(join(root, ".github/workflows/meta-paid-migration.yml")),
    actor,
    maxEstimatedUsd: Number(allowance),
  });
  commitPreflight(destination, card);
  return card;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5) throw Error("ARGUMENTS_REQUIRED");
    const card = previewGeneration(...process.argv.slice(2));
    console.log(JSON.stringify(card, null, 2));
    console.log("PREVIEW_ONLY; exact main review, signed admission and authentic operator dispatch still required");
  } catch {
    console.error("PREFLIGHT_REFUSED; require clean checkout, owner actor, explicit allowance and new absolute destination outside checkout; check tariff freshness");
    process.exitCode = 1;
  }
}
