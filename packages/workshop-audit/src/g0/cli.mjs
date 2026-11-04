// Explicit manual Linux/Docker entrypoint. Never decrypts or downloads candidates.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { admitDirectory } from "../../../target-worker/src/admission.mjs";
import { buildImage } from "./docker.mjs";
import { Evidence, privatePath, readPrivateJson } from "./evidence.mjs";
import { finalizeLedger } from "./finalizer.mjs";
import { check, registerScope, safeCode } from "./policy.mjs";
import { runG0 } from "./run.mjs";
import { qualifySynthetic } from "./synthetic.mjs";

const root = resolve(import.meta.dirname, "../../../..");
function evaluatorHead() {
  const git = (args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  const head = git(["rev-parse", "HEAD"]);
  check(
    /^[a-f0-9]{40}$/.test(head) &&
      git(["status", "--porcelain", "--untracked-files=all"]) === "",
    "G0_IDENTITY",
  );
  return head;
}
export async function main(args) {
  check(process.platform === "linux", "G0_LINUX_REQUIRED");
  const [mode, ...values] = args;
  const head = evaluatorHead();
  if (mode === "synthetic") {
    check(values.length === 1, "G0_FIELDS");
    privatePath(resolve(values[0]), true);
    const result = await qualifySynthetic(resolve(values[0]), head);
    check(evaluatorHead() === head, "G0_IDENTITY");
    return result;
  }
  if (mode === "prepare") {
    check(values.length === 1, "G0_FIELDS");
    const sink = new Evidence(resolve(values[0]));
    try {
      const { imageId, recipeSha } = await buildImage(sink);
      return { imageId, recipeSha, evaluatorSha: head };
    } finally {
      sink.seal();
    }
  }
  if (mode === "run") {
    check(values.length === 3, "G0_FIELDS");
    const [scopePath, candidate, output] = values.map((v) => resolve(v));
    const declaration = readPrivateJson(scopePath);
    check(declaration.evaluatorSha === head, "G0_IDENTITY");
    const bundle = await admitDirectory(candidate, declaration.candidateSha);
    // Original admission rejects links/hardlinks; additionally require private
    // owner-controlled staging permissions, never POSIX-as-Windows-ACL proof.
    privatePath(candidate, true);
    for (const file of bundle.files) privatePath(resolve(candidate, file.path));
    const scope = registerScope(declaration, bundle);
    mkdirSync(`${output}-controls`, { mode: 0o700 });
    const qualified = await qualifySynthetic(`${output}-controls`, head);
    check(
      qualified.runtime.imageId === scope.imageId &&
        qualified.runtime.recipeSha === scope.recipeSha,
      "G0_IDENTITY",
    );
    const result = await runG0(scope, bundle, output);
    check(evaluatorHead() === head, "G0_IDENTITY");
    return result;
  }
  if (mode === "finalize") {
    check(values.length === 3, "G0_FIELDS");
    const [runRoot, output, runId] = values;
    const sink = new Evidence(resolve(output));
    try {
      return {
        runId,
        ...(await finalizeLedger(resolve(runRoot), sink, runId)),
      };
    } finally {
      sink.seal();
    }
  }
  check(false, "G0_FIELDS");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = await main(process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (result.verdict && result.verdict !== "PASS") process.exitCode = 1;
  } catch (e) {
    console.error(
      JSON.stringify({
        status: "G0_ERROR",
        code: safeCode(e),
        docker: "DOCKER_NOT_RUN_OR_INCOMPLETE",
        realCandidate: "NOT_RUN",
      }),
    );
    process.exitCode = 1;
  }
}
