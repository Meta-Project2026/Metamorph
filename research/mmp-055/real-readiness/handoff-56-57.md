# MMP-055 contract to #56 and #57 — versioned fields, budgets, coverage, vocabulary

Docs-only proposal, 2026-11-04. **No shared DTO, Oracle, comparator, worker or
workflow is edited here**; shared-interface changes need both owners' explicit
agreement ([AGENTS.md](../../../AGENTS.md)). Everything below builds on shapes
that already exist in committed code:

- #55 evidence side: `ReceiptIdentityV1` (`mmp-evidence-identity-v1`) and the
  admission budget schema in
  [boundary.ts:2–44](../../../packages/evidence-retention/src/boundary.ts);
  validated by `identity()` / `admission()`
  ([core.mjs:72,98](../../../packages/evidence-retention/src/core.mjs)).
- #56 registry side: merged synthetic witnessed registry and single-draw
  journal ([PR #185](https://github.com/Meta-Project2026/Metamorph/pull/185),
  commit `e0e971b`): `createSyntheticRegistry`
  ([core.mjs:538](../../../packages/g4-registry/src/core.mjs)), ordered stages
  `REGISTERED → CANDIDATE_FROZEN → DRAW_STARTED → SELECTION_COMMITTED →
  AUTHORIZED_RUN → ATTEMPT_*`
  ([state.mjs:103–239](../../../packages/g4-registry/src/state.mjs)), receipt
  `mmp-056-synthetic-receipt-v1` scoped `SYNTHETIC_ONLY`
  ([interface.md:20–26](../../mmp-056/interface.md)), and
  `syntheticEvidenceIdentity()` already emitting the #55 identity-v1 shape with
  `witnessRef` = the attempt's terminal checkpoint
  ([interface.md:27–35](../../mmp-056/interface.md)).

## 1. Minimum versioned field contract (proposal)

An outer **envelope** carries the linkage; strict `GateResult`/`RunEvent` stay
untouched ([protocol.md:186–190](../../../specs/017-formal-g4/protocol.md)
"outer acceptance record"; EnvelopeHandshakeV1 in
[boundary.ts:38](../../../packages/evidence-retention/src/boundary.ts)).

| Field | Minted by | Verified by | Notes |
| --- | --- | --- | --- |
| `runId`, `epochId`, `registrationId` | #56 registry (synthetic today) | #55 root identity + #56 ledger cross-check | Stable across technical retries within the epoch |
| `registrationCommitment`, `candidateCommitment`, `selectionCommitment` | #56 (blinded domains, [interface.md:51–58](../../mmp-056/interface.md)) | #56 witness checkpoint; R opens via restricted path | Bare SHA-256 never sufficient for low-entropy secrets |
| `candidateBundleSha256` + build/runtime/evaluator digests | #56 freeze | #57 at launch and finalization | Mutable branch/tag names insufficient ([protocol.md:90–96](../../../specs/017-formal-g4/protocol.md)) |
| `attemptId`, `attemptIndex` | #56 `authorizeAttempt`/`startAttempt` | #55 per-pack binding; #56 terminal ledger | Authorization binds candidate + selection, valid ≤5 min, same-selection retry only with predeclared ERROR classification + reviewer/custodian + both owner signatures ([state.mjs:199–235](../../../packages/g4-registry/src/state.mjs)) |
| `terminalReceiptAt` (UTC) | #56 terminal transition | #55 retention clock | Starts the 180-day clock; latest terminal receipt governs grouped-attempt expiry |
| `witnessRef` | #56 attempt-terminal checkpoint | #55 reader config + R | Stable across retry (not the newest journal head) |
| `custodyScopeId` | #55 identity | #55 reader | Different permission scopes never combine ([format.md:51](../v1/format.md)) |
| `manifestSha256` (outer witness add-on) | #55 catalog witness | Reader pins | Immutable exact-byte root manifest |
| Per-pack: `attemptId`, `terminalReceiptAt`, `pairId`, `indexSha256`, `COMPLETE|INCOMPLETE`, outcome `PASS|FAIL|ERROR|ABORTED` | #55 seal | #55 reader + #57 finalizer receipts | `writersRevoked: true` supplied by a caller is not proof of teardown; #57 must supply authenticated admission/finalizer receipts ([format.md:20–29](../v1/format.md)) |
| Attempt-level `SYNTHETIC_` statuses / real coarse statuses | #56 receipt | #56 witness | Real vocabulary: `NOT_RUN` execution label (never a fifth `Verdict` enum), `BLOCKED` admission status, sticky FAIL |

## 2. Size budgets — the 117-file baseline is a floor, not a bound

- The 117-file public manifest (`6 + 3·S + 6·R`) and umask-022 acceptance are a
  **regression floor**: any reused retention path must keep passing
  ([checklist.md B3](../../../specs/017-formal-g4/checklist.md)).
- Real epochs must derive budgets per registration via `admission()`: caps 16
  packs / 100 scenarios / 10,000 requests / 16 MiB record / 128 MiB pack /
  256 MiB bundle / 4 MiB journal (4096 events) / 64 KiB header, plus the
  derived `maxAuthorityBytes` journal+anchor reserve and the aggregate
  **two-copy** bound with working-set buffer
  ([format.md:31–50](../v1/format.md), [core.mjs:6–16](../../../packages/evidence-retention/src/core.mjs)).
- #56 registration must record the epoch's admitted budget identities so a
  later run cannot exceed what retention preflighted; admission rejects
  combinations whose derived overhead cannot fit (maxima are not a promise the
  Cartesian product fits).
- Attempts more than one UTC day apart need separately retained bounded
  retention bundles, enumerated by #56's external run catalog
  ([README §grouped attempts](../../../packages/evidence-retention/README.md)).

## 3. Complete/partial attempt coverage

- Every attempt — complete, partial or failed — is sealed and enumerated in the
  root catalog; a hash-valid partial pack is never a complete pack
  ([storage.md:43–47](../../../specs/017-formal-g4/storage.md)).
- Division of authority: **#56 owns authentic attempt completeness** (its
  witnessed terminal ledger defines the expected attempt set); **#55 owns
  bytes/index retention** but "cannot discover an attempt never submitted by a
  dishonest controller" — the independent witness must reconcile the expected
  attempt set against all sealed catalogs and their witnessed roots
  ([format.md:20–29](../v1/format.md), [mmp-056 README](../../mmp-056/README.md)).
- A witnessed behavioral FAIL is sticky even if a later harness ERROR ends the
  attempt; FAIL/PASS/unclassified ERROR never permit retry
  ([mmp-056 README](../../mmp-056/README.md)).

## 4. Independent witnesses and storage/finality linkage

```text
#56 registration ──witness checkpoint──▶ blinded registration commitment
#56 freeze/draw   ──witness checkpoint──▶ candidate + selection commitments
#55 seal          ──catalog witness──▶ manifestSha256 + blinded catalog commitment
#55 publish       ──storage witness──▶ signed receipt per copy (both domains)
#57 run           ──admission/finalizer receipts──▶ #55 identity binding
finality: publish → post-teardown index verify → independent restore from EACH
          copy → RETAINED_VERIFIED only then; final receipt publication waits
          for all of it ([storage.md:88–96], [protocol.md:171–174])
```

The #56 `witnessRef` ↔ #55 sealed-catalog reconciliation is the binding that
prevents omitted attempts and candidate/epoch drift; both sides are
append-only and cross-checked by an independent witness.

## 5. Status vocabulary (shared, no new enum values)

| Term | Meaning | Source |
| --- | --- | --- |
| `G4_PROTOCOL_READY` / `IMPLEMENTATION_READY` / `REGISTERED` / `CANDIDATE_FROZEN` / `SELECTION_COMMITTED` / `AUTHORIZED_RUN` | Process milestones; journal labels, not `GateResult` changes | [protocol.md:22–37](../../../specs/017-formal-g4/protocol.md) |
| `EXECUTED → TEARDOWN_VERIFIED → PRIVATE_RETAINED → REVIEWED → FINAL` | Execution-to-acceptance chain | [protocol.md:30–31](../../../specs/017-formal-g4/protocol.md) |
| `RETAINED_VERIFIED` | Only after independent post-teardown restore attestation | [storage.md:93–96](../../../specs/017-formal-g4/storage.md) |
| `DELETION_UNVERIFIED` | Until verified removal across copies/snapshots/escrow | [storage.md:148–149](../../../specs/017-formal-g4/storage.md) |
| `NOT_RUN` | Execution label; never a fifth strict Verdict enum | [checklist.md:110–113](../../../specs/017-formal-g4/checklist.md) |
| `BLOCKED` | Admission status (custody/profile prerequisite absent) | [checklist.md:99](../../../specs/017-formal-g4/checklist.md) |
| `NOT_VERIFIED` | Missing restore/witness proof | [reader README](../../../packages/evidence-retention/README.md) |
| `SYNTHETIC_*` | Prefix on all #56 receipt states until real admission exists | [mmp-056 README:99–104](../../mmp-056/README.md) |

## 6. Versioning rules

- `mmp-056-synthetic-receipt-v1` shape changes require a new version
  ([interface.md:24–26](../../mmp-056/interface.md)); same for this envelope
  contract: additive fields only via a new `EnvelopeHandshakeV1` revision,
  never by reinterpreting existing fields.
- Changing pool, sampler (`stratified-fisher-yates-v1`), scope, normalization
  or control semantics ⇒ new benchmark version + epoch with preregistration;
  old commitments/results retained ([protocol.md:213–215](../../../specs/017-formal-g4/protocol.md)).
- Both owners must agree any shared API/schema/runtime change with a concrete
  compatibility plan **before** it is implemented
  ([decision-record.md:79–83](../../../specs/017-formal-g4/decision-record.md)).
