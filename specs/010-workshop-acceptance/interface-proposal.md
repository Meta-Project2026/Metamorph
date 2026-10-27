# Target-owner handoff — proposal, not ratification

Owner recipient: Vladimir. Reference/Oracle owner: Ilia. Refs19.
Status: BLOCKED_TARGET_OWNER_API until explicit owner agreement. This document
is the handoff artifact; no teammate message or approval is implied.

| Boundary | Required input / result | Constraints / compatibility |
|---|---|---|
| Route admission | exact `/api.php?action=...` and query bytes from immutable MANIFEST | Permit the literal dotted route; still reject traversal, absolute/network URLs, controls and fragments. No route rewrite to `/items`. |
| HTTP request | method, exact optional UTF8 body bytes, trusted request MIME `application/x-www-form-urlencoded` for POST, empty body preserved | Content type is trusted scenario policy, never inferred/re-encoded by candidate; no automatic JSON. GET has no form MIME/body. Preserve per-step/runtime/request identity, byte/deadline limits and inspector-only receipts. |
| Readiness | trusted non-mutating process/loopback readiness evidence, separate from business observation | Replace hardcoded `/items` requirement through an explicitly versioned optional profile; keep existing `/items` smoke compatible by default. A fake business response is not readiness. App initial DB must be initialized deterministically by declared bootstrap, with no extra business mutation. |
| State budget | actual hard bytes limit for candidate DB, WAL/journal and auxiliary files | 16MiB inspector admission only rejects oversized reads. Enforce at write boundary (e.g. dedicated bounded tmpfs/volume), including all files and memory accounting. Report exhaustion and cleanup as explicit errors; never silently truncate snapshot. |
| Snapshot | independent inspector observation of actual admitted candidate state, source/runtime/volume/generation/step identity | Preserve DDL/defaults/PK/indexes/FK/sequence, all tables/rows/multiplicity and typed cells. Supported SQLite version difference is an input to measure, not permission to normalize SQL or values. |
| Failure | typed operation and cleanup errors with independent resource inventory | Invalid encoding/body/wire, unsupported schema, drift/dirty reset, timeout/cancel and cleanup failure fail closed. Keep raw diagnostics private; no catch-and-PASS fallback. |

Do not expand immutable MANIFEST or shared DTOs unilaterally. A possible versioned
transport policy belongs in a jointly reviewed change; no new signature is
implemented here. The current TargetWorker/WorkerAdapter APIs and existing smoke
remain untouched. No candidate-generated inspector, arbitrary headers or evidence
paths may cross the trusted boundary.

Preflight after agreement: execute genuine TS build/type/smoke independently;
provision both sides with separate clean state and matching frozen clock; compare
initial state strictly before HTTP. Then replay all17 business steps through the
unchanged Oracle with every checkpoint and independent controls. An initial
mismatch stays G3 FAIL and G2 missing-coverage INCONCLUSIVE; never bypass it.
Reference-only replay here does not satisfy that preflight for a TS candidate.
