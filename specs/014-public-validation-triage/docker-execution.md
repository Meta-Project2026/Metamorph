# MMP-044 real public Docker execution — 2026-10-28

Executor classification v1: **CANDIDATE_BEHAVIOR_CONFIRMED**, limited to the fixed
independently authored public corpus. Original private AUDIT_FAIL is unchanged;
its cause is **not established** by this experiment. Independent external code
and evidence review remains pending; no teammate approval or acceptance is claimed.

Delivery: [PR #46](https://github.com/Meta-Project2026/Metamorph/pull/46).
Separate proposed candidate-fix scope: [Issue #49](https://github.com/Meta-Project2026/Metamorph/issues/49).
Base: `aea0c5d97e3b1be44be82b8e11dc499e54ef782b` (PR #45 merged).
Final experiment code SHA: `5efce039179dfa46e8878b748bafa86fff11158a`.
Subsequent delivery changes add only offline artifact verification and reports;
they are not represented as another Docker execution of that later Git HEAD.

## Exact hosted evidence

Selected [run 40708487948](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708487948),
[job 122887959454](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708487948/job/122887959454),
[artifact 12825241624](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708487948/artifacts/12825241624).
Ubuntu 24.04 GitHub-hosted disposable Linux amd64 daemon, Node 24 host.
Frozen dependencies, exact-SHA checkout, real bounded Docker, no secrets/provider
or model calls. Harness exit 0 / job SUCCESS means **HARNESS_EXECUTED=SUCCESS**;
the measured **PARITY=FAIL** is a separate result.

| Fact | Actual selected-run result |
| --- | --- |
| Independent fresh pairs | 14/14 completed |
| HTTP comparisons | 38/38; 29 PASS, 9 FAIL |
| Full SQLite comparisons | 52/52; 14 initial PASS, 28 post-step PASS, 10 post-step FAIL |
| Scenario verdicts | 9 PASS, 5 FAIL, 0 ERROR/NOT_RUN |
| Bootstrap | 14 HTTP 200 + exact initial legacy SHA; outside comparison counts |
| Positive control | public-good-lifecycle: all 8 HTTP / 9 DB PASS |
| Negative control | Copy of real positive response changed to status 503; original compareHttp detects HTTP_STATUS; outside counts |
| Isolated G1 | 14 original target provision/build/type/smoke procedures PASS |
| Cleanup | Every pair and independent finalizer PASS; containers=0, volumes=0, emergencyRemoved=0 |
| Public projections | 76 checked HTTP/post-step DB records, no messages or seed identities |
| Duration | 246048 ms total; maximum complete pair 21149 ms, below unchanged 180000 ms worker limit |

PHP image ID: `sha256:dd575ef01fe3bbba706ea55c73b9571a8ab14f344470f27e5878405a61619e4e`.
Target image ID: `sha256:1825aaa882b13f7db51c6ad7de870dafe7a51035dbf3aed0a36a79cf7f9b0cd0`.
Actual PHP 7.4.33 / PCRE 10.35 (2020-05-09) / SQLite 3.34.1;
target Node v24.11.0 / SQLite 3.50.4. All clocks verified at
2026-10-27 12:00:00 UTC. Measured real monotonic deltas: PHP
50.065616–50.136063 ms, target 1200.703528–1202.438114 ms.
Prepared image IDs can vary between builds; source/recipe bytes and measured
runtime versions are verified independently, and actual IDs are recorded.

Original corpus SHA-256:
`5e3b588003de33d36f37cc2dadc848d0dfebc44fdd2c0a9aaed65e84f240f496`.
Candidate bundle:
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`.
PHP commit: `d272170d0aecbd28eb5b13e272d9dd11d545b66c`; archive:
`32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`.
MANIFEST: `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`.
Target recipe: `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
Every trusted file in unchanged pins.json was compared against both exact Git
blob and Linux checkout bytes before execution; no CRLF normalization workaround.
Original MIT provenance/notices remain in the verified archive and frozen fixture.

## Public causes and alternatives checked

| Public cases | First real difference | Measured public rule |
| --- | --- | --- |
| engine-nbsp, phone-nbsp | HTTP step-1: HTTP_JSON_MISSING/HTTP_JSON_VALUE; DB_STATE after request | PHP rejects NBSP, JS accepts it; PHP has no appointment/sequence row, TS inserts id 1 |
| exponent-mechanic | HTTP step-1: HTTP_JSON_MISSING/HTTP_JSON_VALUE; DB_STATE | PHP integer cast yields 10 (absent mechanic), TS parseInt yields 1 and inserts |
| exponent-cancel | DB step-2: DB_STATE; HTTP step-2 still matches | PHP addresses missing id 10 and keeps id 1; TS removes id 1 |
| exponent-update | HTTP step-2: HTTP_JSON_VALUE; DB_STATE | PHP rejects missing id 10; TS updates id 1 from mechanic 1/date 2099-08-18 to mechanic 2/date 2099-08-19; both row counts remain 1 |

Case IDs above have prefix `public-`. Nine other fixed cases passed, including
ASCII padding, ordinary validation failures, invalid/past dates and lifecycle
sequence behavior. PR #45's predictions were frozen before observations; their
confirmation is measured here, not assumed by the runner or used as expected
values in comparison.

Public upstream api.php lines 103/254/345 use integer casts, lines 113/119 use
the measured regexes without UTF/UCP flags; frozen TS main.ts lines 29/81/86 use
parseInt/ECMAScript regexes. The separate trusted in-container diagnostic uses
those original operators on fixed public bytes, without importing/changing the
candidate. It records `(int)'1e1' = 10` versus `parseInt('1e1',10) = 1`, and both
PHP regex outcomes false versus JS true. Form-decoding hex is identical on both
sides (`2b31353535c2a0343430303031`, `454e47c2a030343441`).

Clock/source/runtime identity checks pass before verdicts. Fourteen independent
initial full snapshots match. Original HTTP/SQLite comparisons use complete typed
observations, schemas, rows and sequence; no row-count-only or success-only
comparison replaces them. Public projections independently check selected raw
wire versus mapped fields before publication. Thus form decoding, dirty initial
state, clock drift and selected-field mapping do not explain the measured five
public differences. No original evaluator/comparator defect is established.

An additional independent-daemon run on `daf2c9e4799251f898426ecebc4fe79511bce1a8`
([40708007607](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708007607))
has the same 14/38/52 counts, controls, five failures and clean finalizer. All
76 public observation payloads (including full snapshot/body commitments) match
the selected run after excluding raw transport identity hashes. No new cases or
adaptive held-out samples were added.

## Receipts and offline verification

Exact downloaded bytes are retained under
[docker-evidence](docker-evidence/index.json), with run/job IDs, code SHAs,
all six independently downloaded ZIP digests and every published file hash.
Only allowlisted summary.json, finalizer.json and optional public-repro.json
were downloaded/persisted; all six ZIP entry lists and their 14 files were
independently checked against those hashes and the stored bytes.

| Selected object | SHA-256 |
| --- | --- |
| Downloaded ZIP | `5dd8bd994aa56e77bc39961077aea9d07594af11a267133761a88a1a11f62152` |
| summary.json | `eaf19b6bc7a25c9339145fe2a21a8e104b29480aef4b98794bb7dc9fc6ceaea9` |
| finalizer.json | `8471611f3eae9d3518a354d510802ee928626799be4243d150c70e8265da7987` |
| public-repro.json | `8d2f59ca3ee76dd496afef921edd96ed520c91fd17f7a9facd7f6c23422fea17` |

Run the standalone offline verifier (actual exit 0, 76 records/14/38/52 verified):

```sh
node research/mmp-044/verify-public.mjs specs/014-public-validation-triage/docker-evidence/run-40708487948 5efce039179dfa46e8878b748bafa86fff11158a
```

Runtime summary.json intentionally says NOT_ESTABLISHED/deferred review. It is
preserved byte-for-byte, not rewritten after the fact. This report and
[classification.public.json](classification.public.json) are the subsequent
versioned executor causal classification based on reviewed public observations,
source and diagnostics. Independent external review remains separate and pending.

## Actual checks and failed attempts

Local Windows x64 Node v22.23.1 / pnpm 11.25.0; no PHP/candidate executed on host.
All commands below exited 0. Root/package checks used unchanged package bytes;
driver changes were checked by the explicit research command and real Linux runs.

| Command | Actual result |
| --- | --- |
| pnpm install --frozen-lockfile | Lockfile unchanged |
| pnpm lint | 131 configured files, no fixes; research is excluded from root scope |
| pnpm typecheck | Trusted workspace type checks PASS |
| pnpm test | 87 PASS / 0 FAIL / 0 SKIP |
| pnpm build | Trusted workspace builds PASS |
| node --test packages/oracle/reference/reference.test.mjs packages/oracle/reference/acceptance.test.mjs packages/target-worker/test/*.test.mjs packages/differential/test/*.test.mjs | 201 PASS / 0 FAIL / 2 SKIP out of 203; POSIX-only evidence tests skip on Windows |
| node --test research/mmp-044/driver.test.mjs | Final driver suite 31 PASS / 0 FAIL / 0 SKIP; also executed on selected Linux workflow |
| node research/mmp-044/check.mjs | Explicit repository Biome rules + node syntax: 8 research files PASS locally (selected runner checked its then-existing 7 files) |
| offline verifier on runs 40708007607 and 40708487948 | Both exit 0; all public coverage/identity/cleanup checks PASS |
| offline verifier deliberate corruption checks | Six altered count/initial/step/public-field/cleanup/pin cases rejected, assertions exit 0 |
| independent ZIP entry/byte/hash checks and replay comparison | 6 ZIPs / 14 files PASS; 76 repeat payloads match |
| git diff --check | PASS |

The initial 25-test driver was immediately committed/pushed and PR #46 opened;
later 27/28/31-test versions and fixes were pushed as concrete changes.

| Hosted attempt | Actual outcome |
| --- | --- |
| First dispatch (no run) | HTTP 422: runner.temp invalid in job-level env; fixed by a setup step |
| [40705634442](https://github.com/Meta-Project2026/Metamorph/actions/runs/40705634442), 6c7a5a8 | 0 comparisons, ERROR; cleanup error obscured primary failure; final inventory zero, cleanup ERROR |
| [40706258372](https://github.com/Meta-Project2026/Metamorph/actions/runs/40706258372), 238058f | CLI SyntaxError in diagnostic patch, no worker run; fallback receipt; finalizer PASS |
| [40706654187](https://github.com/Meta-Project2026/Metamorph/actions/runs/40706654187), 36f5a4c | 0 comparisons, WORKER_NOT_READY at PHP reset, cleanup ERROR; zero final inventory |
| [40707314674](https://github.com/Meta-Project2026/Metamorph/actions/runs/40707314674), 05e7599 | First complete 14/38/52; 9 PASS/5 FAIL; controls/finalizer PASS |
| [40708007607](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708007607), daf2c9e | Full 14/38/52 plus public projections/operator diagnostics; same result |
| [40708487948](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708487948), 5efce03 | Selected final driver/cleanup-accounting proof; full coverage and clean resources |

PHP startup was a host-driver wiring error: process umask 077 reduces the
archive's create mode 0444 to 0400. The existing pilot explicitly chmods this
verified public archive to 0444; adding that missing host step allowed startup.
No original worker, source bytes, recipe, isolation limit or comparator was
changed. These harness failures are not candidate failures or evidence about
the private audit.

Feature-ref dispatch was actually accepted although main lacked the new path.
The narrow optional registration [PR #48](https://github.com/Meta-Project2026/Metamorph/pull/48)
was therefore closed unmerged; registration is not a remaining blocker.
No direct main push, merge, private workflow reuse or arbitrary-code input was used.

## Scope, gates and remaining review

All existing preregistration/prediction files remain unchanged. No private audit
code, generator, package, seed, expected data, raw log or PR #31 artifact was read.
No candidate/reference/manifest/policy/comparator/normalizer/mapper/worker/shared
API change, owner agreement, governance ratification or AI migration is claimed.
Raw host evidence packs remained ephemeral on the disposable runner and were not
uploaded. Public projections are sufficient to inspect the stated rules, not to
reconstruct private inputs. Actions artifact retention is seven days; permitted
public receipts are also versioned here for durable review.

Public G1 PASS; public G2/G3 FAIL. G0 INCONCLUSIVE, **canonical G4 INCONCLUSIVE**,
product **NOT_ESTABLISHED**. Candidate compatibility changes are proposed only in
Issue #49 for owner-reviewed follow-up. PR #46 remains open/unmerged for independent
review; neither Issue #44 closure nor product/Oracle acceptance is claimed.
