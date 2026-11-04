# MMP-192 D0 — isolated Docker fault-injection design

**D0_DESIGN_PROPOSED / NO_OWNER_APPROVAL / ENGINE_FAULTS_NOT_RUN**

This documentation-only proposal addresses [#192](https://github.com/Meta-Project2026/Metamorph/issues/192), also relevant to [#183](https://github.com/Meta-Project2026/Metamorph/issues/183), [#57](https://github.com/Meta-Project2026/Metamorph/issues/57), and the distinct legacy hazard in [#134](https://github.com/Meta-Project2026/Metamorph/issues/134). It does not authorize provisioning, shared-runtime changes, a fault, candidate execution, privileged operations, or a paid call. Independent exact-HEAD ChatGPT review and explicit dated, authenticated, separate SHA-specific decisions by **both** Vladimir and Ilia are required before the separately scoped implementation can start. An implementation review and an explicitly authorized execution window are additional prerequisites before real runs.

## Evidence boundary

At base `14a54665a94394ca9fdb68a7c27f0c596428cbea`, [PR #191](https://github.com/Meta-Project2026/Metamorph/pull/191) and its [review](https://github.com/Meta-Project2026/Metamorph/pull/191#pullrequestreview-5776612231) record an **owner-reported** `PUBLIC_SYNTHETIC_DOCKER_QUALIFIED` 11+1 fixed public session on the owner's WSL2/Docker Desktop engine. The 11-case suite contains one structural process-import negative; ten cases plus the qualified positive actually ran in Docker according to that report. The evaluator was `48f182374b260cc3bcaaeeed0569a1eeb50979ad`, not PR #191's later documentation HEAD. Raw inspect, ledger and trace bytes were not available to the independent reviewer; hashes and the public matrix do not supply independent custody or formal G0 attestation. [The report](../mmp-183/linux-docker-validation.md) retains earlier failed attempts. PR #191 corrected [#190](https://github.com/Meta-Project2026/Metamorph/issues/190), the pinned Node native-addon denial classifier, without changing sandbox privileges.

The [result JSON](../mmp-183/linux-docker-result.json) lists exactly 12 engine fault classes, all `NOT_RUN`. Existing models are useful but do not establish their actual engine behavior. The older [acceptance matrix](../mmp-183/acceptance-matrix.md) says all actual Docker observations are not run and its rows still describe the pre-#191 state; its fault-qualification gaps remain correct. The earlier status table in the [MMP-183 README](../mmp-183/README.md) explicitly identifies itself as historical. Use the later report and #191 review for the owner-reported public session; neither proves independent reproduction.

## Proposed sequence

1. **D0 — decide the design.** Review these documents and the exact proposal commit; resolve every `PENDING` field and obtain two distinct authenticated owner decisions. A PR, CI, this document, and one owner acting alone confer no approval.
2. **D1 — implement, after D0.** A separately scoped Sol 6.1 ultra implementation PR may build the public-only harness and supervisor under the approved boundary. It must receive independent exact-HEAD security review and ordinary Node 22/24 CI. If implementing requires a new shared API, Oracle, worker, cleanup or trust-contract change, stop and obtain the applicable two-owner agreement.
3. **D2 — execute, only after D1.** On an explicitly authorized, individually identified disposable environment and execution window, an operator runs the predeclared bounded public controls once, with continuous external supervision and independently reviewed private evidence. Failed and partial attempts remain. A separate execution authorization may impose stricter constraints; D0 alone is not permission to provision or run.

These D0–D2 labels are local to #192 and do not stand for #56's separate G4 D1–D7 decisions.

## Documents

- [Architecture options](architecture-options.md): three alternatives, full-lifetime exclusivity and trust assumptions.
- [Unsigned decision record](decision-record.md): identities, endpoint, operations, bounds, evidence and approval state.
- [Fault matrix](fault-matrix.md): exactly 12 original classes, code mappings, controls and `NOT_RUN` status.
- [Safety runbook](safety-runbook.md): proposed preflight, supervisor, recovery and evidence handling.
- [Handoff](handoff.md): implementation slice, acceptance, command results and outstanding gates.

## Key source anchors

- [G0 Docker adapter](../../packages/workshop-audit/src/g0/docker.mjs#L189), [separate ledger finalizer](../../packages/workshop-audit/src/g0/finalizer.mjs#L7), [evidence](../../packages/workshop-audit/src/g0/evidence.mjs#L49), [verdict/cleanup lifecycle](../../packages/workshop-audit/src/g0/run.mjs#L97), [policy](../../packages/workshop-audit/src/g0/policy.mjs), [probes](../../packages/workshop-audit/src/g0/probes.mjs), [public fixtures](../../packages/workshop-audit/src/g0/synthetic.mjs), and [CLI](../../packages/workshop-audit/src/g0/cli.mjs).
- [G0 mock/unit models](../../packages/workshop-audit/test/g0.test.mjs#L432) and [lifecycle models](../../packages/workshop-audit/test/g0-run-controls.mjs); they do not run the fault matrix against Docker.
- [Trusted Docker CLI command implementation](../../packages/target-worker/src/controller.mjs#L64), relevant [worker](../../specs/008-ts-target-worker/spec.md) and [independent-audit](../../specs/013-workshop-independent-audit/spec.md) boundaries.

Neither this design nor a successful future public fault suite establishes owner-local genuine-candidate provenance, real G0, domain-local independent retention controls ([#55](https://github.com/Meta-Project2026/Metamorph/issues/55), [#188](https://github.com/Meta-Project2026/Metamorph/issues/188)), real registration and D1–D7 ([#56](https://github.com/Meta-Project2026/Metamorph/issues/56)), formal G4, or product acceptance.
