import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sanitizeResult } from "./qualification.mjs";

test("public sanitizer drops bodies, answers, unknown steps, raw errors and arbitrary metadata", () => {
  const privateValue = "PRIVATE-QUESTION-ANSWER-DO-NOT-PUBLISH";
  const value = {
    format: "php74-qualification-v1",
    mode: "examsuite",
    runtime: {
      phpVersion: "7.4.33",
      sqliteVersion: "3.34.1",
      extensions: ["pdo_sqlite", privateValue],
    },
    bootstrapStatus: "PASS",
    statefulReplayStatus: "PASS",
    decision: "GO",
    rawBody: privateValue,
    scenarios: [
      {
        scenarioId: "exam-business",
        replay: 1,
        status: "PASS",
        exitCode: 0,
        dbPath: privateValue,
        initialCounts: { intakes: 0, [privateValue]: 100 },
        steps: [
          {
            stepId: "create-intake",
            status: 302,
            exitCode: 0,
            body: privateValue,
            headers: { answer: privateValue },
            error: privateValue,
            responseSha256: "a".repeat(64),
            beforeSha256: privateValue,
            afterSha256: "b".repeat(64),
          },
          { stepId: privateValue, status: 200 },
        ],
      },
    ],
    checks: [{ id: privateValue, exitCode: 0 }],
  };
  const result = sanitizeResult(value, "examsuite");
  assert.ok(!JSON.stringify(result).includes(privateValue));
  assert.equal(result.decision, "NO-GO");
  assert.equal(result.replayCount, 0);
  assert.equal(result.statefulReplayStatus, "FAIL");
  assert.equal(result.scenarios[0].steps[0].beforeSha256, null);
  assert.equal(result.scenarios[0].steps.length, 1);
  assert.throws(() => sanitizeResult(value, "workshop"));
});

test("qualification recipe is separate, bounded and cannot pass host environment/mounts into PHP", async () => {
  const driver = await readFile(
    new URL("qualification.mjs", import.meta.url),
    "utf8",
  );
  for (const required of [
    '"--network", "none"',
    '"--read-only"',
    '"--cap-drop", "ALL"',
    '"no-new-privileges"',
    '"--user", "65534:65534"',
    '"--memory", "256m"',
    '"--pids-limit", "64"',
    '"--signal=KILL"',
    "target=/input/source.tgz,readonly",
    "target=/probe/replay.php,readonly",
  ])
    assert.ok(driver.replace(/\s+/g, " ").includes(required), required);
  assert.ok(!driver.includes('"--privileged"'));
  assert.ok(!driver.includes('"--env-file"'));
  assert.ok(!driver.includes('"-e"'));
  assert.ok(!driver.includes("docker.sock"));
  const workflow = await readFile(
    new URL(
      "../../../.github/workflows/php74-qualification.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(workflow.includes("persist-credentials: false"));
  assert.ok(workflow.includes("contents: read"));
  assert.ok(!workflow.includes("pull_request_target"));
});
