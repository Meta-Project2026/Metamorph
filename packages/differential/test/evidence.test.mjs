import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PrivateEvidence } from "@metamorph/oracle";
import { retainOracle } from "../src/private-run.mjs";

test("private Oracle catalog is retained, permission checked, symlink resistant and tamper evident", {
  skip: process.platform !== "linux",
}, () => {
  const scratch = mkdtempSync(join(tmpdir(), "mmp008a-private-control-"));
  try {
    const parent = join(scratch, "raw");
    const root = join(parent, "run");
    mkdirSync(parent, { mode: 0o700 });
    mkdirSync(root, { mode: 0o700 });
    mkdirSync(join(root, "diffs"), { mode: 0o700 });
    const gates = [
      {
        gate: "G3",
        verdict: "FAIL",
        executedTestIds: ["original:initial"],
        evidencePaths: ["diffs/0-initial.json"],
      },
    ];
    const save = (name, value) =>
      writeFileSync(join(root, name), JSON.stringify(value), { mode: 0o600 });
    save("gate-results.json", gates);
    save("manifest.json", { scenarioIds: ["original"] });
    save("diffs/0-initial.json", [{ code: "DB_SCHEMA", path: "/schema" }]);
    const result = { evidenceDirectory: root, gateResults: gates };
    const pack = new PrivateEvidence(scratch, process.cwd(), {
      originalSynthetic: true,
    });
    const retained = retainOracle(result, parent, pack);
    assert.deepEqual(retained.gates, gates);
    const hash = pack.seal();
    assert.equal(PrivateEvidence.verify(pack.path, hash), 5);
    writeFileSync(join(pack.path, "oracle-file-1.json"), "tampered");
    assert.throws(
      () => PrivateEvidence.verify(pack.path, hash),
      /EVIDENCE_TAMPERED/,
    );
    const fresh = () => new PrivateEvidence(scratch, process.cwd(), {});
    const link = join(root, "diffs/linked");
    symlinkSync(join(root, "manifest.json"), link);
    assert.throws(() => retainOracle(result, parent, fresh()), /PRIVATE_LINK/);
    rmSync(link);
    save("gate-results.json", []);
    assert.throws(
      () => retainOracle(result, parent, fresh()),
      /ORACLE_PUBLICATION/,
    );
  } finally {
    assert.ok(scratch.startsWith(join(tmpdir(), "mmp008a-private-control-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
