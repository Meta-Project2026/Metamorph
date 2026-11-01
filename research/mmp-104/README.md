# MMP-104 — paid-v2 verifier incident, offline forensic result

Refs [#104](https://github.com/Meta-Project2026/Metamorph/issues/104).
Base and incident execution SHA: `d199510fd802693d4af852bd5ed8498b5461d185`.
**Historical root cause UNKNOWN; source/private operation packs UNAVAILABLE.**
This change supplies reproducible public-artifact inspection, synthetic regression
controls and a telemetry design/prototype. Production runner, report schemas,
comparators, compiler, model admission, retention, workflows and recipes are unchanged.
No production instrumentation or new export decision is activated by this PR.

## Verified incident

[Run41327197036](https://github.com/Meta-Project2026/Metamorph/actions/runs/41327197036),
[job124909546925](https://github.com/Meta-Project2026/Metamorph/actions/runs/41327197036/job/124909546925):
workflow_dispatch by barbalatv, run_attempt1, completed/failure on2026-11-01.
Created16:36:25Z, completed16:38:33Z. These are observations of the previous
authorized run; **no rerun, dispatch or inference was performed for this task**.

The GitHub connector downloaded **both** public artifacts; local ZIP digests
match GitHub artifact metadata. Public artifact13091408776 has five JSON members;
policy artifact13091647657 has one. All six member lengths/hashes and the two ZIP
hashes are pinned and checked by [inspect-incident.mjs](inspect-incident.mjs).
[incident.json](incident.json) is its freshly derived allowlist, not raw source,
provider payload or a reconstructed candidate. GitHub artifact expiry is
2026-11-08; member hashes remain reproducible only while the original ZIPs exist.

| Observation             | Actual public receipt                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Generation              | REAL_INFERENCE PASS; one POST, HTTP200, one confirmed response                                               |
| Model / usage           | muse-spark-1.3 Standard; 5,985 input, 9,870 output, 0 cached tokens                                          |
| Cost                    | USD0.04942875 estimate; chargedCostUsd=null/UNKNOWN                                                          |
| Candidate identity      | `1120249ee45c0aa3efe73d57d01e813d522a9c2252fcd3e2d984a4000b9d9d2d`                                           |
| Per-pair G1             | PASS for workshop-business; DIAGNOSTIC_UNAVAILABLE, no compiler-failure entries                              |
| Aggregate G1            | INCONCLUSIVE / BUILD_NOT_RUN; only business:typecheck and business:build, not all six IDs across three pairs |
| Aggregate G2            | ERROR / VERIFIER_ERROR; 0/17 completed HTTP comparisons                                                      |
| Aggregate G3            | ERROR / VERIFIER_ERROR; 1/20 SQLite, only business:initial                                                   |
| Pair / attempt coverage | One pair, one attempt; public synthetic G4 controls did not establish held-out G4                            |
| Cleanup                 | Normal VERIFIED_ZERO_RESOURCES; finalizer PASS, 0containers/0volumes/0emergency removals                     |
| Preservation            | NOT_APPLICABLE; identity/ciphertext hash/length null; encrypted upload skipped                               |
| Product                 | G0/G4 INCONCLUSIVE; #61 NOT_ESTABLISHED                                                                      |

Generation step succeeded at16:37:51Z. Validator exited1 at16:38:28Z.
Preserver exited0 in its categorical NOT_APPLICABLE branch; upload gate exited0
but reported ineligible; finalizer passed, encrypted uploader/record-upload skipped.
Thus the preserver's successful process exit was not evidence of preserved source.
The attempt ledger remains statusUNKNOWN with attemptedRequests1; it does not
establish a settled charge or authorize another attempt. #100's single paid-v2
attempt is consumed. The prior #100 offline card does not grant a retry.

Public request/context/source/archive/manifest identities match the earlier exact
main serializer audit. The actual orchestration unit is workshop-api, covering
11 ordered public PHP functions/five actions; no eight-unit decomposition was run.
Pinned PHP commit is d272170d0aecbd28eb5b13e272d9dd11d545b66c.
No fresh source download, historical TypeScript recovery or benchmark replay is claimed.

## Supported failure interval

The control flow is established from the exact execution source:
[Oracle runner](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/packages/oracle/src/runner.ts),
[runtime](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/packages/agent-real/src/runtime.mjs),
[publication/aggregation](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/packages/agent-real/src/report.mjs),
[raw evidence admission](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/packages/differential/src/oracle-retention.mjs).

1. Both resets and initial snapshots completed; initial comparison was counted.
   The public report records no initial mismatch findings. Retention/publication
   also admitted the mandatory initial evidence paths; missing initial-diff write
   cannot pass this publication contract (explicit negative control).
2. No first-step HTTP comparison was counted. The unresolved interval is the first
   reference request/clone/serialization/evidence write, candidate request/clone/
   serialization/evidence write, or trusted HTTP comparison **before** executedHttp.push.
   An adapter request includes its own before/after snapshot checks, transport,
   response admission and evidence writes; its failure need not mean application failure.
3. Oracle catches raw exceptions and publishes the same VERIFIER_ERROR. Runtime
   receives returned ERROR gates, not that exception, so its external errorCode
   need not become a more specific code. The public projection omits raw
   completion/targetFailure and operation diagnostics. Private pack IDs/digests
   commit to bytes that are no longer available; they cannot reveal those bytes.
4. Cleanup success and the finalizer rule out a _recorded cleanup failure_ as the
   final cause. They do not identify the earlier operation. A post-step snapshot
   or later HTTP-diff write would occur after an HTTP ID was counted, unlike 0/17.

**0 completed HTTP comparisons does not imply zero HTTP requests reached either
service.** One side can have completed a request before the other side failed.
Neither candidate TS, PHP reference, transport, comparator nor filesystem is
individually identified by the available public receipt. Build PASS on one pair
does not prove runtime behavior, full source completeness or full-migration G1 PASS.

| Unresolved hypothesis                                                    | Missing historical evidence                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Reference adapter/transport/request admission or nested snapshot failure | Trusted operation-stage marker and reference operation receipt                               |
| Candidate adapter/transport/request admission or nested snapshot failure | Trusted operation-stage marker and candidate operation receipt                               |
| Operation deadline/cancellation/runtime exit                             | Trusted timer provenance and runtime lifecycle receipt; exception text alone is insufficient |
| Malformed observation, clone/serialization/comparator exception          | Trusted internal-stage marker; no raw observation is requested                               |
| HTTP evidence write failure                                              | Trusted evidence-write stage and categorical storage result                                  |

The nine first-step synthetic faults demonstrate non-uniqueness, not the
probability of a hypothesis or reproduction of the historical candidate.
The old2026-10-29 BUILD_FAILED incident is separate and its exact compiler/source
root cause remains UNKNOWN too.

## Reproduction and regression scope

After frozen install/build of trusted packages, run:

```powershell
node --test packages/agent-real/test/verifier-forensics.test.mjs
node research/mmp-104/inspect-incident.mjs <local-public-artifact-directory>
```

Inspector expects the two original ZIP files as public.zip/policy.zip and their
six reviewed JSON members flattened to the names in MEMBERS. Obtain them only
through read-only GitHub artifact download; inspect exact member names/sizes
before extraction, do not execute their contents. Output is allowlisted JSON.
The test suite does not download artifacts and requires no account, Docker or model.
The test's SQLite schema, HTTP values and adapters are original synthetic fixtures;
no benchmark/candidate code executes on the host. Build PASS is an explicitly
**synthetic receipt parsed by production buildReceipt**, not an executed compiler.

Production verifyPair, validatePublication, publicAttempt/aggregateAttempt and
retention selectors execute unchanged. Nine request/transport/deadline/malformed/
evidence-write faults produce G1 INCONCLUSIVE, G2/G3 ERROR,0/17+1/20. Four reset/
initial-snapshot faults instead produce0/17+0/20. Initial-diff write failure is
rejected by publication. A completed single pair remains incomplete globally;
cleanup error takes precedence. These distinctions are asserted, not normalized away.

Stage prototype tests cover exception-getter/claim distrust, fixed output shape,
late completion sealing and internal checkpoint classification. The actual Linux
preserver CLI runs on inert partial receipts with an empty executable PATH and
no age/Docker/provider credentials. It must emit NOT_APPLICABLE/no ciphertext for
INCONCLUSIVE/ERROR/NOT_RUN G1 and G1PASS with incomplete parity. That CLI test is
explicitly skipped on Windows; Linux Node22/24 CI must execute it before review.

See [telemetry-design.md](telemetry-design.md), [candidate-custody-options.md](candidate-custody-options.md)
and [validation.md](validation.md). Independent ChatGPT exact-SHA review is required.
No shared API, export authorization, product acceptance or paid readiness is granted.
