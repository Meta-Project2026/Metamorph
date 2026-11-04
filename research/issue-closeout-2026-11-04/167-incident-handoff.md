# #167 — historical abnormal G1 (#41749479450): handoff accounting and verdict

**Proposal: `closed/not_planned`** — superseded/handed off to **#176**, which is
OPEN and explicitly retains the unresolved owner-private replay. The historical
abnormal G1 build root cause is **NOT fixed** and must not be claimed fixed.

## Historical incident (immutable)

Paid run [#41749479450](https://github.com/Meta-Project2026/Metamorph/actions/runs/41749479450),
exact `main@32d173fc0ddb6cfe8d0addd3061fe5493f6e48f6`: genuine candidate SHA
`4e863cb94b444970e237e7cb8eb028ec99f5d960b200b5d1e714c91ee785f448`; custody
stored/readback PASS; G1 `ENVIRONMENT_ERROR` + downstream `BUILD_FAILED` after one
executed typecheck id `workshop-business:typecheck`; `compilerDiagnostics.status=
DIAGNOSTIC_UNAVAILABLE`; HTTP 0/17, SQLite 0/20; zero repair POST. The specific
real build-phase subtype remains **UNKNOWN**.

## Deliverables accounted for (all merged)

| Deliverable | PR | Evidence | Strength |
| --- | --- | --- | --- |
| Bounded build-phase diagnostic sidecar (fixed-enum, G1 ERROR only) | #168 merged | `packages/agent-real/test/build-phase-diagnostics.test.mjs`; would classify a *future* run; cannot retroactively classify #41749479450 | `hosted synthetic` unit coverage |
| Offline cold G1 qualification spike (5 PASS / 5 ERROR local) | #172 merged | `research/mmp-167/RESULTS.md`; provenance conflict (`bd2296fc…` vs `f09b12fe…`) later reconciled as Windows CRLF checkout artifact | local, superseded by hosted runs |
| Hosted credential-free G1 qualification + provenance reconciliation + Decision B0 (keep production 12s/35s/180s constants) | #173 merged at `main@da7a699b62818cd99f068576fd218e312a90e890` | Runs #41813835915, #41814496390, #41815439107: **10/10 PASS** each on Ubuntu 24.04, pinned recipe `f09b12fe…` matched | `hosted synthetic` |
| Tiered hosted stress qualification | #175 merged at `main@6c5a5337e7b4841a11805f99fe84ee398230b555` | Runs #41819253155, #41819982839, #41822941185: **9/9 PASS** each (27/27 total) at 2/8/26-file tiers | `hosted synthetic` |
| Owner-only offline G1 replay helper + runbook | #177 merged at `main@a5bcf5968b05f77da6c8d755e4b99a1614fd1a58` | `research/mmp-176/{README.md,OWNER-RUNBOOK.md,VALIDATION.md}`; executor-reported test-key controls 6/6, reviewer verified code+CI, did not rerun manual Docker tests | code merged; real replay NOT_RUN |

## Why superseded-by-#176 is the correct disposition

The only *unresolved* part of #167 — why the authentic candidate's build phase
aborted, on the real artifact — requires the owner's private age identity and the
retained ciphertext. That work is precisely scoped by **#176 (OPEN)**, whose exit
criteria state: *"Actual historical G1 subtype remains UNKNOWN until a separately
owner-run real-candidate replay succeeds."* The #176 deliverables (retention
procedure, fail-closed owner-local diagnostic with network guard, enum-only output)
are merged; what remains is an **owner action**, not further executor diagnostics
under #167.

Synthetic evidence explicitly does **not** transfer: hosted 10/10 and 27/27 PASS
runs and Decision B0 (preserving the 12s phase / 35s provision / 180s worker
constants unchanged) are about the synthetic fixture and known-good toolchain; they
are not evidence about the authentic candidate, and no production timeout or
sandbox change was made on their basis.

## Preservation and handoff duties recorded

- The historical FAIL/ERROR stays FAIL/ERROR; nothing retrofits the new candidate's
  G1 PASS onto run #41749479450.
- Downstream **#160** (G1 recovery efficacy, `NOT_EXERCISED` in the new run — zero
  repair POSTs) and **#161** (repair feedback quality) remain OPEN, untouched.
- The new genuine G1 PASS (run #41856569137) is bounded in
  [README.md](README.md); it is not proof of the historical failure's cause.

## OWNER-ONLY urgent action (repeated from README; agents cannot do this)

Artifacts from run #41749479450 expire **2026-11-11 00:49 UTC**: encrypted
`candidate.age` artifact **13284218898** and public custody-receipt artifact
**13285336430**. Only Vladimir should download, hash-verify and retain them on
privately controlled storage before expiry, then (only if authorized and on a
dedicated disconnected Linux VM) follow `research/mmp-176/OWNER-RUNBOOK.md`. If the
ciphertext expires or no isolated VM exists, the replay is `OWNER_ACTION_REQUIRED /
NO_GO` and the subtype stays UNKNOWN — no substitute evidence is acceptable.
