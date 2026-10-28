// Adversarial host checks only. Historical public fixtures are never new proof.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";
import { git, PINS_PATH, root, verifyPins } from "../mmp-044/config.mjs";
import { verifyPublic } from "../mmp-049/verify.mjs";

const historicalSha = "cf33c5bbcaad524a99c667782fae5cb9b0b4125f";
const names = [
  "summary.json",
  "semantics.json",
  "agent.json",
  "finalizer.json",
];
function fixtures() {
  return Object.fromEntries(
    names.map((name) => [
      name,
      JSON.parse(
        readFileSync(
          join(
            root,
            "specs/016-candidate-compat/evidence/run-40720986007",
            name,
          ),
        ),
      ),
    ]),
  );
}
function verify(files, sha = historicalSha) {
  return verifyPublic((name) => {
    assert.ok(names.includes(name));
    assert.ok(Object.hasOwn(files, name));
    return JSON.stringify(files[name]);
  }, sha);
}
test("unchanged verifier accepts historical public fixtures only at their historical SHA", () => {
  assert.equal(verify(fixtures()).status, "PASS_SCOPED");
  assert.throws(() => verify(fixtures(), "0".repeat(40)));
});
test("pin refresh admits exactly the merged permission fix and preserves every other pin", () => {
  const { pins } = verifyPins({ strictCheckout: process.platform === "linux" });
  const old = JSON.parse(
    git("show", `7cf6e678802802d16336685771c842d0ce6cf37d:${PINS_PATH}`),
  );
  old.files["packages/oracle/src/runner.ts"] =
    "adf610324c8af75c4cde974f5e772ad82646b1435fd378b08584f3b8ea630150";
  assert.deepEqual(pins, old);
  const current = git("show", "HEAD:packages/oracle/src/runner.ts").toString();
  const previous = git(
    "show",
    "8779dfe^:packages/oracle/src/runner.ts",
  ).toString();
  assert.equal(
    current,
    previous.replace(
      "await mkdir(join(evidenceDirectory, directory));",
      "await mkdir(join(evidenceDirectory, directory), { mode: 0o700 });",
    ),
  );
});
test("pin gate still rejects a different executable Oracle blob", () => {
  assert.throws(() =>
    verifyPins({
      strictCheckout: false,
      blob: (path) =>
        path === "packages/oracle/src/runner.ts"
          ? Buffer.from("unreviewed runner")
          : git("show", `HEAD:${path}`),
    }),
  );
});
for (const name of names) {
  test(`unchanged verifier rejects missing artifact member ${name}`, () => {
    const files = fixtures();
    delete files[name];
    assert.throws(() => verify(files));
  });
}
for (const [name, mutate] of [
  [
    "wrong receipt identity",
    (f) => {
      f["agent.json"].headSha = "0".repeat(40);
    },
  ],
  [
    "missing finalizer stage",
    (f) => {
      f["finalizer.json"].stages.pop();
    },
  ],
  [
    "missing main stage",
    (f) => {
      f["summary.json"].groups.pop();
    },
  ],
  [
    "wrong HTTP count",
    (f) => {
      f["summary.json"].groups[0].cases[0].executedHttp--;
    },
  ],
  [
    "wrong SQLite count",
    (f) => {
      f["summary.json"].groups[0].cases[0].executedSqlite--;
    },
  ],
  [
    "lost initial state",
    (f) => {
      f["summary.json"].groups[0].cases[0].initial.status = "NOT_RUN";
    },
  ],
  [
    "forged PASS over HTTP failure",
    (f) => {
      f["summary.json"].groups[0].cases[0].steps[0].http.status = "FAIL";
    },
  ],
  [
    "forged PASS over state failure",
    (f) => {
      f["summary.json"].groups[0].cases[0].steps[0].db.status = "FAIL";
    },
  ],
  [
    "known-bad control undetected",
    (f) => {
      f["summary.json"].httpControls.negative.codes = [];
    },
  ],
  [
    "emergency cleanup despite zero inventory",
    (f) => {
      f["finalizer.json"].stages[1].emergencyRemoved = 1;
    },
  ],
  [
    "wrong source archive",
    (f) => {
      f["summary.json"].runtime.sourceSha256 = "0".repeat(64);
    },
  ],
  [
    "wrong candidate source",
    (f) => {
      f["summary.json"].candidate.candidateSha256 = "0".repeat(64);
    },
  ],
  [
    "missing Agent repair",
    (f) => {
      f["agent.json"].attempts.pop();
    },
  ],
]) {
  test(`unchanged verifier rejects ${name}`, () => {
    const files = fixtures();
    mutate(files);
    assert.throws(() => verify(files));
  });
}
test("unchanged admission rejects unsafe candidate paths before execution", () => {
  const content = "export {};\n";
  const file = { path: "src/main.ts", content, sha256: sha256(content) };
  assert.ok(validateBundle([file]).candidateSha);
  for (const path of [
    "../escape.ts",
    "src/../../escape.ts",
    "/src/main.ts",
    "src/held-out/main.ts",
  ]) {
    assert.throws(() => validateBundle([{ ...file, path }]));
  }
});
