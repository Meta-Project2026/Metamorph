import { MANIFEST } from "@metamorph/oracle";
import { requireCheck } from "./strict.mjs";

export const BASE_SHA = "49859eab33d5979336f19dbbf75519f0dc1dcfd2";
export const PUBLIC_CANDIDATE_SHA =
  "67dbb4b31a245ac304ebe7722aa7bfc13d6263001b3eea7e850e92e4edad1af0";
export const SCENARIOS = Object.freeze([MANIFEST[0]]);
export const stepId = (index) => `step-${String(index + 1).padStart(2, "0")}`;
export function checkedScenarios(input) {
  requireCheck(
    Array.isArray(input) && input.length > 0 && input.length <= MANIFEST.length,
    "SCENARIO_SCHEDULE",
  );
  let previous = -1;
  const result = input.map((scenario) => {
    const index = MANIFEST.findIndex((s) => s.id === scenario?.id);
    requireCheck(
      index > previous &&
        JSON.stringify(scenario) === JSON.stringify(MANIFEST[index]),
      "SCENARIO_SCHEDULE",
    );
    previous = index;
    return structuredClone(MANIFEST[index]);
  });
  return result;
}
