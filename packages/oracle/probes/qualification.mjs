// Trusted host adapter. Never executes PHP or extracts third-party archives on host.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const probeRoot = fileURLToPath(new URL(".", import.meta.url));
const imageRef = "php:7.4.33-cli-bullseye";
const sources = [
  {
    mode: "examsuite",
    sourceRepo: "https://github.com/MarionForm/Tech2Teach-ExamSuite",
    repo: "MarionForm/Tech2Teach-ExamSuite",
    sourceCommit: "444a2f71491b755ab3f84dbaa3e4ebf5f2227805",
    attribution: "Copyright (c) 2026 MarionForm",
  },
  {
    mode: "workshop",
    sourceRepo: "https://github.com/tanjilaafsarirubina/car-workshop",
    repo: "tanjilaafsarirubina/car-workshop",
    sourceCommit: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
    attribution: "Copyright (c) 2026 Tanjila Afsari Rubina",
  },
];
const allowedSteps = {
  "exam-business": [
    "create-intake",
    "read-pack",
    "generate-exam",
    "take-exam",
    "grade-empty-answers",
    "read-results",
    "export-json",
  ],
  "exam-rejected": [
    "invalid-intake",
    "read-home",
    "missing-pack",
    "read-after-rejection",
  ],
  "exam-fresh": ["create-intake", "read-pack"],
  "workshop-business": [
    "book",
    "read-booking",
    "update",
    "read-update",
    "cancel",
    "read-cancel",
  ],
  "workshop-rejected": [
    "book",
    "duplicate",
    "read-after-duplicate",
    "invalid-booking",
    "read-after-invalid",
  ],
  "workshop-capacity": [
    "fill-1",
    "fill-2",
    "fill-3",
    "fill-4",
    "over-capacity",
    "read-after-capacity",
  ],
};
const tables = [
  "intakes",
  "questions",
  "exams",
  "exam_questions",
  "attempts",
  "mechanics",
  "appointments",
  "sqlite_sequence",
];
const modules = [
  "Core",
  "date",
  "libxml",
  "openssl",
  "pcre",
  "sqlite3",
  "zlib",
  "ctype",
  "curl",
  "dom",
  "fileinfo",
  "filter",
  "ftp",
  "hash",
  "iconv",
  "json",
  "mbstring",
  "mysqlnd",
  "PDO",
  "pdo_sqlite",
  "Phar",
  "posix",
  "readline",
  "Reflection",
  "session",
  "SimpleXML",
  "sodium",
  "SPL",
  "standard",
  "tokenizer",
  "xml",
  "xmlreader",
  "xmlwriter",
  "Zend OPcache",
];
const sha = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
const integer = (value, maximum = 1000000) =>
  Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
const status = (value) =>
  ["PASS", "FAIL", "ERROR", "NOT_RUN"].includes(value) ? value : "ERROR";
const rowCounts = (value) =>
  Object.fromEntries(
    tables
      .filter((name) => integer(value?.[name]) !== null)
      .map((name) => [name, value[name]]),
  );

/** Strict public allowlist: never forward bodies, PHP error text or arbitrary keys. */
export function sanitizeResult(value, mode) {
  if (value?.format !== "php74-qualification-v1" || value.mode !== mode)
    throw new Error("Invalid probe envelope");
  const scenarioIds = Object.keys(allowedSteps).filter((id) =>
    id.startsWith(mode === "examsuite" ? "exam-" : "workshop-"),
  );
  const scenarios = [];
  for (const scenarioId of scenarioIds) {
    for (const replay of [1, 2]) {
      const matches =
        value.scenarios?.filter(
          (entry) => entry.scenarioId === scenarioId && entry.replay === replay,
        ) ?? [];
      if (matches.length !== 1) continue;
      const item = matches[0];
      const steps = [];
      for (const stepId of allowedSteps[scenarioId]) {
        const candidates =
          item.steps?.filter((entry) => entry.stepId === stepId) ?? [];
        if (candidates.length !== 1) continue;
        const step = candidates[0];
        steps.push({
          stepId,
          status: integer(step.status, 599),
          responseSha256: sha(step.responseSha256),
          stableHeadersSha256: sha(step.stableHeadersSha256),
          beforeSha256: sha(step.beforeSha256),
          afterSha256: sha(step.afterSha256),
          beforeCounts: rowCounts(step.beforeCounts),
          afterCounts: rowCounts(step.afterCounts),
          unchanged: step.unchanged === true,
          elapsedMs: integer(step.elapsedMs, 180000),
          exitCode: integer(step.exitCode, 255),
        });
      }
      scenarios.push({
        scenarioId,
        replay,
        dbPath: `/work/${scenarioId}-${replay}/${mode === "examsuite" ? "storage/tech2teach.sqlite" : "workshop.sqlite"}`,
        initialSha256: sha(item.initialSha256),
        initialCounts: rowCounts(item.initialCounts),
        status: status(item.status),
        exitCode: integer(item.exitCode, 255),
        steps,
      });
    }
  }
  const complete =
    scenarios.length === 6 &&
    scenarios.every(
      (scenario) =>
        scenario.status === "PASS" &&
        scenario.exitCode === 0 &&
        scenario.steps.length === allowedSteps[scenario.scenarioId].length &&
        scenario.steps.every(
          (step) =>
            step.exitCode === 0 &&
            step.responseSha256 &&
            step.beforeSha256 &&
            step.afterSha256,
        ),
    );
  const checks = [];
  const checkIds = [
    "archive-extract",
    "php-lint",
    ...scenarioIds.flatMap((id) =>
      [1, 2].flatMap((replay) => [
        `${id}:${replay}:init_db.php`,
        `${id}:${replay}:seed_questions.php`,
      ]),
    ),
  ];
  for (const id of checkIds) {
    const check = value.checks?.find((entry) => entry.id === id);
    if (check)
      checks.push({
        id,
        exitCode: integer(check.exitCode, 255),
        ...(id === "php-lint"
          ? { fileCount: integer(check.fileCount, 10000) }
          : {}),
      });
  }
  const phpVersion = value.runtime?.phpVersion === "7.4.33" ? "7.4.33" : null;
  const sqliteVersion =
    typeof value.runtime?.sqliteVersion === "string" &&
    /^\d+\.\d+\.\d+$/.test(value.runtime.sqliteVersion)
      ? value.runtime.sqliteVersion
      : null;
  const extensions = modules.filter((name) =>
    value.runtime?.extensions?.includes(name),
  );
  let exactReplayEqual = complete;
  for (let index = 0; index < scenarios.length; index += 2) {
    const a = scenarios[index];
    const b = scenarios[index + 1];
    if (!b || a.initialSha256 !== b.initialSha256) exactReplayEqual = false;
    for (const [stepIndex, step] of a.steps.entries()) {
      const other = b?.steps[stepIndex];
      if (
        !other ||
        [
          "stepId",
          "status",
          "responseSha256",
          "stableHeadersSha256",
          "beforeSha256",
          "afterSha256",
        ].some((key) => step[key] !== other[key])
      )
        exactReplayEqual = false;
    }
  }
  const bootstrapStatus = status(value.bootstrapStatus);
  const statefulReplayStatus = complete
    ? "PASS"
    : value.statefulReplayStatus === "NOT_RUN"
      ? "NOT_RUN"
      : "FAIL";
  return {
    phpVersion,
    sqliteVersion,
    extensions,
    licenseSha256: sha(value.licenseSha256),
    executedChecks: checks,
    scenarioIds: [...new Set(scenarios.map((entry) => entry.scenarioId))],
    executedStepIds: scenarios.flatMap((scenario) =>
      scenario.steps.map(
        (step) =>
          `${scenario.scenarioId}:replay-${scenario.replay}:${step.stepId}`,
      ),
    ),
    replayCount: complete ? 2 : 0,
    scenarios,
    bootstrapStatus,
    statefulReplayStatus,
    exactReplayEqual,
    decision:
      complete &&
      exactReplayEqual &&
      phpVersion &&
      extensions.includes("pdo_sqlite") &&
      bootstrapStatus === "PASS"
        ? "GO"
        : bootstrapStatus === "NOT_RUN"
          ? "BLOCKED"
          : "NO-GO",
  };
}

async function run(args, timeoutMs, maxBytes = 8 * 1024 * 1024) {
  const start = Date.now();
  return await new Promise((accept) => {
    const child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    const append = (target, chunk) => {
      if (stdout.length + stderr.length + chunk.length > maxBytes) {
        timedOut = true;
        child.kill("SIGKILL");
        return;
      }
      if (target === "stdout") stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", () => {
      clearTimeout(timer);
      accept({
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut,
        elapsedMs: Date.now() - start,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      accept({
        exitCode: code,
        stdout,
        stderr,
        timedOut,
        elapsedMs: Date.now() - start,
      });
    });
  });
}

async function download(url, maxBytes) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    headers: { "User-Agent": "Metamorph-independent-qualification" },
  });
  if (!response.ok || !response.body) throw new Error("Pinned download failed");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Pinned download exceeds limit");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function main() {
  const output = resolve("qualification-public");
  await mkdir(output, { recursive: true });
  const scratch = await mkdtemp(join(tmpdir(), "metamorph-php74-private-"));
  const report = {
    scope: "real-PHP-reference-only",
    decision: "BLOCKED",
    imageRef,
    imageDigest: null,
    imageId: null,
    candidates: [],
    infrastructureChecks: [],
    limitations: [
      "Raw HTTP/SQLite evidence remains ephemeral inside private container tmpfs and is destroyed after the run; no external private evidence store is configured.",
      "No candidate TS, product G0-G4 acceptance, concurrency qualification, model calls or benchmark registration.",
      "UUID/time/random values remain intact; no scoped metamorphic invariant has independent owner approval.",
    ],
    evidenceProvenance: {
      runUrl: process.env.GITHUB_RUN_ID
        ? `https://github.com/Meta-Project2026/Metamorph/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
      headSha: process.env.QUALIFICATION_HEAD_SHA ?? null,
      runner:
        process.env.GITHUB_ACTIONS === "true"
          ? "GitHub-hosted Ubuntu 24.04"
          : process.platform,
      collectedAt: new Date().toISOString(),
      rawRetention: "ephemeral-container-tmpfs-only",
      summaryKind: "allowlisted-structural-metadata-and-hashes",
    },
    blockers: [],
  };
  let imageId;
  const record = async (id, args, timeoutMs) => {
    const result = await run(args, timeoutMs);
    report.infrastructureChecks.push({
      id,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      elapsedMs: result.elapsedMs,
      privateOutputSha256: createHash("sha256")
        .update(result.stdout + result.stderr)
        .digest("hex"),
    });
    if (result.exitCode !== 0) throw new Error(id);
    return result;
  };
  try {
    await record("docker-version", ["version"], 15000);
    await record("docker-info", ["info"], 15000);
    await record("php74-image-pull", ["pull", imageRef], 180000);
    const base = JSON.parse(
      (
        await record(
          "php74-image-inspect",
          ["image", "inspect", imageRef],
          10000,
        )
      ).stdout,
    )[0];
    report.imageDigest =
      base.RepoDigests.find((value) =>
        /^php@sha256:[a-f0-9]{64}$/.test(value),
      ) ?? null;
    if (!report.imageDigest) throw new Error("image-digest-missing");
    await record(
      "trusted-extension-image-build",
      [
        "build",
        "--build-arg",
        `PHP_IMAGE=${report.imageDigest}`,
        "-f",
        join(probeRoot, "Dockerfile"),
        "-t",
        "metamorph-php74-qualification",
        probeRoot,
      ],
      300000,
    );
    imageId = JSON.parse(
      (
        await record(
          "trusted-image-inspect",
          ["image", "inspect", "metamorph-php74-qualification"],
          10000,
        )
      ).stdout,
    )[0].Id;
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId))
      throw new Error("image-id-invalid");
    report.imageId = imageId;
    for (const source of sources) {
      const candidate = {
        sourceRepo: source.sourceRepo,
        sourceCommit: source.sourceCommit,
        license: "MIT",
        attribution: source.attribution,
        sourceArchiveSha256: null,
        phpVersion: null,
        imageRef,
        imageDigest: report.imageDigest,
        imageId,
        runtime: "restricted-offline-Docker-PHP74",
        executedChecks: [],
        scenarioIds: [],
        executedStepIds: [],
        replayCount: 0,
        bootstrapStatus: "NOT_RUN",
        statefulReplayStatus: "NOT_RUN",
        decision: "BLOCKED",
        blockers: [],
        nondeterminismNotes:
          source.mode === "examsuite"
            ? [
                "UUID random_bytes: metamorphic-check-required",
                "ORDER BY RANDOM question selection/order: metamorphic-check-required",
                "SQLite datetime(now): metamorphic-check-required",
              ]
            : [
                "Asia/Dhaka and explicit future appointment dates: controlled",
                "SQLite CURRENT_TIMESTAMP creation fields: metamorphic-check-required",
                "Appointment ids after fresh reset: deterministic",
              ],
      };
      report.candidates.push(candidate);
      try {
        const license = await download(
          `https://raw.githubusercontent.com/${source.repo}/${source.sourceCommit}/LICENSE`,
          65536,
        );
        if (
          !license.toString().includes("MIT License") ||
          !license.toString().includes(source.attribution)
        )
          throw new Error("pinned-license-mismatch");
        const licenseHash = createHash("sha256").update(license).digest("hex");
        const archive = await download(
          `https://codeload.github.com/${source.repo}/tar.gz/${source.sourceCommit}`,
          10 * 1024 * 1024,
        );
        candidate.sourceArchiveSha256 = createHash("sha256")
          .update(archive)
          .digest("hex");
        const archivePath = join(scratch, `${source.mode}.tgz`);
        await writeFile(archivePath, archive, { mode: 0o644 });
        const name = `mmp005-${source.mode}-${process.pid}`;
        let execution;
        try {
          execution = await run(
            [
              "run",
              "--rm",
              "--name",
              name,
              "--network",
              "none",
              "--read-only",
              "--cap-drop",
              "ALL",
              "--security-opt",
              "no-new-privileges",
              "--cpus",
              "1",
              "--memory",
              "256m",
              "--memory-swap",
              "256m",
              "--pids-limit",
              "64",
              "--user",
              "65534:65534",
              "--tmpfs",
              "/work:rw,noexec,nosuid,nodev,size=96m,uid=65534,gid=65534",
              "--tmpfs",
              "/tmp:rw,noexec,nosuid,nodev,size=16m",
              "--mount",
              `type=bind,source=${archivePath},target=/input/source.tgz,readonly`,
              "--mount",
              `type=bind,source=${join(probeRoot, "replay.php")},target=/probe/replay.php,readonly`,
              "--entrypoint",
              "timeout",
              imageId,
              "--signal=KILL",
              "180",
              "php",
              "/probe/replay.php",
              source.mode,
            ],
            195000,
          );
        } finally {
          await run(["rm", "--force", name], 10000);
        }
        candidate.containerExitCode = execution.exitCode;
        candidate.executedChecks.push({
          id: "restricted-container-replay",
          exitCode: execution.exitCode,
          elapsedMs: execution.elapsedMs,
          timedOut: execution.timedOut,
        });
        if (execution.exitCode !== 0) {
          candidate.blockers.push("restricted-container-execution-error");
          continue;
        }
        const sanitized = sanitizeResult(
          JSON.parse(execution.stdout),
          source.mode,
        );
        if (sanitized.licenseSha256 !== licenseHash)
          throw new Error("archive-license-mismatch");
        Object.assign(candidate, sanitized, {
          executedChecks: [
            ...candidate.executedChecks,
            ...sanitized.executedChecks,
          ],
        });
        if (candidate.decision === "GO") break;
        // Fallback only after factual primary execution (failure or exact replay mismatch).
      } catch {
        candidate.blockers.push("probe-download-or-structured-evidence-error");
      }
    }
    report.decision = report.candidates.some(
      (candidate) => candidate.decision === "GO",
    )
      ? "GO"
      : report.candidates.length > 0 &&
          report.candidates.every((candidate) => candidate.decision === "NO-GO")
        ? "NO-GO"
        : "BLOCKED";
  } catch {
    const failed = report.infrastructureChecks.find(
      (check) => check.exitCode !== 0,
    );
    report.blockers.push(
      failed ? failed.id : "runtime-preparation-or-identity-error",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
    await writeFile(
      join(output, "qualification-summary.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    // Only a constant enum and controlled summary path enter public logs.
    console.log(
      `Reference qualification decision: ${report.decision}; sanitized summary: qualification-public/qualification-summary.json`,
    );
  }
  if (report.decision === "BLOCKED") process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
