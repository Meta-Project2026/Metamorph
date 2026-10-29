# MMP-082 — safe G1 compiler diagnostics

2026-10-29 review follow-up: one new exact-head offline run completed with
original proof PASS_SCOPED, compiler control PASS and finalizer PASS (0/0/0).
See [review-followup.md](review-followup.md) for current evidence and limits.
The earlier results below are retained as the original delivery record;
the intermittent failure's root cause remains UNKNOWN and external re-review
remains pending.

Issue: <https://github.com/Meta-Project2026/Metamorph/issues/82>.
Base main, freshly fetched: `d21376747c7147043ca618e149fac87c0df80111`.
Code commit (including corrected manual driver): `d9b5f62a9313e2b40727a7f9407662d98c6ec85e`.
Initial parser/runtime/publication implementation: `a17efd8a95e42abbfabcc4489fe03e950907e413`.
PR: <https://github.com/Meta-Project2026/Metamorph/pull/83>.
Scope is future observability only. Product remains **NOT_ESTABLISHED**.
Implementation/review contract: [task-contract.md](task-contract.md).

## Historical observation, not a repaired migration

Read-only inspection of run [40900698372](https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372)
and its downloaded `meta-paid-public-40900698372` artifact confirms:

- One Meta `muse-spark-1.3` POST, HTTP 200, attemptedRequests=1 and
  confirmedResponseCount=1. Candidate SHA256:
  `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f`.
- G1 **FAIL / BUILD_FAILED**, executed `workshop-business:typecheck` only.
  G2/G3 **INCONCLUSIVE / MISSING_COVERAGE**, HTTP **0/17**, SQLite **0/20**.
  G0/G4 **INCONCLUSIVE**; product **NOT_ESTABLISHED**.
- Returned-usage cost estimate **$0.04653825**; settled charge **UNKNOWN/null**.
  Cleanup verified: containers=0, volumes=0, emergencyRemoved=0.

The published artifact contains neither original candidate bytes nor raw TSC
diagnostics. The exact TypeScript errors are **UNKNOWN**, cannot be reconstructed
from these public receipts, and are not inferred from our synthetic control.
This implementation does not retroactively add diagnostics to that attempt.

## Audited trust and publication flow

1. Pinned `target-worker/runtime/build.mjs` invokes the trusted TypeScript compiler
   in a network-off, bounded, nonroot Docker container. Candidate controls TS bytes
   only. Each phase records exitCode/signal/error/stdout/stderr; compiler buffers
   are limited to 512 KiB per stream. Messages may include candidate excerpts.
2. `TargetWorker.provision` saves the Docker command receipt in private
   `worker.evidence.build` **before** raising BUILD_FAILED. The trusted host command
   runner caps combined output at 4 MiB. Successful output additionally supplies
   buildChecks and checked JS artifact hashes. Raw source/artifacts never become
   a public diagnostic field.
3. `runtime.buildReceipt` first checks the existing trusted build invocation,
   timeout/cancel/overflow/spawn status, outer exit, strict bounded JSON and
   ordered phase receipts. The unchanged G1 object still contains only gate,
   verdict, executedTestIds and fixed findingCodes. Invalid envelopes retain their
   existing ERROR/evidence-error behavior; unverified data is not declassified.
4. On a verified compiler failure, the new parser receives only phase streams
   and the exact admitted immutable candidate. `observeBuild` transports its
   summary separately from the G1 object. Private worker evidence is still retained
   in the existing sealed, owner-only packs; it is never spread into public JSON.
5. `publicAttempt` explicitly projects the sidecar into
   `attempts[].pairs[].compilerDiagnostics`. `validateGeneratedMigration` uses
   publicAttempt, then `research/mmp-078/validate-candidate.mjs` writes that public
   structure to trial.json in the existing fresh secret-free process. No change
   to these latter two files, gate DTOs, CODES or code-only repair feedback is needed.

Host/recipe authenticity remains the existing trusted-adapter boundary, not a
signature inferred from compiler text. Candidate paths and messages are untrusted.
The summary is explanatory metadata, never an independent verdict or proof of
root cause; only the existing Docker worker supplies authoritative G1.

## New versioned projection, future observations only

`format=mmp082-g1-diagnostics-v1` binds sourceSha (pinned public PHP commit),
candidateSha, attemptId, pairId and the pair's g1Verdict. No cross-owner shared
contract is changed. A live summary is frozen, issued in-process, and bound to
the admitted candidate SHA; arbitrary/cloned/reloaded sidecars are unavailable.

Allowed entry fields are phase (`typecheck` or `build`), `TS[0-9]{4,5}`, exact
candidate-relative ASCII `src/**/*.ts`, and positive line/column within that
candidate's source bounds. Paths must also pass the existing admission rules;
secret/token-like filename markers are conservatively rejected. Absolute paths,
traversal, unadmitted files and Unicode paths are unavailable.

At most **20 distinct phase/code/position entries** and **8192 canonical compact
JSON UTF-8 bytes per versioned block**, including identity. Input limit: **1 MiB**; individual
line limit: **16 KiB**. errorCount counts parsed diagnostic headers, including
duplicates; entries deduplicate identical locations/codes within a phase.
More than 20 distinct entries sets truncated=true while retaining the header
count. Oversized input/lines yield DIAGNOSTIC_UNAVAILABLE, null count and
truncated=true. No raw-output hash is needed or published.

Only anchored plain TSC headers are parsed. Message tails and indented
continuations/excerpts are discarded without searching them for codes. ANSI/OSC,
control characters, ambiguous unindented text, malformed/truncated headers and
compiler failures without a numeric code produce fixed DIAGNOSTIC_UNAVAILABLE.
Missing diagnostics on a valid compiler failure preserve G1 FAIL / BUILD_FAILED;
timeout/overflow/cancellation retain ERROR. PASS and nonexecuted builds have no
available failure diagnostics. No response bodies, stacks, SQL, PHP source,
credentials, OIDC/JWT bytes or private Oracle inputs cross this projection.

## Post-response local compilation decision

No additional host compilation is introduced. The existing post-response
`validateGeneratedMigration` already compiles immediately in the authoritative
network-off worker in a fresh process without the Meta credential. A second
host-side compiler would add an execution surface and duplicate G1; another
Docker build would duplicate the existing check without new evidence. The new
manual synthetic control exercises this exact existing post-response validator,
without constructing a provider or making another model request.

## Validation and publication

The 45 new pure offline tests cover plain/multifile/build/stderr diagnostics,
Unicode messages, indented injected headers/excerpts, ANSI/OSC/control bytes,
empty/incomplete streams, malformed envelopes, paths and source bounds, huge
inputs/lines, max-size serialization, truncation/deduplication, secret-like
markers, foreign/forged sidecars, FAIL/ERROR/PASS preservation, and public JSON
through the real observation/publicAttempt path. Initial formatter checks found
formatting and a control-regex lint violation; corrected before final validation.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS, exit 0; lockfile unchanged |
| New `node --test packages/agent-real/test/compiler-diagnostics.test.mjs` | PASS, exit 0; 45/45, 0 skips |
| `pnpm lint` | PASS, exit 0 |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test` | PASS, exit 0; 438 tests: 336 passed, 102 skipped on Windows, 0 failed |
| `pnpm build` | PASS, exit 0 |
| `pnpm --filter @metamorph/oracle test:reference` | PASS, exit 0; 55 passed, 1 Windows-only fixture skip |
| `pnpm --filter @metamorph/target-worker test` | PASS, exit 0; 69/69 |
| `pnpm --filter @metamorph/differential test` | PASS, exit 0; 122 tests: 77 passed, 45 skipped on Windows, 0 failed |
| `pnpm exec biome check research/mmp-082` | PASS after formatting, exit 0 |
| Original public positive/negative Docker and Oracle controls | First run PASS_SCOPED, exit 0; second run PARTIAL / EVIDENCE_ERROR, exit 1 (known-good G1 ERROR); details below |
| New synthetic compiler control through actual trial validator | PASS, exit 0 in [40907197167](https://github.com/Meta-Project2026/Metamorph/actions/runs/40907197167): actual Docker TS2322, src/main.ts:1:14, G1 FAIL retained; first driver failed before execution |
| Hosted Node 22/24 Fast CI | PASS on both versions in [40905453375](https://github.com/Meta-Project2026/Metamorph/actions/runs/40905453375) and corrected-code [40907204753](https://github.com/Meta-Project2026/Metamorph/actions/runs/40907204753) |
| Final hosted cleanup 0/0, emergencyRemoved=0 | PASS in both manual runs: original proof completion, new compiler control and independent finalizers |
| Real Meta generation, repair, regeneration, GET/POST, paid rerun | NOT_RUN; prohibited |

The existing manual `agent-workshop-compose.yml` gains only the synthetic
compiler-control step and an explicit artifact path. Original replay and all
original controls remain intact. The dispatch uses `model_provider=none`, no
Meta credential, and explicit missing admission. It is separate from Fast CI.
The new control's host-fetch allowlist permits only the exact pinned public
GitHub source archive; every other direct fetch is rejected and counted.
Local command exit statuses and TAP counters: [local-checks.json](local-checks.json).
Windows skips are not represented as executed tests. Linux CI covers the
POSIX-only admission and filesystem cases.
Linux Fast CI completed those cases: root 435 PASS / 3 SKIP on each Node version;
reference 56/56, target 69/69, differential 122/122, qualification sanitizer 2/2,
workshop audit 54/54. Root skips are one Windows-only case and two fixtures
requiring root/chown; they remain SKIP, not PASS.

First hosted manual run 40905449684 is overall **FAIL**, despite the original
proof succeeding: the new research driver failed to import `@metamorph/oracle`
from outside a workspace package before any compiler control execution. This is
a harness **ERROR / NOT_RUN**, not a candidate FAIL or a parser result. The import
was corrected to the explicit trusted `packages/oracle/dist/index.js` and checked
locally before a fresh offline dispatch on the corrected commit. No workflow
rerun or paid operation was used. The first run's public artifacts are retained
under [evidence](evidence/40905449684).

In [40905449684](https://github.com/Meta-Project2026/Metamorph/actions/runs/40905449684),
the original proof passed three fresh attempts: known-good public G1/G2/G3 PASS,
deliberate public cancellation defect G2/G3 FAIL, then the existing deterministic
repair control public G1/G2/G3 PASS. Each executed 17 HTTP / 20 SQLite comparisons:
**51 HTTP / 60 SQLite total**. All six runtime negative controls passed. These
are existing public replay controls, not repair of the historical model candidate.

Corrected-code manual run [40907197167](https://github.com/Meta-Project2026/Metamorph/actions/runs/40907197167)
is also overall **FAIL**, for a different reason. The initial known-good replay
returned G1 **ERROR / ENVIRONMENT_ERROR** with no executed build test IDs and
0/0 HTTP/SQLite coverage. Its aggregate includes BUILD_FAILED; the proof's final
expected-result assertion produces **EVIDENCE_ERROR / PARTIAL**. The exact worker
failure is not present in public receipts; no timeout/OOM/compiler cause is
asserted. The same known-good candidate SHA
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`
later passed G1/G2/G3 as the repair control's second attempt with 17/20 coverage.
The defect attempt also executed 17/20 with expected G2/G3 FAIL: **34 HTTP /
40 SQLite comparisons** in this run. All six runtime controls passed again.
Core package/workflow diff between the two tested commits is empty (exit 0);
only research driver/docs/evidence changed. This does not establish the cause
of the inconsistent initial known-good result.

The new compiler control **did execute and PASS** in that second run: an original
synthetic TS candidate was compiled only by the pinned worker through
validateGeneratedMigration. Public G1 stayed FAIL / BUILD_FAILED, coverage stayed
0/17 and 0/20, and the sidecar contained only TS2322 at src/main.ts line 1 column
14, errorCount=1, truncated=false and bound identities. No private marker/source
or raw stream was published. Its guarded host fetch admitted only the pinned
public GitHub archive; metaRequests=0. This is not a model-generated candidate.

Both proof completions and finalizers report containers=0, volumes=0 and
emergencyRemoved=0. Second-run public artifacts, including the compiler-control
receipt, are retained under [evidence](evidence/40907197167). Both admission trials
record generatedRequests=0, candidateSha=null and AI_GENERATION_NOT_RUN.
Retained evidence was checked for raw-stream/private-marker strings: no matches
(rg exit 1 means no match).

**Draft blocker:** the latest full original-control job is PARTIAL because of
the initial known-good G1 ERROR. Independent review must assess that failure
before readiness; it is not relabelled PASS, attributed to a guessed cause,
hidden by rerunning, or addressed by weakening the recipe, tests or budgets.
Compiler observability is locally and Docker-tested; full replay reliability
on the corrected delivery is not established by this run.

## Changed files

The complete diff is limited to these paths (no protected input changes):

```text
.github/workflows/agent-workshop-compose.yml
packages/agent-real/src/compiler-diagnostics.mjs
packages/agent-real/src/report.mjs
packages/agent-real/src/runtime.mjs
packages/agent-real/test/compiler-diagnostics.test.mjs
research/mmp-082/biome.json
research/mmp-082/docker-proof.mjs
research/mmp-082/local-checks.json
research/mmp-082/plan.md
research/mmp-082/report.md
research/mmp-082/task-contract.md
research/mmp-082/evidence/40905449684/admission-trial.json
research/mmp-082/evidence/40905449684/finalizer.json
research/mmp-082/evidence/40905449684/summary.json
research/mmp-082/evidence/40907197167/admission-trial.json
research/mmp-082/evidence/40907197167/compiler-control.json
research/mmp-082/evidence/40907197167/finalizer.json
research/mmp-082/evidence/40907197167/summary.json
```

Unchanged: trusted recipe pin
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`,
runtime recipe files, public benchmark/source/manifest, fixtures, Oracle and
comparator, hidden G4, budgets, cost admission and paid workflow. No owner
permissions, secret mapping or repository policy changes; no new paid operation
or model spend. Public source downloads/dependency/image preparation and GitHub
operations are distinct from model network calls. This is structural/test evidence,
not a universal packet trace or independent acceptance.

Independent ChatGPT review remains **PENDING** after push; author checks are not
independent review. No merge, issue closure, governance ratification, product
PASS or successful real migration is claimed. A second paid generation requires
fresh owner authorization and budget.
