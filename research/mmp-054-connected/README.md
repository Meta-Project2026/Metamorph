# MMP-054: connected public PHP/TS and Agent proof

Refs [Issue #54](https://github.com/Meta-Project2026/Metamorph/issues/54),
including its 2026-10-28 scope amendment. This is a preregistered execution plan;
all new runtime results are **NOT_RUN** until published in the PR/issue comments.
Expected counts below are targets, not measurements. No new runtime is introduced.

## Source decision and exact revision

- BASE_SHA: `7cf6e678802802d16336685771c842d0ce6cf37d` (fetched main).
- Branch: `Vladimir/mmp-054-connected-public-e2e`, separate clean worktree.
- EXECUTION_SHA / PR_HEAD_SHA: the full commit containing this plan, recorded in
  the PR before dispatch. Keep HEAD fixed after the successful experiment.
- Registered entrypoint: `.github/workflows/mmp044-public-docker.yml`, explicitly
  selecting `proof=mmp049-compatibility`, invokes the unchanged local reusable
  `.github/workflows/mmp049-candidate-compat.yml` at the same SHA.
- Source inspection found one real blocker: merged PR #59 changed only the
  Oracle runner's directory creation to `mkdir(..., { mode: 0o700 })`, but the
  MMP-044 admission pins still required the previous runner bytes. Canonical Git
  blob hash changed from
  `87a9c4528402937d1be54a70a8903dc3ff025c3270b4a1eae93e404028aab94b` to
  `adf610324c8af75c4cde974f5e772ad82646b1435fd378b08584f3b8ea630150`.
  Refresh that one research pin and the two checksums of the pin document.
  No production source, comparator, normalization, workflow gate, corpus,
  candidate, recipe or API is changed. All other canonical pinned blobs match.
  This records the already merged permission correction; it asserts no new
  owner approval. Historical evidence and exact historical source stay intact.

## One bounded experiment

Commit/push and open the PR with NOT_RUN status before executing:

```powershell
gh workflow run mmp044-public-docker.yml --repo Meta-Project2026/Metamorph --ref Vladimir/mmp-054-connected-public-e2e -f proof=mmp049-compatibility
```

One planned proof run. Retry only after diagnosing a definite setup/code defect;
preserve the failed run, exact first stage/case/exit, fix and both SHAs. No
result-driven retries, provider calls, hidden corpus, #55/#56 storage/custody
work, merge, auto-merge or automatic issue closure.

Original workflow order: exact checkout; frozen install/build; MMP-049 host
boundary tests; pinned PHP/JS operator probe; real public differential proof;
deterministic Agent FAIL/repair; independent always-finalizer; allowlisted upload.
Job: Ubuntu 24.04 amd64, 35 minutes. Existing proof deadline: 27 minutes;
Agent outer deadline: 12 minutes, Agent budget: 600 seconds / one repair / no
escalations. Existing target lifetime: 180000 ms, memory 256 MiB, CPU 1, PIDs 64,
operation 15000 ms, startup 10000 ms, bounded output and state. Do not extend them.
Internet is allowed on the host/daemon for pinned dependencies/source. Worker
network remains `none` (inspector may share that isolated network), read-only
root, dropped capabilities, no-new-privileges, separate state and no Docker socket.

## Public coverage and identity targets

| Stage | Fresh pairs | HTTP | Typed SQLite initial + post-step |
| --- | ---: | ---: | ---: |
| Original MANIFEST (3 cases) | 3 | 17 | 20 |
| Unchanged MMP-044 corpus (14 cases) | 14 | 38 | 52 |
| MMP-049 public regressions (25 cases) | 25 | 55 | 80 |
| Main total | 42 | 110 | 152 |
| Agent attempt 1, public cancellation no-op | 3 | 17 | 20 |
| Agent attempt 2, corrected source | 3 | 17 | 20 |
| Agent total | 6 | 34 | 40 |

Derive actual counts from each new per-case receipt; reconcile workflow log and
artifact, not just aggregate labels. Preserve status/headers/body and full typed
SQLite comparisons, initial snapshots, every step and original normalization.
Run six existing workshop controls, original known-good lifecycle and intentionally
corrupted HTTP-status negative control. Operator probes cover the existing 44
numeric and 12 whitespace families, with compiled candidate helpers inside Docker.

Pinned public source: `tanjilaafsarirubina/car-workshop` commit
`d272170d0aecbd28eb5b13e272d9dd11d545b66c`, archive
`32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`;
retain original MIT notice and verified license hash from the existing pin file.
MANIFEST SHA-256:
`d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`.
Frozen baseline candidate:
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`;
separate `workshop-compat-v1` candidate:
`5fe43bb1b0e2147fb85d1c0074678e5823fb07c45cbd7d90c1bdee030b24d928`.
Target recipe:
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
Capture fresh PHP/TS image IDs, toolchain provenance, Agent source lease/attempt
identities and pair IDs; no candidate application executes on the host.

## Verification, publication and receipt index

Before dispatch run required host checks and focused adversarial tests:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node research/mmp-049/check.mjs
node --test research/mmp-049/driver.test.mjs
node --test research/mmp-054-connected/verify.test.mjs
git diff --check
```

The new tests mutate historical PUBLIC fixtures in memory solely as verifier
unit controls. They never become fresh runtime receipts and are never uploaded.
Record each command's exit, actual skips and platform; Fast CI is separate.

After the run, require `run.head_sha == checkout == EXECUTION_SHA == PR_HEAD_SHA`;
compare workflow and executable source blobs with the inspected revision. Inspect
logs and stage conclusions, setup versions, runner image, timings, and available
budget information (unknown quota stays unknown).

Download only artifact **mmp049-public**. Validate GitHub digest, ZIP SHA-256,
CRC, duplicate-free exact membership of `semantics.json`, `summary.json`,
`agent.json`, `finalizer.json`, and sizes before bounded extraction. Then run the
unchanged verifier from the exact executed checkout:

```powershell
node research/mmp-049/verify.mjs <public-receipt-directory> <EXACT_EXECUTED_SHA>
```

Do not publish raw HTTP/SQLite, child logs, ephemeral directories, secrets or
private packs. Public index is append-only PR/issue comments (no post-run HEAD
change): record run/attempt/job/artifact IDs and links, trigger/ref, all relevant
SHAs, artifact ZIP size/digest and each allowlisted JSON's size/SHA-256. These
comments are an audit convention, not cryptographic immutable storage. The hash
index survives artifact expiry; preserve a local trusted copy of the exact ZIP
and four allowlisted JSONs for later retrieval. No raw packs are downloaded or
published. Downloaded evidence and logs remain outside Git.

PASS requires every mandatory stage and case, correct identities/controls,
per-stage normal cleanup, zero owned containers/volumes and `emergencyRemoved=0`,
plus unchanged independent verifier exit 0. Emergency removal, source drift,
unknown inventory, missing steps/files, incomplete evidence or failed teardown
are ERROR / NOT_VERIFIED even if a label says PASS; real parity mismatch is FAIL.
Preserve failures and earlier receipts. Host connectivity is allowed; a host or
daemon egress-denial probe is outside this task.

Publish PREPARE, REAL_DOCKER, G1, PUBLIC_G2, PUBLIC_G3, AGENT_REPLAY,
NORMAL_CLEANUP, INDEPENDENT_VERIFICATION, SECURITY_BOUNDARY, G0, G4, PRODUCT,
MODEL_GENERATION matrix and observed-vs-target coverage in both PR and Issue #54.
G0/G4 remain INCONCLUSIVE, product NOT_ESTABLISHED, model generation NOT_RUN;
deterministic source replay costs $0 and is not LLM generation. Preserve historical
PR #31 AUDIT_FAIL, unresolved #34 cause, and optional #60 OFFLINE_PROOF_NOT_RUN.
Ask independent ChatGPT review of the exact PR SHA and public artifact; no
self-approval, merge, account impersonation or automatic issue closure.

## Risk register

| Risk | Treatment |
| --- | --- |
| Merged #26 pin drift | Exact one-file pin refresh; mutation and unchanged-pin tests before dispatch |
| Docker/image/source availability or runner quota | Preserve first failure; no simulated fallback; record available diagnostics and unknown quota |
| Resource leaks, cancellation, timeouts | Original bounded workers, normal cleanup and independent always-finalizer; emergency removal is ERROR |
| Mutable ref or post-run commits | Fixed feature HEAD; cross-check run/checkout/source; publish results outside the branch |
| Artifact expiration or partial download | ZIP digest/CRC/allowlist; screened public-only durable attachment and append-only hash index |
| Public receipts alone cannot prove arbitrary provenance | Correlate exact GitHub run, stage logs, source pins and negative controls; independent review pending |
| Hidden/model/product overclaim | No hidden data or model calls; G0/G4 INCONCLUSIVE and product NOT_ESTABLISHED |
