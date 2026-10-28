# MMP-010A validation — 2026-10-28

MMP-010A now has a complete **PASS_SCOPED** hosted Docker proof on exact branch SHA `e2cc71ce1822e4eccf581d3f488e09ef489f077d`: [run 40685101415](https://github.com/Meta-Project2026/Metamorph/actions/runs/40685101415), [job 122805318179](https://github.com/Meta-Project2026/Metamorph/actions/runs/40685101415/job/122805318179). This is the Vladimir-owned offline Agent → admitted TS target → unchanged PHP/Oracle composition. Refs #23. **G0/G4 and Agent remain INCONCLUSIVE; product NOT_ESTABLISHED.** Independent ChatGPT review is requested; no owner acceptance or self-merge is claimed.

The two minimal fixes correct a stale composition recipe pin and an exact-subtraction assertion that rejected valid fractional monotonic deadlines. Both have failing-before / passing-after regressions. The actual runtime, 180000 ms policy, Oracle, differential, contracts, fixtures, existing workflows and auditor files were not changed. The trusted byte check remains strict; deadline validation uses the same exact addition as the unchanged TargetWorker, without tolerance or extra time.

Workflow `398781710` is registered on main after merged #33. Workflow blob `3e798197914bd0227dd12ad9fc6ba5bbd5ec5641` is identical on main and the executed branch: manual-only, contents:read, exact-SHA checkout, no persistent credentials, Ubuntu 24.04 / Node 24, 40-minute job, cancel-in-progress:false, always-finalizer and a two-file upload allowlist. Refreshed main: `de6a679c1b58195f4fc2ea10670504b59441f9dd`. #35 is merged / #25 closed; this does not change the feature branch's CI YAML. PR Fast CI separately exercises the merge ref.

The Actions run/job and all required steps succeeded. `Verify exact checked-out SHA` printed `e2cc71ce1822e4eccf581d3f488e09ef489f077d`. Observed host Node `v24.21.0` / pnpm 11.25.0. Frozen install, lint, typecheck and build all exited 0; test counts are separate actual Linux suites:

| Command | Exit | Executed result |
| --- | ---: | --- |
| `pnpm test` | 0 | 87/87 PASS, 0 skipped |
| `pnpm --filter @metamorph/oracle test:reference` | 0 | 56/56 PASS, 0 skipped |
| `pnpm --filter @metamorph/target-worker test` | 0 | 69/69 PASS, 0 skipped |
| `pnpm --filter @metamorph/differential test` | 0 | 78/78 PASS, 0 skipped |
| `pnpm --filter @metamorph/agent-real test` | 0 | 22/22 PASS, 0 skipped |

The real proof step exited 0 and logged trusted runtime preparation, known-good INCONCLUSIVE / one attempt, repair INCONCLUSIVE / two attempts, and scoped completion. It did not substitute synthetic provider tests for Docker execution. Per-pair G1 requires actual isolated typecheck/build receipts. Each attempt has the exact public scenario IDs (business 6, rejected 5, capacity 6), 17 HTTP and 20 SQLite comparisons including the three initial snapshots:

| Attempt | Attempt ID | Candidate SHA | G1 | G2 / G3 | HTTP / SQLite |
| --- | --- | --- | --- | --- | --- |
| known-good | `eadd288a-16b8-4a6a-9851-4db8ce4df730` | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` | PASS | PASS / PASS | 17 / 20 |
| repair-before | `6222929e-45db-42a4-9fc0-13404ae254ab` | `1fd6c3547691a2593a58932e78946a8338061ec07cc46f9fb5b9422825591121` | PASS | FAIL / FAIL | 17 / 20 |
| repair-after | `9ef222cf-d3d2-4d1b-b269-ef8a1d4f13d8` | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` | PASS | PASS / PASS | 17 / 20 |

Observed totals for this one SHA/run: **51 HTTP / 60 SQLite, 9 distinct pairs, 18 distinct private-pack IDs/hashes**. The before-repair cancellation defect produced actual FAIL, then CandidateWriter wrote the good source and fresh workers/packs reran all coverage. Both final Agent runs are external-evidence INCONCLUSIVE. Every attempt's G0/G4 remains INCONCLUSIVE. No prior candidate's receipt establishes the repaired candidate.

All six unchanged runtime controls actually executed:

- `candidate-aux-enospc`: PASS, REAL_DOCKER, VERIFIED_ZERO_RESOURCES.
- `candidate-wal-full`: PASS, REAL_DOCKER, VERIFIED_ZERO_RESOURCES.
- `corrupt-db-rejected`: PASS, REAL_DOCKER, VERIFIED_ZERO_RESOURCES.
- `hung-socket-timeout`: PASS, REAL_DOCKER, VERIFIED_ZERO_RESOURCES.
- `process-crash`: PASS, REAL_DOCKER, VERIFIED_ZERO_RESOURCES.
- `cancel-readiness`: PASS, REAL_DOCKER, VERIFIED_ZERO_RESOURCES.

Every pair reports verified normal cleanup. Completion inventory and the later independent finalizer both report **containers=0, volumes=0, emergencyRemoved=0**, with finalizer PASS. No emergency reaping was needed.

Public [artifact 12814379086](https://github.com/Meta-Project2026/Metamorph/actions/runs/40685101415/artifacts/12814379086) contains exactly `summary.json` and `finalizer.json`; downloaded ZIP SHA-256 `ba6c31f96d962ea0ac3ff29c52ad48bbdea8a4753cd0d78099a8cf78d6fb7019` matches both GitHub API digest `sha256:ba6c31f96d962ea0ac3ff29c52ad48bbdea8a4753cd0d78099a8cf78d6fb7019` and the upload log. Run, artifact and finalizer agree on the exact SHA. Independent structural inspection checked actual workflow/job states, checkout/proof/finalizer logs, exact coverage IDs, fresh identities, controls, cleanup and ZIP contents/digest. Bounded public-log/artifact scans found no private-pack paths, raw HTTP fields, SQL/DDL or credentials. Raw private packs were not downloaded or published.

Provider: offline-deterministic-replay, three scripted calls, paidCalls=0, known/total/reserved spend=0, usage cost=0 and all token counts null. The positive USD1 admission ceiling is policy, not spend. AI_GENERATION_NOT_RUN; liveProvider NOT_RUN; EXTERNAL_RETENTION_NOT_RUN. No candidate PHP/TS ran on the Windows host; all candidate builds/execution ran in isolated Docker.

Earlier failed runs are retained as debugging evidence, never counted toward this proof: [40682636983](https://github.com/Meta-Project2026/Metamorph/actions/runs/40682636983) on `48932cd32700dc3487c764b0ce66b92420f7b56d` stopped at recipe admission (0/0 comparisons); [40683761588](https://github.com/Meta-Project2026/Metamorph/actions/runs/40683761588) on `d254711d69a82d56b711253fe075acec9133e146` reached 28/33 then deadline ERROR. Both finalizers were clean; their failed proof steps remain failed. Registration 404 is resolved by actual successful dispatch.

No self-merge or Issue #23 closure. NEXT: independent ChatGPT review of the current exact PR SHA and its matching successful run/artifact.

## Private-pack public index

These are public structural IDs and SHA-256 receipts from the verified run on `e2cc71ce1822e4eccf581d3f488e09ef489f077d`. Private content remains ephemeral on the disposable runner; hashes do not establish external raw retention.

| Attempt / public scenario | Pair ID | Private pack ID / SHA-256 |
| --- | --- | --- |
| known-good / workshop-business | `92785459-ff97-45b4-9bf3-fd55aed226ca` | `oracle-jbICq8` / `8e785bea17ce327cce1f6b80eb7876ca5d9237eb2141d2655c549a656b4371e3`<br>`oracle-8fFmWf` / `2495c65d31d547d70d19d8980b86e22e3128ddcee99570a7a8f7f4a2a6c0f582` |
| known-good / workshop-rejected | `e3b0ae26-1674-48b0-9e1e-59437ad54ffd` | `oracle-vQUhrd` / `3c589babe5f2e14f5319ed9c7b8e04858262fbfcc63191ffde10f9c4524d6c70`<br>`oracle-rHMToK` / `33642ae31a359063014a3683d8ec7d46ae318d4443083c2d22fd08a94f37fbab` |
| known-good / workshop-capacity | `4151c132-0599-413f-a5d5-2a6bf847dff4` | `oracle-mzQNyv` / `baa94071eccc08f68345843c17cde52360d73baa9373622b7b9afbb4334cca65`<br>`oracle-yeqYz8` / `245d025d9f1070ca35f256e318a6ebc49f083a26473c6f24bd21fcb2c39056d5` |
| repair-before / workshop-business | `92ae94bb-8164-472a-b4d5-96fbb5b2d247` | `oracle-StaYpn` / `01c01e067812f22d61b7f9f91ef22f5f28ee40a7596fa786273dfb830ed07ab2`<br>`oracle-LNkweG` / `78e79a2317f7c2235664c8b389674d27c4c88a1791c102a5705d4df5549d3f99` |
| repair-before / workshop-rejected | `3d2103e9-8a82-41e5-bc11-c3fd20c4e2ec` | `oracle-7DWllu` / `358c67b9c66aba7011145d0650b2e0ac63373f3132c3ca467f4d7e8d123877c0`<br>`oracle-MlhvQk` / `1a86c7baa33cf451f2928f75fc12a08e653ceb86cbc3f3637c46efe74db6c37e` |
| repair-before / workshop-capacity | `cf862306-635e-462d-bede-125823fd486e` | `oracle-1f52DF` / `f12c6f3fdaf410b45ad00d3f3a2711ce2457d6bdb58a4f01711535c44345a048`<br>`oracle-amjHDu` / `059b042aee4bc63b67a99eb935d9eac02feb52f09984f27dd3f58702965ab674` |
| repair-after / workshop-business | `d594c4fa-2000-4138-b89a-4d5e594648dd` | `oracle-n8G65i` / `bcc6098ef49e1b06245fd5751fd73ac035b8e0a6e79539bc22ca30625e026e65`<br>`oracle-Tpqm04` / `20052b75a7d61859d0b7eb4e6644822dd8eef07f4b1e7a9a8059244cfd22209f` |
| repair-after / workshop-rejected | `1fd109d4-c29c-4744-9c9b-5bbcf25cee2a` | `oracle-RAWa11` / `5cbe8764401a43054c84c648a0091a8027e8677a3ec30b6f12a1614ce68d9bee`<br>`oracle-nlO1SJ` / `73fba0e9825de4dd50f6d30506fa1272867075b57bc100191908590912dd15b2` |
| repair-after / workshop-capacity | `50fc8209-e6f5-4f2a-b039-3ff4c219365c` | `oracle-cjS8vq` / `2935ee4584087019206d94b1ffae8161af59ef2408099a4c664f85a3d62c7b0c`<br>`oracle-FkL8HS` / `6bd9107437542e3fdaed65fabd56d8e94d888299046f013c2ac801308b4e93fd` |

## Regression and local verification

- Invalid recipe pin: new test failed before correction (20/21 PASS, exit 1), then passed (21/21, exit 0); changed Dockerfile and CRLF copies are rejected. The strict Git/LF recipe is `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
- Fractional clock: `(90000.000003 + 180000) - 90000.000003` is `180000.00000000003`. Expanded suite failed before correction (21/22, exit 1), then passed (22/22, exit 0), including changed deadline/policy and nonfinite clocks.
- Windows Node 22.23.1 / pnpm 11.25.0 after the recipe fix: frozen install, lint, typecheck, root 86/86 and build all exit 0 (1.51 / 1.87 / 67.40 / 42.63 / 28.39 seconds). After the deadline fix: lint, root 87/87 (36.12 seconds), focused 22/22 and diff check all exit 0. These are trusted adapter/boundary tests; no host candidate execution.
- Code-head Fast CI [40685108751](https://github.com/Meta-Project2026/Metamorph/actions/runs/40685108751) passed Node 22/24 with root 87, reference 56, target 69, differential 78 and qualification 2, all without skips. Its actual PR merge checkout was `f644bb7c4e589bbe975c7474fdbe875e33a65465`, distinct from the exact branch SHA used by the Docker proof.

## REPORT_ONLY and acceptance boundary

This report records the executed code SHA `e2cc71ce1822e4eccf581d3f488e09ef489f077d`. The subsequent documentation-only commit is REPORT_ONLY: this run is not retroactively attributed to that later SHA. Exact final-head acceptance requires another complete dispatch after the report commit; its run, job and artifact are published in PR #30 and Issue #23. No code or workflow change belongs in that reporting commit.

Independent ChatGPT review remains pending. G0/G4, AI generation, live APIs, held-out audit, owner agreement, product acceptance and external raw retention are not established by these scoped receipts. No shared-API or governance approval is inferred. PR #31 / Issue #24 and the auditor's hidden data were not read or changed. No unrelated Issue #34 change was made.
