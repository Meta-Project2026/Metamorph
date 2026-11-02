import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { audit, INPUTS, RECORDS, sameBoundaryShape } from "./audit.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const parse = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const repair = parse(RECORDS.repair);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function snapshot(t) {
  const directory = mkdtempSync(join(tmpdir(), "mmp125-test-"));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("mmp125-test-"));
    rmSync(directory, { recursive: true, force: true });
  });
  for (const path of [...INPUTS, "research/mmp-125/pins.json"]) {
    const target = join(directory, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, path), target);
  }
  return directory;
}
function replace(directory, path, content, repin = false) {
  writeFileSync(join(directory, path), content);
  if (repin) {
    const pinPath = join(directory, "research/mmp-125/pins.json"),
      pins = JSON.parse(readFileSync(pinPath, "utf8"));
    const bytes = readFileSync(join(directory, path));
    pins.files[path] = { bytes: bytes.length, sha256: hash(bytes) };
    writeFileSync(pinPath, JSON.stringify(pins));
  }
}
test("actual pinned public records correlate without attributing a side, cause, model attestation or product PASS", () => {
  const result = audit();
  assert.equal(result.status, "AUDIT_COMPLETE_CAUSE_UNRESOLVED");
  assert.equal(result.rootCause, "UNKNOWN");
  assert.equal(result.failedSide, "UNKNOWN");
  assert.equal(result.errorClass, "UNKNOWN");
  assert.equal(result.profiles.meta.G1.verdict, "INCONCLUSIVE");
  assert.equal(result.profiles.repair.G1.executed, 2);
  assert.equal(result.profiles.draft.G1.verdict, "FAIL");
  assert.equal(result.profiles.knownGood.G2.executed, 17);
  assert.equal(result.profiles.statusMutant.G2.verdict, "FAIL");
  assert.equal(
    result.newDockerRuns + result.newModelRequests + result.newArtifactUploads,
    0,
  );
  assert.equal(result.formalG4, "NOT_RUN");
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.equal(result.diagnostic, "PROPOSED_REQUIRES_OWNER_CONSENT");
  assert.doesNotMatch(
    JSON.stringify(result),
    /createServer|CREATE TABLE|stderr|BEGIN.*KEY|C:\\\\Users|\/var\/lib\/docker/,
  );
});
test("existing candidate, reference and malformed controls have the same shape; completed HTTP mismatch and teardown are different", () => {
  const controls = parse(RECORDS.synthetic).cases;
  assert.deepEqual(
    controls.map((c) =>
      sameBoundaryShape({
        gates: { G2: c.G2, G3: c.G3 },
        coverage: repair.coverage,
      }),
    ),
    [true, true, true, false, false],
  );
});
for (const [name, change] of [
  [
    "semantic FAIL is not verifier ERROR",
    (r) => {
      r.gates.G2.verdict = "FAIL";
    },
  ],
  [
    "completed HTTP excludes the zero-comparison interval",
    (r) => {
      r.gates.G2.executedCount = 1;
      r.coverage.http = 1;
    },
  ],
  [
    "missing initial snapshot excludes this interval",
    (r) => {
      r.gates.G3.executedCount = 0;
      r.coverage.sqlite = 0;
    },
  ],
  [
    "a post-step DB id is not initial state",
    (r) => {
      r.gates.G3.executedFirst = "workshop-business:step-0";
    },
  ],
  [
    "different mandatory totals are not comparable",
    (r) => {
      r.coverage.requiredHttp = 1;
    },
  ],
  [
    "additional categorical failures cannot be discarded",
    (r) => {
      r.gates.G2.findingCodes.push("ENVIRONMENT_ERROR");
    },
  ],
])
  test(name, () => {
    const r = structuredClone(repair);
    change(r);
    assert.equal(sameBoundaryShape(r), false);
  });
test("untrusted side/error claims do not change the shape into a cause", () => {
  const r = structuredClone(repair);
  Object.defineProperty(r, "cause", {
    get() {
      throw Error("PRIVATE_CANARY");
    },
  });
  r.failedSide = "REFERENCE";
  r.errorClass = "CONNECTION_REFUSED";
  assert.equal(sameBoundaryShape(r), true);
  assert.equal(audit().rootCause, "UNKNOWN");
});
test("receipt corruption rejects instead of publishing raw text", (t) => {
  const dir = snapshot(t);
  replace(dir, RECORDS.repair, "PRIVATE_CANARY invalid JSON");
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("foreign run head rejects even with a re-pinned JSON checksum", (t) => {
  const dir = snapshot(t),
    run = parse(RECORDS.repairRun);
  run.headSha = "f".repeat(40);
  replace(dir, RECORDS.repairRun, JSON.stringify(run), true);
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("summary cannot substitute a different case", (t) => {
  const dir = snapshot(t),
    run = parse(RECORDS.repairRun);
  run.cases[0].gates.G2.verdict = "PASS";
  replace(dir, RECORDS.repairRun, JSON.stringify(run), true);
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("independent candidate admission hash rejects changed bytes even after file re-pinning", (t) => {
  const dir = snapshot(t),
    path = "research/mmp-123/repair-candidate/src/api.ts";
  replace(dir, path, `${readFileSync(join(dir, path), "utf8")}\n`, true);
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("extra candidate source is not silently omitted from the immutable bundle", (t) => {
  const dir = snapshot(t);
  writeFileSync(
    join(dir, "research/mmp-123/repair-candidate/src/extra.ts"),
    "// harmless test data",
  );
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("independent recipe hash rejects substituted runtime bytes even after file re-pinning", (t) => {
  const dir = snapshot(t),
    path = "packages/target-worker/runtime/clock.mjs";
  replace(dir, path, `${readFileSync(join(dir, path), "utf8")}\n`, true);
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("linked input does not count as an original pinned file", (t) => {
  const dir = snapshot(t);
  linkSync(join(dir, RECORDS.repair), join(dir, "second-link.json"));
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("Windows newline drift rejects; no normalization hides a recipe change", (t) => {
  const dir = snapshot(t),
    path = "packages/target-worker/runtime/Dockerfile";
  replace(
    dir,
    path,
    readFileSync(join(dir, path), "utf8").replaceAll("\n", "\r\n"),
  );
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("CLI has no Docker, private path or provider mode; invalid arguments produce a fixed safe refusal", () => {
  const child = spawnSync(
    process.execPath,
    [join(root, "research/mmp-125/audit.mjs"), "--docker", "PRIVATE_CANARY"],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(child.status, 2);
  assert.equal(child.stderr, "");
  assert.deepEqual(JSON.parse(child.stdout), {
    format: "mmp125-correlation-v1",
    status: "AUDIT_REJECTED",
    rootCause: "UNKNOWN",
  });
});

test("extra top-level candidate files are not omitted from admission", (t) => {
  const dir = snapshot(t);
  writeFileSync(
    join(dir, "research/mmp-123/repair-candidate/package.json"),
    "{}",
  );
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("a candidate directory alias is not the original immutable namespace", (t) => {
  const dir = snapshot(t),
    original = join(dir, "research/mmp-123/repair-candidate"),
    moved = join(dir, "moved-candidate");
  renameSync(original, moved);
  symlinkSync(
    moved,
    original,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
test("extra executable recipe files change the recipe rather than being omitted", (t) => {
  const dir = snapshot(t);
  writeFileSync(
    join(dir, "packages/target-worker/runtime/extra.mjs"),
    "// inert test data",
  );
  assert.throws(() => audit(dir), /MMP125_AUDIT_REJECTED/);
});
