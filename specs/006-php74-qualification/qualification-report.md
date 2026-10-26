# MMP-005 qualification — 2026-10-27 (Europe/Bucharest)

**Decision: GO for the controlled sequential car-workshop reference profile.**
This qualifies a PHP baseline for a demonstration, not a registered benchmark,
TS migration, independent owner agreement or product G0–G4 PASS. The unmodified
real-clock profiles of both applications boot and execute successfully but are
**NO-GO for exact replay** because their actual state/response hashes differ.

## Where and what actually executed

Local Windows has no Docker/Podman or installed WSL distribution. Authorized
GitHub-hosted Ubuntu 24.04 Docker execution removed that blocker. No third-party
PHP, including lint, ran on the host. The final manual qualification
[run 40420872942](https://github.com/Meta-Project2026/Metamorph/actions/runs/40420872942)
and [job 121914695751](https://github.com/Meta-Project2026/Metamorph/actions/runs/40420872942/job/121914695751)
both completed **success** at exact source HEAD
`43287bb38280b4bf9b9fc93185c52ab1aaad809e`. UTC timestamps in machine evidence
are retained as recorded; the local calendar date is 27 October.

Final job steps: checkout success; trusted sanitizer/recipe tests success (2/2);
bounded reference qualification success (host command exit 0); sanitized artifact
publication success. [Execution provenance](execution-provenance.json) retains
the actual API step statuses. Workflow success means the qualification procedure
completed; it does not change any candidate's measured NO-GO into GO.

Runtime: **PHP 7.4.33**, **SQLite 3.34.1**. The actual extension inventory includes
PDO, pdo_sqlite, sqlite3 and mbstring; all modules are listed in the summary.
Base tag `php:7.4.33-cli-bullseye` resolved to
`php@sha256:620a6b9f4d4feef2210026172570465e9d0c1de79766418d3affd09190a7fda5`.
The final trusted runtime image ID is
`sha256:525580b12477b912e85c9a2d960674ff948285570ec535504b6e1ab740794869`.
Image ID is an executed local image identity, not a published registry tag.

| Source / actual profile | Pin | Source archive SHA256 | Outcome |
| --- | --- | --- | --- |
| MarionForm/Tech2Teach-ExamSuite, real clock | `444a2f71491b755ab3f84dbaa3e4ebf5f2227805` | `20672339cf3105d2d0960666bdd69dd8367ec7a48ca0461606849205e4f51dcb` | Bootstrap PASS, business assertions PASS, exact replay NO-GO |
| tanjilaafsarirubina/car-workshop, real clock | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4` | Bootstrap PASS, business assertions PASS, exact replay NO-GO |
| Same car-workshop, predeclared fixed clock | same pin | same archive | Bootstrap PASS, business assertions PASS, exact replay **GO** within this profile |

Pinned LICENSE files were read via GitHub and downloaded independently before
source execution; their hashes matched the LICENSE inside each archive. Both are
MIT: copyright 2026 MarionForm / 2026 Tanjila Afsari Rubina respectively. Archives
retain those notices. No upstream source, tests, questions or answer fixtures are
vendored. The original probe code is task-time implementation/research. Debian
libfaketime **0.9.8-9** and its copyright notice remain inside the trusted image;
the notice SHA256 is recorded in `clockControl`. No upstream code was copied to
implement the probe.

## Actual request coverage

Every scenario ran twice using independent fresh source copies and SQLite DBs:
six DBs per profile, eighteen DBs in the final run. There were **94 executed HTTP
steps**, including 34 steps for the qualified profile. Each step saved raw HTTP
and typed logical DB snapshots before/after, and tested a separate
`BEGIN IMMEDIATE; ROLLBACK` inspection transaction. All 94 lock probes exited 0;
no lingering write lock was observed at these sequential checkpoints. This is
not a concurrent contention test.

| Scenario ID | Per-replay steps actually executed | Assertions |
| --- | --- | --- |
| `exam-business` | POST `/intake/crear`; GET redirected `/pack/ver`; POST `/exam/generar`; GET `/exam/tomar`; POST `/exam/corregir` with no answers; GET `/exam/resultados`; GET `/exam/export?type=json` | Actual 302/200 statuses; one intake/exam/attempt; five linked questions; empty-answer score/correct count zero and analytics counters updated; subsequent reads/export preserve state |
| `exam-rejected` | Empty POST `/intake/crear`; GET `/`; GET missing `/pack/ver`; GET `/` | Rejection message, 404 for missing pack, exact before/after state unchanged and next reads succeed |
| `exam-fresh` | Create another intake and read its redirected pack on a new DB | Starts with zero intakes; creates exactly one; read preserves state |
| `workshop-business` | POST `api.php?action=book`; GET `get_appointments`; POST `update_appointment`; GET `get_appointments`; POST `cancel_appointment`; GET `get_appointments` | Actual JSON success and persisted name/date/mechanic; one booking; updated read; zero bookings after cancel; reads preserve state |
| `workshop-rejected` | Book; duplicate POST; read; invalid empty POST; read | DUPLICATE_CLIENT and invalid rejection; exact DB state unchanged after rejection; subsequent requests/lock checks succeed |
| `workshop-capacity` | Four unique bookings; fifth rejected POST; GET slots | MECHANIC_FULL at four; no extra DB row/sequence side effect; next read reports booked_count=4 and is_full=true |

The last three scenarios also execute under `workshop-clock`. Request bodies
are original safe public inputs in `replay.php` (synthetic client identities,
explicit future dates); they drive the real upstream PHP application, not a
synthetic implementation. GET boot/init checks precede the counted scenarios and
are private captures. HTTP business rejection in workshop is observed HTTP 200
with JSON failure; the probe does not invent HTTP 4xx semantics.

PHP lint: 26 ExamSuite files and 6 workshop files, exit 0. ExamSuite DB init and
seed: all twelve command invocations exit 0 per profile. Workshop creates/seeds
its own DB through its actual API bootstrap. `php -v` / `php -m`, archive extraction
and all three bounded PHP containers exit 0. Raw lint/init outputs stay private;
their executed check statuses and runtime metadata are public.

## Why fixed-clock GO is narrower than an application-wide claim

The initial real-clock runs proved actual nonrepeatability. ExamSuite's random
IDs already differ in independently seeded question banks. Its `random_bytes`
UUIDs propagate through redirects, foreign keys and output; random question
ordering and timestamps also require scoped checks. Positional column-vector
differences in the summary may reflect changed random-ID row ordering, **not**
changed upstream question/answer contents. No question or answer value is public.

Workshop's measured changed columns were `mechanics.created_at` and
`appointments.created_at`; returned booking reads also differed. Before running
the controlled profile, the plan declared a stopped wall clock at
**2026-10-27 12:00:00 UTC**. Trusted child probes confirmed PHP UTC and SQLite
`datetime('now')` both equal that value, exit 0. Only the workshop PHP server
receives the preload; parent inspection and monotonic deadlines use real time.
The application's Asia/Dhaka timezone and date validation execute normally.
This follows the library's [documented stopped-clock mode](https://github.com/wolfcw/libfaketime#readme).

With that control, all three clean initial DB hashes match between repeats, and
all 17 step-pairs match status, body hash, stable header hash and complete typed
before/after state hashes. All changed-column lists are empty. All timestamps,
IDs, values and array ordering remain present. No business-field stripping,
remapping, sorting away business order, source patching or production Oracle normalization change
was used. This GO covers the tested sequential fixed-clock demo profile only.
Raw Date/Server/connection headers are retained privately; stable-header hashing
uses the predeclared business header set, excluding those transport headers.

| Field/behavior | Classification | Evidence / remaining work |
| --- | --- | --- |
| ExamSuite generated IDs and foreign-key links | metamorphic-check-required | Random-ID differences in initial and post-state; no agreed invariant implemented |
| ExamSuite question content/choices/answers | unverified for independent content parity | Values remain private; vector differences can follow ID-based row reordering |
| ExamSuite random exam question order | metamorphic-check-required | Random selection in pinned source; no broad order normalizer authorized |
| ExamSuite creation timestamps / HTML date | metamorphic-check-required | Real clock retained; no exact-replay GO for this source |
| Workshop seeded IDs, booking IDs, relationship/state/order | deterministic within fresh reset | Exact typed state and subsequent-read hashes agree in controlled repeats |
| Workshop timezone and appointment dates | controlled | App's Dhaka timezone; explicit 2099-06-15/16 scenario dates |
| Workshop `created_at` under ordinary clock | metamorphic-check-required | Measured initial/post-state and returned-read differences |
| Workshop PHP/SQLite wall clock under qualified profile | controlled | Both observed at declared UTC; all actual timestamp values retained and equal |
| Clock advances, midnight/DST/past-date boundaries | unverified | NOT_RUN; frozen profile must not be generalized to these behaviors |
| Simultaneous capacity/duplicates, lock contention, crash rollback | unverified | NOT_RUN; sequential lock/rejection checks are narrower |

## Isolation, evidence and reproduction

The trusted Docker build finishes before source admission. PHP containers run
`--network none --read-only --cap-drop ALL --security-opt no-new-privileges`, UID
65534, one CPU, 256 MiB memory, 64 PIDs, 96 MiB `/work` and 16 MiB `/tmp` tmpfs.
Only the archive and trusted script are readonly binds. No credentials, tokens,
host-writable mounts, workspace, Docker socket, privileged mode or published ports
enter the worker. The entire worker has a 180-second `timeout` plus an independent
195-second host deadline and force-removal cleanup. Parent job limit: 20 minutes.

Raw HTTP bodies, headers and full schema/type/PK/sequence-aware snapshots were
kept in private container tmpfs and destroyed at exit. **No external private raw
evidence store was available.** Independent reinspection requires rerunning the
recipe; the retained public summary is structural metadata/hashes, not a retained
raw proof pack. No upstream answers or future held-out data entered model context
or public logs/artifacts. The trusted host allowlist discards raw text/unknown
keys. Public artifact ID `12696189075`, digest
`sha256:daa63565898210700e70bcb91456dc41cff1bed03d739f36e9f083557f3231f8`.

Exact executed entrypoints:

```sh
node --test packages/oracle/probes/qualification.test.mjs
node packages/oracle/probes/qualification.mjs
gh workflow run php74-qualification.yml --repo Meta-Project2026/Metamorph --ref feat/mmp-005-php74-qualification
```

The driver source at run SHA specifies the actual bounded Docker commands,
source download URLs, checks and request bodies. [Probe README](../../packages/oracle/probes/README.md)
contains the command recipe. Record new actual image/package versions when
rebuilding: a base digest is pinned, while apt package availability may change.
Do not reuse an invented image digest or assume PHP 8 is an equivalent runtime.

## Attempts, validation and delivery

Two initial image-build attempts failed before source admission because an
unnecessary libsqlite3 upgrade referenced an unavailable security package (apt
404). Installing only missing extension prerequisites fixed this without disabling
signature validation or changing PHP. [Preparation attempts](preparation-attempts.json)
records actual runs/checks. The subsequent uncontrolled run and structural run
both completed and recorded NO-GO; fixed clock was predeclared before final GO.
One manual dispatch returned HTTP 500; no run existed for that SHA at the check,
and the single retry created the successful run above.

PR #9 enabled initial execution but was merged externally at
`0a4eaf46d56a934a4a82ff04a0ef72284bb074dd` while this task was still running.
This agent did not invoke merge. The follow-up PR contains final evidence, the
controlled profile and removal of the temporary PR trigger. The final workflow
in this follow-up is manual-only; default-branch cleanup takes effect after its
independent merge. Ordinary Fast CI is unchanged.

Final local validation is recorded in [validation.md](validation.md). The
[benchmark proposal](benchmark-proposal.json) is for independent agreement only;
it is not registered. The [handoff](handoff.md) defines the trusted worker boundary
and remaining integration work for Vladimir. No live model calls or spend.
