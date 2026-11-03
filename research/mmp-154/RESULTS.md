# MMP-154 first live probe preparation — 2026-11-03

**Delivered: runnable generation-only first increment. Primary real-inference
acceptance: NOT_RUN. Full signed real repair chain: NOT_IMPLEMENTED.**

[Draft PR #155](https://github.com/Meta-Project2026/Metamorph/pull/155), refs
[#154](https://github.com/Meta-Project2026/Metamorph/issues/154) and
[#151](https://github.com/Meta-Project2026/Metamorph/issues/151).
Fetched base: `79c0b2f61052ce12c527ce42cf2e6c20c43282ae`, containing merged PR #153.
Code/evidence implementation: `438d6a95796c521d842b0917da3555501cef2723`;
initial pushed increment: `0921be8439f9504ab2116d2023c59fae44aff5db`.
Work is isolated in branch `codex/mmp154-live-first`; the original checkout and
other owners' active feature pointers remain unchanged.

## What changed

The updated instruction explicitly prioritizes the smallest safe generation-only
probe before engineering the second signed request. This increment preserves
the existing one-POST path and makes its operator decision concrete/reviewable:

- `migration-preflight.mjs` creates a deterministic source-backed card with exact
  head/workflow/body hashes, actor ID, Standard model, current tariff/sources,
  token ceiling, estimate, maximum one send and zero repairs/retries. It grants
  no capability and states unknown credit/balance/charged amount.
- `meta-paid-authorization.mjs` binds the card/workflow hashes into existing
  opaque signed admission, durably commits the card before UNKNOWN reservation
  and POST, refuses existing/partial cards and refuses admission after tariff
  expiry. Genuine OIDC, actor, protected-main and environment checks remain.
- `meta-tariff.mjs` is the single new-run snapshot, verified against official
  Meta documentation on November 3. Rates remain 1.25/0.15/4.25 USD per million
  input/cached/output tokens; November 10 is a seven-day project review deadline,
  not a provider guarantee. See [PRICING.md](PRICING.md). Historical receipts stay
  intact. The current MMP-120 audit now explicitly locks the new version, date,
  documentation URL, exact rates and expiry instead of the superseded snapshot.
- `paid-run.mjs` publishes the exact card and append-only pre-send/final receipt
  files, retaining the original latest receipt. These fixed sanitized files are
  included in the existing seven-day public artifact allowlist.
- `live-experiment.mjs` projects counts, candidate/request/response hashes,
  observed usage estimate, gate counts, validated recorded custody bindings,
  independent finalizer, feedback codes and stop reason. Unknown billing stays
  null. It reads no candidate text and grants no repair or Oracle authority.
- `validate-candidate.mjs` keeps mandatory stored-ciphertext admission. A complete
  public FAIL can finish the comparison step (exit 0) with an explicit FAIL
  result; incomplete coverage or ERROR exits 1. A green workflow step therefore
  means completed comparison, never successful migration. G0/G4 remain
  INCONCLUSIVE and product NOT_ESTABLISHED.
- The new always-run scorecard step receives no Meta secret. Fast CI is unchanged;
  research was added to its existing syntax inventory. Package regression tests
  are selected by the existing root test glob.

No Oracle/comparator/contracts/worker/differential or `.specify` changes, no
reference or historical candidate edits, no new dependency, no Contributor
mode and no billable probe. Existing source pins and MIT notice checks remain.
The PR #153 process-group/join/quarantine and daemon-boundary code is untouched.

## Commands and evidence actually executed

Windows Node 24.21.0; pnpm 11.25.0. Exit codes below are process results, not
product acceptance. The full root suite uses synthetic provider transports.

| Command/check | Exit | Observation |
| --- | ---: | --- |
| `git fetch origin main`, worktree/branch, commits and pushes | 0 | New branch from current main; protected main was rechecked unchanged |
| Initial sandbox `pnpm install --frozen-lockfile` | 1 | EPERM on required pnpm symlink |
| Same frozen install outside sandbox | 0 | Pinned dependencies; no lockfile change |
| Initial sandbox `pnpm build` | 1 | Compiler process exit 134 / allocation failure; environment ERROR |
| Build outside sandbox, including final `pnpm build` | 0 | Full workspace build |
| `pnpm lint` | 0 | 353 files |
| `pnpm typecheck` outside sandbox | 0 | Full existing workspace command |
| Initial full `pnpm test` outside sandbox | 1 | 835 total: 722 passed, 111 skips, 2 failures from stale audit tariff pin |
| Full `pnpm test` after updating current audit pin | 0 | 835 total: 724 passed, 111 Windows/platform skips, 0 failed |
| Focused paid/preflight/repair/evidence/readiness files | 0 | 87/87; the subsequently refined scorecard file also passed all 7 focused controls |
| `pnpm exec biome check research/demo-readiness research/mmp-069 research/mmp-054-connected` | 0 | Existing scoped lint |
| `node research/mmp-069/check-syntax.mjs` | 0 | 119 modules; parsing only |
| `node research/mmp-069/validate.mjs` | 0 | Existing static inventory valid; not a test verdict |
| `node --test research/mmp-069/validate.test.mjs` | 0 | 45/45 negative inventory controls |
| `git diff --check` and shared-scope comparison | 0 | No whitespace errors; shared scope unchanged |
| Offline `preflight.mjs l1ncolny 0.25 <new outside-checkout path>` on clean code SHA | 0 | Exact deterministic card; no network or credential read |
| Repeat with same destination; repeat with default `0.10` | 1 each, expected | Refused no-clobber replay and insufficient estimate allowance |
| Read-only GitHub metadata via authenticated `gh api` | 0 | Protected main; main-only META_API_KEY environment; META secret name present; no secret value read |
| `docker version --format '{{.Server.Version}}'` | 1 | Linux daemon pipe unavailable |
| Actual `Invoke-DockerSmoke.ps1 -ScratchRoot <outside-repository TEMP>` attempt on clean code SHA | 1 | Stopped at `docker info`, MMP151_DOCKER_COMMAND_FAILED; no resource creation or Oracle execution |

The first 57-test focused run had one failure because a signed test fixture's
November 2 clock predated the newly verified snapshot; its synthetic clock was
updated to November 3, without bypassing freshness. The first scorecard tests
caught an absent-finalizer dereference; the missing-evidence path was corrected.
The final focused files pass. Local infrastructure failures are distinct from
model FAIL and did not cause a paid request.

First increment hosted Fast CI
[41679485854](https://github.com/Meta-Project2026/Metamorph/actions/runs/41679485854)
failed Node 22/24 on the same two stale audit-pin tests. This was fixed in the
second increment. Its hosted run
[41681525947](https://github.com/Meta-Project2026/Metamorph/actions/runs/41681525947)
passed on both Node 22 and 24 for exact code SHA
`438d6a95796c521d842b0917da3555501cef2723`. Documentation-only follow-ups and
their CI are separate from that code result. No workflow_dispatch was performed.

## Exact preview and launch blocker

The clean code-SHA preview for `l1ncolny` has workflow SHA256
`626ec938c1157749120e1a2f4423debd6fa2ae208aadfd517143fb390141890c`,
request SHA256
`d0e5c872a735ca5a039820147177f9eb2d2a2da4f9d0b6f5a93180f66dd7da46`,
23,148 request bytes, 125,360 projected input tokens, 16,384 maximum output
tokens, USD **0.226332** projected envelope and explicit USD 0.25 estimate
allowance. Card SHA256:
`2d439bdcef6f25932250c704c51d2709b0327f66a64a61999ae7215ddf6413a9`.
It is a branch preview only, neither a live run nor authorization. A new exact
main card must be generated after merge; different operator/head changes it.

The precise remaining live boundary is **independent exact-head review, merge,
then authentic operator dispatch on protected main with the exact preflight and
explicit one-attempt/no-hard-cap confirmation**. GitHub's current environment has
no required reviewer/wait timer, so CI or environment admission does not itself
prove the mandated independent review. The secret name exists; account credit,
balance and entitlement were not accessed or asserted. Do not invent an account
blocker, request keys in chat or bypass the authentic operator boundary.

[LAUNCH.md](LAUNCH.md) gives the exact preflight/launch contract and evidence
interpretation. Actual Meta calls: **0**. Independent live G1/G2/G3: **NOT_RUN**.
No real trial exists to supply a measured bottleneck or justify a follow-up
prompt change; [REAL_EXPERIMENTS.md](REAL_EXPERIMENTS.md) records that absence.

Signed generation-attempt-2 authority, prior-candidate/Oracle binding, distinct
attempt-2 encrypted artifact/readback and durable two-send production reservations
remain **NOT_IMPLEMENTED**. `autonomous_repair` still fails closed. This is the
instruction's first-probe shortcut, not completion of its full real repair
objective. No self-approval, merge, owner agreement or product PASS is claimed.
