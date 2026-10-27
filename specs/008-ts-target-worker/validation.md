# MMP-007 validation — 2026-10-27, Europe/Chisinau

**Worker demonstration: PASS within the original public mini-API scope.**
Full G0, PHP↔TS G2/G3/G4 and product acceptance are NOT_RUN/not established.
This is not a registered benchmark, completed migration or owner API agreement.

## Actual executions and provenance

Base: `07f37fc24f37971aa2254cfcd0024e1b33b53192`. Qualified source:
`f612b9b642cf035f4797c1a64d59cc813a5f57ab`.
[Isolated run 40426117490](https://github.com/Meta-Project2026/Metamorph/actions/runs/40426117490),
[job 121932570377](https://github.com/Meta-Project2026/Metamorph/actions/runs/40426117490/job/121932570377):
all steps success, including six boundary tests, bounded public smoke, artifact
publication and fallback cleanup. [Fast CI Node 22/24](https://github.com/Meta-Project2026/Metamorph/actions/runs/40426117560)
also completed success. [PR #13](https://github.com/Meta-Project2026/Metamorph/pull/13)
remains unmerged and contains final HEAD SHA and final-source replay receipt.

Local Windows: Node 22.23.1, pnpm 11.25.0. The seven commands in
[local-checks.json](local-checks.json) each exited 0: frozen install, lint,
typecheck, root test (65/65 retained), build, new boundary tests (6/6) and
`git diff --check`. Root checks never typecheck or execute candidate source;
root tsc includes only the trusted boundary sketch. No Docker was installed or
used locally. No candidate/benchmark code ran on the host.

Runtime: official Node 24.11.0/bookworm-slim base index digest
`sha256:76d0ed0ed93bed4f4376211e9d8fddac4d8b3fbdb54cc45955696001a3c91152`,
TypeScript 5.9.3, Node SQLite 3.50.4, libfaketime 0.9.10-2.1.
Actual qualified image: `sha256:129c44883c63d1bb029d0b9425ee2c6ac546505d0c23fb2f9ae0fcbe6a01ad25`.
Fresh builds can have different image IDs; each run retains its actual ID.
Candidate bundle SHA256:
`67dbb4b31a245ac304ebe7722aa7bfc13d6263001b3eea7e850e92e4edad1af0`;
emitted artifact bundle SHA256:
`eae4bb89494aedb31daba63d70af11a9d891d1e1f27fe4e229d7f2e742b49b1d`.
Hash construction is specified in admission/controller, not an approval ritual.

Artifact [12699414491](https://github.com/Meta-Project2026/Metamorph/actions/runs/40426117490/artifacts/12699414491),
zip digest `sha256:c05e48ee1d5bafcf1216aa70787a886527558ccf1bc8517082e499414e81de16`.
Public JSON receipts are retained permanently in [evidence/](evidence/), including
raw HTTP/base64 bytes, complete typed DB state, compiler diagnostics, exit codes,
runtime policy/IDs, notices, clock samples and cleanup.
[Execution provenance](execution-provenance.json) records actual job step status.
[Data audit](evidence-audit.json) separately rechecked positive observations,
typed state, rejection immutability, isolation flags and cleanup; this is an
implementation-author audit, not independent owner approval.

## G1 and scoped G0

Actual isolated typecheck/build exits 0; trusted unit-smoke inside candidate
container exits 0 (empty/write/read). A separate inspector then observes clean
GET `/items`, POST write, persisted GET, independently opened SQLite, rejected
POST 400 without state change, missing route 404, and a new runtime/DB reset.
No PHP process, source, DB, reference network, golden table or scenario ID exists
inside the worker. Original fixture implements generic input persistence.
Full benchmark route completeness and arbitrary-candidate independence remain
unproven. The original safe fixture and tests were authored by the coding
assistant, without migration/provider generation; human-only authorship is not
claimed. No model/provider call or billable probe occurred.

19 runtime cases completed and cleanupVerified=true in every case:

| Case | Actual result |
| --- | --- |
| Original write/read/rejection/reset | Real HTTP/typed DB and unit-smoke verified |
| Syntax, type, invalid import | Compiler failure; wrapper exit 2; raw compiler exits retained |
| Startup exception | Runtime exit 1 with expected exception |
| Deliberate crash | Runtime exit 7 |
| OOM | V8 heap exhaustion, child SIGABRT; launcher/docker-exec exit 128 |
| npm script, PHP subprocess, reference file | Runtime exit 1 with ERR_ACCESS_DENIED |
| External reference-network dependency | Runtime exit 8; network none; target never serves |
| Infinite loop | Actual host docker-wait timeout at 750ms; force kill; runtime exit 137 |
| Cancel/reap | Actual aborted docker exec; whole container subsequently removed |
| Malformed HTTP | Independent parser rejects invalid HTTP; raw HPE/parse error retained |
| Corrupt/missing/linked DB | Live HTTP 404 proves startup; independent DB inspection rejects |
| Candidate fake snapshot/verdict endpoint | Actual fake response captured; separate inspector still finds persisted row |
| Typed SQLite | INTEGER 9223372036854775807, BLOB 00ff, REAL 1.25, NULL preserved |

Normal runtime shutdown also records exit 137: stopping PID1 ends the container
and reaps exec children; this is the cleanup path, not an application crash claim.
All actual Docker/inner compiler results and signals remain in raw receipts.

Boundary tests additionally reject wrong source/bundle hashes, traversal,
case aliases, protected/root files, malicious package/script declarations,
symlinks/junctions and hardlinks. Windows and hosted Linux filesystem tests execute
real link creation/rejection. Missing/corrupt HTTP, wrong snapshot source,
cancellation and cleanup timeout cannot produce PASS. **Cleanup timeout is trusted
fault injection**, not a claim that a real Docker daemon was induced to hang;
forced removal after that injected failure is unit-tested. Hostile daemon/kernel
escape testing and a real unresponsive cleanup daemon are NOT_RUN.

## Actual clock experiment

Real and controlled probes run inside isolated image, before and after a real
1.2-second pause. No host clock change, Date monkeypatch, business-field stripping,
source timestamp rewrite or Oracle normalization change is used.

| Mode | Date / Date.now | SQLite datetime / CURRENT_TIMESTAMP | Monotonic delta |
| --- | --- | --- | --- |
| Real | Advances with actual wall time; raw values retained | Advances with actual wall time | 1200.984940ms |
| Fixed | both 2026-10-27T12:00:00.000Z / 1793102400000 | both 2026-10-27 12:00:00 | 1201.983856ms |
| Wrong-wall negative control | both 12:00:01 UTC | both 12:00:01 UTC | 1202.016515ms |

Exact raw timestamps are authoritative in [summary](evidence/summary.json) and
[clock receipts](evidence/clock-fixed-experiment.json). `performance.now()` and
`hrtime` both advance in all three modes. The one-second drift is correctly
rejected against declared 12:00:00 wall time. The pinned Node/V8/SQLite image
achieves the declared fixed wall control. This agrees with the clock value in
earlier PHP qualification; it is **not** a jointly executed PHP/TS comparison
or G2/G3 verdict. Midnight/DST/clock boundaries and concurrent bookings remain
NOT_RUN. Another Node/base/libfaketime requires a new measurement; disagreement
must become CLOCK_PARITY_BLOCKED without normalization.

## Delivery and limitations

First preparation run 40425357043 failed before candidate admission: incorrect
libfaketime 0.9.10-2 pin was unavailable. It was corrected to Debian's published
0.9.10-2.1. Intermediate runs were superseded/cancelled while controls were
strengthened; cancellation is not hosted success even if some receipts completed.
The qualified run above is completed success.

Committed workflow is manual-only; original Fast CI is unchanged. Because a new
workflow cannot dispatch before registration on default branch, final source
validation reruns the earlier same-repo exact-branch bootstrap definition, which
checks out the **current branch** and records `git rev-parse HEAD`. Its event SHA
differs from final source SHA by design. PR #13 supplies actual final checked-out
SHA and replay run/attempt/artifact links; retained in-repo evidence above remains
explicitly bound to qualified f612b9b. The final manual definition's dispatch and
default-branch registration are NOT_RUN until external merge. This agent never
merges the PR.

No shared Agent/Oracle/contracts/integration, PHP worker, qualification recipe,
Fast CI or feature pointer changed. Lockfile delta is only a new empty workspace
importer. Independent adaptation to WorkerAdapter needs both owners' agreement.
Full G0, PHP↔TS G2/G3/G4, held-out, model provider, concurrency, registration and
product acceptance remain NOT_RUN/pending.
