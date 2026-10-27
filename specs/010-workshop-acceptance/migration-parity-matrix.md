# Migration acceptance matrix

This feature qualifies PHP reference observations, not a TS implementation.
The source-bound corpus covers the three existing public scenarios only.

| Requirement | MMP-009A reference work | Genuine TS migration status |
|---|---|---|
| G0 complete independent target | No candidate admitted | NOT_RUN |
| G1 TS build/types/unit/startup | Trusted controller checks are separate | NOT_RUN |
| Initial SQLite preflight | Each PHP reset checks pinned legacy initial digest; two passes compare full initial state | NOT_RUN against TS; old `/items` mismatch is historical G3 FAIL |
| G2 HTTP contracts | Repeat status, stable headers and full raw body privately for each17-step pass | NOT_RUN against TS |
| G3 state checkpoints | Compare before+after full typed SQLite for every step and clean initial state | NOT_RUN against TS |
| G4 independent controls/held-out | Explicitly synthetic mutation controls plus isolated process faults; no held-out corpus | NOT_RUN against TS; held-out NOT_RUN |
| Cleanup | Dedicated runner inventory must be containers0/volumes0; sticky failure ERROR | Candidate cleanup NOT_RUN |
| Clock | Inspector independently enforces frozen UTC wall with advancing monotonic timer | Candidate parity NOT_RUN |
| Durable evidence | Local POSIX packs survive worker cleanup only | EXTERNAL_RETENTION_NOT_RUN |
| Product / registration | No approval implied by reference replay | NOT_ESTABLISHED / NOT_APPROVED |

Mandatory future HTTP IDs: workshop-business step-01..06,
workshop-rejected step-01..05, workshop-capacity step-01..06. Bootstrap is service
coverage, not one of17 business steps. Initial + all before/after checkpoints
must compare on a genuine candidate; counts alone cannot establish parity.

Taxonomy: FAIL means an executed mismatch; INCONCLUSIVE means missing mandatory
evidence/coverage; ERROR means invalid observation, harness/runtime/cleanup
failure; NOT_RUN identifies absent execution. Only all applicable mandatory
gates and independent controls with evidence could establish product PASS.
