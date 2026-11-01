// Research-only trusted instrumentation prototype. No production imports this.
// Stages come from trusted call sites, never exception fields or worker output.
const sides = ["REFERENCE", "CANDIDATE"];
const work = ["RESET", "INITIAL_SNAPSHOT", "REQUEST", "STEP_SNAPSHOT"];
const stages = new Set([
  ...sides.flatMap((side) => [...work, "CLOSE"].map((op) => `${side}_${op}`)),
  "INITIAL_DIFF_WRITE",
  "REFERENCE_HTTP_SERIALIZE",
  "HTTP_COMPARE",
  "HTTP_DIFF_WRITE",
]);

export function createStagePrototype() {
  let primary = null;
  let lastCompleted = null;
  let sealed = false;
  let finalReceipt;
  const cleanupFailures = new Set();
  const fail = (stage, category) => {
    if (sealed) return;
    if (stage.endsWith("_CLOSE")) cleanupFailures.add(stage);
    else primary ??= { stage, category };
  };
  async function observe(stage, signal, operation) {
    if (sealed || !stages.has(stage) || typeof operation !== "function")
      throw new Error("STAGE_PROTOTYPE_CONTRACT");
    const abort = () => fail(stage, "SIGNAL_ABORTED");
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) abort();
      const value = await operation();
      if (!sealed && !signal?.aborted && !stage.endsWith("_CLOSE"))
        lastCompleted = stage;
      return value;
    } catch (error) {
      fail(stage, signal?.aborted ? "SIGNAL_ABORTED" : "OPERATION_REJECTED");
      throw error; // Preserve original semantics; never inspect error properties.
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }
  return Object.freeze({
    observe,
    wrap(side, adapter) {
      if (!sides.includes(side) || sealed)
        throw new Error("STAGE_PROTOTYPE_CONTRACT");
      let snapshots = 0;
      return Object.freeze({
        reset: (signal) =>
          observe(`${side}_RESET`, signal, () => adapter.reset(signal)),
        request: (input, signal) =>
          observe(`${side}_REQUEST`, signal, () =>
            adapter.request(input, signal),
          ),
        snapshot: (signal) => {
          const op = snapshots++ === 0 ? "INITIAL_SNAPSHOT" : "STEP_SNAPSHOT";
          return observe(`${side}_${op}`, signal, () =>
            adapter.snapshot(signal),
          );
        },
        close: (signal) =>
          observe(`${side}_CLOSE`, signal, () => adapter.close(signal)),
      });
    },
    finish(oracleError) {
      if (typeof oracleError !== "boolean")
        throw new Error("STAGE_PROTOTYPE_CONTRACT");
      if (!sealed) {
        // Adapter wrappers cannot identify internal serialization/comparison/IO.
        // Additional trusted runner call sites would need separate API review.
        const failure =
          primary ??
          (oracleError && cleanupFailures.size === 0
            ? { stage: "UNCLASSIFIED_TRUSTED_PIPELINE", category: "UNKNOWN" }
            : null);
        finalReceipt = Object.freeze({
          format: "mmp104-stage-prototype-v1",
          productionWired: false,
          lastCompleted,
          primary: failure ? Object.freeze({ ...failure }) : null,
          cleanupFailures: Object.freeze([...cleanupFailures].sort()),
        });
        sealed = true;
      }
      return finalReceipt;
    },
  });
}
