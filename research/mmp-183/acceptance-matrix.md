# MMP-183 acceptance matrix

`CI` below means the existing trusted workshop-audit unit suite, **not** execution
of candidate/probe code or Docker. `MANUAL_DOCKER` is an implemented manual path;
all actual Docker observations in this checkout are NOT_RUN. Formal G4/registry,
private source/key access, historical repair and provider calls are out of scope.

| Invariant / negative | Implementation | CI evidence | Actual execution dependency |
| --- | --- | --- | --- |
| Version, exact bundle/source/manifest/runtime/evaluator and provenance | `g0/policy.mjs` registration/identity; CLI clean HEAD before/after | Wrong SHA, drift, copied scope, missing identities | Trusted owner declaration; actual genuine source NOT_RUN |
| Complete declared units/routes, explicit unsupported behavior | Exact file/unit/route/test/control sets; zero exclusions allowed | Empty unsupported accepted; duplicate/malformed/oversized/non-array exclusions rejected; mandatory sets remain nonempty | Finite items/workshop challenge in Docker; no claim outside declared scope |
| Allowed full TS target | Unchanged compiler/launch image; original items/workshop positive controls | AST admission and challenge/policy models | Both real positives and qualified positive replay NOT_RUN |
| No partial source mount / PHP/reference mount | Stdin-only full bundle/artifacts; no bind/volume mounts | Forged reference/PHP/state/work/corpus/socket mount inspections rejected | Actual image/mount/process evidence NOT_RUN |
| No host secrets / reference process or endpoint | Exact image environment; sanitized child env; process/namespace observation | Extra environment/host namespaces rejected | `/proc` child flags/env and reference TCP denial probes NOT_RUN |
| Filesystem, corpus, foreign Docker/socket | Same candidate permissions plus absence/mount probes | Forbidden mount inspection, incomplete control result, exact ownership models | Filesystem/reference/corpus/socket mutants and actual probes NOT_RUN |
| Reference delegation / network proxy | No-network namespace and routes observation, TCP/Unix probes; proxy mutant | Bad network mode/namespace rejected | Reference TCP, external TCP, Unix IPC and HTTP proxy negative NOT_RUN |
| Forbidden imports, PHP/process/native spawning | AST admission plus Node permission probes | Loader/process import negatives | Process-import mutant is structural; actual spawn/native/PHP probes NOT_RUN |
| Trivial static/golden replay shortcuts | Fresh cryptographic values, stateful writes/reads, workshop update/cancel | Empty/static/golden observation models reject | Static/golden/missing-route/static-cancel Docker mutants NOT_RUN |
| Independent controls gate candidate PASS | Fixed fixture hashes, live verified-evidence observation brand, exact image/recipe/evaluator qualification | Forged prior PASS/suite and live negative with invalid capture rejected; valid live observation models still qualify | Eleven actual Docker fixture observations + qualified positive replay NOT_RUN |
| Bounds, timeout/cancellation | Fixed resource policy, command/lifetime abort, bounded command waits and cleanup join | Nonsettling work/cleanup models cannot block independent finalization; uncertainty stays ERROR; late settlement cannot write evidence | Real CPU/OOM/cancel/lifetime fault qualification NOT_RUN |
| Foreign same-prefix resources | Exact IDs plus per-run/owner/role checks; no volume creation/pruning | Foreign container/volume preserved, owner-label substitution rejected | Real daemon interference/fault qualification NOT_RUN |
| Normal + independent cleanup | Separate reopened ledger, adapter, capture and cleanup deadline | Missing inventory, failed deletion, emergency counts cannot pass | Actual 0/0/0 both paths NOT_RUN; missing inventory stays ERROR |
| Forged/old receipts | In-process issuance/qualification and one-time exact identity consumption | Fabricated/copied/serialized PASS rejected | Persisted receipt needs owner-local independent attestation |
| Partial evidence / failed capture | Bounded private trace and independently verified normal/finalizer catalogs, retained faults | Behavioral mismatch plus post-seal tamper, corrupted finalizer trace, background capture error and failed receipt write stay ERROR | Host interruption/recovery and real Docker catalog fault qualification NOT_RUN |
| Symlink/hardlink/permission tamper | Existing admission plus owner-only staging/catalog checks | POSIX real-file test is skipped on Windows; hosted Linux executes it | Local Windows result NOT_RUN, never ACL proof |
| Genuine candidate bridge | Known SHA match is separate from authenticated source/manifest/candidateGit custody; no owner-attestation input or decryption code | Public SHA classification is ATTESTATION_PENDING; well-formed declarations do not attest provenance | G0_REAL_CANDIDATE=NOT_RUN, including scoped PASS |
| Shared boundaries / acceptance | Separate outer receipt; existing DTO/Oracle/worker/fixtures unchanged | Existing suites remain required | Independent review; both owners decide any later shared change |

Missing mandatory executions produce INCONCLUSIVE; environment/isolation,
timeout, cleanup or evidence failures produce ERROR. Observed source/challenge
violations are FAIL, retained alongside any secondary ERROR. Only complete
same-runtime control qualification, mandatory checks and normal finalization
permit scoped G0_PASS. Implementation readiness remains separately pending.
