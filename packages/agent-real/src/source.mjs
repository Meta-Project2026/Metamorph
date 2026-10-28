import { chmodSync } from "node:fs";
import { createCandidateWriter, ModelResponseSchema } from "@metamorph/agent";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { admitDirectory } from "../../target-worker/src/admission.mjs";

export function check(value, code) {
  if (!value) throw Object.assign(new Error(code), { code });
}
const sessions = new WeakSet();
export const isSourceSession = (value) => sessions.has(value);

/** A directory issued here is backed by the unchanged createCandidateWriter.
 * Exclusive host ownership is required; the provider receives no filesystem path. */
export function createSourceSession(parent) {
  const original = createCandidateWriter(parent);
  chmodSync(original.root, 0o700);
  let busy = false;
  let expectedSha;
  const session = {
    writer: Object.freeze({
      root: original.root,
      async write(changes, signal) {
        check(!busy, "SOURCE_BUSY");
        busy = true;
        expectedSha = undefined;
        try {
          await original.write(changes, signal);
          signal.throwIfAborted();
          expectedSha = (await admitDirectory(original.root)).candidateSha;
        } finally {
          busy = false;
        }
      },
    }),
    async acquire(root, signal) {
      signal.throwIfAborted();
      check(root === original.root && !busy && expectedSha, "SOURCE_IDENTITY");
      busy = true;
      try {
        const bundle = await admitDirectory(root, expectedSha);
        signal.throwIfAborted();
        for (const file of bundle.files) Object.freeze(file);
        Object.freeze(bundle.files);
        Object.freeze(bundle);
        let released = false;
        return Object.freeze({
          bundle,
          async assertUnchanged() {
            check(!released, "SOURCE_RELEASED");
            await admitDirectory(root, bundle.candidateSha);
          },
          async release() {
            if (released) return;
            try {
              await admitDirectory(root, bundle.candidateSha);
            } finally {
              released = true;
              busy = false;
            }
          },
        });
      } catch (error) {
        busy = false;
        throw error;
      }
    },
  };
  sessions.add(session);
  return Object.freeze(session);
}

/** Original transparent public mutation: cancel returns success but keeps the row.
 * No private observations or held-out values are involved. */
export const DEFECT =
  'db.prepare("DELETE FROM appointments WHERE id = ?").run(id);';
export async function replayProvider(fixtureRoot, mode) {
  check(["known-good", "repair"].includes(mode), "REPLAY_MODE");
  const fixture = await admitDirectory(fixtureRoot, WORKSHOP_CANDIDATE_SHA);
  check(fixture.files.length === 2, "REPLAY_SOURCE");
  const main = fixture.files.find((file) => file.path === "src/main.ts");
  check(main?.content.split(DEFECT).length === 2, "REPLAY_MUTATION");
  let calls = 0;
  return Object.freeze({
    billing: "synthetic",
    maxRequestCostUsd: 0,
    async generate(request, signal) {
      const started = performance.now();
      signal.throwIfAborted();
      check(request.unitId === "workshop" && ++calls <= 2, "REPLAY_BUDGET");
      check(
        request.attempt === calls &&
          request.action === (calls === 1 ? "generate" : "repair"),
        "REPLAY_SEQUENCE",
      );
      const broken = mode === "repair" && calls === 1;
      return ModelResponseSchema.parse({
        changes: fixture.files.map(({ path, content }) => ({
          path,
          content:
            broken && path === "src/main.ts"
              ? content.replace(
                  DEFECT,
                  "// Public negative control: cancellation is a no-op.",
                )
              : content,
        })),
        usage: {
          requestId: `offline-replay-${calls}`,
          provider: "offline-deterministic-replay",
          modelId: "public-workshop-source-replay-v1",
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          estimatedCostUsd: 0,
          durationMs: performance.now() - started,
        },
      });
    },
  });
}
