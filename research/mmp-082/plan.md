# MMP-082 bounded implementation plan

Issue: <https://github.com/Meta-Project2026/Metamorph/issues/82>.
Base: `d21376747c7147043ca618e149fac87c0df80111` (fetched main).
Scope: trusted agent-side observability, tests, manual public Docker proof, report.
The root constitution remains PROPOSED / PENDING OWNER RATIFICATION.

Acceptance: after the existing recipe/envelope/phase checks, declassify only
bounded TS codes and positions in the exact admitted candidate. Keep the G1
receipt, gate schemas, fixed finding-code allowlist and repair feedback unchanged.
Publish a separately versioned block bound to public source, candidate, attempt,
pair and build verdict. Never publish messages, excerpts, private packs or raw
generated candidate source. Unsafe/ambiguous input is DIAGNOSTIC_UNAVAILABLE.

- [x] Audit current main and original public failed trial without model requests.
- [x] Implement bounded parser and explicit publication sidecar.
- [x] Test hostile, incomplete, multiline, ANSI, Unicode, path, identity and size cases.
- [x] Keep recipe, source, manifest, comparator, budgets and paid admission unchanged.
- [x] Evaluate optional post-response compile: existing secret-free Docker validator
      already does it; add no duplicate host compiler or second G1 authority.
- [x] Execute all four local fast checks and original boundary suites; record skips.
- [ ] Execute original public positive/negative Docker controls and final inventory.
- [ ] Exercise new compiler sidecar through the actual generated-candidate validator
      with an explicitly synthetic original candidate, never a new model generation.
- [ ] Record exact results, push and open PR; independent review remains external.

No Meta GET/POST, paid workflow dispatch, rerun, candidate repair/regeneration,
secret read, owner permission change, merge or product acceptance is authorized.
