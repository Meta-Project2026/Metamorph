// Original public fixture/mutations only. Source is data on the host.
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  sha256,
  validateBundle,
} from "../../../target-worker/src/admission.mjs";
import { buildImage } from "./docker.mjs";
import { Evidence } from "./evidence.mjs";
import { CONTROLS, check, DRIVERS, registerScope, VERSION } from "./policy.mjs";
import { qualifyAdapter, runG0 } from "./run.mjs";

export function publicScope(bundle, runtime, head, driver = "items-v1") {
  return registerScope(
    {
      version: VERSION,
      benchmarkId: "g0-public-synthetic",
      benchmarkVersion: "v1",
      sourceSha: bundle.candidateSha,
      manifestSha: sha256(
        JSON.stringify({ version: VERSION, driver, routes: DRIVERS[driver] }),
      ),
      candidateSha: bundle.candidateSha,
      candidateGitSha: head,
      evaluatorSha: head,
      imageId: runtime.imageId,
      recipeSha: runtime.recipeSha,
      driver,
      units: [
        {
          id: "application",
          files: bundle.files.map((f) => f.path),
          routes: [...DRIVERS[driver]],
        },
      ],
      routes: [...DRIVERS[driver]],
      unsupported: [
        "general-php",
        "unregistered-routes",
        "concurrency",
        "held-out",
      ],
      testIds: DRIVERS[driver].map((id) => `route-${id}`),
      controlIds: [...CONTROLS],
    },
    bundle,
  );
}
const pack = (content) =>
  validateBundle([{ path: "src/main.ts", content, sha256: sha256(content) }]);
export async function syntheticCases() {
  const source = await readFile(
    resolve(
      import.meta.dirname,
      "../../../target-worker/fixtures/public/src/main.ts",
    ),
    "utf8",
  );
  const replace = (before, after) => {
    check(source.includes(before), "G0_IDENTITY");
    return source.replace(before, after);
  };
  const insertion =
    'db.prepare("INSERT INTO items(value) VALUES (?)").run(input.value);';
  const guard = 'if (req.method === "POST") {';
  const conditional = `${guard} if (req.headers["x-request-id"]) {`;
  const access = (path, marker) =>
    `import { readFileSync } from "node:fs";\n${replace(guard, `${conditional}\ntry { readFileSync("${path}"); res.end('{"g0Defect":"AVAILABLE"}'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ERR_ACCESS_DENIED") throw e; res.end('{"g0Defect":"${marker}"}'); } return; }`)}`;
  const workshopMain = await readFile(
    resolve(
      import.meta.dirname,
      "../../../target-worker/fixtures/workshop/src/main.ts",
    ),
    "utf8",
  );
  const workshopSchema = await readFile(
    resolve(
      import.meta.dirname,
      "../../../target-worker/fixtures/workshop/src/schema.ts",
    ),
    "utf8",
  );
  const workshopPack = (main) =>
    validateBundle([
      { path: "src/main.ts", content: main, sha256: sha256(main) },
      {
        path: "src/schema.ts",
        content: workshopSchema,
        sha256: sha256(workshopSchema),
      },
    ]);
  return [
    { id: "positive", bundle: pack(source), verdict: "PASS", code: null },
    {
      id: "static",
      bundle: pack(replace(insertion, "void input.value;")),
      verdict: "FAIL",
      code: "G0_CHALLENGE",
    },
    {
      id: "golden-replay",
      bundle: pack(
        replace(insertion, insertion.replace("input.value", '"unit-public"')),
      ),
      verdict: "FAIL",
      code: "G0_CHALLENGE",
    },
    {
      id: "missing-route",
      bundle: pack(
        replace(
          guard,
          `${conditional} res.writeHead(404); res.end("{}"); return; }`,
        ),
      ),
      verdict: "FAIL",
      code: "G0_CHALLENGE",
    },
    {
      id: "reference",
      bundle: pack(access("/reference/source.php", "REFERENCE_DENIED")),
      verdict: "FAIL",
      code: "G0_DEFECT_REFERENCE",
    },
    {
      id: "corpus",
      bundle: pack(access("/corpus/expected.json", "CORPUS_DENIED")),
      verdict: "FAIL",
      code: "G0_DEFECT_CORPUS",
    },
    {
      id: "docker-socket",
      bundle: pack(access("/var/run/docker.sock", "DOCKER_DENIED")),
      verdict: "FAIL",
      code: "G0_DEFECT_DOCKER",
    },
    {
      id: "proxy",
      bundle: pack(
        replace(
          guard,
          `${conditional} try { await fetch("http://198.51.100.1/", { signal: AbortSignal.timeout(500) }); res.end('{"g0Defect":"AVAILABLE"}'); } catch { res.end('{"g0Defect":"NETWORK_DENIED"}'); } return; }`,
        ),
      ),
      verdict: "FAIL",
      code: "G0_DEFECT_NETWORK",
    },
    {
      id: "spawn-import",
      bundle: pack(`import "node:child_process";\n${source}`),
      verdict: "FAIL",
      code: "G0_FORBIDDEN_IMPORT",
    },
    {
      id: "workshop-positive",
      bundle: workshopPack(workshopMain),
      driver: "workshop-v1",
      verdict: "PASS",
      code: null,
    },
    {
      id: "workshop-static-cancel",
      bundle: workshopPack(
        workshopMain.replace(
          'db.prepare("DELETE FROM appointments WHERE id = ?").run(id);',
          "void id;",
        ),
      ),
      driver: "workshop-v1",
      verdict: "FAIL",
      code: "G0_CHALLENGE",
    },
  ];
}
export async function qualifySynthetic(parent, head) {
  check(process.platform === "linux", "G0_LINUX_REQUIRED");
  const setup = new Evidence(join(parent, "setup"));
  let runtime;
  try {
    runtime = await buildImage(setup);
  } finally {
    setup.seal();
  }
  const results = [];
  const receipts = [];
  for (const fixture of await syntheticCases()) {
    const receipt = await runG0(
      publicScope(fixture.bundle, runtime, head, fixture.driver),
      fixture.bundle,
      join(parent, fixture.id),
    );
    receipts.push(receipt);
    results.push({
      id: fixture.id,
      candidateSha: fixture.bundle.candidateSha,
      expected: fixture.verdict,
      actual: receipt.verdict,
      code: receipt.faults[0] ?? null,
      runId: receipt.identity.runId,
    });
    check(
      (fixture.verdict === "PASS"
        ? receipt.verdict === "INCONCLUSIVE" &&
          receipt.faults[0] === "G0_QUALIFICATION_REQUIRED"
        : receipt.verdict === fixture.verdict &&
          receipt.faults[0] === fixture.code) &&
        receipt.cleanup?.containers === 0 &&
        receipt.cleanup?.volumes === 0 &&
        receipt.finalizer?.emergencyRemoved === 0 &&
        receipt.evidence,
      "G0_CONTROL_FAILED",
    );
  }
  const qualification = await qualifyAdapter(receipts);
  const positive = (await syntheticCases())[0];
  const qualified = await runG0(
    publicScope(positive.bundle, runtime, head),
    positive.bundle,
    join(parent, "qualified-positive"),
  );
  check(qualified.verdict === "PASS", "G0_CONTROL_FAILED");
  return {
    status: "TESTED_SYNTHETIC",
    docker: "REAL_DOCKER_PASSED",
    head,
    results,
    qualification,
    qualifiedRunId: qualified.identity.runId,
    runtime: { imageId: runtime.imageId, recipeSha: runtime.recipeSha },
    realCandidate: "NOT_RUN",
    product: "NOT_ESTABLISHED",
  };
}
