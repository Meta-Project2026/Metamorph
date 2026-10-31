# MMP-097 — Option A candidate-only encrypted retention

Status: **IMPLEMENTED / NO_GO_PENDING_ACTUAL_DOCKER_ACCEPTANCE**.
Tracking: [#97](https://github.com/Meta-Project2026/Metamorph/issues/97).
Base: fresh `origin/main@38aa818e4afe75512e4555390246f44b5d7798db`, after PR95/87.
Branch: `codex/mmp097-option-a-retention`.

The supplied task records the owner's 31 October Option A decision in #96.
Scope: encrypted-export implementation, not a paid request, workflow dispatch,
live artifact upload, merge or access to any owner key. Historical MMP-094
documents remain exact pre-implementation audits.

## Contract

Legacy **G1_BUILD_FAILED** remains `mmp089-private-diagnostics-v1`: the unchanged
builder selects admitted TS, trusted compiler receipts and manifest. Legacy
preservation identities and record format remain unchanged.

New **G1_PASS_COMPLETED** is `mmp097-candidate-only-v1`. Only admitted
`src/**/*.ts`, canonical per-file SHA/bytes manifest and minimal exact-run
identity are exported. An identity digest binds all ordered pair IDs, pack
seals, successful build identity, cleanup and parity metadata. No compiler/
runtime output, HTTP/SQLite values, reference, Oracle, comparator, G4, provider
response, inventory, token or environment is exported.

All MANIFEST pairs require successful trusted G1 with both compiler phases,
complete G2/G3 IDs and PASS/FAIL outcomes, matching public/private metadata,
identical source, no operation failure and normal cleanup. Partial FAIL is
ineligible. Runtime adds a sealed metadata-only retention sidecar after observing
build/lease/cleanup. The new selector reads only bound indexes, provenance,
source and this sidecar, never mixed completion or raw observations. Failed
sidecar projection closes export without changing gate scoring.

G1 ERROR/cancel/timeout/INCONCLUSIVE/NOT_RUN and unfinished parity remain
NOT_APPLICABLE. Tampered otherwise eligible trials are REJECTED. ERROR is never
relabelled semantic FAIL. The independent upload gate rederives variant/bindings,
checks the exact record, ciphertext digest/size, both successful producers and
normal plus independent finalizer **0/0/0**. Legacy failure-format receipts
cannot admit PASS candidates. Only actual upload success yields PRESERVED.

Pinned recipient, age v1.3.2, encryption sandbox, fixed candidate-diagnostics.age
path, seven-day ciphertext-only artifact, 4 MiB plaintext/5 MiB ciphertext and
source-admission limits are unchanged. Model API, signed authorization, scoring,
worker recipe/budgets, reference, comparator and hidden tests are unchanged.

## Plan and current completion

- [x] Audit existing identity/selector/producer/upload paths.
- [x] Add separate source-only case, sealed metadata and upload binding.
- [x] Add synthetic positive/adversarial source and CLI tests.
- [x] Supply bounded manual real-Docker/crypto driver and coverage registration.
- [ ] Execute complete actual Linux Docker/crypto acceptance matrix.
- [ ] Exact-pushed-SHA independent security and final ChatGPT review.
- [ ] Reviewed merge; no self-approval or issue closure.

Docker/crypto acceptance: **NOT_TESTED / NO_GO**. See [validation.md](validation.md)
and [acceptance.json](acceptance.json). Green CI cannot close it. #61 remains
NOT_ESTABLISHED, G0/G4 INCONCLUSIVE; owner roundtrip remains NOT_VERIFIED.

## Manual reproduction — not dispatched here

On an authorized disposable Linux Docker host, use a clean exact commit, frozen
install/build and qualified MMP089 tools. Supply fresh absolute paths and no
credentials:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  AGENT_HEAD_SHA=<exact-reviewed-commit> \
  MMP097_PRIVATE_PARENT=<new-private-directory> \
  MMP097_PUBLIC_OUTPUT=<sanitized-output-directory> \
  MMP089_AGE_PATH=<qualified-tools>/age \
  node research/mmp-097/offline-controls.mjs
```

The unexecuted driver runs validator -> preserver -> independent finalizer ->
upload gate for four parity combinations and legacy build failure. Candidates
adapt the unchanged public workshop fixture and retain its MIT notice. HTTP
status mutation changes responses; a post-request extra table changes state
after the initial snapshot. These intended outcomes are not observations.
Real age uses throwaway keys for exact source/manifest roundtrip, wrong-key and
tamper rejection, recipient/size/crash/deadline controls. No uploader is called.
Negative crypto controls require the encryption-error category and successful
internal cleanup; deadline input also requires compatible elapsed time. The
underlying process-crash/timer cause stays NOT_INDEPENDENTLY_ESTABLISHED, rather
than being inferred from any rejection. Driver receipts distinguish observed
ERROR/timeouts/cancellation from proven FAIL with fixed stage/cause codes.
Even five successful scoped cases leave actual G1 error/cancellation and the
complete matrix pending; the driver labels that boundary explicitly.

Public receipts contain categorical statuses/identities/digests only. Private
roots, keys, ciphertext, plaintext and raw output must never be committed or
uploaded. Failure is retained; no automatic retries.

## Trust limits

SHA seals are not signatures. Trusted host/selector/source producer/daemon and
no concurrent same-UID/root writer are required. Bounded reads, no-follow/stat
checks and admission reject ordinary links/replacement/size violations; they
do not defeat malicious root or authenticated-looking full receipt rewrites.
Secret-marker rejection cannot prove absence of arbitrary encoded secrets.

Age authenticates ciphertext against tampering, not its sender. Verify the
trusted exact-run receipt/digest. The public repo exposes ciphertext downloads;
plaintext access depends on owner key custody. Streaming decrypt failure may
leave partial plaintext: consume only after exit0. Runner loss/cancellation and
seven-day expiry still permit data loss. No secure-erasure/crash recovery
guarantee. See [owner runbook](../mmp-089/RUNBOOK.md).
