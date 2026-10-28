# MMP-049: explicit public compatibility candidate experiment

Refs [#49](https://github.com/Meta-Project2026/Metamorph/issues/49),
[PR #50](https://github.com/Meta-Project2026/Metamorph/pull/50).
Candidate/provenance: [specs/016-candidate-compat](../../specs/016-candidate-compat/spec.md).

`workshop-compat-v1` is an additive fixture, not a replacement of the frozen
workshop candidate or its shared admission pin. Original PHP/TS workers, runtime
recipe, requestPolicy, MANIFEST, comparators and MMP-044 corpus remain unchanged.
No private audit package, inputs, outputs, seeds, logs or artifacts are needed.

## Checks without candidate execution on the host

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node research/mmp-049/check.mjs
node --test research/mmp-049/driver.test.mjs
```

These check trusted host code, admission, policy and receipt integrity. The
fixture TS is only formatted/read as data on the host; application typecheck,
build, import and execution occur inside the existing isolated TargetWorker.
Fast CI remains the existing technical gate, not the expensive parity proof.

## Real explicit milestone execution

```powershell
gh workflow run mmp044-public-docker.yml --repo Meta-Project2026/Metamorph --ref fix/mmp-049-workshop-compat -f proof=mmp049-compatibility
```

The registered manual public entrypoint invokes the local reusable workflow at
that exact feature SHA. Its default remains `frozen-public-repro`. There is no
automatic differential run on PRs, arbitrary code/ref input, secret forwarding,
private-audit invocation or paid/model call.

The reusable workflow checks exact HEAD, installs frozen dependencies, runs host
boundary tests, measures fixed public PHP/Node operators in bounded Docker,
executes the separately pinned candidate, then runs corrected offline Agent
FAIL/repair through the unchanged MMP-010A SourceSession/RealVerifier/runAgent.

The main proof executes 3 mandatory MANIFEST scenarios (17 HTTP/20 SQLite), the
unchanged 14 MMP-044 scenarios (38/52), and 25 additional public regressions
(55/80). All 42 pairs get independent fresh PHP/TS state and a full initial DB
comparison plus a full comparison after each request. The actual compiled
candidate helper is separately compared to real PHP for the 44 numeric and
12 whitespace families (interior, leading, trailing and both edges). ASCII controls are operator-only; requestPolicy stays
unchanged. The six original real workshop controls and original public positive
and corrupted-status negative control execute without changes.

The Agent replay introduces the original public cancellation no-op for attempt 1,
then supplies the exact corrected source for the single allowed repair. Its two
attempts each require three fresh pairs, 17 HTTP/20 SQLite, immutable source
leases, real isolated builds, and unchanged Oracle verifyPair. An Agent
INCONCLUSIVE result is expected because G0/G4 remain INCONCLUSIVE.

## Publication and verification

Only `semantics.json`, `summary.json`, `agent.json`, `finalizer.json` are uploaded.
All values are designated public observations, structural verdicts, identities,
counts and commitments. Raw packs remain private on the disposable runner.
The independent always-finalizer processes the three explicit stage ledgers;
normal cleanup failure or emergency removal cannot be erased by final zero.
Original worker aggregate lifetime stays 180000 ms; workflow job limit is 35 min.

After downloading and allowlist-checking the task's public artifact:

```powershell
node research/mmp-049/verify.mjs <public-receipt-directory> <exact-executed-code-sha>
```

The verifier rejects missing scenarios/steps/initial DB, mismatches, wrong source
identity, failed controls, incomplete repair, nonzero resources, emergency
cleanup or changed HEAD. ZIP and exact file digests belong in the evidence index.
A green job alone never supplies parity. The original private AUDIT_FAIL and its
unknown cause remain unchanged; G0/canonical G4 INCONCLUSIVE, product
NOT_ESTABLISHED, AI_GENERATION_NOT_RUN, external retention NOT_RUN.
