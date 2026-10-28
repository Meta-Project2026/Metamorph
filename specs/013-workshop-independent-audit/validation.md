# Validation

Current status (2026-10-28 docs sync): **HARNESS_EXECUTED=SUCCESS;
MIGRATION_AUDIT=AUDIT_FAIL**. The final hosted record below applies to executable
SHA `b142201c07df45d4c10b470ba4f6f8e6b32d9b82`, not to this later docs-only commit.
Earlier NOT_RUN/registration statements are historical stage snapshots.

## Historical implementation and initial local validation

Base `3de9d5ceef343536a5b56761deb805006fbd4b65`, fresh origin/main. Branch
`feat/mmp-010b-independent-workshop-audit`; independent managed worktree.
Issue24 and its coordination comment inspected. No other-owner files edited.

Actual command results and exact-head manual proof will be recorded after
execution. At this stage Docker families/controls/cleanup are NOT_RUN; no parity
or audit verdict is assumed. G4 INCONCLUSIVE/product NOT_ESTABLISHED regardless.
Formal held-out isolation remains HELDOUT_ISOLATION_NOT_PROVEN (shared author
context; no formal policy/registration). External raw retention NOT_RUN.

| Family | Scenarios | Declared HTTP steps |
| --- | ---: | ---: |
| duplicate-date-identity | 2 | 16 |
| capacity-update-cancel | 2 | 21 |
| admitted-validation | 2 | 14 |
| ordering-types | 1 | 8 |

Each fresh pair includes one initial DB comparison plus every executed post-step
checkpoint. Public controls add6steps each, separately from private coverage.
Filtered/search queries are BLOCKED_TRANSPORT_POLICY, not silently excluded from
full-source claims. No hidden concrete case/seed/repro or expected body is stored
here or in PR. New differences must not be used to repair this frozen candidate.

Local Windows commands executed with Node v24.21.0 / pnpm11.25.0:
`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`: exit0, root65/65. Reference56 total:55PASS+1POSIX skip, exit0;
differential78:77PASS+1POSIX skip, exit0; target69/69, exit0; audit27/27,
exit0. Import-only validation exit0. Synthetic fixtures in own tests are labeled
PUBLIC_DEV_CONTROL, never hidden. No private sampling or candidate/PHP
compilation/execution was performed on Windows.

Actual candidate bytes admitted without execution at
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`.
Archive/API/config/LICENSE bytes read and SHA256 checked against accepted pins.
Lockfile change is only the12-line workspace importer; no dependency resolutions
or other-owner code changed. Parallel PR30 observed; no messages or data sent.

## Historical registration blocker - partial delivery

[Draft PR31](https://github.com/Meta-Project2026/Metamorph/pull/31) created immediately
following push. Two dispatch attempts on implementation2e53fa8 returned HTTP404:
`workflow workshop-independent-audit.yml not found on the default branch` (short
filename and repository-relative filename attempted). `gh workflow list --all`
contains only the five existing workflows; the new one is absent. Main remains
3de9d5c. No private corpus was generated and no supplementary Docker pair ran.

Status: AUDIT_PARTIAL / MANUAL_WORKFLOW_NOT_REGISTERED. Supplementary G2/G3,
real positive/negative evaluator controls, pack commitments and audit inventory:
NOT_RUN. No0/0 cleanup or artifact integrity claim is made for an unexecuted audit.
See structural [registration-blocker.json](registration-blocker.json). There is no
supplementary Actions run URL, job ID or ZIP hash to report.

The existing manual entrypoints call fixed owner-owned scripts and cannot invoke
this evaluator without editing forbidden files. No auto PR trigger, install/build
side effect, comparator/worker replacement, temporary invalid YAML, self-merge or
other registration workaround was introduced. Reviewed registration of the new
manual-only workflow on the default branch is the required next step. Then run:
`gh workflow run workshop-independent-audit.yml --repo Meta-Project2026/Metamorph
--ref feat/mmp-010b-independent-workshop-audit` (one shell line). That future run
must validate its exact HEAD, sample after freeze, run all declared families and
both controls, hash-verify private packs after teardown and publish structural ZIP.
Future candidate differences must not trigger repairs or expose private repros.

[Fast CI40587891976](https://github.com/Meta-Project2026/Metamorph/actions/runs/40587891976)
at2e53fa8 completed SUCCESS for Node22 and24. These fast checks are not evidence
for supplementary G2/G3. Final-head Fast CI and unchanged registered workshop
regressions are linked in PR31 after the report commit. Existing public controls
never count as execution of the seven new sampled scenarios.

## Historical original checks on report-head a14429c

[Fast CI40588301991](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588301991)
Node22/24: SUCCESS. Registered unchanged
[public baseline40588295315](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315)
checked out `a14429ca9d5ac565dbb618e9f9c26297c9ead30b`.
Frozen install/lint/typecheck/build exit0; actual Linux root65/65, reference56/56,
differential78/78, target69/69, no skips. Own audit27/27 is local synthetic proof
only, not a hosted private-audit claim.

Original public MANIFEST proof: SUCCESS, G2/G3 PASS per scenario in both passes,
34HTTP/40DB with exact initial/step IDs revalidated independently; finalizer
containers0/volumes0/emergencyRemoved0. Job122486167150 (retained in attempt2 as
122489128400). Artifact12773920415 ZIP SHA256 independently matches GitHub:
`de1f84f1f3a01d0a243105efb8f097c076a00b63d03e9c083201aa2a0c02f855`.
This is existing public parity, not supplemental coverage.

Original regression job122486167588: ERROR for items-smoke, expected mismatch
pilot regression PASS (G2 INCONCLUSIVE/0HTTP, G3 FAIL/1initial DB_SCHEMA+DB_STATE,
G4 INCONCLUSIVE). Finalizer inventory0/0 only AFTER emergencyRemoved1, statusERROR;
this does not establish normal cleanup success. One justified retry of only the
failed job on the same SHA (122489125401) reproduced the same ERROR and emergency
removal. Workflow overall FAILURE;30/30 Docker controls are NOT_ESTABLISHED for
these runs. No comparator, test, quota, timing or other-owner code was weakened.
Cause remains unresolved: public receipts do not reveal the private diagnostic,
and raw logs were not retrieved. No claim is made that this predates this PR.

Safe ZIP digests verified against GitHub: attempt1 artifact12771614054
`f49ac3e644dff683fd7f8135de2f37248a3df2b81ecbb5fd1717ad7cc4cae523`;
attempt2 artifact12773531413
`fcb122c18a57131f9b3805738c829deb6e4b754432df323b47593b101046f325`.
Structural receipts retained in [regression-evidence.json](regression-evidence.json).
No private raw HTTP/DB/DDL/forms/stdout/stderr was downloaded.

A prior regression dispatch40588260952 ran at2e53fa8 after a transient DNS push
failure; it was cancelled and superseded by40588295315 after successful push.
The final follow-up commit adds only this report/structural evidence. These Docker
results apply specifically to a14429c; they are not relabeled as execution of a
later documentation SHA. Final Fast CI is linked in PR31. The new audit remains
NOT_RUN/AUDIT_PARTIAL; independent registration and review are still required.

## Historical review-fix validation (2026-10-28; before hosted authorization)

Read entire CHANGES_REQUESTED review5675008255 and both inline comments; Issue24,
Issue32 and Issue34 plus PR30 latest48932cd. Started clean in existing dedicated
PR31 worktree/branch at69b8c50. Fresh main is37608f8 (includes registration PR33
merge84ac716 and Fast CI PR35). No remote feature changes overwritten, no main
push/merge/issue close, no provider/paid API. Common merge base remains3de9d5c.

P1: PairRegistry keeps packs across provision/Oracle/retention/close/inventory
faults. All-path finally attempts independent bounded cleanup, then captures
partial Oracle raw bytes and seals/verifies available PHP/bridge/oracle indexes.
Primary fault is separate from secondary errors. Incomplete/failed evidence never
becomes FINALIZED_PRIVATE_COMPLETE. Pack types/status/hash/count only enter public
error-v2; private paths/diagnostics stay outside Git. Safe builder and writer
failure controls prevent a secondary exception from suppressing safe failure
publication when storage works. Physical storage failure remains explicitERROR.
P2: cancellation now false; all other manual workflow security policy unchanged.

Actual local matrix, Windows Node24.21.0/pnpm11.25.0, corrected source bytes in the
review-fix commit (final SHA is linked in PR31; no candidate execution on host):

| Command | Exit | PASS / FAIL / SKIP |
| --- | ---: | --- |
| pnpm install --frozen-lockfile | 0 | frozen importer unchanged |
| pnpm lint | 0 | no diagnostics after formatting |
| pnpm typecheck | 0 | original workspace TS checks |
| pnpm test | 0 |65 /0 /0 root tests only |
| pnpm build | 0 | original package builds |
| pnpm --filter @metamorph/oracle test:reference | 0 |55 /0 /1 POSIX skip |
| pnpm --filter @metamorph/target-worker test | 0 |69 /0 /0 |
| pnpm --filter @metamorph/differential test | 0 |77 /0 /1 POSIX skip |
| pnpm --filter @metamorph/workshop-audit test | 0 |51 /0 /1 of52 total |
| node packages/workshop-audit/src/run.mjs --validate-imports | 0 |import-only, no samples |

The25 new tests are original PUBLIC_DEV_CONTROL fault injections; total audit
suite52 includes27 previous tests. Provision, before/during Oracle, retention,
close/inventory/emergency cleanup, partial construction/catalog, seal/verify/write,
primary+secondary failures, timeout/cancellation/late receipt, registry and public
publication failure are covered. Filesystem test indexes independently verify their
synthetic bytes; actual production POSIX PrivateEvidence test is SKIP on Windows.
No actual private Docker pack index/hash/count is claimed. Unit canary absence in
public error JSON is tested; no new real public audit artifact exists to certify.

PR35's current-main Fast CI adds original reference/target/differential commands;
it still does not imply this separate audit suite executes. Do not conflate old
65/65 root or prior Fast CI69b8c50 with new52 tests. New manual workflow explicitly
runs audit tests before Docker. Until its aligned version runs at the final SHA:
HOSTED_AUDIT_TESTS_NOT_RUN; sampled7scenarios/59HTTP/66DB and real positive/negative
controls NOT_RUN. Prior baseline40588295315 at a14429c stays historical and ERROR
for items-smoke twice/emergencyRemoved1 (Issue34). Cause remains unknown. Existing
worker/smoke/comparators/workflows are unmodified; no all-workflows PASS or30/30
Docker claim, no merge-ready. No new baseline diagnosis or private logs retrieved.

Registration32 closed after reviewed PR33 merge, but main still has old workflow
SHA2563032a4716739a912eadad131eb911c6ccb4344b3a91ed32687b05d508c618d56
(cancel true). Corrected branch SHA256
 eaecd695253b95ecabc61d46b30a5e6131678c99d70fae951b16a1a957e5484c
(cancel false). This task explicitly requires byte equality with reviewed main
before dispatch. Therefore no dispatch of mismatched bytes, no automatic Docker
trigger/registration edit/self-merge workaround: HOSTED_PROOF_BLOCKED /
WORKFLOW_REGISTRATION_BYTES_MISMATCH. See review-fix-status.json. Registration
handoff contains only the corrected YAML SHA and cancellation-policy change.

Final delivery status: CODE_FIX_PUSHED / HOSTED_AUDIT_NOT_RUN; canonicalG4 remains
INCONCLUSIVE, G0NOT_RUN, productNOT_ESTABLISHED, formal held-out isolation not
proven, external recoverable raw retentionNOT_RUN. Request independent review of
code and registration reconciliation; no owner acceptance is inferred.


## Historical first hosted follow-up (2026-10-28): PROVISION_ERROR

The human owner explicitly authorized corrected feature-ref dispatch without
waiting for default-branch byte parity. The former task-level policy block is
superseded for this execution; registration-only PR43 is a separate reconciliation.
Manual run40608027232/job122552328147 actually checked out953fd144de14ae6e1c5c12cb8d029df8677f369f.
Linux original suites passed65/56/69/78 and all52audit tests passed, no skips.
Actual Docker phase failed at first public positive pair PROVISION_ERROR.
No negative control or sampled scenario executed. Cause is not yet established.
All three available partial pair packs and global provenance verified; catalog
INCOMPLETE. Finalizer CLEANUP_PASS: containers0/volumes0/emergencyRemoved0.
Public ZIP independently downloaded and SHA matched GitHub; only error.json and
finalizer.json, no summary. Exact public digests/counts are in hosted-proof.json.
No private log/sample/seed/raw response or path was downloaded or published.

Bounded diagnosis adds a fixed allowlisted detailCode to failure pairs; stage code
and primary/secondary semantics are retained. Audit adapters retain recognized
trusted error codes while their message remains AUDIT_ADAPTER_ERROR; unknown
codes become ADAPTER_OPERATION_ERROR. No exception text enters public receipts.
Two additional synthetic tests cover known/unknown canary code propagation and
sealed partial indexes. Windows audit53PASS/1POSIXskip of54, exit0. This diagnostic
change is not a claimed provision fix; next proof must use its new exact HEAD.
G0 NOT_RUN, G4 INCONCLUSIVE, product NOT_ESTABLISHED, EXTERNAL_RETENTION_NOT_RUN.
Baseline34 remains separate, cause unknown, not rerun or attributed here.


## Final hosted record - 2026-10-28 (review 5676478621 docs sync)

**HARNESS_EXECUTED=SUCCESS; MIGRATION_AUDIT=AUDIT_FAIL.** Actions job SUCCESS
means the auditor completed execution and publication; it does not establish
successful PHP-to-TS migration parity. This record supersedes the historical
NOT_RUN/blocker statements above without changing their original provenance.

Executed source SHA: `b142201c07df45d4c10b470ba4f6f8e6b32d9b82`.
[Run 40608788918](https://github.com/Meta-Project2026/Metamorph/actions/runs/40608788918),
[job 122554892789](https://github.com/Meta-Project2026/Metamorph/actions/runs/40608788918/job/122554892789),
[public artifact 12781924203](https://github.com/Meta-Project2026/Metamorph/actions/runs/40608788918/artifacts/12781924203).
Independent [review 5676478621](https://github.com/Meta-Project2026/Metamorph/pull/31#pullrequestreview-5676478621)
verified the actual job logs, public JSON bytes/digests and scoped failure.

| Hosted check | Observed result at the executed source SHA |
| --- | --- |
| Frozen install, lint, typecheck, build | exit 0 |
| Root / reference / differential / target tests | 65/65 / 56/56 / 78/78 / 69/69 PASS |
| Linux audit tests | 54/54 PASS, 0 FAIL, 0 SKIP |
| Sampled coverage, excluding both public controls | 7 pairs, 59 HTTP, 66 SQLite comparisons |
| Sampled scenario verdicts | 6 PASS; audit-validation-2 AUDIT_FAIL (G2/G3 FAIL) |
| Real positive control | CONTROL_PASS; G2/G3 PASS; 6 HTTP / 7 DB |
| Real corrupted-status negative control | CONTROL_PASS; expected G2/G3 FAIL, HTTP_STATUS; 6 HTTP / 7 DB |
| All nine pair cleanup receipts | VERIFIED_ZERO_RESOURCES |
| Independent finalizer | CLEANUP_PASS; containers=0, volumes=0, emergencyRemoved=0 |

The only public difference-code set for `audit-validation-2` is
`HTTP_JSON_MISSING`, `HTTP_JSON_VALUE`, `HTTP_JSON_LENGTH`, `DB_STATE`.
These are observed comparison differences, not a root-cause classification.
Independent public-safe diagnosis is tracked in [Issue #44](https://github.com/Meta-Project2026/Metamorph/issues/44).
Do not infer a candidate defect versus evaluator/transport cause without that
separate evidence; do not disclose/reconstruct private examples or expected
answers, repair this frozen candidate from them, or resample to obtain PASS.

Artifact ZIP SHA-256, independently downloaded and matched to GitHub:
`e51c466b385ef1d9c43d1e68395171a858222696ffc561a4efd6883a828cc763`.
Exactly two public JSON files were present:

- `summary.json`: `9fa9c07f137cb9da65a55877586d5906c7189c09fb299a4d66b3cddac504e36e`.
- `finalizer.json`: `082500e07bd52cd797bca28077b5857c147a866c2d3c5b124051b777a91321c8`.

No error.json was uploaded for this completed execution. The trusted executed
code and structural publication attest three verified private indexes per pair
(27 total), plus global provenance. The public artifact exposes nine bridge-pack
commitments and provenance; independent review did not inspect private raw pack
bytes. Hash commitments are not recoverable external retention. No private
inputs, expected outputs, seed, raw HTTP/DB/DDL, paths or logs are included here.
See [hosted-proof.json](hosted-proof.json) for the documentation-only current
status and the intact historical first-run record.

Historical run 40608027232 at953fd14 remains PROVISION_ERROR before sampled
execution, cause NOT_ESTABLISHED. Its verified partial indexes and cleanup0/0/0
are not erased or relabeled fixed/flaky by the later completed execution.
The older items-smoke/emergency-cleanup baseline stays separately in
[Issue #34](https://github.com/Meta-Project2026/Metamorph/issues/34).

G0=NOT_RUN, canonical G4=INCONCLUSIVE, product=NOT_ESTABLISHED,
HELDOUT_ISOLATION_NOT_PROVEN, EXTERNAL_RETENTION_NOT_RUN remain unchanged.
Unsupported filtered/search stays BLOCKED_TRANSPORT_POLICY. Independent owner
acceptance/merge disposition is separate from tool execution and audit verdict.

This synchronization changes documentation only. The new documentation commit
was not executed by run40608788918: proof remains bound to the original source
SHA above. Executable files, tests, workflows, corpus, verifier/comparator and
candidate are unchanged relative to that SHA. No closed-sample rerun, runtime
checks, merge or issue closure is performed for this documentation update.
