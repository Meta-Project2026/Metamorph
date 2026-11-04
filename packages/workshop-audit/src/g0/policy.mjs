// Trusted outer G0 boundary. No Oracle/worker DTO or registry is changed.
import { randomUUID } from "node:crypto";
import ts from "typescript";
import {
  sha256,
  validateBundle,
} from "../../../target-worker/src/admission.mjs";

export const VERSION = "g0-standalone-v1";
export const LIMITS = Object.freeze({
  memory: 268435456,
  nanoCpus: 1000000000,
  pids: 64,
  lifetimeMs: 180000,
  operationMs: 15000,
  cleanupMs: 10000,
  outputBytes: 4 * 1024 * 1024,
});
export const CONTROLS = Object.freeze([
  "scope",
  "source",
  "build",
  "isolation-build",
  "isolation-runtime",
  "filesystem",
  "php",
  "reference",
  "corpus",
  "docker",
  "spawn",
  "native",
  "network",
  "ipc",
  "process",
  "environment",
  "challenge",
  "cleanup",
]);
export const DRIVERS = Object.freeze({
  "items-v1": Object.freeze(["items-read", "items-write"]),
  "workshop-v1": Object.freeze([
    "slots",
    "appointments",
    "book",
    "update",
    "cancel",
  ]),
});
const registered = new WeakSet();
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{0,63}$/;
export const digest = (x) => sha256(JSON.stringify(x));
export function check(value, code) {
  if (!value) throw Object.assign(new Error(code), { code });
}
export function fields(value, keys, code = "G0_FIELDS") {
  check(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).sort().join() === [...keys].sort().join(),
    code,
  );
}
function ids(value, code) {
  check(
    Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 64 &&
      value.every((id) => typeof id === "string" && ID.test(id)) &&
      new Set(value).size === value.length,
    code,
  );
}
export function exactIds(actual, expected, code = "G0_COVERAGE") {
  check(
    Array.isArray(actual) &&
      actual.length === expected.length &&
      new Set(actual).size === actual.length &&
      actual.every((id) => expected.includes(id)),
    code,
  );
}
export function freeze(value) {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}

// Caller is the trusted registrar, never a candidate/model result. A scope is
// local G0 configuration, not #56 benchmark registration or owner ratification.
export function registerScope(input, bundle) {
  fields(input, [
    "version",
    "benchmarkId",
    "benchmarkVersion",
    "sourceSha",
    "manifestSha",
    "candidateSha",
    "candidateGitSha",
    "evaluatorSha",
    "imageId",
    "recipeSha",
    "driver",
    "units",
    "routes",
    "unsupported",
    "testIds",
    "controlIds",
  ]);
  check(
    input.version === VERSION &&
      typeof input.benchmarkId === "string" &&
      ID.test(input.benchmarkId) &&
      typeof input.benchmarkVersion === "string" &&
      ID.test(input.benchmarkVersion) &&
      typeof input.driver === "string" &&
      Object.hasOwn(DRIVERS, input.driver),
    "G0_SCOPE",
  );
  for (const key of ["sourceSha", "manifestSha", "candidateSha", "recipeSha"])
    check(
      typeof input[key] === "string" && HASH.test(input[key]),
      "G0_IDENTITY",
    );
  check(
    /^[a-f0-9]{40}$/.test(input.candidateGitSha) &&
      /^[a-f0-9]{40}$/.test(input.evaluatorSha) &&
      /^sha256:[a-f0-9]{64}$/.test(input.imageId),
    "G0_IDENTITY",
  );
  const admitted = validateBundle(bundle.files, input.candidateSha);
  exactIds(input.routes, DRIVERS[input.driver], "G0_ROUTES");
  exactIds(
    input.testIds,
    DRIVERS[input.driver].map((id) => `route-${id}`),
    "G0_TEST_IDS",
  );
  exactIds(input.controlIds, CONTROLS, "G0_CONTROL_IDS");
  ids(input.unsupported, "G0_UNSUPPORTED");
  check(
    Array.isArray(input.units) &&
      input.units.length > 0 &&
      input.units.length <= 64,
    "G0_UNITS",
  );
  const unitIds = [],
    paths = [],
    routes = [];
  for (const unit of input.units) {
    fields(unit, ["id", "files", "routes"]);
    unitIds.push(unit.id);
    check(Array.isArray(unit.files) && unit.files.length > 0, "G0_UNITS");
    check(
      unit.files.every((p) => admitted.files.some((f) => f.path === p)),
      "G0_UNITS",
    );
    ids(unit.routes, "G0_UNITS");
    check(
      unit.routes.every((r) => input.routes.includes(r)),
      "G0_UNITS",
    );
    paths.push(...unit.files);
    routes.push(...unit.routes);
  }
  ids(unitIds, "G0_UNITS");
  exactIds(
    [...new Set(paths)],
    admitted.files.map((f) => f.path),
    "G0_SOURCE_COMPLETENESS",
  );
  exactIds([...new Set(routes)], input.routes, "G0_UNIT_COMPLETENESS");
  const scope = freeze(structuredClone(input));
  registered.add(scope);
  return scope;
}
export function requireScope(scope) {
  check(registered.has(scope), "G0_UNTRUSTED_SCOPE");
}

// AST-based import admission is structural only; Docker controls are separate.
// This deliberately small v1 accepts no package/plugin/dynamic loader surface.
const imports = new Set([
  "node:http",
  "node:sqlite",
  "node:fs",
  "node:fs/promises",
  "node:net",
  "node:crypto",
  "node:url",
  "node:buffer",
  "node:util",
  "node:events",
]);
export function inspectSource(bundle) {
  validateBundle(bundle.files, bundle.candidateSha);
  for (const file of bundle.files) {
    const ast = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
    );
    check(ast.parseDiagnostics.length === 0, "G0_SOURCE_SYNTAX");
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) {
          check(
            ts.isStringLiteral(node.moduleSpecifier),
            "G0_FORBIDDEN_IMPORT",
          );
          const name = node.moduleSpecifier.text;
          check(
            imports.has(name) ||
              /^\.\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(name),
            "G0_FORBIDDEN_IMPORT",
          );
        }
      }
      check(!ts.isImportEqualsDeclaration(node), "G0_FORBIDDEN_IMPORT");
      if (ts.isCallExpression(node))
        check(
          node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
            !(
              ts.isIdentifier(node.expression) &&
              ["require", "eval"].includes(node.expression.text)
            ),
          "G0_FORBIDDEN_IMPORT",
        );
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
}
export function makeRunId() {
  return `g0-${randomUUID()}`;
}
export function identity(scope, runId) {
  return {
    version: VERSION,
    runId,
    scopeSha: digest(scope),
    candidateSha: scope.candidateSha,
    candidateGitSha: scope.candidateGitSha,
    sourceSha: scope.sourceSha,
    manifestSha: scope.manifestSha,
    benchmarkId: scope.benchmarkId,
    benchmarkVersion: scope.benchmarkVersion,
    evaluatorSha: scope.evaluatorSha,
    imageId: scope.imageId,
    recipeSha: scope.recipeSha,
  };
}
export const SAFE_CODES = new Set([
  "G0_SCOPE",
  "G0_FIELDS",
  "G0_IDENTITY",
  "G0_ROUTES",
  "G0_TEST_IDS",
  "G0_CONTROL_IDS",
  "G0_UNSUPPORTED",
  "G0_UNITS",
  "G0_SOURCE_COMPLETENESS",
  "G0_UNIT_COMPLETENESS",
  "G0_UNTRUSTED_SCOPE",
  "G0_SOURCE_SYNTAX",
  "G0_FORBIDDEN_IMPORT",
  "G0_LINUX_REQUIRED",
  "G0_DOCKER_UNAVAILABLE",
  "G0_ENVIRONMENT",
  "G0_ISOLATION",
  "G0_EVIDENCE",
  "G0_TIMEOUT",
  "G0_CANCELLED",
  "G0_BUILD",
  "G0_CHALLENGE",
  "G0_CLEANUP",
  "G0_OWNERSHIP",
  "G0_COVERAGE",
  "G0_CONTROL_FAILED",
  "G0_PARTIAL",
  "G0_SOURCE_ADMISSION",
  "G0_RUNTIME_EXIT",
  "G0_INTERNAL",
  "G0_QUALIFICATION_REQUIRED",
  "G0_DEFECT_REFERENCE",
  "G0_DEFECT_NETWORK",
  "G0_DEFECT_CORPUS",
  "G0_DEFECT_DOCKER",
]);
export const safeCode = (e) =>
  SAFE_CODES.has(e?.code) ? e.code : "G0_INTERNAL";
