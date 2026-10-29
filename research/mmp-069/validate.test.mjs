import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { stringify } from "yaml";
import { expand, ROOT, validate, yaml } from "./validate.mjs";

const workflowPath = ".github/workflows/ci.yml";
const matrixPath = "research/mmp-069/coverage-matrix.json";
function write(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function json(root, path, change) {
  const value = JSON.parse(readFileSync(join(root, path), "utf8"));
  change(value);
  write(root, path, JSON.stringify(value));
}
function workflow(root, change) {
  const value = yaml(readFileSync(join(root, workflowPath), "utf8"));
  change(value);
  write(root, workflowPath, stringify(value));
}
const audit = (w) =>
  w.jobs.quick.steps.find((s) => s.name === "Workshop-audit tests");
const research = (m) =>
  m.research.find((r) => r.path === "research/demo-readiness");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "mmp074-"));
  // Copies are only read/parsed by the validator, never executed as test code.
  const paths = new Set([
    workflowPath,
    matrixPath,
    "pnpm-workspace.yaml",
    "package.json",
    ...expand(ROOT, "packages/*/package.json"),
    ...expand(ROOT, "apps/*/package.json"),
    ...expand(ROOT, "packages/**/*.test.mjs"),
    ...expand(ROOT, "apps/**/*.test.mjs"),
    ...expand(ROOT, "research/**/*.mjs"),
    ...expand(ROOT, "research/**/biome.json"),
  ]);
  for (const path of paths) write(root, path, readFileSync(join(ROOT, path)));
  return root;
}
function cli(root) {
  return spawnSync(
    process.execPath,
    [join(ROOT, "research/mmp-069/validate.mjs"), root],
    { encoding: "utf8", timeout: 15000 },
  );
}
test("clean actual repository and isolated metadata copy validate without claiming test PASS", () => {
  assert.equal(validate().status, "VALID");
  const root = fixture();
  try {
    const result = cli(root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "VALID");
    assert.equal(report.privilegedRunner, "NOT_RUN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
const mutations = [
  [
    "remove audit step",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.steps = w.jobs.quick.steps.filter((s) => s !== audit(w));
      }),
  ],
  [
    "rename audit step",
    (r) =>
      workflow(r, (w) => {
        audit(w).name = "Imaginary tests";
      }),
  ],
  [
    "wrong audit command",
    (r) =>
      workflow(r, (w) => {
        audit(w).run = "pnpm --filter @metamorph/workshop-audit audit:isolated";
      }),
  ],
  [
    "disabled step boolean",
    (r) =>
      workflow(r, (w) => {
        audit(w).if = false;
      }),
  ],
  [
    "conditional step expression",
    (r) =>
      workflow(r, (w) => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression
        audit(w).if = "${{ matrix.node == '22' }}";
      }),
  ],
  [
    "continue-on-error step",
    (r) =>
      workflow(r, (w) => {
        audit(w)["continue-on-error"] = true;
      }),
  ],
  [
    "masked shell failure",
    (r) =>
      workflow(r, (w) => {
        audit(w).run += " || true";
      }),
  ],
  [
    "quoted echo is not execution",
    (r) =>
      workflow(r, (w) => {
        audit(w).run = 'echo "pnpm --filter @metamorph/workshop-audit test"';
      }),
  ],
  [
    "comment is not execution",
    (r) =>
      workflow(r, (w) => {
        audit(w).run = "# pnpm --filter @metamorph/workshop-audit test";
      }),
  ],
  [
    "inert multiline script",
    (r) =>
      workflow(r, (w) => {
        audit(w).run =
          "if false; then\npnpm --filter @metamorph/workshop-audit test\nfi";
      }),
  ],
  [
    "different cwd",
    (r) =>
      workflow(r, (w) => {
        audit(w)["working-directory"] = "elsewhere";
      }),
  ],
  [
    "custom shell",
    (r) =>
      workflow(r, (w) => {
        audit(w).shell = "echo {0}";
      }),
  ],
  [
    "injected environment",
    (r) =>
      workflow(r, (w) => {
        w.env = { NODE_OPTIONS: "--require ./bypass.cjs" };
      }),
  ],
  [
    "job disabled",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.if = false;
      }),
  ],
  [
    "job soft failure",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick["continue-on-error"] = true;
      }),
  ],
  [
    "job dependency suppression",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.needs = "missing";
      }),
  ],
  [
    "Node24 absent",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.strategy.matrix.node = ["22"];
      }),
  ],
  [
    "matrix excludes Node24",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.strategy.matrix.exclude = [{ node: "24" }];
      }),
  ],
  [
    "wrong setup-node version",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.steps[1].with["node-version"] = "22";
      }),
  ],
  [
    "PR trigger removed",
    (r) =>
      workflow(r, (w) => {
        delete w.on.pull_request;
      }),
  ],
  [
    "PR path filter",
    (r) =>
      workflow(r, (w) => {
        w.on.pull_request = { paths: ["unrelated/**"] };
      }),
  ],
  [
    "wrong permissions",
    (r) =>
      workflow(r, (w) => {
        w.permissions.contents = "write";
      }),
  ],
  [
    "missing lint gate",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.steps = w.jobs.quick.steps.filter(
          (s) => s.name !== "Active research lint",
        );
      }),
  ],
  [
    "missing syntax gate",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.steps = w.jobs.quick.steps.filter(
          (s) => s.name !== "Active research syntax",
        );
      }),
  ],
  [
    "missing validator controls",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.steps = w.jobs.quick.steps.filter(
          (s) => s.name !== "Coverage validator negative controls",
        );
      }),
  ],
  [
    "missing history bootstrap",
    (r) =>
      workflow(r, (w) => {
        w.jobs.quick.steps = w.jobs.quick.steps.filter(
          (s) => s.name !== "Connected history bootstrap",
        );
      }),
  ],
  [
    "false package",
    (r) =>
      json(r, matrixPath, (m) => {
        m.packages[0].name = "fiction";
      }),
  ],
  [
    "false command",
    (r) =>
      json(r, matrixPath, (m) => {
        m.packages[0].scripts.test = "echo pass";
      }),
  ],
  [
    "new workspace package",
    (r) =>
      write(
        r,
        "packages/new-package/package.json",
        '{"name":"@metamorph/new","scripts":{}}',
      ),
  ],
  [
    "removed package",
    (r) => rmSync(join(r, "packages/workshop-audit/package.json")),
  ],
  [
    "renamed package manifest",
    (r) =>
      json(r, "packages/workshop-audit/package.json", (m) => {
        m.name += "-renamed";
      }),
  ],
  [
    "unselected new package test",
    (r) =>
      write(
        r,
        "packages/contracts/test/unselected.test.mjs",
        "// intentionally not selected",
      ),
  ],
  [
    "missing active harness",
    (r) =>
      json(r, matrixPath, (m) => {
        m.research = m.research.filter((h) => h.path !== "research/mmp-078");
      }),
  ],
  [
    "new uninventoried harness",
    (r) => write(r, "research/new-harness/run.mjs", "// not executed"),
  ],
  [
    "false fastCi flag",
    (r) =>
      json(r, matrixPath, (m) => {
        research(m).fastCi = true;
      }),
  ],
  [
    "false manual test gate",
    (r) =>
      json(r, matrixPath, (m) => {
        m.research.find((h) => h.path === "research/mmp-054").tests =
          "GATED_HOSTED";
      }),
  ],
  [
    "active mislabeled archived",
    (r) =>
      json(r, matrixPath, (m) => {
        research(m).lifecycle = "ARCHIVED";
      }),
  ],
  [
    "stale research path",
    (r) =>
      json(r, matrixPath, (m) => {
        research(m).path += "-missing";
      }),
  ],
  [
    "disabled scoped linter",
    (r) =>
      json(r, "research/demo-readiness/biome.json", (m) => {
        m.linter.enabled = false;
      }),
  ],
  [
    "excluded lint source",
    (r) =>
      json(r, "research/demo-readiness/biome.json", (m) => {
        m.files.includes.push("!serve.mjs");
      }),
  ],
  [
    "privileged skip claimed pass",
    (r) =>
      json(r, matrixPath, (m) => {
        m.skips[1].status = "PASS";
      }),
  ],
  [
    "duplicate YAML keys",
    (r) =>
      write(
        r,
        workflowPath,
        `${readFileSync(join(r, workflowPath), "utf8")}\njobs: {}\n`,
      ),
  ],
  [
    "fake root shell plus matching matrix",
    (r) => {
      json(r, "package.json", (m) => {
        m.scripts.test =
          'echo "node --test packages/contracts/test/contracts.test.mjs"';
      });
      json(r, matrixPath, (m) => {
        m.packages.find((p) => p.path === ".").scripts.test =
          'echo "node --test packages/contracts/test/contracts.test.mjs"';
      });
    },
  ],
];
for (const [name, mutate] of mutations) {
  test(`invalid coverage exits nonzero: ${name}`, () => {
    const root = fixture();
    try {
      mutate(root);
      const result = cli(root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(JSON.parse(result.stderr).code, /^[A-Z_]+$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
test("new demo test is automatically reached by the wildcard without a fabricated test count", () => {
  const root = fixture();
  try {
    write(
      root,
      "research/demo-readiness/future.test.mjs",
      "// metadata-only discovery control",
    );
    assert.ok(
      validate(root).testFiles.includes(
        "research/demo-readiness/future.test.mjs",
      ),
    );
    assert.equal(cli(root).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
