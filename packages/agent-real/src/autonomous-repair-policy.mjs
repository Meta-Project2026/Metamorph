// No credential, network, provider constructor or caller-issued cap in this module.
export function requireMigrationMode(mode = "single_generation") {
  if (mode === "single_generation") return;
  const code =
    mode === "autonomous_repair"
      ? "BLOCKED_BUDGET_GUARANTEE"
      : "MIGRATION_MODE_BLOCKED";
  throw Object.assign(new Error(code), { code });
}
