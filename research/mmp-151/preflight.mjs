// Offline refusal only. CLI arguments and environment cannot grant paid access.
import { requireMigrationMode } from "../../packages/agent-real/src/autonomous-repair-policy.mjs";
try { requireMigrationMode("autonomous_repair"); }
catch {
  console.log(JSON.stringify({ mode: "autonomous_repair", status: "BLOCKED_BUDGET_GUARANTEE",
    paidRequests: 0, chargedCostUsd: null, product: "NOT_ESTABLISHED" }));
  process.exitCode = 1;
}
