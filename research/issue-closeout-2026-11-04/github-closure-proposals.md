# Ready-to-post GitHub closure comments (PROPOSALS — PENDING INDEPENDENT REVIEW)

These are the exact comment texts proposed for #115, #125, #167. Per protocol the
**independent reviewer**, not the executor, decides whether to post/close; the
executor has not closed any issue. No closing keywords are used anywhere. Each
comment is `PENDING INDEPENDENT REVIEW` until the reviewer acts on the Draft PR at
its exact reviewed HEAD.

---

## Proposed comment — #115

> **Closeout proposal (docs-only): `completed` — scoped to production candidate-only custody.** PENDING INDEPENDENT REVIEW; drafted in the closeout ledger (Draft PR links from the audit branch; evidence ledger `research/issue-closeout-2026-11-04/`).
>
> Basis, each inside its own evidence boundary: implementation merged after independent exact-SHA security review (PR #117, SCOPED_MERGE_GO, review #5731067024); operational gate-by-gate ledger merged (PR #133, review #5739681601); live production capture → age encryption → pre-Oracle finalizer 0/0/0 → authenticated artifact upload **and** exact-ID readback executed in real paid run [#41505679809](https://github.com/Meta-Project2026/Metamorph/actions/runs/41505679809) (candidate `6140dbed…`, artifact 13169609004, ciphertext SHA `1afcc2a0…`, 31094 bytes) and repeated in run #41856569137 (artifact 13338306385, cleanups 0/0/0); and `OWNER_RESTORE_PASS` for artifact 13169609004 is **owner-reported** (2026-11-02, above), not reviewer-rerun.
>
> Scope guards: this is not G0/G4 PASS, not the formal dual-domain 180-day durability of #55/#57, not product acceptance (#61 NOT_ESTABLISHED), and not a claim that GitHub artifacts are private or revocable. Historical verdicts (custody-unavailable, G2/G3 FAIL, G1 ERROR runs) stand unchanged. #134 stays OPEN: `packages/differential/src/workshop-finalizer.mjs` at main `95397bbf` still deletes by name-prefix without per-run owner-label verification.

---

## Proposed comment — #125

> **Closeout proposal (docs-only): `not_planned` — superseded.** PENDING INDEPENDENT REVIEW; drafted in the closeout ledger `research/issue-closeout-2026-11-04/` (Draft PR from the audit branch).
>
> The planned second-run diagnostic of the frozen GLM candidate `0cf5ba0b…` is no longer needed for the project's present goal: authentic run [#41856569137](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137) at exact `main@95397bbf` achieved the first genuine model-generated public Oracle PASS (**G1 6/6, G2 17/17, G3 20/20**, `COMPLETE_PUBLIC_PASS`, zero repair POSTs), so the HTTP+SQLite path is now directly proven. Dependency check at that SHA: nothing under `packages/` or `.github/workflows/` references `mmp-125`; the diagnostic modules are research-only.
>
> Preserved: the historical `0/17, 1/20` VERIFIER_ERROR cause, failed side and error class remain **UNKNOWN** — nothing here identifies or fixes them, and the GLM candidate stays neither exonerated nor convicted (`NOT_REPRODUCED`). The consumed `ERROR_ENVIRONMENT` attempt stands. **#134 stays OPEN and untouched**: the shared `workshop-finalizer.mjs` still force-deletes by broad name prefix without owner-label verification (source-inspected at `95397bbf`), a separate P0 decision gate for both owners.

---

## Proposed comment — #167

> **Closeout proposal (docs-only): `not_planned` — superseded by #176.** PENDING INDEPENDENT REVIEW; drafted in the closeout ledger `research/issue-closeout-2026-11-04/` (Draft PR from the audit branch).
>
> Accounting of #167 deliverables, all merged: build-phase diagnostic sidecar (PR #168); hosted credential-free G1 qualification + CRLF provenance reconciliation + Decision B0 keeping production 12s/35s/180s constants unchanged (PR #172/#173, runs #41813835915/#41814496390/#41815439107, 10/10 PASS each); tiered hosted stress 27/27 PASS (PR #175); owner-only offline G1 replay helper + runbook (PR #177). The remaining unresolved item — the authentic candidate's actual G1 build-phase subtype for run [#41749479450](https://github.com/Meta-Project2026/Metamorph/actions/runs/41749479450) — is exactly what **open #176** retains: its exit criteria state the subtype stays UNKNOWN until a separately owner-run real-candidate replay succeeds. The new candidate's authentic G1 PASS and all synthetic hosted PASSes are **not** evidence about the historical failure's cause.
>
> **Owner-only, urgent:** artifacts 13284218898 (encrypted `candidate.age`) and 13285336430 (public custody receipt) from run #41749479450 expire **2026-11-11 00:49 UTC**. Only the owner can retain them before expiry and later use `research/mmp-176/OWNER-RUNBOOK.md` on a dedicated disconnected Linux VM; agents/reviewers must never download, decrypt or execute the private candidate. If they lapse, the replay is OWNER_ACTION_REQUIRED/NO_GO and the subtype stays UNKNOWN. #160 and #161 remain OPEN.
