// Explicit opt-in corrected offline replay. The historical replayProvider stays pinned.
import { ModelResponseSchema } from "../../packages/agent/dist/index.js";
import { DEFECT } from "../../packages/agent-real/src/source.mjs";

export function correctedReplay(bundle) {
  const main = bundle.files.find((f) => f.path === "src/main.ts");
  if (main?.content.split(DEFECT).length !== 2) throw Error("REPLAY_MUTATION");
  let calls = 0;
  return Object.freeze({
    billing: "synthetic",
    maxRequestCostUsd: 0,
    async generate(request, signal) {
      signal.throwIfAborted();
      if (
        request.unitId !== "workshop" ||
        ++calls > 2 ||
        request.attempt !== calls ||
        request.action !== (calls === 1 ? "generate" : "repair")
      )
        throw Error("REPLAY_SEQUENCE");
      return ModelResponseSchema.parse({
        changes: bundle.files.map(({ path, content }) => ({
          path,
          content:
            calls === 1 && path === "src/main.ts"
              ? content.replace(
                  DEFECT,
                  "// Original public negative control: cancellation is a no-op.",
                )
              : content,
        })),
        usage: {
          requestId: `mmp049-offline-${calls}`,
          provider: "offline-deterministic-replay",
          modelId: "public-workshop-compat-v1-replay",
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          estimatedCostUsd: 0,
          durationMs: 0,
        },
      });
    },
  });
}
