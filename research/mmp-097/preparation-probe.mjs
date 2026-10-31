// Trusted preparation only: no candidate/reference business execution or raw output.
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readPrivateJson } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { createEnvironment } from "../../packages/agent-real/src/runtime.mjs";

export function validationPreparation(parent, headSha) {
  const reports = [];
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^oracle-[a-zA-Z0-9_-]+$/.test(entry.name))
      continue;
    const directory = join(parent, entry.name);
    const provenance = readPrivateJson(
      join(directory, "provenance.json"),
    ).value;
    if (
      provenance.headSha !== headSha ||
      !provenance.source ||
      !provenance.manifestSha
    )
      continue;
    const index = readPrivateJson(join(directory, "index.json")).value;
    for (const record of index.entries) {
      if (!/^diagnostic-[0-9]+$|^record-[0-9]+-runtime$/.test(record.id))
        continue;
      const value = readPrivateJson(join(directory, `${record.id}.json`)).value;
      const receipt = record.id.startsWith("diagnostic-")
        ? value
        : value.receipt;
      const command = record.id.startsWith("diagnostic-")
        ? "PHP_PREPARATION"
        : [
              "image-build.json",
              "image-inspect.json",
              "runtime-provenance.json",
              "provenance-cleanup.json",
            ].includes(value.name)
          ? value.name
          : "TRUSTED_PREPARATION";
      const result = {
        command,
        exitCode: receipt.exitCode ?? null,
        timedOut:
          receipt.timedOut === true || receipt.fault === "WORKER_TIMEOUT",
      };
      if (receipt.exitCode !== 0) {
        const stderr = receipt.stderrBase64
          ? Buffer.from(receipt.stderrBase64, "base64").toString()
          : (receipt.stderr ?? "");
        result.category = /permission denied/i.test(stderr)
          ? "PERMISSION_DENIED"
          : /buildx|buildkit|plugin/i.test(stderr)
            ? "BUILD_PLUGIN_ERROR"
            : /network|connection|certificate|TLS/i.test(stderr)
              ? "NETWORK_ERROR"
              : "PROCESS_ERROR";
      }
      reports.push(result);
    }
  }
  return reports;
}

export async function preparationProbe(root, parent, headSha) {
  mkdirSync(parent, { mode: 0o700 });
  const report = { status: "ERROR", commands: [] };
  let context;
  try {
    context = createEnvironment(root, parent, headSha);
    await context.prepare(AbortSignal.timeout(8 * 60 * 1000));
    report.status = "PASS";
  } catch (error) {
    const allowed = [
      "ENVIRONMENT_ERROR",
      "SOURCE_DOWNLOAD",
      "SOURCE_DIGEST",
      "SOURCE_LIMIT",
      "IMAGE_DIGEST",
      "EVIDENCE_PERMISSIONS",
      "EVIDENCE_PUBLIC_ROOT",
      "COMMAND_PULL_ERROR",
      "COMMAND_BUILD_ERROR",
      "WORKER_TIMEOUT",
      "WORKER_ABORTED",
      "DOCKER_UNAVAILABLE",
      "EVIDENCE_WRITE_ERROR",
    ];
    report.cause = allowed.includes(error.code)
      ? error.code
      : "PREPARATION_ERROR";
    // Trusted code frame numbers only; never error message or absolute path.
    const frames = String(error.stack ?? "")
      .split("\n")
      .slice(1, 6)
      .map((line) =>
        /(?:runtime\.mjs|docker\.js|process\.js|runtime-broker\.mjs|evidence\.js):([0-9]+):([0-9]+)/.exec(
          line,
        ),
      )
      .filter(Boolean);
    report.trustedFrameLines = frames.map((m) => Number(m[1]));
  } finally {
    if (context) {
      try {
        const completion = await context.finish();
        report.cleanup = {
          status: completion.cleanup,
          inventory: completion.inventory,
          emergencyRemoved: completion.emergencyRemoved,
        };
        const path = join(parent, completion.provenancePack.id);
        const index = readPrivateJson(join(path, "index.json")).value;
        for (const entry of index.entries) {
          if (!/^diagnostic-[0-9]+$|^record-[0-9]+-runtime$/.test(entry.id))
            continue;
          const value = readPrivateJson(join(path, `${entry.id}.json`)).value;
          const receipt = entry.id.startsWith("diagnostic-")
            ? value
            : value.receipt;
          const name = entry.id.startsWith("diagnostic-")
            ? "PHP_PREPARATION"
            : [
                  "image-build.json",
                  "image-inspect.json",
                  "runtime-provenance.json",
                  "provenance-cleanup.json",
                ].includes(value.name)
              ? value.name
              : "TRUSTED_PREPARATION";
          const row = {
            command: name,
            exitCode: receipt.exitCode ?? null,
            timedOut:
              receipt.timedOut === true || receipt.fault === "WORKER_TIMEOUT",
          };
          if (receipt.fault)
            row.fault = [
              "WORKER_TIMEOUT",
              "WORKER_ABORTED",
              "WORKER_OUTPUT_LIMIT",
              "DOCKER_UNAVAILABLE",
            ].includes(receipt.fault)
              ? receipt.fault
              : "PROCESS_ERROR";
          const stderr = receipt.stderrBase64
            ? Buffer.from(receipt.stderrBase64, "base64").toString()
            : (receipt.stderr ?? "");
          if (
            receipt.exitCode !== 0 &&
            /toomanyrequests|pull rate limit/i.test(stderr)
          )
            row.publicToolCategory = "REGISTRY_RATE_LIMIT";
          else if (
            receipt.exitCode !== 0 &&
            /manifest unknown|not found|failed to resolve/i.test(stderr)
          )
            row.publicToolCategory = "PUBLIC_DEPENDENCY_UNAVAILABLE";
          else if (receipt.exitCode !== 0 && /permission denied/i.test(stderr))
            row.publicToolCategory = "PERMISSION_DENIED";
          else if (receipt.exitCode !== 0 && /timeout|timed out/i.test(stderr))
            row.publicToolCategory = "TIMEOUT";
          else if (
            receipt.exitCode !== 0 &&
            /network|connection|certificate|TLS/i.test(stderr)
          )
            row.publicToolCategory = "PUBLIC_TOOL_NETWORK_ERROR";
          report.commands.push(row);
        }
      } catch {
        report.cleanup = { status: "ERROR" };
        report.status = "ERROR";
      }
    }
  }
  return report;
}
