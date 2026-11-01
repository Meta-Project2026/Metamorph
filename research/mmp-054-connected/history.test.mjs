import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { bootstrap, checkHistory, HISTORY, ROOT } from "./history.mjs";

test("real depth-one clone lacks history; bounded exact-object bootstrap restores identity", () => {
  checkHistory(ROOT); // caller must bootstrap before this test, never silently skip
  const directory = mkdtempSync(join(tmpdir(), "mmp063-shallow-"));
  const checkout = join(directory, "checkout");
  try {
    execFileSync(
      "git",
      [
        "clone",
        // Disposable clone: background maintenance can race its final removal.
        "--config=maintenance.auto=false",
        "--config=gc.auto=0",
        "--depth=1",
        "--no-local",
        "--no-checkout",
        pathToFileURL(ROOT).href,
        checkout,
      ],
      { timeout: 60000, stdio: "pipe", windowsHide: true },
    );
    for (const [name, expected] of [
      ["maintenance.auto", "false"],
      ["gc.auto", "0"],
    ])
      assert.equal(
        execFileSync("git", ["config", "--get", name], { cwd: checkout })
          .toString()
          .trim(),
        expected,
      );
    assert.equal(
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: checkout,
      })
        .toString()
        .trim(),
      "true",
    );
    const missing = spawnSync(
      process.execPath,
      [join(ROOT, "research/mmp-054-connected/history.mjs"), "check", checkout],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(missing.status, 1);
    assert.deepEqual(JSON.parse(missing.stderr), {
      status: "ERROR",
      code: "HISTORY_MISSING_OR_INVALID",
    });
    // The mirror is this authenticated checkout's authentic objects, not JSON.
    assert.equal(
      bootstrap(checkout, pathToFileURL(ROOT).href).parent,
      HISTORY.parent,
    );
    assert.equal(checkHistory(checkout).status, "VERIFIED");
    assert.equal(
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: checkout,
      })
        .toString()
        .trim(),
      "true",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("missing remote fails closed without a fallback or synthetic history", () => {
  const directory = mkdtempSync(join(tmpdir(), "mmp063-missing-"));
  try {
    execFileSync("git", ["init", directory], { stdio: "pipe" });
    assert.throws(() => bootstrap(directory, join(directory, "missing.git")), {
      message: "HISTORY_FETCH_FAILED",
    });
    assert.throws(() => checkHistory(directory), {
      message: "HISTORY_MISSING_OR_INVALID",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
