# MMP-123 — Insights (bounded observations, not gate outputs)

These are research observations from the recorded verification work. They do
not change gate verdicts, do not claim parity, and do not establish a product.

1. **Typed-boundary gap between generated TS and the node:sqlite value union.**
   The first draft's only compile failure is a single TS2345 at
   `src/config.ts:100:41`: `row["cnt"]` (from `SELECT COUNT(*)`). Under the
   pinned environment, `node:sqlite` row values are typed to include
   `Uint8Array` (BLOBs), while the generated `phpCastInt` parameter union
   (`string | number | bigint | null | undefined`) omitted exactly that case.
   One typedef-level widening handles it. This is a precise, reproducible
   model-behavior data point: a near-complete strict-mode TS port failing at
   exactly the intersection of a typed API surface and PHP scalar-cast
   semantics.

2. **PHP `(int)` semantics can absorb a BLOB through its string form.** The
   repair casts `Uint8Array` bytes via their UTF-8 decoding into the existing
   leading-numeric `phpInt` rule. Invalid UTF-8 decodes non-fatally to U+FFFD
   replacement characters, which parse as 0 — matching PHP's lenient
   leading-numeric cast on arbitrary bytes; this is a documented semantic
   approximation via `TextDecoder` (non-fatal mode), not a byte-exact PHP
   runtime.

3. **Executor-prefix behavior makes aggregate coverage honest by design.** The
   unchanged verifier stops at the first pair that ends in G1 FAIL: 1 of 6 G1
   gate tests executed and G2/G3 never ran. Recording 1/6, 0/17, 0/20 as
   INCONCLUSIVE/MISSING_COVERAGE — instead of treating an unexecuted gate as
   failed or skipped-as-trivially-true — is exactly the distinction the G0–G4
   design intends. Case `PASS` (execution integrity) and candidate `FAIL`
   (gate verdict) coexisting in one receipt is not a contradiction.

4. **First-draft + separately-committed single repair preserves custody.**
   Copy-then-edit verified by admission byte-identity before the edit
   (reproducing `4ff450d2...`) means the first-draft provenance record stays
   true forever, even though the recorded G1 verdict came *after* the freeze.
   The repair is labeled "GLM 5.3 first draft + Sol 6.1 repair" — never
   GLM-only — and the continuation model is truthfully recorded as
   `glm-5.3-flash-free` (same family permitted by the card; platform-level
   model independence is NOT_VERIFIED).

5. **Host-side harness corrections are a real risk class.** Five fail-closed
   cycles occurred before any recorded evidence existed: MSYS-to-Windows
   path-arg rewriting silently corrupting mount strings, a linked worktree's
   `/repo/.git` link-file unusable under Linux git, CRLF shebangs failing
   inside the image, and an over-strict "known-good" assumption (copied
   semantics for when execution stops). The correction pattern that worked:
   fail closed on anything suspicious, correct the *harness*, and let earlier
   failed cycles publish no receipts — so only a clean run can ever enter the
   evidence tree. None of these cycles evaluated the candidate, and the
   recorded result is unaffected by them.

6. **Admission as a custody instrument.** `admitDirectory()` is small, has no
   non-Node dependencies, and reproduces the same SHA from the same bytes
   anywhere (freeze day, continuation day, copy-before-edit check, driver
   runtime). Pinning the repair unit the same way — rather than pinning a
   diff or narrative description — keeps the draft→repair chain auditable
   without trusting any prose.

7. **One pair of scenarios never yields a parity conclusion.** With 0 HTTP and
   0 SQLite scenarios executed for the first draft, any statement about
   HTTP/SQLite parity is unsupported, and the only claim allowed is the G1
   finding itself. This result is not comparable to any benchmark aggregate;
   no benchmark selection is proposed here.

8. **The repair chain closed the compile gap but stayed honest at every
   hop.** The single authorized unit proceeded exactly as admission-pinned:
   the repair run's receipt links `candidatePin 0cf5ba0b...` with
   `firstDraftCandidatePin 4ff450d2...`, and its compiler projection records
   `g1Verdict PASS` with `errorCount null` — the first draft's `TS2345`
   failure is gone and typecheck plus build themselves completed. But G1 had
   6 member checks and only 2 executed (`BUILD_NOT_RUN`), so the honest
   aggregate stays INCONCLUSIVE, not PASS: a pinned fix that is believed to
   work is still not a closed gate.

9. **`ERROR` is preserved as its own verdict, distinct from `FAIL`.** The
   repair run's G2/G3 recorded `VERIFIER_ERROR` with public receipts carrying
   only categorical projections — raw failure content never crosses into
   evidence. Nothing in the public record distinguishes a verifier-side
   environment fault from candidate-triggered behavior, so no such claim is
   made; the C2C-style answer is to report `ERROR`, keep partial coverage
   honest (sqlite 1/20, http 0/17), and de-scope further claims. Combined
   with the card's one-repair rule, this means the work *documents* the end
   state instead of chasing it: draft proven FAIL, repair INCONCLUSIVE
   forward, product NEVER established outside separately authorized
   milestone work.
