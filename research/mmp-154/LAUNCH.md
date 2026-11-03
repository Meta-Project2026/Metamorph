# First genuine source-backed run: operator handoff

This increment implements the instruction's generation-only fast path. It does
not implement or authorize production repair. The existing SYNTHETIC two-step
controller and its earlier Docker result remain separate evidence. The blocked
autonomous_repair option is not the desired final state; it needs a subsequent
reviewed signed capability and separate attempt-2 custody implementation.

## Before launch

An independent ChatGPT reviewer must inspect the pushed exact PR HEAD. After
genuine approval and merge, use current protected `main`, not this development
branch or a PR merge ref. CI success alone does not meet this condition. Neither
this implementer nor the preflight card supplies independent approval.

The authenticated operator must be `barbalatv` (85129726) or `l1ncolny`
(338248494). The GitHub environment remains `META_API_KEY`, mapping secret `META`
only into the generation step's `MODEL_API_KEY`. No key should be copied locally
or sent in chat. Signed OIDC also binds actor ID, first run attempt, current
protected main, workflow SHA, run ID, repository IDs and GitHub-hosted runner.

Verify the authoritative pricing/billing pages again and read PRICING.md. Check
the authorized account dashboard if accessible for actual credit/balance terms.
No account lookup or secret access was performed during implementation. The
owner-reported 1,000 executions is not an enforced prepaid quota. The first
tranche is exactly one potentially charged POST; pay-as-you-go and ambiguous
timeouts may incur a charge. Do not scale while charging/prepayment is uncertain.

## Produce the immutable exact-main card

In a clean checkout of independently reviewed, merged main with pinned
dependencies installed and built, fetch main and verify the checkout SHA equals
the fetched protected main. Do not change another owner's shared checkout.

Run the offline preview, explicitly choosing the actual operator and an unused
absolute output path outside the checkout:

```powershell
node research/mmp-154/preflight.mjs barbalatv 0.25 C:\path\outside-checkout\mmp154-main-preflight.json
```

Use `l1ncolny` instead when that is the authenticated initiating operator. The
parent directory must already exist. The helper refuses a dirty tree, unknown
operator, unsupported allowance, stale snapshot or existing/partial destination.
It reads only the approved pinned public PHP workshop source as inert data. It
does not query Meta, read a credential, dispatch a workflow or grant admission.

The card shows repository/head, workflow-byte hash, operator ID, source/archive/
context/manifest hashes, Standard model, tariff verification date and sources,
exact body hash/bytes, 16,384 output-token ceiling, projected USD 0.226332, maximum
one POST, zero repairs/retries, and explicit unknown account balance/credit/charge.
The `0.25` choice is an estimate allowance; `0.10` remains the default and blocks
this workload. Neither choice enforces a provider dollar cap. Do not reuse a
card if head, source, workflow, model, tariff, actor or allowance changes.

## Authentic narrowly scoped launch

After reviewing the exact card and accepting that one possibly charged attempt
has no provider hard cap, the trusted operator opens **Actions → Meta paid
migration → Run workflow** on `main` and supplies:

| Input | Value |
| --- | --- |
| execution_mode | single_generation |
| reviewed_sha | Exact merged-main SHA printed in the new card |
| confirm_paid | I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP |
| max_estimated_usd | 0.25, matching the reviewed card |
| model_provider | meta |
| validate_only | false |

`validate_only=true` is optional signed-admission validation, never model or
Oracle evidence. No development environment or CI test may dispatch this run.
No runner rerun or retry is allowed. A crash, timeout, cancellation, partial
ledger or unknown response retains the reservation; start no second send in
that experiment. A distinct later run requires review of the result and a new
operator-triggered bounded experiment with an explicit hypothesis.

## Read the result

`meta-paid-public-<run-id>` retains only explicitly selected sanitized records
for seven days: preflight, generation, append-only reservation/completion
checkpoints, trial, custody receipts, finalizer and scorecard. A separate
`mmp107-candidate-<run-id>-1` artifact holds only candidate age ciphertext.
Its authenticated ID/digest, download and byte readback must precede the Oracle.
Raw candidate source, age identities, reference observations and SQL are not
published. Optional encrypted diagnostics retain the existing separate policy.

The validator now exits 0 for either COMPLETE_PUBLIC_PASS or
COMPLETE_PUBLIC_FAIL: successful completion of a comparison is not a successful
migration. ERROR or incomplete coverage exits 1 and cannot supply repair codes.
The result must show all 6 G1 checks, 17 HTTP, 20 SQLite and 27 public controls,
candidate binding and normal plus independent zero-resource cleanup. A G1 FAIL
remains an observed G1 FAIL with later gates unestablished, never an eligible
complete public failure. Each worker still executes only inside Docker.

The scorecard is a read-only projection of recorded trusted-adapter receipts,
not another Oracle execution or a new authorization. Inspect original receipts
when it reports unavailable evidence. Charged cost stays UNKNOWN; usage cost is
an observed tariff estimate. Public PASS stops; complete FAIL stops with
PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED. No second or third POST exists here.
G0/G4 stay INCONCLUSIVE and product remains NOT_ESTABLISHED in every case.

After a genuine run, add its exact run URL/SHA, request count, candidate hash,
custody identity, usage/estimate, public verdict/coverage/cleanup and a concrete
next hypothesis to REAL_EXPERIMENTS.md. Have ChatGPT independently review that
exact result. Do not copy synthetic fixtures or a manually repaired derivative
into this log as model output.

## MMP-158 two-attempt launch addendum (signed generate_then_repair)

The reviewed `generate_then_repair` mode performs at most two signed POSTs in
one workflow run: generation → independent Docker Oracle →, only on a complete
eligible public FAIL (`publicRepairDecision` FAIL with allowlisted codes and
verified stored attempt-1 custody), one repair POST → second independent
Docker Oracle. Both sends are projected and reserved before the first POST on
the immutable card (maximumPosts 2, maximumRepairs 1, aggregate worst case);
the attempt-2 card binds the exact repair body (genuine previous model changes
plus public feedback codes only) and re-checks the aggregate. Each attempt has
its own OIDC admission, candidate-only age custody, distinct artifact
(`mmp107-candidate-<run>-1` / `-1-repair`), verified readback and fresh
Oracle. A first-attempt PASS stops after one POST; there is no third POST and
no automatic retry. Dispatch with `execution_mode=generate_then_repair` and
`confirm_paid=I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP`; the single-generation
default path is unchanged. All other preflight/launch conditions above apply
unchanged, including independent exact-HEAD review, merge to protected main
and authentic operator action. No dispatch happened from implementation.
