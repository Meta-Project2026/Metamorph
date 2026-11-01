# MMP-104 production validation

Date2026-11-01; branch codex/mmp104-production-telemetry. Fresh base:
114973cbcde2debc699ff0b578c146c34b6c636e (merged research PR110).
Both bounded-contract approvals are recorded: [Ilia](https://github.com/Meta-Project2026/Metamorph/issues/104#issuecomment-6561627815),
[Vladimir](https://github.com/Meta-Project2026/Metamorph/issues/104#issuecomment-6562299299).
This is the separate focused production implementation requested by that approval.
Independent production code/security review is PENDING; no self-merge.

Local executor observations: Windows, Node24.21.0, pnpm11.25.0.

| Actual command                                                     | Exit / result                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| pnpm install --offline --frozen-lockfile                           | 0; frozen lockfile/cache, no downloads                 |
| pnpm lint                                                          | 0                                                      |
| pnpm exec biome check research/mmp-104                             | 0                                                      |
| pnpm typecheck                                                     | 0                                                      |
| pnpm test                                                          | 0;704total/600PASS/104Windows or permission SKIP/0FAIL |
| pnpm build                                                         | 0                                                      |
| node --test packages/agent-real/test/production-telemetry.test.mjs | 0;85PASS/0SKIP/0FAIL                                   |
| node research/mmp-069/check-syntax.mjs                             | 0;81research files parsed, none executed               |
| node research/mmp-069/validate.mjs                                 | 0;82research modules/42test files reached              |
| node --test research/mmp-069/validate.test.mjs                     | 0;45PASS/0FAIL                                         |

[local-checks.json](local-checks.json) preserves actual timestamps/exits and ignored
log SHA256. Baseline root suite619tests, now704 (+85). No new skip, test weakening,
workflow or coverage-policy change. The existing root wildcard reaches this test;
research syntax/module counts are unchanged (new research content is documentation).
Root lint excludes research, hence the separate explicit lint command.

All29stages have actual production failure controls: both worker sides, initial/
HTTP/step clones, serialization, HTTP/DB comparison, each evidence-write class,
and all five final publication files. Existing trusted built-in functions are
mocked only inside tests; no production fault-injection API. Opt-in/opt-out runs
compare exact gate objects/IDs/findings/evidence paths, write order and cleanup
acknowledgements. Known-good controls cover all three public manifest ordinals.
These are inert original adapters, not a candidate, PHP replay, compiler or Docker
qualification. Global G1 remains incomplete despite the synthetic pair build PASS;
G4 stays INCONCLUSIVE and repair feedback never receives telemetry.

Formal controls also cover hostile exception getters/spoofed fields; operation
value/exception identity; successful-finally abort; actual bounded timeout and
parent cancellation through the existing broker; preaborted/late operations;
both close failures and cleanup-only null ordinal; stage-specific ordinal mistakes;
setup/publication rejection preserving the original value; unclassified failure;
missing/foreign/copied/malformed/oversized/truncated telemetry and G4 scope refusal.
Report handoff tests prove non-serializable context/issuance and fixed public shape.
Original preservation identity stays identical with a hostile optional-field getter;
partial G1 cannot authorize source access or export. No selector policy changed.

The new actual PrivateEvidence→retainOracle→seal→verify→public projection control
must execute its positive POSIX branch in hosted Linux Node22/24 CI. Locally it
asserts the existing Windows platform rejection; positive POSIX retention is
**NOT_RUN locally**, as is the existing Linux isolated-preserver control. Private
raw publication membership and catalog exclude telemetry; the issued record stays
in memory instead. No new evidence file or source export package member is added.

Development corrections: TypeScript's array-descriptor type needed an explicit
PropertyDescriptor record cast (runtime descriptor checks unchanged). Clone-fault
test ordinals initially overlooked the unchanged independent controls' own clone;
the injection harness now accounts for that call. No production check was relaxed.
Review also added explicit UNAVAILABLE/INTERNAL_ERROR for an error outside approved
checkpoints, with a matching regression. Final checks above all passed afterward.

Ordinary exact-HEAD PR Node22/24 CI and the independent production review are
reported in the PR handoff after publication; this file does not preclaim success.
No model/provider GET/POST, dispatch/validate_only, job rerun, age/key access,
actual candidate, Docker benchmark or plaintext export. Paid calls=0. Historical
root cause UNKNOWN; historical candidate/private packs UNAVAILABLE; product
NOT_ESTABLISHED. #100's paid attempt remains consumed; #105/#107/#108 unchanged.
Original repository code/synthetic tests only, no dependency/license/fixture change.
