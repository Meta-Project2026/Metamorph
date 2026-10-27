// Trusted recipe. Candidate controls only TS bytes, never this process invocation.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const files = JSON.parse(readFileSync(0, "utf8"));
for (const file of files) {
  if (!/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(file.path))
    throw new Error("PATH");
  mkdirSync(dirname(`/work/${file.path}`), { recursive: true });
  writeFileSync(`/work/${file.path}`, file.content, { flag: "wx" });
}
const args = [
  "--target",
  "ES2022",
  "--module",
  "NodeNext",
  "--moduleResolution",
  "NodeNext",
  "--strict",
  "--noEmitOnError",
  "--skipLibCheck",
  "false",
  "--rootDir",
  "/work/src",
  "--outDir",
  "/work/out",
  "--typeRoots",
  "/opt/toolchain/node_modules/@types",
  ...files.map((f) => `/work/${f.path}`),
];
const checks = [];
for (const phase of ["typecheck", "build"]) {
  const result = spawnSync(
    "/usr/local/bin/node",
    [
      "/opt/toolchain/node_modules/typescript/lib/tsc.js",
      ...args,
      ...(phase === "typecheck" ? ["--noEmit"] : []),
    ],
    {
      timeout: 12000,
      maxBuffer: 512 * 1024,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", TZ: "UTC" },
    },
  );
  checks.push({
    phase,
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.code ?? null,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  });
  if (result.status !== 0) {
    console.log(JSON.stringify({ checks, artifacts: [] }));
    process.exit(2);
  }
}
const artifacts = [];
function collect(root, prefix = "") {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) collect(`${root}/${entry.name}`, `${path}/`);
    else {
      const bytes = readFileSync(`${root}/${entry.name}`);
      artifacts.push({
        path,
        base64: bytes.toString("base64"),
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
}
collect("/work/out");
console.log(JSON.stringify({ checks, artifacts }));
