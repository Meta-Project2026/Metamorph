# Public Docker reproduction driver

Refs #44. This is an executable continuation of the unchanged PR #45 public
preregistration, not the private evaluator or a candidate fix. The frozen corpus
is 14 fresh pairs, 38 HTTP and 52 full SQLite comparisons. Bootstrap and the
deliberate copied-status negative control are outside those totals.

From an exact committed Linux amd64 checkout on a disposable Docker host:

```sh
pnpm install --frozen-lockfile
pnpm build
node research/mmp-044/check.mjs
node --test research/mmp-044/driver.test.mjs
export MMP044_HEAD_SHA="$(git rev-parse HEAD)"
export MMP044_WORKDIR="$(mktemp -d /tmp/mmp044-job-XXXXXXXX)"
export MMP044_PARENT="$MMP044_WORKDIR/private"
export MMP044_OUTPUT="$MMP044_WORKDIR/public"
mkdir "$MMP044_OUTPUT"
node research/mmp-044/run-public.mjs
node research/mmp-044/finalize.mjs
sha256sum "$MMP044_OUTPUT/summary.json" "$MMP044_OUTPUT/finalizer.json"
```

The parent must not already exist. No PHP or admitted TS executes on the host.
The manual-only workflow supplies those variables without secrets or custom
code inputs. It checks out `github.sha`, uses Node 24 and frozen dependencies,
joins bounded work, and runs the independent finalizer even after failure.
Default worker lifetime/operation/reset/state bounds are unchanged. The host
work deadline is 20 minutes plus independent cleanup; the original runtime
broker does not accept cancellation, so its bounded build is joined before
acting on an abort. The outer workflow limit is 30 minutes.

Only `summary.json`, `finalizer.json` and a successfully allowlist-verified
`public-repro.json` may be uploaded, for seven days. Raw
HTTP/DB/server/build receipts stay in a new 0700/0600 host evidence pack outside
the repository. No existing audit directory or PR #31 artifact is accessed.
The summary exposes original comparator codes and SHA-256 commitments to full
mapped observations, never forecasts as runtime observations. Full raw receipts
are not automatically made public. The optional projection includes only public
request commitments, numeric IDs, dates, sequence and counts, and verifies selected
raw-versus-mapped HTTP/SQLite fields independently. Messages, seed names and all
other cell values are excluded; an unexpected observation suppresses publication
without changing comparison results. Fixed in-container PHP/JS operator diagnostics
record actual PCRE version, form-decoding hex, regex outcomes and integer coercion.
Independent cause review is required before a confirmed causal classification;
the driver conservatively emits `NOT_ESTABLISHED` pending that review.

Exit 0 means complete harness execution with valid positive/negative controls
and clean resources; `parity` may still be `FAIL`. Missing steps, wrong identities,
bad initial state, clock faults and emergency cleanup are `ERROR`. On ordinary
candidate mismatch the remaining fixed schedule continues. G0/G4 remain
INCONCLUSIVE, product NOT_ESTABLISHED, and the private AUDIT_FAIL is unchanged.

The exact job ledger is created before provision and tracks PHP names and target
run prefixes. The finalizer restores only that ledger and never removes foreign
containers/volumes by a generic label or prefix. The existing runtime broker
also removes its own short-lived provenance container in its internal finally.

The workflow path is absent on default main, but actual dispatch of the feature
ref succeeded without registration merge. The optional registration PR #48 was
therefore closed unmerged. Do not assume a default-branch registration blocker
without an actual API response. Dispatch the reviewed feature ref:

```sh
gh workflow run mmp044-public-docker.yml --repo Meta-Project2026/Metamorph --ref feat/mmp-044-public-docker-proof
```

No self-merge or direct push to main is part of delivery. A green Fast CI job is
technical validation only. See the separate execution report for actual checks,
dispatch state and exact counts.

Actual selected proof: [run 40708487948](https://github.com/Meta-Project2026/Metamorph/actions/runs/40708487948),
code `5efce039179dfa46e8878b748bafa86fff11158a`: 14/38/52 completed,
9 scenario PASS / 5 FAIL, controls and cleanup PASS. The subsequent executor
[classification](../../specs/014-public-validation-triage/classification.public.json)
is CANDIDATE_BEHAVIOR_CONFIRMED on public evidence only. Runtime summaries retain
their original deferred classification. External independent review is pending.

Verify the preserved allowlisted artifact offline (no Docker/app execution):

```sh
node research/mmp-044/verify-public.mjs specs/014-public-validation-triage/docker-evidence/run-40708487948 5efce039179dfa46e8878b748bafa86fff11158a
```
