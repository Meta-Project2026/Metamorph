import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const artifacts = JSON.parse(readFileSync(0, "utf8"));
for (const file of artifacts) {
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(file.path))
    throw new Error("ARTIFACT_PATH");
  const path = `/work/out/${file.path}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(file.base64, "base64"), { flag: "wx" });
}
const child = spawn(
  "/usr/local/bin/node",
  [
    "--max-old-space-size=96",
    "--permission",
    "--allow-fs-read=/work/out/",
    "--allow-fs-read=/state/",
    "--allow-fs-write=/state/",
    "/work/out/main.js",
  ],
  {
    stdio: "inherit",
    env: {
      PATH: "/usr/local/bin:/usr/bin:/bin",
      TZ: "UTC",
      ...(process.env.LD_PRELOAD
        ? {
            LD_PRELOAD: process.env.LD_PRELOAD,
            FAKETIME: process.env.FAKETIME,
            FAKETIME_DONT_FAKE_MONOTONIC: "1",
          }
        : {}),
    },
  },
);
child.on("exit", (code, signal) => {
  console.error(JSON.stringify({ candidateExitCode: code, signal }));
  process.exit(code ?? 128);
});
