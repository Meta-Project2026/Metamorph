import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDocument } from "yaml";
import {
  publicCase,
  publicCrypto,
} from "../../../research/mmp-097/hosted-receipt.mjs";

test("milestone Docker workflow is PR98 same-repository exact-head and token-free", () => {
  const text = readFileSync(
    new URL(
      "../../../.github/workflows/mmp097-offline-acceptance.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const yaml = parseDocument(text);
  assert.deepEqual(yaml.errors, []);
  const workflow = yaml.toJS();
  assert.deepEqual(Object.keys(workflow.on), ["pull_request"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.match(workflow.jobs.offline.if, /pull_request.number == 98/);
  assert.match(
    workflow.jobs.offline.if,
    /head.repo.full_name == github.repository/,
  );
  assert.equal(workflow.jobs.offline["runs-on"], "ubuntu-24.04");
  assert.equal(
    workflow.jobs.offline.steps[0].with.ref,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression
    "${{ github.event.pull_request.head.sha }}",
  );
  assert.equal(
    workflow.jobs.offline.steps[0].with["persist-credentials"],
    false,
  );
  assert.doesNotMatch(
    text,
    /pull_request_target|workflow_dispatch|schedule:|repository_dispatch|secrets\.|GH_TOKEN|GITHUB_TOKEN|id-token|upload-artifact|environment:/,
  );
  for (const step of workflow.jobs.offline.steps.filter((s) =>
    s.run?.includes("hosted-acceptance.mjs"),
  ))
    assert.match(step.run, /env -i/);
  assert.equal(workflow.jobs.offline.steps.at(-1).if, "always()");
});

test("hosted receipt refuses arbitrary statuses and exports only categorical fields", () => {
  const row = {
    id: "g1-pass-g2-pass-g3-pass",
    status: "PASS",
    gates: { G1: "PASS", G2: "PASS", G3: "PASS", raw: "SECRET_RAW" },
    stdout: "SECRET_RAW",
  };
  assert.doesNotMatch(
    JSON.stringify(publicCase(row, "a".repeat(40))),
    /SECRET_RAW|stdout|raw/,
  );
  assert.throws(() =>
    publicCase({ ...row, status: "SECRET_RAW" }, "a".repeat(40)),
  );
  assert.throws(() => publicCrypto(["SECRET_RAW"]));
  assert.throws(() =>
    publicCrypto([
      { control: "deadline-input", elapsedMs: 1, status: "SECRET_RAW" },
    ]),
  );
});
