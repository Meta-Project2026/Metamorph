# Next #61 experiment — NO_GO

Run from the repository root, offline, using the committed frozen dependencies:

```sh
pnpm install --frozen-lockfile
pnpm build
node --test packages/agent-real/test/candidate-custody-research.test.mjs
node research/mmp-107/preflight.mjs
```

The preflight serializes current public context with the actual pure wire serializer
and budget projection. It neither obtains authorization nor calls a provider. Production
never imports the research module. CLI exit 0 means the offline checks completed; read
`readiness`, which is deliberately **NO_GO**, not permission to send a request.

Frozen source: `tanjilaafsarirubina/car-workshop@d272170d0aecbd28eb5b13e272d9dd11d545b66c`,
archive `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`, MIT notice
`46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9`.
`bindMigrationContext` checks exact api.php/config.php bytes and notice against pins.
Scope is five actions, eleven PHP functions, **one** current agent unit `workshop-api`.
No UI/MySQL/concurrency/whole-app claim. Benchmark `mmp061-workshop-api-v1`, manifest
`d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`.

For business/rejected/capacity scenarios require G1 typecheck+build (6 exact IDs),
G2 17 HTTP IDs and G3 20 typed SQLite IDs; all exact IDs are emitted by preflight.
G3 includes HTTP findings; an HTTP-only mismatch is expected to fail G2 and G3.
G4 stays INCONCLUSIVE, formal held-out NOT_RUN. Product acceptance remains
PRODUCT_NOT_ESTABLISHED until genuine AI generation supplies all applicable evidence.

At this base: `muse-spark-1.3`, Standard, reasoning `low`, one POST, zero repairs/retries,
16384 output tokens, 180-second request / 240-second session bounds. Current serialized
body is 22762 UTF-8 bytes, SHA-256
`55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`.
Policy projection is 123816 input tokens + 16384 output, **$0.224402** at locked rates
$1.25 input / $0.15 cached / $4.25 output per million, snapshot `meta-standard-2026-10-29`,
expiry `2026-11-05T00:00:00Z`. Default **$0.10 blocks**; whitelist .10/.20/.25/.50/.75/1.00.
These are current code values, not a live tariff verification, exact tokenizer or provider
hard cap. Recompute on the newly reviewed main SHA and confirm fresh tariff before any
separate authorization; do not silently choose .25. Spent/charged UNKNOWN, not zero;
estimated is not actual billing. No Meta GET was made to verify rates.

Recorded offline replay validation uses mmp-108/evidence/local-f9a7b44/summary.json:
known-good G1/G2/G3 PASS 6/17/20; HTTP-503 fault G1 PASS, G2/G3 FAIL with complete
17/20 and HTTP_STATUS. Both record normal and independent cleanup 0/0/0.
Receipt head is `f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`, not this PR head.
The projection records counts/first/last IDs, not full per-ID traces; rechecking that
record is not a fresh execution or new full-trace attestation. Existing MMP-108 controls
also check its projection/harness integrity. Fixtures are DETERMINISTIC, not AI output.
New Docker execution is NOT_RUN and needs separate authorization if required.

Before another POST: both-owner concrete custody approval; independently reviewed
implementation; real age synthetic restore rehearsed by the owner off-runner; original
candidate immutable manifest→ciphertext→durable checkpoint→restore checks proven; fresh
pre-Oracle 0/0/0 cleanup gate and upload acknowledgment tested, including crash/cancel.
Provider receipt/admission candidateSha must equal capture and later Oracle source pins;
generation custody UUID and verifier UUID must be explicitly linked, not conflated.
Any missing bytes or broken binding blocks Oracle; no repair can change original source.

Only after those pass may a reviewed checklist declare
`GO_FOR_ONE_OWNER_AUTHORIZED_MODEL_POST`, still requiring new authorization specifying
exact main SHA, model/body hash, chosen estimated budget, timeout, zero repair/retry,
the capture-before-durable-ack failure window and unknown-charge handling. No such GO
or authorization exists now. This preflight intentionally cannot issue it.

After genuine AI-generated G1/G2/G3 acceptance, prepare a separate truthful demo-readiness
PR with exact new receipts and source-recovery proof. Measure an actual 90-second and
4-minute human rehearsal. Both are currently NOT_RUN; existing historical fixture/demo
tracks and G4 limitations remain honestly labeled.
