import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const hashes = {};
for (const name of readdirSync("/opt/worker").filter((name) =>
  name.endsWith(".mjs"),
))
  hashes[name] = createHash("sha256")
    .update(readFileSync(`/opt/worker/${name}`))
    .digest("hex");
for (const name of ["package.json", "package-lock.json"])
  hashes[name] = createHash("sha256")
    .update(readFileSync(`/opt/toolchain/${name}`))
    .digest("hex");
console.log(
  JSON.stringify({
    node: process.version,
    sqlite: process.versions.sqlite,
    typescript: JSON.parse(
      readFileSync("/opt/toolchain/node_modules/typescript/package.json"),
    ).version,
    faketime: execFileSync(
      "dpkg-query",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: dpkg format, not JS interpolation.
      ["-W", "-f=${Version}", "libfaketime"],
      { encoding: "utf8" },
    ),
    clockPolicy: "libfaketime-real-monotonic-v1",
    hashes,
  }),
);
