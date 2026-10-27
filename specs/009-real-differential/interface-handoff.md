# Bridge interface and target-owner handoff

Read APIs at main49859ea: reference WorkerAdapter/PhpReferenceWorker/
DockerReferenceTransport/PrivateEvidence, target controller/runtime-broker/
admission and isolated runtime inspect/build/launch. Do not use the stale target
boundary.ts sketch as executable API: provision(signal), reset(scenarioId,signal),
request(stepId,method,path,body,signal), snapshot(stepId,signal), close() are actual.

TargetOracleAdapter(worker, scenarios, {record}) is trusted-only. Production pilot
constructs a real TargetWorker with the in-process capability returned by measured
buildTrustedRuntime and the exact admitDirectory bundle. No fake command/runtime
seam is passed. Unit controls use explicitly synthetic controller-boundary objects;
their positive results are not cross-language proof.

Call adapter.provision before verifyPair. It compiles source inside a build
container, already resets to public-initial and waits for /items readiness. Adapter
captures that generation's full clean state. Oracle reset advances only the copied
allowed schedule, verifies a new runtime ID and DB volume, and compares its own
initial state against provision baseline. Two service snapshots are separate from
the subsequent real Oracle initial snapshot/comparison; no G2 coverage is inferred.
Only one scenario is exercised to fit the unchanged180s total target work budget
(16 resets/128 operations; provision counts). Workers cannot be reused after close.

request binds exact public manifest/step sequence, checks raw independent inspector
receipt and request-id echo plus current generation. Header identity x-request-id
does not change stable business headers or oracle-exact-v1. UTF8/base64/size,
duplicate JSON keys/header spellings and existing validateHttp/comparator checks
reject corruption; content-type is never supplied when absent.

snapshot uses TargetWorker's independent SQLite inspector. Strict incoming
target-worker-sqlite-v1-proposed metadata/schema order/identity checks precede
conversion tbl→tbl_name→table and null-wire adaptation through accepted
mapPhpSnapshot. Original independent SQLite fixture/core snapshot equivalence and
mutants demonstrate PK, defaults, DDL, index/view/trigger, sequence, NULL/int64/
REAL/TEXT/BLOB, duplicate rows. Full metadata stays private; core DDL is untouched.
This is a supported bounded profile, not general SQLite or new shared DTO.

close invokes target cancellation/join, then joins bridge conversion and checks
actual Docker inventory. Keep operationCode and cleanupCode separately; cleanup
failure stays sticky even if a later emergency reaper removes resources. PHP uses
its own unchanged close and pack. Independent resource ledger/inventory covers
both sides; private diagnostics/worker objects must never enter ModelProvider.

Actual runner rule: after initial DB mismatch it continues to next scenario,
skipping every HTTP request. PHP worker requires the current scenario to complete
before another reset, so a future multi-scenario mismatch-tolerant bridge would
need an explicitly agreed lifecycle policy. This pilot uses exactly one scenario;
it does not disguise that compatibility constraint or extend either owner's API.

Target-owner next task (proposal only; no notification/approval implied):

1. Implement a publicly scoped TS workshop migration slice: booking/read/update/
   cancel and duplicate/invalid/capacity rejection with compatible schema/state,
   fixed-clock timestamps and subsequent reads. Keep reference fixtures independent.
2. Agree a generic non-mutating readiness capability, chosen only by the trusted
   orchestrator from an approved bounded manifest. A transport-only listen/identity
   check or explicitly non-mutating route must not require the /items business
   schema. Pin timeout/body/redirect/method policy and generation identity. No
   fake /items added to workshop, arbitrary provider route or candidate verdict.
3. Agree hard target DB filesystem quota/size budget at provision/reset; existing
   target API offers no volume backend/quota parameter. Current16MiB DB inspector
   admission guard is not a hard write limit. No command interception/monkeypatch
   or foreign module edit is used to add that missing property. Until agreed,
   hard-quota isolation acceptance is BLOCKED; this exact original fixture pilot
   can only demonstrate observed bounded state and independent mismatch detection.

External private storage/encryption recipient is absent. Local raw packs survive
worker cleanup and are destroyed with runner. EVIDENCE_RETENTION_NOT_CONFIGURED /
EXTERNAL_RETENTION_NOT_RUN; no durable retention or joint owner sign-off claimed.
