// Synthetic witness fixture only. Its private signing key is outside source,
// candidate and writer storage. Not a claim of independent human custody.
import { readFileSync, writeFileSync } from "node:fs";
import { bytes } from "../src/core.mjs";
import { witnessCatalog } from "../src/crypto.mjs";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const key = readFileSync(config.signingKeyPath);
try {
  writeFileSync(
    config.outputPath,
    bytes(
      witnessCatalog(
        config.input,
        config.recipients,
        key,
        new Date().toISOString(),
      ),
    ),
    { mode: 0o600, flag: "wx" },
  );
} finally {
  key.fill(0);
}
