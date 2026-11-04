import { createCipheriv, createHash } from "node:crypto";
import { digest, requireThat } from "./validation.mjs";

// AES-CTR is used as a deterministic stream only for replaying this synthetic
// draw. Its 256-bit key is generated after DRAW_STARTED and kept private.
const IV = createHash("sha256")
  .update("MMP-056-SAMPLER-STREAM-V1\0")
  .digest()
  .subarray(0, 16);
const ZERO_WORD = Buffer.alloc(4);
const WORD_SPACE = 2 ** 32;

export function syntheticSample(registration, entropy) {
  digest(entropy);
  const stream = createCipheriv("aes-256-ctr", Buffer.from(entropy, "hex"), IV);
  function below(bound) {
    const ceiling = Math.floor(WORD_SPACE / bound) * bound;
    for (let i = 0; i < 1024; i++) {
      const word = stream.update(ZERO_WORD).readUInt32BE(0);
      if (word < ceiling) return word % bound;
    }
    throw new Error("SYNTHETIC_RANDOM_STREAM_EXHAUSTED");
  }
  const selected = [];
  for (const stratum of registration.policy.strata) {
    const pool = registration.pool.filter(
      (entry) => entry.stratum === stratum.id,
    );
    const mandatory = pool
      .filter((entry) =>
        registration.policy.mandatoryCaseIds.includes(entry.id),
      )
      .map((entry) => entry.id);
    const optional = pool
      .filter(
        (entry) => !registration.policy.mandatoryCaseIds.includes(entry.id),
      )
      .map((entry) => entry.id);
    for (let i = optional.length - 1; i > 0; i--) {
      const j = below(i + 1);
      requireThat(j >= 0 && j <= i, "SYNTHETIC_RANDOM_INVALID");
      [optional[i], optional[j]] = [optional[j], optional[i]];
    }
    selected.push(
      ...mandatory,
      ...optional.slice(0, stratum.count - mandatory.length),
    );
  }
  return selected;
}
