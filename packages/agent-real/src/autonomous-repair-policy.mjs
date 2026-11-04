// No credential, network, provider constructor or caller-issued cap in this module.
// single_generation stays the default. generate_then_repair is the signed
// two-attempt plan: both sends are projected and reserved before the first
// POST, and the second POST requires its own admission plus a complete
// eligible public FAIL of the first candidate. The legacy autonomous_repair
// mode stays blocked pending an independent financial guarantee.
export function requireMigrationMode(mode = "single_generation") {
  if (
    mode === "single_generation" ||
    mode === "generate_then_repair" ||
    mode === "generate_then_repair_g1_v2"
  )
    return;
  const code =
    mode === "autonomous_repair"
      ? "BLOCKED_BUDGET_GUARANTEE"
      : "MIGRATION_MODE_BLOCKED";
  throw Object.assign(new Error(code), { code });
}
