// Independently reopen the private ledger, not a prior cleanup/PASS receipt.
import { join } from "node:path";
import { G0Docker } from "./docker.mjs";
import { privatePath, readPrivateJson, validateLedger } from "./evidence.mjs";
import { check } from "./policy.mjs";

export async function finalizeLedger(root, sink, expectedRunId) {
  privatePath(root, true);
  const ledger = validateLedger(readPrivateJson(join(root, "ledger.json")));
  check(ledger.runId === expectedRunId, "G0_OWNERSHIP");
  const adapter = new G0Docker(ledger.runId, sink, { owner: ledger.owner });
  adapter.ledger = ledger.resources;
  return adapter.finalize();
}
