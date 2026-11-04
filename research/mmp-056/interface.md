# Synthetic interface and proposed handoff

This is a versioned **proposal**, not approval to integrate #55/#57 or alter a
shared DTO. Public entrypoint `@metamorph/g4-registry` exports only
`createSyntheticRegistry`. It takes an absolute local journal path, a pinned
synthetic trust graph, an injected witness, and an authorization callback.
It returns methods `register`, `freeze`, `draw`, `authorizeAttempt`,
`startAttempt`, `finishAttempt`, `abort`, `receipt`,
`recordBehavioralFail`, `syntheticSelection`, and `syntheticEvidenceIdentity`. The last two are
synthetic-fixture helpers; no real hidden-selection interface is supplied.

The witness interface provides `checkpoint()` and `record(envelope)`.
`record` receives the entire synthetic transition and actor signatures as well
as its hash and predecessor; it returns an Ed25519-signed checkpoint only after
checking it. Tests independently reapply the state transition before signing.
Callers must not infer independent custody from this injected interface.
Every journal reopen verifies the live signed high-water, each actor signature,
each witnessed checkpoint, canonical encoding, chain and transition order.

The public receipt format is `mmp-056-synthetic-receipt-v1`; its scope is
`SYNTHETIC_ONLY`. It provides the run/epoch/registration/custody IDs, blinded
registration/candidate/selection commitments, safe stratum counts, coarse
attempt statuses, terminal times and terminal checkpoint references, current
checkpoint, and explicit real-admission and G4 non-claims. Changes to this
shape require a new version. It is not a `GateResult` or `RunEvent`.

After a terminal attempt, `syntheticEvidenceIdentity(attemptId)` produces
the existing #55 `mmp-evidence-identity-v1` shape. Its `witnessRef` is that
attempt's terminal checkpoint, not the most recent journal head; it remains
stable across a later technical retry. The focused test passes this object
through #55's existing `identity` validator, without invoking or modifying
storage. A future controller must reconcile the complete witnessed attempt set
against all #55 sealed catalogs and their independently witnessed roots. The
shape check does not establish raw-evidence retention or restore.

The freeze contains syntactic `g0ReceiptSha256` and `g1ReceiptSha256`
bindings. A future #57 adapter must independently authenticate #183's actual
G0 receipt, verify full candidate/scope/runtime matches, verify G1 and all
other mandatory gates, execute controls, capture coverage, check finalization,
and verify #55 retention. This module performs none of those operations.
Both owners must agree any shared API, comparator or worker policy changes
before integration.

## Exact commitment and signature bytes

Canonical JSON encodes null/booleans/strings, safe integers, arrays in declared
order, and plain objects with keys sorted by JavaScript string order; UTF-8
bytes are used. Inputs are bounded and constrained to ASCII synthetic IDs.
Commitment bytes are:

```text
SHA-256(UTF8(domain) || 0x00 || 32-byte private random opening
        || uint64_be(length(UTF8(canonical value))) || UTF8(canonical value))
```

Domains are `MMP-056-REGISTRATION-V1`, `MMP-056-CANDIDATE-V1` and
`MMP-056-SELECTION-V1`; openings must differ. Registration commits to the
entire ordered synthetic registration including provenance, pool and policy;
the selection commitment also binds the candidate and registration
commitments and draw ID. The public commitment is blinded, not a plain hash of
a guessable case. The independently computed test vector is opening
`000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`, domain
`MMP-056-REGISTRATION-V1`, value
`{"a":"synthetic-case","n":1}`, result
`da651386191b5318ba31db00e85780008c704ca45fd1b4397293100bd09fd3a0`.

An actor signs the 32-byte SHA-256 of canonical JSON
`{domain:"mmp-056-transition-v1",event}`. The event contains a monotonic
sequence, predecessor hash, UTC timestamp, transition, payload and pinned
trust hash. The record hash covers canonical `{event,signatures}`. The witness
signs SHA-256 of canonical
`{domain:"mmp-056-witness-checkpoint-v1",seq,hash}`. These mechanics do not
establish clock integrity or independent operation.

The only sampler is `stratified-fisher-yates-v1`: strata follow registration
order, mandatory case IDs follow pool order, remaining eligible IDs are
Fisher–Yates shuffled using Node's `crypto.randomInt`, and the predeclared
count is selected. Randomness is requested only after witnessed and locally
persisted `DRAW_STARTED`. The synthetic API has no seed input; the test-only
entropy seam cannot admit a real registration.
