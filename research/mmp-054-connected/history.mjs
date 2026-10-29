// Only authentic Git objects; no fixture substitution or relaxed verifyPins().
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ROOT = resolve(import.meta.dirname, "../..");
export const HISTORY = Object.freeze({
  pins: "7cf6e678802802d16336685771c842d0ce6cf37d",
  fix: "8779dfeec71ac9ae3906859c15a237ec2b3f6f24",
  parent: "bcf8275cb2673abbda7a340e25f8c8d5b01198bb",
  pinsDigest:
    "8ed5d1eb8d62ac51db97e1d05a755809fabb6b69f945e56fdeb7c1488857f7bc",
  runnerDigest:
    "87a9c4528402937d1be54a70a8903dc3ff025c3270b4a1eae93e404028aab94b",
});
function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function checkHistory(root = ROOT) {
  try {
    for (const sha of [HISTORY.pins, HISTORY.fix, HISTORY.parent]) {
      if (
        git(root, "rev-parse", "--verify", `${sha}^{commit}`)
          .toString()
          .trim() !== sha
      )
        throw new Error("identity");
    }
    if (
      git(root, "rev-parse", `${HISTORY.fix}^`).toString().trim() !==
      HISTORY.parent
    )
      throw new Error("parent");
    if (
      digest(
        git(
          root,
          "show",
          `${HISTORY.pins}:specs/014-public-validation-triage/pins.json`,
        ),
      ) !== HISTORY.pinsDigest
    )
      throw new Error("pins");
    if (
      digest(
        git(root, "show", `${HISTORY.fix}^:packages/oracle/src/runner.ts`),
      ) !== HISTORY.runnerDigest
    )
      throw new Error("runner");
  } catch {
    throw new Error("HISTORY_MISSING_OR_INVALID");
  }
  return { status: "VERIFIED", ...HISTORY };
}
export function bootstrap(root = ROOT, remote = "origin") {
  try {
    return checkHistory(root);
  } catch {
    /* Bounded explicit fetch, no retry/fallback. */
  }
  try {
    git(
      root,
      "-c",
      "fetch.recurseSubmodules=false",
      "fetch",
      "--no-tags",
      "--depth=2",
      remote,
      HISTORY.pins,
      HISTORY.fix,
    );
  } catch {
    throw new Error("HISTORY_FETCH_FAILED");
  }
  return checkHistory(root);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const mode = process.argv[2];
    if (!["check", "bootstrap"].includes(mode))
      throw new Error("HISTORY_ARGUMENT");
    const root = process.argv[3] ? resolve(process.argv[3]) : ROOT;
    console.log(
      JSON.stringify(
        mode === "bootstrap" ? bootstrap(root) : checkHistory(root),
      ),
    );
  } catch (error) {
    console.error(JSON.stringify({ status: "ERROR", code: error.message }));
    process.exitCode = 1;
  }
}
