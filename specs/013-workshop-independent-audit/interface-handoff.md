# Audit trust boundary and handoff

Current handoff (2026-10-28): HARNESS_EXECUTED=SUCCESS;
MIGRATION_AUDIT=AUDIT_FAIL at b142201c07df45d4c10b470ba4f6f8e6b32d9b82.
The final dated handoff below supersedes historical launch/status notes; it does
not attribute that runtime proof to this later docs-only commit.

New trusted wrappers accept only evaluator-owned bounded scenarios using existing
WORKSHOP_PROFILE. They do not modify/inherit/bypass the original MANIFEST-only
PhpReferenceWorker or TargetOracleAdapter. Readonly reuse of strict target mapping,
evidence/resources helpers and low-level workers preserves comparator semantics.

Reference reset uses DockerReferenceTransport, independent bootstrap and actual
SOURCE.initialSha256. Before/after/explicit snapshots detect uncommanded writes.
Target binding validates source/image/runtime/scenario/fresh volume; raw inspector
receipt validates exact form bytes, x-request-id, generation, readonly DB source
and strict duplicate-key JSON admission. Every requestStep is ordinal-bound and
consumed once; failures poison wrappers and force close. No app-provided DB view.
PHP adapter has a real advancing180s aggregate timer; TargetWorker retains its
existing180s timer. Cleanup grace cannot enable more useful operations.

Actual admitDirectory pin, source archive, image/recipe/profile, normalization,
HEAD and evaluator code digest freeze before sample generation. A module-issued
capability exists only after receipt persistence succeeds. Crypto RNG draws values
without caller-supplied seed. Public generator recipes are visible; sampled concrete
values/response expectations are not. No provider/Agent/model API is called.

The candidate sees each current HTTP request to answer it; this is necessary for
execution and does not expose future cases, expected outputs or evaluator source.
PHP source and candidate storage are independent. Only public source archive is
bound into PHP; candidate never receives archive/private roots/host Docker socket.
Original nonroot/read-only/network/CPU/RAM/PIDs/state quotas remain in effect.

Raw HTTP/forms/SQL/DDL/state/diagnostics/corpus are private0700 directories and
atomic0600 receipts outside checkout. Full raw Oracle catalog retained in private
packs; verify hashes only after close and zero inventory. Public serialization
reconstructs a small allowlist. Driver stderr/stdout goes to a private file even
on unexpected exception. Upload lists just summary/error/finalizer JSON. Public
pack commitments prove integrity, not external recoverable retention. Raw bytes
are ephemeral; EXTERNAL_RETENTION_NOT_RUN.

No organizational/human independence is claimed: the same chat helped implement
the frozen candidate in MMP008B. Post-freeze concrete samples remain outside its
model context; independent ChatGPT review remains required. This is a provisional
adversarial audit, not registered formal held-out G4. Report
HELDOUT_ISOLATION_NOT_PROVEN; canonicalG4 INCONCLUSIVE/product NOT_ESTABLISHED.

Public positive control compares real equal PHP/TS outputs. Negative control
changes one independently captured public response status in trusted wiring,
then original Oracle must FAIL; no synthetic-only proof substitutes for Docker.
Discovered differences are family/count/code only, with no candidate repair hints.

Filtered/search GETs remain BLOCKED_TRANSPORT_POLICY. Scope excludes UI/static,
wrong methods rejected by transport, MySQL, concurrency/clock advance and full
source completeness. Any future cross-owner API expansion needs a separate review.

OSS: unchanged pinned MIT car-workshop source/license validated by existing
transport; TS fixture retains full notice. Audit code is original task work and
reuses repository trusted utilities; Node/TypeScript dependencies retain notices.

## Historical PR31 review fixes (2026-10-28; before hosted authorization)

PairRegistry now registers a pair before construction and retains each returned
PHP/bridge/oracle pack immediately. Registry JSON is atomic0600 in its0700 private
parent, with frozen provenance, ordinal identity, current phase, primary fault and
secondary cleanup/evidence faults. Half-constructed/unreturned packs are explicitly
unavailable/ERROR, never silently counted verified. Target/reference cleanup hooks
are registered before provision/launch. Pair `finally` closes them with independent
25s bounds and checks actual ledger inventory/reap; any close timeout/failure or
emergency removal is stickyERROR even if the last inventory is empty. These grace
bounds never renew180s useful worker deadlines.

After attempted teardown, partial execution counters and worker diagnostics are
retained privately, then all async pack writers are revoked. Late receipts cannot
mutate sealed indexes. A separate Oracle pack captures a bounded private raw
catalog even if provision/verifyPair/retainOracle did not finish: up to256files,
64MiB total,12MiB/file,300directories/depth8 with owner/no-links/0600 admission.
Catalog stays INCOMPLETE on operation/cleanup failure; an index may verify intact
partial bytes without implying complete Oracle evidence or PASS. Sealing/checksum
failure on one pack does not skip attempts for other available packs.

Each available pack receives private finalization metadata, seal and independent
PrivateEvidence.verify after cleanup attempt. Global provenance retains the final
registry, including later secondary faults. Public error-v2 reconstructs fixed
scenario IDs, phase/codes, pack types/index status/hash/count, catalog/cleanup only.
Primary exception diagnostics stay private. Malformed gate/error objects cannot
cause a second serializer throw; public-file write failure emits only the fixed
AUDIT_ERROR_PUBLICATION_FAILED code and keeps exit1. No false published receipt is
claimed if storage is physically unavailable.

SIGTERM/SIGINT abort useful work, pair cleanup joins/bounds closers, then seals
available partial evidence. Hard-killed runner/daemon/power loss cannot guarantee
finalization; absent receipt is NOT_RUN/ERROR. Synthetic cancellation/late-receipt
unit tests do not prove real Docker/OS-signal behavior.

Manual workflow is still workflow_dispatch-only/contents:read/exactSHA checkout,
private redirected driver log, always-run finalizer and explicit three-file public
upload. Only policy edit: cancel-in-progress:false. Independent audit unit tests
remain an explicit command before Docker. Registration33 merged the older true
version; corrected bytes require separately reviewed reconciliation with main
before dispatch under this task's exact-byte precondition. No existing workflow
or registration PR is changed here. Only YAML SHA/policy is sent to Issue32.


## Historical launch authorization and first-run diagnosis (before run40608788918)

The human owner explicitly permits corrected feature-ref dispatch without main
byte parity. Registration-only43 remains separate, no self-merge. At953fd14,
run40608027232 actually passed52Linux audit tests but first public pair failed
PROVISION_ERROR before sampled execution. Private partial PHP/bridge/oracle and
provenance indexes verified; public finalizer0/0/emergencyRemoved0. See safe
hosted-proof.json for commitments. Raw private diagnostics were not retrieved.

A failure pair now adds detailCode from a fixed trusted-code allowlist; unknown
values become ADAPTER_OPERATION_ERROR. The primary stage code remains unchanged.
No message/path/stack/data is copied. No worker/comparator/source/corpus change.
Next dispatch must bind the new exact commit; no runtime fix/PASS inferred.


## Final hosted handoff - 2026-10-28 (review 5676478621 docs sync)

Executable proof source is `b142201c07df45d4c10b470ba4f6f8e6b32d9b82`.
[Run40608788918](https://github.com/Meta-Project2026/Metamorph/actions/runs/40608788918),
[job122554892789](https://github.com/Meta-Project2026/Metamorph/actions/runs/40608788918/job/122554892789)
and [public artifact12781924203](https://github.com/Meta-Project2026/Metamorph/actions/runs/40608788918/artifacts/12781924203)
were independently verified in review5676478621. Linux audit54/54 passed, no skips.
All7sampled pairs executed59HTTP/66SQLite comparisons, excluding the two real
controls. Positive G2/G3 PASS and corrupted-status negative G2/G3 FAIL behaved
correctly (both CONTROL_PASS), each6HTTP/7DB. Six sampled scenarios passed;
`audit-validation-2` is AUDIT_FAIL, G2/G3 FAIL with only public codes
HTTP_JSON_MISSING, HTTP_JSON_VALUE, HTTP_JSON_LENGTH, DB_STATE.
**Actions job SUCCESS means auditor execution/publication; migration AUDIT_FAIL
means observed non-equivalence. No passing-migration/product acceptance follows.**

All nine pair receipts state VERIFIED_ZERO_RESOURCES. Independent finalizer:
CLEANUP_PASS, containers=0, volumes=0, emergencyRemoved=0. ZIP SHA-256:
`e51c466b385ef1d9c43d1e68395171a858222696ffc561a4efd6883a828cc763`.
Only summary.json/finalizer.json were uploaded; their exact hashes and the
historical first run are in [validation.md](validation.md) and the
[documentation status](hosted-proof.json). The executed trusted code asserts27
private pair indexes plus provenance; public commitments do not expose private
raw bytes or establish external recoverable retention. No private input, seed,
expected response, raw observation, path or log is transferred in this handoff.

Further independent public-safe diagnosis is tracked in
[Issue #44](https://github.com/Meta-Project2026/Metamorph/issues/44). Root cause
(candidate behavior versus evaluator/transport) remains NOT_ESTABLISHED. No
private-sample reconstruction, candidate repair from hidden feedback, comparator
changes or reruns of the closed selection to seek PASS are authorized here.
Historical run40608027232 at953fd14 remains PROVISION_ERROR, cause unknown;
items-smoke baseline #34 remains a separate unresolved issue.

G0=NOT_RUN, canonical G4=INCONCLUSIVE, product=NOT_ESTABLISHED,
HELDOUT_ISOLATION_NOT_PROVEN and EXTERNAL_RETENTION_NOT_RUN are unchanged.
Filtered/search coverage remains BLOCKED_TRANSPORT_POLICY.

This is documentation-only synchronization. Executable files, tests, YAML,
corpus, verifier/comparator and candidate remain byte-identical to b142201c.
Run40608788918 was not executed on the later documentation SHA. No new audit
or runtime tests, merge or issue closure are performed. Independent ChatGPT
review of this docs delta and its code-blob equality is requested.
