# Agent / Oracle public integration (MMP-004)

From the repository root, run `pnpm demo:integration`. This invokes the existing
`runAgent()` and the public `verifyPair()` on every verification attempt. It prints
the retained OS temporary evidence root. Expected sequence:

1. Deterministic nonbillable provider writes inert `src/candidate.ts` with the
   exact `broken` demo comment. No import, compilation, eval or execution occurs.
2. A trusted original fixture interprets that comment as a finite behavior choice:
   POST returns a wrong status and writes a wrong SQLite value. Oracle compares
   actual loopback HTTP and independently inspected logical SQLite snapshots.
   G2 and G3 FAIL; the public controls leave G4 INCONCLUSIVE.
3. Agent receives only a bounded public summary, spends its single repair, and
   writes the exact `repaired` comment. The verifier reads the current file again,
   provisions two new HTTP servers and two new SQLite files, then calls Oracle.
   G2/G3 PASS, G4 INCONCLUSIVE; terminal agent verdict is **INCONCLUSIVE**.

`PUBLIC/SYNTHETIC ONLY`, `PHP=NOT_RUN`, `LIVE_META=NOT_RUN`, G0/G1 NOT_RUN,
`HELD_OUT=NOT_RUN`, `PRODUCT_PASS=NOT_ESTABLISHED`. The example.invalid repository
and zero commit in the agent's synthetic manifest are explicit placeholders,
not a registered or qualified benchmark. The one-dollar configuration permits
the existing agent's synthetic admission rule; no billable provider exists.

## Boundaries and evidence

The composition package depends on Agent, Oracle and Contracts through public
exports. It contains no comparator, control implementation or cloned runner.
Oracle-owned code, existing tests/expectations, shared contracts and CI workflow
remain unchanged. The original trusted integration fixture is separate from
Oracle's existing trusted examples and imports `snapshotSqlite()` for inspection.
No external source/dependency is added; retain existing dependency notices.

`OracleBackedVerifier` is intentionally restricted to this two-marker public demo,
not a general candidate executor. It requires a dedicated candidate directory
containing only `src/candidate.ts`, exact marker text, and a disjoint private
artifact parent. Its SHA-256 identifies those inert bytes. CandidateWriter gets
only its fresh source directory; it never receives Oracle storage paths. These
interfaces do not isolate processes from a malicious concurrent host user.

Each attempt has fresh state and a new Oracle pack containing manifest,
gate-results, events, controls, HTTP observations, DB snapshots, diffs and report.
Before accepting it, integration validates gate schemas, actual publication,
referenced files and the observation/diff index for executed IDs, the Oracle
event journal and corpus metadata. Coverage requires every exact step ID in G2
and G3 plus each G3 initial snapshot; it never splits scenario IDs on colons.
Duplicate/unknown execution IDs and malformed reports reject. Incomplete coverage
cannot establish agent PASS. No G0/G1 result is fabricated and G4 PASS is rejected.

Private `integration-attempt.json` binds agent runId, verificationAttempt, current
candidate hash, real GateResults, executed coverage and existing evidence directory.
The final private manifest links both attempts and the final outcome; root
`events.jsonl` records the real agent journal. Raw evidence stays in OS temporary
storage outside Git. Only a sanitized observed summary belongs in `specs/005`.
The CLI prints locations for the human operator, not raw bodies/snapshots. Paths
are local to that run; a checkout does not contain those temporary artifacts.

Provider requests contain no raw GateResults, evidence directories, fixture/DB
paths, observations or expected values. Feedback copies only explicitly allowed
public mismatch classes and known public IDs, deduplicated to four entries and
512 characters. Returned event findings replace raw messages with constant text.
Exceptions become `INTEGRATION_VERIFICATION_ERROR`; the agent reduces these to
its existing stable error reason. Raw GateResults remain in private manifests.

## Cancellation and limits

Oracle's API has no external AbortSignal. Integration wraps worker operations to
reject new work after cancellation and combines signals for cooperative fetches;
cleanup still gets Oracle's independent cleanup signal. Late verification results
are rejected and never appended to accepted attempts. Concurrent verify calls
reject. The demo drains `waitForIdle()` before publishing its final manifest.

The default fixture closes sockets and DB handles idempotently. Per-operation
Oracle timeouts bound async worker waits and parallel close attempts (demo:
1,000 ms/operation). After cancellation an outstanding uncooperative async operation
can take one operation timeout, followed by one parallel cleanup timeout; this is
not a hard wall-time bound on filesystem I/O, provisioning or synchronous host
code. A timed-out Promise cannot kill an arbitrary worker. Trusted PairFactory
test seams must close partially provisioned resources themselves and cooperate
with cancellation; they are never model inputs. No new Oracle cancellation API
is proposed or silently introduced by this slice.

## Validation and next infrastructure gate

`pnpm test` retains the 51 existing tests and adds integration tests for actual
repair, fresh DB/evidence/hash revisions, coverage, sanitization, zero budget,
repair/escalation bounds, worker exception/timeout/cleanup/evidence errors,
pre-abort, in-flight cancellation, stale revisions and source-write boundaries.
Fault doubles test rejection paths only; successful integration always uses the
actual Oracle. Node 22/24 fast CI remains model-free and benchmark-free.

Before real migration: authorize a disposable OS/container broker with separately
provisioned baseline/candidate source and DBs, no credentials or baseline mounts
in candidate workers, resource/network limits, trusted observation collection
and enforceable termination/cleanup. Independently qualify a pinned PHP 7.4 source
with repeatable stateful replay (see `specs/003-oracle/benchmark-qualification.md`),
then execute G0/G1 and externally held-out G4. Any shared interface change needs
both owners' agreement. Live Meta access/spend/usage receipts remain separate.
GitHub issue #2 was already CLOSED when inspected on 2026-10-27; this task does
not change its state or infer completed PHP qualification from that metadata.
