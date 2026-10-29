# MMP-082 — safe G1 compiler diagnostics

Issue: <https://github.com/Meta-Project2026/Metamorph/issues/82>.
Base main, freshly fetched: `d21376747c7147043ca618e149fac87c0df80111`.
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

At most **20 distinct phase/code/position entries** and **8192 serialized UTF-8
bytes per versioned block**, including identity. Input limit: **1 MiB**; individual
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
| Original public positive/negative Docker and Oracle controls | NOT_RUN on this branch yet; hosted proof pending |
| New synthetic compiler control through actual trial validator | NOT_RUN on this branch yet; hosted proof pending |
| Hosted Node 22/24 Fast CI | NOT_RUN on this branch yet; PR pending |
| Final hosted cleanup 0/0, emergencyRemoved=0 | NOT_RUN on this branch yet; proof pending |
| Real Meta generation, repair, regeneration, GET/POST, paid rerun | NOT_RUN; prohibited |

The existing manual `agent-workshop-compose.yml` gains only the synthetic
compiler-control step and an explicit artifact path. Original replay and all
original controls remain intact. The dispatch uses `model_provider=none`, no
Meta credential, and explicit missing admission. It is separate from Fast CI.
The new control's host-fetch allowlist permits only the exact pinned public
GitHub source archive; every other direct fetch is rejected and counted.
Local command exit statuses and TAP counters: [local-checks.json](local-checks.json).
Windows skips are not represented as executed tests; Linux CI remains required
to cover the POSIX-only admission and filesystem cases.

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
