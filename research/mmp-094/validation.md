# MMP-094 validation and trust boundaries

Execution/main SHA: `53b4d5a1da99e49a223fa9cafe03ff24b280bf86`.
Worktree initially clean, isolated from the user's stale main checkout. Branch
`ilia/mmp-094-paid-v2-readiness` starts at this SHA; only `research/mmp-094/`
changes. No new mjs directory, dependency, workflow or coverage-matrix change.

## Executed local commands

Windows Node24.21.0 / pnpm11.25.0. All final commands below exit0; detailed elapsed
times and execution HEAD are in [local-checks.json](evidence/local-checks.json).

| Command | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; lockfile unchanged |
| `pnpm build` before audit | PASS |
| `node research/mmp-086/audit-request.mjs <local-output>` with local deny-network preload and fresh minimal env | PASS; 22762 full serialized bytes; request/context hashes freshly recomputed |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 459 tests, 357 PASS, 102 Windows skips, 0 FAIL |
| `pnpm build` after tests | PASS |
| `node research/mmp-069/check-syntax.mjs` | PASS; 63 active modules parsed; none imported/executed by syntax check |
| `node research/mmp-069/validate.mjs` | VALID; 64 research modules discovered, including existing archived exclusion |
| Existing `validateMetaEnvironment` over freshly retrieved GitHub metadata | PASS; protected exact main and main-only environment policy; no secret endpoints |

The local preload launcher initially failed twice with
`ERR_UNSUPPORTED_ESM_URL_SCHEME`: Windows absolute `--import` path needed a
`file:///` URL. Failures occurred before importing repository audit code; no
provider/network operation occurred. Only this uncommitted local wrapper was
corrected. These are not request/Oracle failures. The successful audit child
received only PATH/Windows system/temp names, no provider/GitHub/OIDC credentials,
with HTTP/HTTPS/fetch/socket entrypoints denied; blockedAttempts0. No raw request
body or PHP source is published; the JSON receipt contains identities, schema
digest, file hashes/byte counts, limits and projection only.

## Exact hosted CI and historical Docker/crypto

[Main Fast CI41014429601](https://github.com/Meta-Project2026/Metamorph/actions/runs/41014429601),
event push, head53b4d5a: SUCCESS. Node22 job123927432067 and Node24 job123927431657
completed every configured step. This establishes Fast CI for that exact main,
not hosted Docker, owner agreement or product acceptance. Final PR-head CI is
separately recorded in the PR after push; it must not be inferred from main CI.

Existing MMP-089 receipts were inspected as exact Git blob bytes from audited
main. Nine safe receipt digests are inventoried; five independent receipt hashes
match the original `independent-execution.json` hash list exactly. Ten relevant
implementation/workflow Git objects are identical between historical execution
head `dc28ac9b94617e95dd7aab2712b6eaf03fe4fc9b` and main. This binds prior code
evidence without relabeling its execution SHA or claiming a new Docker run.

- Executor and independent reviewer: 20/20 real network-off Docker/crypto
  controls each; real validator exit1 with expected G1 FAIL; both finalizers
  0 containers/0 volumes/0 emergency removals. Throwaway-key exact source/manifest/
  compiler equality, wrong-key and tamper controls passed. These are independently
  executed local Linux observations, not GitHub-hosted Docker evidence.
- Production recipient test reached ENCRYPTED_PENDING_UPLOAD only. Actual
  ciphertext artifact upload and actual owner-key decryption are NOT_RUN.
- Initial executor control exited1 with compiler ETIMEDOUT, crypto controls
  NOT_RUN. Additional unchanged baseline is PARTIAL/EVIDENCE_ERROR with inner
  build ETIMEDOUT/SIGTERM; proof exit NOT_RECOVERED, source-implied1 is inference.
  Keep #84 open and distinguish this ERROR from original paid G1 BUILD_FAILED.
- Original real paid run40900698372 candidate/source/compiler errors remain
  unavailable in inspected public material; ROOT_CAUSE_UNKNOWN.

See [historical-provenance.json](evidence/historical-provenance.json). New Docker,
crypto, signed workflow admission/validate_only, owner-key challenge and actual
artifact uploads are **NOT_RUN**. No workflow dispatch or rerun was requested.

## Workflow/security audit

Manual-only workflow; guard enforces reviewed main, owner login/ID, attempt1,
explicit confirmation and estimate selector, current protected branch/environment
policy. Signed OIDC admission checks repository/ref/workflow/run/head/actor and
tariff expiration. Exclusive consumed ledger/checkpoint is flushed before any
possible POST. Session stops on success or error; no retries/repairs/failovers.
Unknown charge after timeout never permits an automatic second attempt.

Chain: install/build → pinned age tools → one generation step → secret-free
validation → failure-aware preservation → always finalizer → receipt/cleanup
gate → one fixed ciphertext upload → actual upload recording. Only generation
maps `secrets.META` to MODEL_API_KEY. `validate_only` skips tool install/generation/
candidate preservation and checks real signed admission without provider/key;
it still requires dispatch/owner admission and is not authorized or executed here.

Compiler, candidate launcher, selector and encryptor receive explicit clean
environments. The general trusted host Docker CLI inherits its host step env;
do not claim all host child processes are sandboxed/clean. It runs in the separate
validation step without MODEL_API_KEY. Selector is trusted filesystem/Docker host
code, not a filesystem sandbox; encryptor is network-off/nonroot/read-only with
bounded stdin and tool mounts, no home/host roots/socket/key. Same-UID/root and
reviewed trusted code remain assumptions. OIDC/runtime credentials in a job mean
absence of MODEL_API_KEY alone is not proof of total credential isolation.

Uploader path is exactly `candidate-diagnostics.age`, no glob/fallback. Seven-day
artifact is ciphertext accessible under public-repository read permissions.
Public JSON contains reviewed structural identities/hashes, bounded compiler
codes/locations and statuses; no actual source/raw diagnostics/provider response.
No owner age identity is mapped, inspected, requested or uploaded. Local public
challenge preparation provides instructions only; no owner outcome was supplied.

Meta API GET/POST0; paid dispatches0; all workflow dispatches/reruns0;
ciphertext uploads0; hidden G4/private pack access0. GitHub metadata reads and
public documentation browsing are separate from provider API calls. Existing
unit tests use mocked/synthetic transports; these are not real inference.

## Handoff

`git diff --check` is required before commit; final changed-file scope and
Node22/24 PR CI are verified after push. Independent ChatGPT exact-pushed-SHA
review and merge decision remain external. Internal read-only subagent analysis
is not final approval. `CODE_REVIEW=READY_FOR_INDEPENDENT_REVIEW`,
`PAID_SPEND=NO_GO`, `OWNER_ONE_POST_PAID_AUTHORIZATION=NOT_GIVEN`.
Any main change makes this audit STALE_SHA_NO_GO until recomputed. No self-merge.
