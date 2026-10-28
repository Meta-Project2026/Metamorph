# MMP-049 validation and handoff — 2026-10-28

Delivery: [PR #50](https://github.com/Meta-Project2026/Metamorph/pull/50), Refs #49.
Branch `fix/mmp-049-workshop-compat`, separate checkout from actual main
`4f56e39cafb45c45038d01cd8747befce3b814f7`.
Independent review is pending. No self-merge, issue closure, teammate approval,
governance ratification, default candidate replacement or product acceptance.

## Selected complete execution

**PASS_SCOPED** on exact code SHA
`cf33c5bbcaad524a99c667782fae5cb9b0b4125f`:
[run 40720986007](https://github.com/Meta-Project2026/Metamorph/actions/runs/40720986007),
[job 122931495864](https://github.com/Meta-Project2026/Metamorph/actions/runs/40720986007/job/122931495864),
[public artifact 12831632788](https://github.com/Meta-Project2026/Metamorph/actions/runs/40720986007/artifacts/12831632788).
Ubuntu 24.04 disposable hosted Docker runner; Node 24 trusted host, actual
PHP 7.4.33/PCRE 10.35 and Node v24.11.0/SQLite 3.50.4 in pinned isolation.
Later delivery changes contain only documentation and exact public receipts;
they are not represented as a Docker run of the later delivery Git HEAD.

| Executed group | Fresh PHP/TS pairs | HTTP | Full SQLite | Result |
| --- | --- | --- | --- | --- |
| Original mandatory MANIFEST | 3 | 17 | 20 | All PASS |
| Unchanged independent MMP-044 corpus | 14 | 38 | 52 | All PASS: original 5 FAIL corrected, original 9 PASS preserved |
| Additional public regressions | 25 | 55 | 80 | All PASS |
| Main proof total | 42 | 110 | 152 | Public G1/G2/G3 PASS |
| Original cancellation-no-op Agent attempt | 3 | 17 | 20 | Expected G2/G3 FAIL; G1 PASS |
| Exact corrected Agent repair | 3 | 17 | 20 | G1/G2/G3 PASS |
| Actual combined total | 48 | 144 | 192 | Main parity PASS; expected negative attempt retained |

SQLite totals include 48 initial comparisons and 144 full post-step comparisons.
Bootstrap requests, the six original runtime controls, one isolated helper worker
and the standalone operator containers are excluded from pair/comparison totals.
Every scenario uses independent clean reference/candidate state and the unchanged
HTTP/SQLite comparison functions. All five public mismatches now pass without
changing historical predictions, expected values, normalization or comparator.

The actual compiled helper matched pinned PHP on all **44 integer inputs** and
**12 whitespace families**, including separate leading/trailing phone/engine
checks. The expanded U+2028/U+2029 checks also pass with the same candidate bytes;
no extra regex anchor change was needed. The six original real resource/crash/
readiness controls PASS. Original real public-good-lifecycle positive control
PASS; copied status=503 negative detects HTTP_STATUS. All pair cleanup and the
three independent stage finalizers PASS with containers=0, volumes=0 and
emergencyRemoved=0; no limit was increased or renewal introduced.

Offline Agent source replay used two provider calls, one permitted repair and
fresh complete evidence for both source hashes. The intentional no-op bundle was
`8633f70c515f5bde9592e064170b8c840eeb6dc6153b5d39a8fbc626cc2c1828`;
repair restored the exact corrected bundle below. Final Agent verdict remains
INCONCLUSIVE / VERIFIER_INCONCLUSIVE because G0/G4 are INCONCLUSIVE.
Known/total/reserved synthetic model spend is zero, actual paid calls zero,
token counts null; the admission spend limit of USD 1 is not spend or permission
for a live call.

The independently downloaded ZIP contains exactly the four allowlisted public
JSON files and has SHA-256
`9a71d2ba8c7cc70c386e2b43ee2f4258705a0a4857c175b222bae2bde0ff83c6`.
Exact payloads and their individual SHA-256 values are retained in
[evidence/index.json](evidence/index.json). Offline verification actually exited 0:

```powershell
node research/mmp-049/verify.mjs specs/016-candidate-compat/evidence/run-40720986007 cf33c5bbcaad524a99c667782fae5cb9b0b4125f
```

The workflow SUCCESS, scoped public parity PASS, deliberately failing first Agent
attempt, final Agent INCONCLUSIVE and product NOT_ESTABLISHED are separate facts.

## Candidate and compatibility

The separately admitted `workshop-compat-v1` bundle is
`5fe43bb1b0e2147fb85d1c0074678e5823fb07c45cbd7d90c1bdee030b24d928`.
The historical frozen bundle remains
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`.
Its source, shared WORKSHOP_CANDIDATE_SHA and original receipts are unchanged.

Only the existing ID conversion helper and two phone/engine character classes
change. The scoped numeric prefix parser handles PHP 7.4 exponents, fractional
truncation, ASCII numeric whitespace and malformed prefixes. Signed 64-bit
integral tokens remain exact bigint values through SQLite binding; finite
overflow saturates and nonfinite numeric conversion returns zero. Date, SQL,
messages, schema, seeds and other business logic remain baseline code. The full
MIT notice in schema.ts is byte-identical. See [measured behavior table](semantics.md).

No shared runtime/profile/hash-policy/API change was needed. The new trusted
manual caller explicitly selects an independently pinned bundle through existing
admission APIs. The historical replayProvider keeps its old pin; an opt-in
corrected replay uses unchanged SourceSession, RealVerifier, runAgent and
verifyPair. A future default/shared pin replacement still needs joint owners.

Original PHP reference commit/archive, MANIFEST, requestPolicy, worker recipe,
HTTP/SQLite comparators, normalization, controls and MMP-044 corpus/predictions
remain unchanged. The protected-path diff against base is empty; all original
Git/checkout trusted pins pass without newline normalization.

## Actual local validation

Windows x64 Node v22.23.1 / pnpm 11.25.0; Docker is absent from PATH. All commands
listed below actually exited 0. No candidate/reference application was compiled,
imported or executed on the host. Fixture lint/admission read source as data;
actual application build and all behavior checks execute in Docker.

| Command | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; lockfile unchanged |
| `pnpm lint` | PASS; 137 configured files, no fixes |
| `pnpm typecheck` | PASS |
| `pnpm test` | 148 PASS / 0 FAIL / 0 SKIP |
| `pnpm build` | PASS |
| `node --test packages/oracle/reference/reference.test.mjs packages/oracle/reference/acceptance.test.mjs packages/target-worker/test/*.test.mjs packages/differential/test/*.test.mjs` | 201 PASS / 0 FAIL / 2 Windows POSIX-only SKIP out of 203 |
| `node --test research/mmp-044/driver.test.mjs` | Original 31 PASS |
| `node --test research/mmp-049/driver.test.mjs` | New 13 PASS |
| `node research/mmp-049/check.mjs` | 12 research JS files: syntax, repository lint/format/import rules PASS |
| Offline public receipt verifier | PASS; exact SHA, all scenarios/steps, controls, source identity, repair and cleanup verified |
| In-memory receipt corruption controls | All 6 rejected: missing HTTP, hidden DB mismatch, missing initial DB, leftover volume, wrong repaired source, wrong HEAD; assertions exit 0 |
| `git diff --check` | PASS |

Hosted [Fast CI 40720994925](https://github.com/Meta-Project2026/Metamorph/actions/runs/40720994925)
on `cf33c5bbcaad524a99c667782fae5cb9b0b4125f`: Node 22 and Node 24 PASS.
Fast CI is a separate technical result, not parity or owner acceptance.

## Earlier observations and errors retained

All exact public payloads, run/job/artifact IDs and ZIP/file hashes are retained
in [evidence/index.json](evidence/index.json). No historical result is rewritten.

| Attempt | Actual outcome |
| --- | --- |
| New standalone workflow dispatch | HTTP 404 before registration; no run. Additive explicit choice in the existing manual public entrypoint invokes the new reusable workflow; frozen default and Fast CI preserved |
| [40716984152](https://github.com/Meta-Project2026/Metamorph/actions/runs/40716984152), `d7af19b…` | Pinned PHP/Node measurement of 44 integers / 11 whitespace families PASS; no application parity claim; cleanup PASS |
| [40718137721](https://github.com/Meta-Project2026/Metamorph/actions/runs/40718137721), `bf33a02…` | First complete new candidate proof: all 42 pairs / 110 HTTP / 152 SQLite PASS, original controls and cleanup PASS; Agent NOT_RUN on that code version |
| [40719023326](https://github.com/Meta-Project2026/Metamorph/actions/runs/40719023326), `5cd0e83…` | ERROR: BUILD_FAILED at workshop-rejected target provision after 6 HTTP / 7 SQLite; remaining work/Agent NOT_RUN; parity INCONCLUSIVE; normal/independent cleanup PASS with zero resources |

The BUILD_FAILED cause is **NOT_ESTABLISHED**. No in-run retry, memory/timeout
increase, runtime edit or weakened build check masks it. Structural phase/exit/
signal/error diagnostics were added to the new caller for subsequent failures.
Any recurrence needs worker-owner investigation; one incomplete run is not a
candidate semantic FAIL or a completed parity result.

The selected later run completes the same main proof and both Agent attempts
without changing the candidate bytes or the protected worker recipe. Its public
receipts, not a reinterpretation of the incomplete run, establish this scoped PASS.

## Limits and review

The 14 MMP-044 cases and new fixed public regressions are transparent inputs,
not unseen qualification. No private audit package, sampled input, expected
output, seed, log or artifact was read or used. Original private AUDIT_FAIL is
unchanged and its cause is not inferred from these public fixes.

G0 and canonical G4 remain **INCONCLUSIVE**. Controls/public parity do not prove
independent complete target construction, held-out generalization, benchmark
registration or product PASS. This fixed 64-bit PHP 7.4.33/PCRE runtime matrix is
not an exhaustive PHP/version/locale/architecture equivalence proof.
AI_GENERATION_NOT_RUN; live provider/paid calls NOT_RUN; external raw retention
NOT_RUN. New source/replay is offline and synthetic, with known model spend zero
and unknown/null token counts. Independent ChatGPT review remains the next step.
