// Static coverage is not a test verdict. Unknown shell/conditions fail closed.

import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parseDocument } from "yaml";

export const ROOT = resolve(import.meta.dirname, "../..");
export const STEPS = [
  { uses: "actions/checkout@v4", with: { "fetch-depth": 1 } },
  {
    uses: "actions/setup-node@v4",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression
    with: { "node-version": "${{ matrix.node }}" },
  },
  { uses: "pnpm/action-setup@v4" },
  { run: "pnpm install --frozen-lockfile" },
  { run: "pnpm lint" },
  { run: "pnpm typecheck" },
  { run: "pnpm test" },
  { run: "pnpm build" },
  {
    name: "Oracle reference tests",
    run: "pnpm --filter @metamorph/oracle test:reference",
  },
  {
    name: "Target-worker tests",
    run: "pnpm --filter @metamorph/target-worker test",
  },
  {
    name: "Differential tests",
    run: "pnpm --filter @metamorph/differential test",
  },
  {
    name: "PHP qualification sanitizer and recipe tests",
    run: "node --test packages/oracle/probes/qualification.test.mjs",
  },
  {
    name: "Workshop-audit tests",
    run: "pnpm --filter @metamorph/workshop-audit test",
  },
  {
    name: "Active research lint",
    run: "pnpm exec biome check research/demo-readiness research/mmp-069 research/mmp-054-connected",
  },
  {
    name: "Active research syntax",
    run: "node research/mmp-069/check-syntax.mjs",
  },
  {
    name: "Validate coverage matrix",
    run: "node research/mmp-069/validate.mjs",
  },
  {
    name: "Coverage validator negative controls",
    run: "node --test research/mmp-069/validate.test.mjs",
  },
  {
    name: "Connected history bootstrap",
    run: "node research/mmp-054-connected/history.mjs bootstrap",
  },
  {
    name: "Shallow history negative control",
    run: "node --test research/mmp-054-connected/history.test.mjs",
  },
  {
    name: "Connected adversarial tests",
    run: "node --test research/mmp-054-connected/verify.test.mjs",
  },
  {
    name: "Demo-readiness tests",
    run: "node --test research/demo-readiness/*.test.mjs",
  },
  {
    name: "MMP-108 first-step negative controls",
    run: "node --test research/mmp-108/*.test.mjs",
  },
];
export function check(condition, code) {
  if (!condition) throw new Error(code);
}
export function same(actual, expected, code) {
  check(isDeepStrictEqual(actual, expected), code);
}
export function read(root, path) {
  return readFileSync(resolve(root, path), "utf8");
}
export function yaml(text) {
  const doc = parseDocument(text, { version: "1.2", uniqueKeys: true });
  check(!doc.errors.length && !doc.warnings.length, "YAML_INVALID");
  return doc.toJS({ maxAliasCount: 0 });
}
export function expand(root, pattern) {
  check(
    typeof pattern === "string" &&
      /^[\w./*?-]+$/.test(pattern) &&
      !pattern.includes("..") &&
      !pattern.startsWith("/"),
    "PATH_PATTERN_INVALID",
  );
  return globSync(pattern, { cwd: root })
    .map((p) => p.replaceAll("\\", "/"))
    .sort();
}
function exactKeys(value, keys, code) {
  same(Object.keys(value).sort(), keys.sort(), code);
}
export function inventory(root) {
  const workspace = yaml(read(root, "pnpm-workspace.yaml"));
  // Current positive pnpm globs are expanded, not replaced by a package list.
  // Unsupported negations/advanced patterns fail closed.
  check(
    Array.isArray(workspace.packages) && workspace.packages.length > 0,
    "WORKSPACE_GLOBS",
  );
  const paths = ["."];
  for (const pattern of workspace.packages) {
    for (const file of expand(root, `${pattern}/package.json`))
      paths.push(file.slice(0, -13));
  }
  check(new Set(paths).size === paths.length, "WORKSPACE_DUPLICATE");
  return paths.sort().map((path) => {
    const pkg = JSON.parse(read(root, `${path}/package.json`));
    return { path, name: pkg.name, scripts: pkg.scripts ?? {} };
  });
}
function testPatterns(script) {
  const match =
    /^(?:pnpm (?:build|--filter @metamorph\/oracle\.\.\. build) && )?node --test ([\w./* -]+)$/.exec(
      script,
    );
  check(match, "TEST_SCRIPT_UNSUPPORTED");
  return match[1].split(" ");
}
export function validate(root = ROOT) {
  const matrix = JSON.parse(
    read(root, "research/mmp-069/coverage-matrix.json"),
  );
  exactKeys(
    matrix,
    [
      "version",
      "contract",
      "semantics",
      "gates",
      "packages",
      "research",
      "skips",
      "privilegedRunner",
    ],
    "MATRIX_FIELDS",
  );
  same(matrix.version, 2, "MATRIX_VERSION");
  same(matrix.contract, "MMP-063-069-074", "MATRIX_CONTRACT");
  same(
    matrix.semantics,
    "Static gating inventory; execution counts and verdicts are recorded separately",
    "MATRIX_SEMANTICS",
  );
  const workflow = yaml(read(root, ".github/workflows/ci.yml"));
  exactKeys(
    workflow,
    ["name", "on", "permissions", "concurrency", "jobs"],
    "WORKFLOW_FIELDS",
  );
  same(
    workflow.on,
    { pull_request: null, push: { branches: ["main"] } },
    "WORKFLOW_EVENTS",
  );
  same(workflow.permissions, { contents: "read" }, "WORKFLOW_PERMISSIONS");
  same(
    workflow.concurrency,
    {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression
      group: "ci-${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": true,
    },
    "WORKFLOW_CONCURRENCY",
  );
  exactKeys(workflow.jobs, ["quick"], "WORKFLOW_JOBS");
  const job = workflow.jobs.quick;
  exactKeys(
    job,
    ["runs-on", "timeout-minutes", "strategy", "steps"],
    "JOB_FIELDS",
  );
  same(job["runs-on"], "ubuntu-latest", "JOB_OS");
  same(job["timeout-minutes"], 8, "JOB_TIMEOUT");
  same(
    job.strategy,
    { "fail-fast": false, matrix: { node: ["22", "24"] } },
    "JOB_MATRIX",
  );
  same(job.steps, STEPS, "CI_STEPS_DRIFT");
  same(
    matrix.gates,
    STEPS.filter((s) => s.run).map((s) => ({
      command: s.run,
      status: "GATED_HOSTED",
    })),
    "MATRIX_GATES_DRIFT",
  );
  const packages = inventory(root);
  same(matrix.packages, packages, "WORKSPACE_DRIFT");
  check(
    new Set(packages.map((p) => p.name)).size === packages.length,
    "PACKAGE_NAMES_DUPLICATE",
  );
  const rootPackage = packages.find((p) => p.path === ".");
  same(rootPackage.scripts.build, "pnpm -r build", "ROOT_BUILD");
  same(
    rootPackage.scripts.typecheck,
    "pnpm build && pnpm -r typecheck",
    "ROOT_TYPECHECK",
  );
  same(rootPackage.scripts.lint, "biome check .", "ROOT_LINT");
  const covered = new Set();
  function addTests(command, cwd = ".") {
    for (const pattern of testPatterns(command)) {
      const files = expand(root, cwd === "." ? pattern : `${cwd}/${pattern}`);
      check(files.length > 0, "EMPTY_TEST_GLOB");
      for (const file of files) covered.add(file);
    }
  }
  addTests(rootPackage.scripts.test);
  for (const step of STEPS) {
    if (step.run?.startsWith("node --test ")) addTests(step.run);
    const selected = /^pnpm --filter (\S+) (\S+)$/.exec(step.run ?? "");
    if (selected) {
      const pkg = packages.find((p) => p.name === selected[1]);
      check(pkg?.scripts[selected[2]], "MISSING_PACKAGE_COMMAND");
      addTests(pkg.scripts[selected[2]], pkg.path);
    }
  }
  for (const pkg of packages.filter((p) => p.path !== ".")) {
    for (const file of expand(root, `${pkg.path}/**/*.test.mjs`))
      check(covered.has(file), "UNREACHED_PACKAGE_TEST");
  }
  const modules = expand(root, "research/**/*.mjs");
  const harnesses = [
    ...new Set(modules.map((p) => p.split("/").slice(0, 2).join("/"))),
  ].sort();
  same(
    matrix.research.map((r) => r.path).sort(),
    harnesses,
    "RESEARCH_INVENTORY_DRIFT",
  );
  for (const entry of matrix.research) {
    exactKeys(
      entry,
      ["path", "lifecycle", "execution", "staticCheck", "tests", "gap"],
      "RESEARCH_FIELDS",
    );
    // Explicit archival boundary; manual workflow code/dependencies remain active.
    same(
      entry.lifecycle,
      entry.path === "research/mmp-055" ? "ARCHIVED" : "ACTIVE",
      "RESEARCH_LIFECYCLE",
    );
    check(
      [
        "GATED_HOSTED",
        "MANUAL_DOCKER",
        "PRIVILEGED_NOT_RUN",
        "LOCAL_ONLY",
        "NOT_VERIFIED",
      ].includes(entry.execution),
      "RESEARCH_EXECUTION",
    );
    same(
      entry.staticCheck,
      entry.lifecycle === "ACTIVE" ? "GATED_HOSTED_SYNTAX" : "ARCHIVED",
      "RESEARCH_STATIC",
    );
    check(
      typeof entry.gap === "string" && entry.gap.length > 0,
      "RESEARCH_GAP",
    );
    const files = modules.filter(
      (p) => p.startsWith(`${entry.path}/`) && p.endsWith(".test.mjs"),
    );
    const gated = files.filter((p) => covered.has(p));
    same(
      entry.tests,
      gated.length > 0 ? "GATED_HOSTED" : "NOT_VERIFIED",
      "RESEARCH_TEST_CLAIM",
    );
    if (entry.execution === "GATED_HOSTED") {
      check(files.length > 0, "RESEARCH_EMPTY_SUITE");
      same(gated, files, "RESEARCH_TEST_UNREACHED");
    }
    if (
      [
        "research/demo-readiness",
        "research/mmp-069",
        "research/mmp-054-connected",
      ].includes(entry.path)
    ) {
      same(entry.execution, "GATED_HOSTED", "ACTIVE_TEST_GATE");
      const config = JSON.parse(read(root, `${entry.path}/biome.json`));
      same(config.files, { includes: ["**/*.mjs"] }, "LINT_SCOPE");
      same(
        config.linter,
        { enabled: true, rules: { preset: "recommended" } },
        "LINT_RULES",
      );
      check(
        config.root === false && !config.overrides && !config.extends,
        "LINT_OVERRIDE",
      );
    }
  }
  same(
    matrix.privilegedRunner,
    { decision: "NO_DECISION", execution: "PRIVILEGED_NOT_RUN" },
    "PRIVILEGED_CLAIM",
  );
  const expectedSkips = [
    {
      title:
        "Windows support fails closed instead of treating POSIX mode bits as ACL proof",
      status: "HOSTED_SKIP",
      reason: "Windows-only",
      guard: 'skip: process.platform !== "win32"',
    },
    {
      title: "real foreign-owner file is rejected",
      status: "HOSTED_SKIP",
      reason: "Requires uid 0",
      guard: "process.getuid?.() !== 0",
    },
    {
      title:
        "actual unprivileged child cannot read source or private key; receives no keys/env",
      status: "HOSTED_SKIP",
      reason: "Requires uid 0",
      guard: "process.getuid?.() !== 0",
    },
  ];
  same(matrix.skips, expectedSkips, "SKIP_CLAIM");
  const retention = read(
    root,
    "packages/evidence-retention/test/retention.test.mjs",
  );
  for (const skip of expectedSkips)
    check(
      retention.includes(skip.title) && retention.includes(skip.guard),
      "SKIP_SOURCE_DRIFT",
    );
  return {
    status: "VALID",
    workspacePackages: packages.length,
    testFiles: [...covered].sort(),
    researchModules: modules.length,
    syntaxFiles: modules.filter((p) => !p.startsWith("research/mmp-055/")),
    privilegedRunner: "NOT_RUN",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify(
        validate(process.argv[2] ? resolve(process.argv[2]) : ROOT),
      ),
    );
  } catch (error) {
    const code = /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "INVALID_INPUT";
    console.error(JSON.stringify({ status: "INVALID", code }));
    process.exitCode = 1;
  }
}
