import { requireCheck } from "./strict.mjs";
export function validateTargetClock(observation) {
  requireCheck(
    observation.node === "v24.11.0" && observation.sqlite === "3.50.4",
    "CLOCK_PARITY_BLOCKED",
  );
  for (const point of [observation.before, observation.after])
    requireCheck(
      point.date === "2026-10-27T12:00:00.000Z" &&
        point.dateNow === 1793102400000 &&
        point.sqlite.datetime === "2026-10-27 12:00:00" &&
        point.sqlite.timestamp === "2026-10-27 12:00:00",
      "CLOCK_PARITY_BLOCKED",
    );
  const perf =
    observation.after.performanceNow - observation.before.performanceNow;
  const hr =
    Number(
      BigInt(observation.after.hrtime) - BigInt(observation.before.hrtime),
    ) / 1e6;
  requireCheck(
    perf >= 1000 &&
      perf < 8000 &&
      hr >= 1000 &&
      hr < 8000 &&
      Math.abs(perf - hr) < 100 &&
      Math.abs(perf - observation.monotonicDeltaMs) < 1,
    "CLOCK_PARITY_BLOCKED",
  );
}
