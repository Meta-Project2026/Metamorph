// Trusted synthetic unit tests only. No PHP, candidate source, corpus, model,
// network, Docker socket or host credentials. Run the pinned Node image read-only
// with /tmp tmpfs. Dependencies/dist must first be built on the trusted host.
import { cpSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
const source = "/source";
const work = "/tmp/mmp055-test-code";
mkdirSync(join(work, "packages"), { recursive: true });
for (const name of ["contracts", "oracle", "differential", "evidence-retention"]) {
  cpSync(join(source, "packages", name), join(work, "packages", name), { recursive: true, filter: (path) => basename(path) !== "node_modules" });
}
mkdirSync(join(work, "node_modules", "@metamorph"), { recursive: true });
for (const name of ["contracts", "oracle"]) symlinkSync(join(work, "packages", name), join(work, "node_modules", "@metamorph", name));
const zod = readdirSync(join(source, "node_modules", ".pnpm")).filter((n) => /^zod@/.test(n));
if (zod.length !== 1) throw new Error("EXPECTED_ONE_FROZEN_ZOD_DEPENDENCY");
cpSync(join(source, "node_modules", ".pnpm", zod[0], "node_modules", "zod"), join(work, "node_modules", "zod"), { recursive: true });
process.chdir(work);
const tests = readdirSync(join(work, "packages", "evidence-retention", "test")).filter((n) => n.endsWith(".test.mjs")).map((n) => join(work, "packages", "evidence-retention", "test", n));
const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit", env: {}, timeout: 180_000 });
process.exitCode = result.status ?? 1;
