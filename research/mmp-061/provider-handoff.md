# Pluggable provider boundary for MMP-061

Status: source binding and existing ModelProvider seam implemented; live adapters
UNCONFIGURED. No runtime/model/account/access/budget is currently authorized.

`createProductionMigrationProvider(context, selection)` is the trusted composition
factory. Its provider implements the unchanged `ModelProvider.generate(request,
signal)` port consumed by runAgent. Selection is an allowlist of none/local/meta,
not an executable module, URL, credential or caller-supplied price. A repository
reviewed backend can replace the corresponding factory branch after admission;
no Oracle, writer, comparator or benchmark change is needed. The synthetic
transport harness is a separate test export and cannot be selected in production.

The host adapter binds `context.prompt(request, previousGeneratedChanges)` around
that port, validates actual responses with ModelResponseSchema/validateBundle and
emits per-request receipts. Needed adapter obligations before live activation:

- Verify the selected runtime/model and license/terms. Local inference requires
  the precise shared billing change proposed in interface-proposal.md and both
  owners' review. An external API requires separately authorized access, account,
  model, exact budget/attempt/time limits and independently enforceable charges.
- Bind actual request ID, input/response hashes, model identity/version, nullable
  tokens/cache usage, real duration, reserved/reported/charged cost and output SHA.
  Preserve unknown paid usage and stop all subsequent requests; no fake zeros.
- Enforce bounded output, timeout, cancellation and joining of in-flight calls;
  never accept a late response as a new candidate after shutdown. No automatic
  failover/retry beyond the preregistered single repair.
- Complete live receipt correlation in migration-trial.mjs and supply the approved
  RunConfig/private output directory from the trusted host. Match every response
  SHA with the source session and every verification attempt. Publish all attempts,
  including failures, using the existing safe publicAttempt projection.
- Retain original Docker positive/negative controls and require independent normal
  cleanup plus zero final inventory. Keep the deterministic control receipts and
  model receipts distinct. G0/G4 remain INCONCLUSIVE and PRODUCT NOT_ESTABLISHED.

The current workflow entrypoint deliberately accepts only verified NOT_RUN
admission receipts. After independent review implements the above, extend it to
accept validated real-trial receipts and actual FAIL/ERROR results as appropriate;
do not merely change the status/admission boolean. The dormant lifecycle in
migration-trial.mjs is a handoff scaffold, not evidence that a live backend works.
No generic paid POST or local-as-synthetic substitute is provided by this PR.
