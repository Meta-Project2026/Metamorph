# #115 — production candidate-only custody: acceptance matrix and verdict

**Proposal: `closed/completed`** — scoped to the issue's actual contract: make the
reviewed Option A custody contract **operational for production candidate-only
pre-Oracle custody**. This is explicitly **NOT** formal G4 dual-domain durability
(#55, #57), not long-term hardware custody, and not product acceptance (#61).

## Traceable acceptance matrix

| # | Acceptance item (issue/contract) | Implementation | Live execution proof | Owner-reported-only proof | Residual nonblocking limitation | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Trusted generation-custody identity, lease/receipt binding, candidate digest | PR #117 merged at `main@839a76cf68cc7341440b23e73bfa8565b6ef8ab8` after independent exact-SHA security review [SCOPED_MERGE_GO](https://github.com/Meta-Project2026/Metamorph/pull/117#pullrequestreview-5731067024) (blob-level byte equality to reviewed `9f5cbbee`) | Run #41505679809: capture `CAPTURED_UNVERIFIED` bound to original run/head/source, candidate SHA `6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38` (recorded in #115; `actual paid run`) | — | UNVERIFIED label is by design pre-Oracle; no upgrade claimed | Established |
| 2 | Credential-free age encryption, private spool, atomic commit | PR #117 (`custody-{capture,checkpoint,collector,contract,files,steps}.mjs`); pinned production age recipient/tool | Same run: encryption + pre-Oracle finalizer **0/0/0** before Oracle; ciphertext 31094 bytes, SHA `1afcc2a061a72f322f4a888bd03a93686babaf5a3e268a5d45dcc7c17bc997cb` (`actual paid run`) | — | No same-UID/root hostile-host protection claimed (documented boundary) | Established |
| 3 | Authenticated GitHub artifact upload + exact-ID readback before Oracle | PR #117 upload/readback steps; docs ledger PR #133 merged at `main@7740ebbbc686a22b8e709ccd2163ceeb9aa5753b` | Same run: artifact 13169609004 uploaded, ID-based readback verified against public receipt from independently downloaded ciphertext; repeated in run #41856569137 (artifact 13338306385, cleanups 0/0/0) (`actual paid run`, both) | — | Artifacts are GitHub-public-downloadable for 7 days, not owner-only or revocable (contract-stated) | Established |
| 4 | Independent pre/post-Oracle finalizers, no custody bypass on Oracle failure | PR #117 independent PRE_ORACLE finalizer; unchanged POST_ORACLE finalizer | Both runs: normal and independent cleanup 0/0/0 (`actual paid run`) | — | — | Established |
| 5 | One-use Oracle permit, ordering custody → permit → Oracle | PR #117 permit consumption in paid validator | Run #41505679809 reached Oracle only after STORED_UNVERIFIED readback; missing/failed gates stop the run by construction and negative controls (25 custody controls, Fast CI #41368158079) | — | — | Established |
| 6 | Owner-side exact restore with private age identity | `packages/agent-real/src/custody-restore.mjs` (owner-local only, recipient/pin/hash validation) | **NOT_RUN by any agent/reviewer** (by design) | `OWNER_RESTORE_PASS` **owner-reported** 2026-11-02 in #115 for artifact 13169609004/ciphertext SHA above; no key/plaintext ever left the owner's machine | Attestation, not reviewer-rerun; restore uses the producing revision's tool (no cross-revision capsule compatibility claimed) | Established as `owner-reported` |
| 7 | Offline negative controls + exact-head CI | PR #117: 25 custody controls; Node22/24 each 782/779 PASS/3 SKIP/0 FAIL ([#41368158079](https://github.com/Meta-Project2026/Metamorph/actions/runs/41368158079), reviewer re-read) | `hosted synthetic` | — | Linux-only behavior controls skipped on Windows are NOT_RUN locally, honest in reports | Established |
| 8 | Post-merge main CI confirmation | — | Fast CI #41368974687 queued at merge time; main has since carried many green runs including #41856569137 at current main | — | — | Established |

Rows 1–5, 7–8 are `actual paid run` / `hosted synthetic` / `reviewer-confirmed`;
row 6 is the only `owner-reported` row, which the acceptance design explicitly
contemplated (private identity stays off-runner/off-Git; no agent may possess it).

## Why this supports `completed`

The closeout condition was: production pre-Oracle custody + authenticated real
upload/readback + attributable owner-reported exact restore, each established
**within its respective evidence boundary**. All three now have authentic,
dated, linked evidence; the superseded "all NOT_RUN" statement of the Nov-2 docs is
corrected by a dated addendum in `research/mmp-115/README.md` (history preserved).

## What this closure deliberately does NOT claim

- Not G0/G4 PASS, not product acceptance (#61 `PRODUCT_NOT_ESTABLISHED`).
- Not the formal dual-domain (two-media, 180-day) durability of #55/#57.
- Not that GitHub artifacts are private, revocable, or long-term.
- Not that owner restore was independently rerun by a reviewer.
- Not that `STORED_UNVERIFIED` ciphertext was ever product-verified pre-Oracle.
- Historical candidates (UNAVAILABLE / G2-G3 FAIL / G1 ERROR runs) keep their
  verdicts; no retrofit of the new PASS.

If the independent reviewer finds a remaining operational acceptance gate not
listed above, the fallback is `HOLD` with that single smallest missing proof named.
