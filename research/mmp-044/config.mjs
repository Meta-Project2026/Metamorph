import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireCheck } from "../../packages/differential/src/strict.mjs";
import {
  MANIFEST_SHA256,
  SOURCE,
} from "../../packages/oracle/dist/reference/manifest.js";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
import { validateCorpus } from "./driver.mjs";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const PINS_PATH = "specs/014-public-validation-triage/pins.json";
export const CASES_PATH =
  "specs/014-public-validation-triage/cases.public.json";
export const PINS_SHA =
  "7b69ec9b65e57f920b5960c781a360f5168c8bd093f9f8324adb853f9cc7a9d1";
export const git = (...args) =>
  execFileSync("git", args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
export function verifyPins({
  read = (p) => readFileSync(join(root, p)),
  blob = (p) => git("show", `HEAD:${p}`),
  strictCheckout = true,
} = {}) {
  requireCheck(
    sha256(blob(PINS_PATH)) === PINS_SHA &&
      sha256(read(PINS_PATH)) === PINS_SHA,
    "PIN_MISMATCH",
  );
  const pins = JSON.parse(read(PINS_PATH));
  const corpus = validateCorpus(read(CASES_PATH));
  requireCheck(
    sha256(blob(CASES_PATH)) === sha256(read(CASES_PATH)),
    "CORPUS_HASH",
  );
  requireCheck(
    SOURCE.commit === pins.php.commit &&
      SOURCE.archiveSha256 === pins.php.archiveSha256 &&
      SOURCE.licenseSha256 === pins.php.licenseSha256 &&
      MANIFEST_SHA256 === pins.manifestSha256 &&
      pins.normalizationVersion === "oracle-exact-v1",
    "PIN_MISMATCH",
  );
  const checkoutDifferences = [];
  for (const [path, expected] of Object.entries(pins.files)) {
    requireCheck(sha256(blob(path)) === expected, "PIN_MISMATCH");
    if (sha256(read(path)) !== expected) checkoutDifferences.push(path);
  }
  const recipe = Object.fromEntries(
    pins.targetRecipeFiles.map((name) => [
      name,
      sha256(read(`packages/target-worker/runtime/${name}`)),
    ]),
  );
  if (strictCheckout)
    requireCheck(
      !checkoutDifferences.length &&
        sha256(JSON.stringify(recipe)) === pins.targetRecipeSha256,
      "PIN_MISMATCH",
    );
  return { pins, corpus, checkoutDifferences };
}
