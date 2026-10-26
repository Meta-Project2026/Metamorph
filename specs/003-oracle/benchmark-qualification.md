# PHP baseline qualification — 2026-10-27

Decision: **NO-GO for benchmark selection at this milestone**. Both runtime probes
are **NOT_RUN**, not a proven PHP compatibility failure. Docker/Podman are absent;
`wsl --list --verbose` reports no installed distributions. No third-party PHP was
executed, no image pulled/built and no real fixture or upstream tests were copied.
Actual runtime versions/extensions/image digests and repeatability are unknown.
Static source inspection cannot establish GO. No source is selected.

## Pinned candidates and verified static facts

GitHub API tree/content reads used exact commits, not moving branches. MIT license
texts were read at those commits. Retain each upstream LICENSE with any future
source archive/distribution. Our synthetic controls are original work. Research
performed here is task-time static research, not an executed independent baseline.

| Candidate | Static evidence | Runtime decision |
| --- | --- | --- |
| [MarionForm/Tech2Teach-ExamSuite@444a2f71491b755ab3f84dbaa3e4ebf5f2227805](https://github.com/MarionForm/Tech2Teach-ExamSuite/tree/444a2f71491b755ab3f84dbaa3e4ebf5f2227805) | README claims PHP 7.4+; app/db.php uses PDO SQLite; scripts/init_db.php defines five business tables. public/index.php lists intake/pack/exam/grading/export routes. MIT, copyright 2026 MarionForm. | NOT_RUN; first candidate to probe, not selected |
| [tanjilaafsarirubina/car-workshop@d272170d0aecbd28eb5b13e272d9dd11d545b66c](https://github.com/tanjilaafsarirubina/car-workshop/tree/d272170d0aecbd28eb5b13e272d9dd11d545b66c) | README asks for PHP 8; this is not proof of PHP 7.4 incompatibility. config.php supports PDO SQLite or MySQL, seeds mechanics; api.php exposes booking/read/edit/cancel and booking locks. MIT, copyright 2026 Tanjila Afsari Rubina. | NOT_RUN; fallback probe only if needed |

ExamSuite nondeterminism is visible in app/helpers.php (`random_bytes` UUID),
app/Models/Question.php (`ORDER BY RANDOM()`), and Models/Exam.php/Intake.php
(`datetime('now')`). These affect business state and question ordering. Do not
strip UUIDs, dates or random exam selections and call the result exact parity.
Its required complete extension inventory and PHP 7.4 boot remain unverified.

Car-workshop depends on wall-clock `date()` validation, Asia/Dhaka by default,
and SQLite CURRENT_TIMESTAMP defaults. Its concurrency/rollback behavior remains
unexecuted. PHP 7.4 syntax/extensions and repeated deterministic writes are unknown.
The upstream tests and any expected answers were not opened or reused.

## Reproducible isolated follow-up

Run this manually on an authorized disposable Docker Linux host. Timebox the first
candidate to 20 minutes; use the second only if the first cannot qualify. Source
archives stay outside Git and outside migration-agent context. The probe below
is a syntax/bootstrap/read-only HTTP smoke, **not** full business qualification.
Record its output even on failure; GO additionally needs the stateful replay below.

1. Pull an approved official PHP 7.4.33 CLI image on the trusted host. Resolve and
   record its actual RepoDigest; do not invent a digest or substitute PHP 8.
   Build the trusted extension image before exposing any candidate source:

```powershell
docker pull php:7.4.33-cli-bullseye
$phpBase = docker image inspect php:7.4.33-cli-bullseye --format '{{index .RepoDigests 0}}'
docker build --build-arg "PHP_IMAGE=$phpBase" -f packages/oracle/probes/Dockerfile -t metamorph-php74-probe packages/oracle/probes
$probeImage = docker image inspect metamorph-php74-probe --format '{{.Id}}'
docker image inspect $probeImage
```

2. In a new scratch directory outside the checkout, download only the pinned
   GitHub source archive. Use the ExamSuite URL below first; replace repo/ref and
   final argument with `workshop` for the fallback. Never run its PHP or Composer
   on the host, and never extract it onto host storage. Retain the archive including
   LICENSE; record its SHA256 once as provenance, not an approval protocol.

```powershell
$probeScratch = Join-Path ([IO.Path]::GetTempPath()) ('metamorph-php74-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $probeScratch
$archive = Join-Path $probeScratch 'source.tgz'
Invoke-WebRequest -Uri 'https://api.github.com/repos/MarionForm/Tech2Teach-ExamSuite/tarball/444a2f71491b755ab3f84dbaa3e4ebf5f2227805' -OutFile $archive
Get-FileHash -LiteralPath $archive -Algorithm SHA256
$probeScript = (Resolve-Path -LiteralPath 'packages/oracle/probes/qualify.sh').Path
$probeName = 'metamorph-php74-' + [guid]::NewGuid().ToString('N')
# POSIX timeout in the trusted image bounds the entire untrusted execution.
# No host-writable bind mount, credentials, published port or network is provided.
docker run --rm --name $probeName --network none --read-only --cap-drop ALL --security-opt no-new-privileges --cpus 1 --memory 256m --memory-swap 256m --pids-limit 64 --user 65534:65534 --tmpfs '/work:rw,noexec,nosuid,nodev,size=96m,uid=65534,gid=65534' --tmpfs '/tmp:rw,noexec,nosuid,nodev,size=16m' --mount "type=bind,source=$archive,target=/input/source.tgz,readonly" --mount "type=bind,source=$probeScript,target=/probe/qualify.sh,readonly" --entrypoint timeout $probeImage --signal=KILL 120 sh /probe/qualify.sh examsuite
# On cancellation/error, also run: docker rm --force $probeName
```

The exact source commit is in the archive URL; image/base digest, archive hash,
command, exit code, php -v/-m and stdout/stderr must accompany actual probe evidence.
`qualify.sh` never supplies an Oracle PASS; its success is only bootstrap smoke.
The Dockerfile/recipe have NOT_RUN status here because Docker is unavailable.

3. Before GO, extend the trusted manual probe with a public stateful sequence for
   the chosen source. Use a fresh isolated DB for each replay, two repeats of each
   sequence, explicit request IDs, raw status/headers/body and logical snapshots
   after **every** step (including rejected operations and a following read).
   Keep writable state inside the disposable worker; extract reviewed observations
   through a trusted broker, not a candidate-authored verdict. Do not grant a TS
   candidate access to the baseline or mount Oracle fixtures into either candidate.

   ExamSuite coverage must include intake → pack → exam → grade → read results /
   export; predeclare a deterministic subset or scoped metamorphic invariants for
   UUID/time/random selection before execution. Qualification must report excluded
   scenarios explicitly. Workshop coverage must include booking/read/update/cancel,
   duplicate client, capacity/rejected transaction and separate concurrency checks;
   fix the timezone/scenario date and account for timestamp defaults in advance.
   No broad normalizer is authorized by this document.

4. GO requires demonstrated PHP 7.4 boot, actual extension inventory, repeatable
   fresh-state business replay and sufficient coverage with justified handling of
   nondeterminism. Until then leave BenchmarkDefinition unregistered and issue #2
   open (`Refs #2`). Missing evidence is INCONCLUSIVE/NOT_RUN; an executed
   incompatibility would be a supported NO-GO reason, not a fabricated result.
