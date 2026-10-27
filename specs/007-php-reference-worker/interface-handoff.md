# Reference worker handoff

Owner: Ilia. Consumer: future trusted Oracle orchestration after independent review.
This change does not modify the shared DTO or imply agreement by Vladimir.

`PhpReferenceWorker(transport, privateEvidence, schedule)` implements the unchanged
WorkerAdapter. For verifyPair, schedule must equal `scenarios.map(s => s.id)`;
use the exact exported `MANIFEST` scenario definitions. reset consumes the next
scenario, request admits only its next method/path/body and binds `step-01` etc.
`requestStep(scenarioId, stepId, request, signal)` also supports explicit checked
IDs for trusted callers. Missing/replayed/out-of-order IDs fail closed. Requests
are sequential; duplicate reset before scenario completion is an error.

reset creates/bootstrap/captures clean initial state; request captures independent
before/after state and actual raw HTTP; snapshot independently recaptures state
and rejects uncommanded changes; close force-removes all known containers even
after an operation abort. Operation errors poison the worker until close. Use
the original verifyPair timeout 1..30000ms (recommend 30000 for Docker operations).
Provision/build/download have separate wider pre-run bounds.

Reference evidence must be outside the Git/public workspace under an existing
0700 owned POSIX parent. Use `PrivateEvidence`, `dockerCommand`, `provisionRuntime`,
then `DockerReferenceTransport`. Seal/verify the private pack after close. Raw
paths, command diagnostics and bodies are private. The existing verifyPair also
writes its own raw artifacts: its artifactParent MUST be a private parent, never
an upload directory. This adapter does not change that existing runner.

Wire mapping: PHP schema `tbl_name` becomes core `table`; DDL is byte-preserved,
including defaults/indexes/views/triggers. PRAGMA columns become ordered names
and PK column indexes sorted by PK rank; full metadata is retained privately.
PDO's PRAGMA metadata may encode cid/notnull/pk/hidden as canonical decimal
strings; these structural fields admit only checked bounded integers. This does
not coerce business row values or discard metadata.
PHP null/value:null becomes core null with no value; int64 stays decimal text;
real stays a finite number; text stays exact; hex blobs become lowercase.
Because PHP 7.4 PDO stringifies CASE expressions, inspector requests SQLite's
26-significant-digit alternate-form decimal for REAL and casts only cells tagged
`typeof=real` back to binary64 before transport. Real round-trip fixtures include
fractional precision and very small/large finite numbers; text/integer cells
are never subjected to that conversion.
Rows use the existing numeric PK/full-row multiset ordering. Sequence is an
ordinary full table. No fields containing business state are masked. Non-ASCII
identifiers, hidden/generated/virtual columns/tables, oversized or unknown shapes
are unsupported ERROR; this bounded profile does not claim general SQLite support.

The app sees its public archive and its own unique 8MiB DB tmpfs volume. Inspector
mounts only that DB volume read-only while the entire app cgroup is paused, copies
DB/journal/WAL into separate inspector tmpfs, and reads that private copy.
It binds trusted code only in the inspector container. No Docker cp from tmpfs
or SQLite parsing on host is used. Cleanup verifies removal of the DB volume too.
Candidate must use wholly separate
containers/state and must never receive reference transport/evidence capabilities.
No cross-language run or G2/G3 product PASS is established by reference repeatability.

Retention is local POSIX only. Linux tests must establish permissions, tamper
rejection and readability after worker teardown. External retention remains
EVIDENCE_RETENTION_NOT_CONFIGURED / EXTERNAL_RETENTION_NOT_RUN. The runner-private
pack disappears when an ephemeral GitHub runner is destroyed; a public pack hash
does not make that raw data independently recoverable.
