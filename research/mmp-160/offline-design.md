# MMP-160 — bounded G1 recovery spike

**OFFLINE_ONLY / NO_PRODUCTION_AUTHORITY. Refs #160, #154, #161.**
Base fetched and confirmed 2026-11-04: `eee4c75fd6a2900c540561593f86c430b74b62b3`.
This is an original research prototype, not a new production trust API. Vladimir
and Ilia approval of the production path is **PENDING**. No provider, workflow
dispatch, candidate execution, historical private source, compiler stderr,
decryption, key or credential handling is part of this spike.

## Evidence and question

[Run 41840074013](https://github.com/Meta-Project2026/Metamorph/actions/runs/41840074013)
used the merged #178 developer prompt on the exact base above. We read its
authenticated public artifact `13328301789`, selecting only
`meta-paid-public-41840074013`. GitHub reports ZIP SHA-256
`69733df9df30ea276dd9fe62f7ee075cfe3533187e09533c4bf34ac88d8e5356`;
this executor used `gh run download` extraction, not an independent ZIP-byte hash.
The [independent issue review](https://github.com/Meta-Project2026/Metamorph/issues/160#issuecomment-6632249813)
records that separate ZIP verification. Public generation/trial receipts agree:

- One genuine `muse-spark-1.3` response, no retry/repair; request SHA
  `01cb64b4aef8206f7e7299dec4487cab6638718fb771f3e1a7c1d8fd5593121a`;
  candidate SHA `a4cb10cf185934ae7d8c0de6a9030af3b29d4c7c3bef38625a2ee58f38eea597`.
- G1 FAIL / BUILD_FAILED, only `workshop-business:typecheck`; complete trusted
  `mmp082-g1-diagnostics-v1`: one TS2339, `src/main.ts:116:58`, AVAILABLE,
  errorCount=1, truncated=false. G2/G3 INCONCLUSIVE, 0/17 HTTP and 0/20 SQLite.
- 6,571 input / 10,715 output tokens, engineering estimate $0.0537525;
  operator allowance **$1.00**, settled charge UNKNOWN, NO_PROVIDER_HARD_CAP.
- The plan was **single_generation**. This historical run is ineligible even
  under the proposed path. It must not be upgraded, retried or privately opened.

Earlier public TS2769 coordinates differ. Neither the exact TS2339 property nor
a common root cause is established. Prior two-POST run 41726833705 did execute
the existing G1-PASS/full-parity-FAIL repair path; it did not establish parity.
This spike asks whether narrowly authenticated compiler failure can be recognized
separately from that complete-comparison path. It cannot measure model efficacy.

## Current cross-layer sequence (unchanged)

```mermaid
sequenceDiagram
    participant W as meta-paid-migration.yml
    participant H as trusted paid host
    participant C as custody checkpoint
    participant V as isolated verifier
    participant D as publicRepairDecision
    W->>H: original signed plan, fresh OIDC, exact main/workflow/body
    H->>H: reservePaidAttempt: exclusive durable UNKNOWN before POST 1
    H-->>W: confirmed response, admitted candidate, encrypted capture
    W->>C: upload + authenticated artifact metadata + exact readback
    C-->>W: opaque pre-Oracle permit
    W->>V: validate-candidate -> validateCustodiedMigration
    V->>V: runtime.buildReceipt, trusted recipe checks
    alt normal compiler nonzero
        V->>V: G1 FAIL; summarize/publicCompilerDiagnostics
        V-->>W: partial trial, G2/G3 INCONCLUSIVE, zero observations
        W->>D: publicTrialOutcome checks complete public comparison
        D-->>W: G1_FAILED, complete=false
        W->>W: validation exit 1; repair-gate skipped
    else G1 PASS then full G2/G3
        V-->>W: complete public PASS or FAIL; actual verdict retained
        W->>D: validation exit 0; credential-free repair-gate
        D-->>W: only eligible complete FAIL has public feedback
        W->>H: repair-run recomputes decision + custody + fresh OIDC
        H->>H: exact previous changes/body + exclusive attempt-2 reservation
        H-->>W: at most one repair POST; fresh custody and Oracle
    end
```

Owning sources: [validate-candidate](../mmp-078/validate-candidate.mjs),
[repair-gate](../mmp-078/repair-gate.mjs), [repair-run](../mmp-078/repair-run.mjs),
[runtime](../../packages/agent-real/src/runtime.mjs),
[diagnostics](../../packages/agent-real/src/compiler-diagnostics.mjs),
[abnormal phases](../../packages/agent-real/src/build-phase-diagnostics.mjs),
[public decision](../../packages/agent-real/src/autonomous-repair.mjs),
[mode policy](../../packages/agent-real/src/autonomous-repair-policy.mjs),
[workflow](../../.github/workflows/meta-paid-migration.yml).
`publicRepairDecision` must retain G1_FAILED, exact coverage and independent
comparison requirements. Do not add TypeScript codes to generic `CODES`, catch
G1 failure as success, or synthesize complete G2/G3 evidence. An abnormal recipe
phase is ERROR (timeout/signal/spawn/overflow), never recoverable compiler FAIL.

## Proposed versioned eligibility and trust

The research envelope `mmp160-offline-evidence-v1` is an exact normalized TEST-only
snapshot. `createOfflineSpike({authenticate})` requires an injected verifier;
there is no production default or environment flag. The fixture verifier checks
an exact immutable snapshot digest. **It is not cryptographic authentication.**
A caller who controls that port can fabricate research evidence; no result grants
a paid permit. A future production adapter must establish all facts from trusted
receipts/opaque permits, not accept a boolean or caller-supplied JSON as authority.

`G1_BUILD_RECOVERABLE` requires all of:

1. Proposed `mmp160-proposed-two-post-plan-v2`, signed before send 1, explicit
   `allowedRepairKinds=[G1_BUILD_RECOVERABLE]`, generate_then_repair, two reserved
   POSTs / one repair. Existing v1 plans and single_generation are rejected.
2. Exactly one confirmed first response, known send state, admitted immutable
   candidate SHA. Same model identity must bind request, response and repair.
3. Normal compiler FAIL, first typecheck only, exactly one executed test and
   one positive integer compiler exit; no abnormal phase or unsettled operation.
4. One complete trusted AVAILABLE diagnostic, nontruncated, errorCount=1,
   code TS2339 or TS2769, phase typecheck; no extra fields/messages. Canonical
   `src/**/*.ts` path must exist in the SHA-verified bundle. Positive safe integer
   line/column must fit its actual text (UTF-16 column, at most line.length+1).
   Existing path restrictions and secret-like path rejection remain effective.
5. Run ID/attempt=1, exact head/workflow, source/context/manifest, request/response,
   model, candidate, Oracle attempt, pair and diagnostic digest all bound.
   **Custody attemptId and Oracle attemptId are different identities** in real
   receipts; require authenticated custodyVerificationLink, not equality or
   matching UUID shapes. The test fixture intentionally uses distinct IDs.
6. Authenticated stored candidate/readback and live immutable same-run source
   lease. Normal and independent post-G1 cleanup both prove zero containers,
   volumes, emergency removals and pending operations before repair admission.
7. G2/G3 explicitly INCONCLUSIVE with zero observations; G0/G4/product unestablished.
8. Attempt-2 ledger absent, not reserved/sent/ambiguous/SEND_UNKNOWN. A read-only
   gate is not a reservation. The paid host must atomically reserve before send;
   every ambiguous claim remains consumed, including crash/restart and races.

After joint approval, proposed ordering is: persist genuine G1 FAIL -> settle all
operations -> credential-free independent cleanup -> verify distinct G1 evidence
-> single-use opaque capability -> fresh independent paid admission -> reserve
attempt 2 durably -> one repair POST -> fresh custody and isolated G1/G2/G3.
Keep failed validation exit/verdict in the job and scorecard even if routing
inspects its durable result after failure. No fall-through from malformed G1
evidence into complete-public-FAIL repair. A second G1 failure stops permanently.

## Feedback and private context boundary

[feedback.schema.json](feedback.schema.json) is the exact proposed public
`mmp160-g1-feedback-v1`: only version, code, path, line, column and bindingDigest;
unknown fields forbidden. Schema validation alone does not establish provenance,
file existence, secret-path rejection or position bounds; the evaluator checks
those too. Binding digest v1 hashes ordered public identity fields plus the
ordered allowlisted diagnostic sidecar hash (see `publicBindingDigest`). It never
hashes raw stderr/source into a new public field and carries no message text.
The private snapshot digest used by the TEST authenticator is never published.

Private trusted-host context shape is separately versioned:

```json
{
  "format": "mmp160-private-test-context-v1",
  "execution": "TEST_ONLY",
  "diagnosticFeedback": { "format": "mmp160-g1-feedback-v1", "code": "TS2339", "path": "src/main.ts", "line": 3, "column": 7, "bindingDigest": "<public SHA-256>" },
  "previousGeneratedChanges": [{ "path": "src/main.ts", "content": "<same-run model-generated bytes; never public>" }]
}
```

The prototype keeps previous changes in a closure-bound snapshot, consumes the
context once per TEST run, and returns no source in public reports. Bundle limits
reuse unchanged `validateBundle`: 1–64 files, 256 KiB/file, 1 MiB total, required
src/main.ts, per-file hash and canonical aggregate hash. Production would use its
existing custody-bound source lease instead; no historical decrypt or new agent
plaintext ingestion. Previous code remains data, not model instructions. Only
that model's own previous generated changes and public source context enter the
future private request, with exact wire bytes bound by separate signed admission.

**Uncertainty:** code/location may not identify the missing property or overload.
The model could inspect its own generated code, but repair success is NOT_RUN.
Do not release TypeScript message text, reference observations, expected values,
held-out data or private packs to resolve this uncertainty.

## Small production slices, only after both owners agree

| Slice | Exact expected production touchpoints | Acceptance before integration |
| --- | --- | --- |
| A: distinct trust/eligibility | New `packages/agent-real/src/g1-repair-eligibility.mjs`; `runtime.mjs`, `report.mjs`, `compiler-diagnostics.mjs`, `custody-checkpoint.mjs` only as needed for provenance/linking | Both owners agree versioned early-stage envelope, diagnostic projection and opaque issuer; full negative matrix, legacy path unchanged |
| B: routing, admission, private request, lineage | `research/mmp-078/{validate-candidate,repair-gate,repair-run}.mjs`; `packages/agent-real/src/{migration-trial,meta-paid-authorization,migration-preflight,meta-migration,migration-context,live-experiment}.mjs`; `.github/workflows/meta-paid-migration.yml` | Fresh original v2 opt-in; OIDC/main/workflow/body binding; original aggregate reservations plus fresh tariff/remaining estimate checks; exclusive durable attempt-2 ledger; cleanup before routing; truthful both-attempt scorecards |
| C: hosted synthetic acceptance | New tests beside `packages/agent-real/test/{repair-entrypoint,repair-vertical,compiler-diagnostics}.test.mjs`; separately approved isolated hosted proof | Exercise actual routing/admission/custody with synthetic OIDC/Meta; concurrent/restart/expired tariff/budget/custody failures; fresh second G1 PASS and FAIL, then full G2/G3; no third POST |

`autonomous-repair.mjs` public complete-parity contract stays unchanged;
`autonomous-repair-policy.mjs` must not enable autonomous_repair. No worker recipe,
pins, reference, comparator, benchmark, mandatory scenarios or normalization edits
are expected. Minimize A changes after owner review; do not broaden existing gate
DTOs when a distinct sidecar suffices. Existing dependency notices remain intact;
new code/fixtures are original and add no dependencies or upstream source.

The research simulation does not implement OIDC, receipts authenticity, protected
main admission, finances, durable cross-process claims, cancellation, Docker or age.
Its single-use in-memory context is a test control, not proof of production crash
safety. Root Fast CI does not discover these research tests; run them explicitly.
The required `research/mmp-069/coverage-matrix.json` registration labels this
folder LOCAL_ONLY / tests NOT_VERIFIED (hosted discovery), with syntax checking
only. No validator, workflow or safeguard is relaxed.

## Owner decision and remaining evaluation

Recommendation: proceed with narrow versioned G1 recovery after review rather
than another blind prompt iteration. Expected benefit is a repair opportunity,
not measured compilation/parity improvement. Main risks are false provenance,
declassification, source/attempt mix-up, unexpected second spend and stale cleanup.

- [ ] Vladimir: attributable issue comment agrees orchestration, original v2
  two-POST opt-in, no retry/third send, current cost/time limits and exact files.
- [ ] Ilia: attributable issue comment agrees independent G1 evidence/identity,
  code/location declassification, cleanup and unchanged G0–G4/Oracle semantics.
- [ ] Both: approve slices A–C before production implementation/merge, including
  private same-model changes, no raw compiler text, capability issuer and durable
  attempt-2 ledger. Record each exact comment URL; neither exists for this vertical
  in the issue comments inspected during this task. Status: **both PENDING**.
- [ ] Independent exact-HEAD code/CI review; then separately authorize production
  implementation and hosted synthetic acceptance. A production PR is not spend.
- [ ] Only after those gates, consider one new owner-authorized signed two-POST,
  no-retry evaluation with fresh tariff, bounded time/aggregate estimate and
  explicit NO_PROVIDER_HARD_CAP acknowledgment. No paid evaluation is requested here.

Do not infer approval from #178's merge, one owner's research direction, this
spike, CI or PR publication. No self-merge or teammate approval is recorded.

A deterministic paid-free source fix was considered: TS2339's property/expression
and TS2769's overload are unknown publicly, so there is no justified semantics-
preserving patch to apply. `any`, casts, suppressions, skipped typecheck, changed
declarations/Oracle expectations or canned code would hide errors or alter behavior
without differential evidence. No such patch is included. A future owner-directed
deterministic transformation would still need fresh isolated G1/full G2/G3 proof.

## Compact work record

- [x] Trace production code, current public evidence and owner boundaries.
- [x] Implement only TEST-only evaluator, private snapshot and feedback schema.
- [x] Exercise positive/negative matrix and original production pure seams offline.
- [ ] Independent review and both-owner production decisions (not executor tasks).
- [ ] Production implementation, hosted isolated proof, paid repair efficacy: NOT_RUN.

Executed local checks and delivery identity are in [offline-validation.md](offline-validation.md)
and the Draft PR. No product PASS or real TS2339 repair success is established.
