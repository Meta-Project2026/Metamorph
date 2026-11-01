// Trusted Linux harness projection. Never exports source, ciphertext or TEST keys.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const parent = process.env.MMP115_PRIVATE,
  output = process.env.MMP115_OUTPUT;
if (
  process.platform !== "linux" ||
  !parent ||
  !output ||
  resolve(parent) !== parent ||
  resolve(output) !== output ||
  process.env.MODEL_API_KEY ||
  process.env.GH_TOKEN
)
  throw new Error("OFFLINE_HARNESS_REJECTED");
mkdirSync(join(parent, "tests"), { mode: 0o700 });
const factsPath = join(parent, "facts.jsonl");
const child = spawnSync(
  process.execPath,
  ["--test", "research/mmp-115/real-age.test.mjs"],
  {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME: "/nonexistent",
      TZ: "UTC",
      MMP115_TEST_PARENT: join(parent, "tests"),
      MMP115_TOOL_ROOT: join(parent, "tools/mmp089-tools"),
      MMP115_FACTS: factsPath,
    },
    timeout: 180000,
    maxBuffer: 1024 * 1024,
    encoding: "utf8",
  },
);
writeFileSync(
  join(parent, "age-tests.log"),
  `${child.stdout ?? ""}${child.stderr ?? ""}`,
  { mode: 0o600 },
);
const cases = existsSync(factsPath)
  ? readFileSync(factsPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((s) => JSON.parse(s))
  : [];
const ok =
  child.status === 0 &&
  !child.error &&
  !child.signal &&
  cases.length === 3 &&
  new Set(cases.map((c) => c.id)).size === 3 &&
  cases.every((c) => c.status === "PASS");
const record = {
  format: "mmp115-offline-age-proof-v1",
  headSha: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  node: process.version,
  platform: process.platform,
  status: ok ? "PASS" : "ERROR",
  cases,
  actualCrypto: "PINNED_AGE_V1_3_2",
  liveGithubTransport: "NOT_RUN",
  ownerPrivateIdentity: "NOT_USED",
  externalModelRequests: 0,
  product: "NOT_ESTABLISHED",
};
writeFileSync(
  join(output, "summary.json"),
  `${JSON.stringify(record, null, 2)}\n`,
  { mode: 0o644 },
);
console.log(
  `MMP115_OFFLINE_${record.status}; cases=${cases.length}; modelRequests=0; liveTransport=NOT_RUN`,
);
process.exitCode = ok ? 0 : 1;
