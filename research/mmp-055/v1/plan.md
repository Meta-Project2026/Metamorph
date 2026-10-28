# Implementation plan v1

1. Define independent receipt identity, admission budgets and Linux descriptor-
   pinned filesystem primitives. Preserve upstream source and compare semantics.
2. Inspect bounded sealed packs and exact root catalog. Independently witness
   before encryption; authenticated binary container and immutable local versions.
3. Separate reader verifies prior signed catalog/storage witnesses, AEAD and
   exact archive/index, restricted recovery delegation and safe outputs.
4. Append-only journal API with external checkpoints; deterministic synthetic
   retention/hold/day90/deletion tests, independent reader process and OS denial.
5. Execute fast checks and targeted Linux tests; publish scoped PR for independent
   ChatGPT review. No self-approval/merge, Issue #55 deployment closure or real G4.

Dependency: #26 / merged #59 is present at base. #54 / merged #62 establishes
public execution only. #56 receives an additive versioned interface proposal;
agreement/integration is pending, not fabricated by this implementation.
