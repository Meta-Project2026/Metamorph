# 01 — Facts and evidence (evidence ledger)

## 0. Классы доказательств

| Класс | Значение |
| --- | --- |
| `GIT_VERIFIED` | Прочитано в зафиксированном коммите `074af75…` (или в историческом SHA, явно указанном); диапазон строк указан |
| `RECEIPT_VERIFIED` | Прочитан публичный JSON-receipt в репозитории, хэш/поля сверены |
| `EXECUTOR_REPORTED` | Self-report исполнителя (модель, Docker-движок, «не читал фикстуры») без платформенной аттестации |
| `EXTERNAL_PRIMARY` | Первичная публикация/официальный репозиторий/документация с DOI или URL (см. `08`) |
| `HYPOTHESIS` | Логический вывод/дедукция из проверенных фактов; не наблюдение |
| `UNKNOWN` | Недоступно / утрачено / не проверялось |

Различаются: **наблюдено** / **логически следует** / **предположено** / **рекомендовано** /
**неизвестно**. Числовые вероятности успеха нигде не выдумываются.

## 1. Первичная проверка репозитория

| Факт | Значение | Класс |
| --- | --- | --- |
| Owner/repo | `Meta-Project2026/Metamorph`, default branch `main` | `GIT_VERIFIED` (GitHub API) |
| HEAD `main` | `074af751e9012abad1be2749c360c5d8b86218e0`, `2026-11-02T02:06:01Z`, «Merge PR #124…» | `GIT_VERIFIED` (`git ls-remote`, `/commits/main`) |
| Fast CI на HEAD | check-runs `quick (22)`, `quick (24)` → `success` | `GIT_VERIFIED` (`/commits/<sha>/check-runs`) |
| История | клон был shallow (depth=1); выполнен `git fetch --unshallow origin`, 150 коммитов — датирование ниже локально проверяемо | `GIT_VERIFIED` |
| Issue #126 | open, создан `2026-11-02T02:20:45Z`, 0 комментариев | `GIT_VERIFIED` (API) |
| Issues #61/#104/#108/#111/#115/#116/#120/#125 | open; #123 **closed** | `GIT_VERIFIED` (API) |
| PR #117, #121, #124 | merged (`839a76c`, `8e85765`, `074af75`) | `GIT_VERIFIED` (API) |
| Workflow `meta-paid-migration.yml` | всего **3** прогона: `40892520110` success (2026-10-29 14:32:38Z; набор `inputs` не проверялся — гипотеза `validate_only` НЕ подтверждена), `40900698372` failure (15:21Z), `41327197036` failure (2026-11-01 16:36Z) | `GIT_VERIFIED` (Actions API) |

**Ключевой вывод:** после 2026-11-01 16:38Z не было ни одного платного/диспетчеризованного
прогона. Следовательно, **ни один production Oracle run не исполнялся с активной
`failure-telemetry`** (добавлена 19:21:51Z, merge 20:00:30Z). `GIT_VERIFIED`.

## 2. Матрица попыток

| # | Дата / линия | Source SHA | Candidate SHA | Run / receipt / CI | G1 | G2 | G3 | Класс |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-10-29, Meta Muse Spark 1.3 | `d272170…` | **UNAVAILABLE** | Actions `40900698372`, head `d21376747c7147043ca618e149fac87c0df80111`, conclusion `failure`; README: G1 `FAIL/BUILD_FAILED`, G2/G3 не исполнялись | `FAIL` | `NOT_RUN` | `NOT_RUN` | `RECEIPT_VERIFIED` (README) + `UNKNOWN` (точная ошибка компилятора) |
| 2 | 2026-11-01, Meta v2 | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` | `1120249ee45c0aa3efe73d57d01e813d522a9c2252fcd3e2d984a4000b9d9d2d` | Actions **`41327197036`** / job `124909546925`, head `d199510fd802693d4af852bd5ed8498b5461d185`, `workflow_dispatch`, attempt 1, created `16:36:25Z`, completed `16:38:33Z`; `research/mmp-104/incident.json` | `INCONCLUSIVE` 2/6 (`BUILD_NOT_RUN`), per-pair typecheck+build PASS | `ERROR` `VERIFIER_ERROR` **0/17** | `ERROR` `VERIFIER_ERROR` **1/20** (`workshop-business:initial`) | `RECEIPT_VERIFIED` |
| 3 | 2026-11-02, GLM 5.3 (ZCode) first draft | тот же | `4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72` | freeze commit `c482e19f8242850f1cc04f79a79add79e68658ee`; run `mmp123-20261102T013108Z-bc21b08702a2`, driver head `a8cf79dd…`; `research/mmp-123/evidence/local-a8cf79dd-*/…` | `FAIL` 1/6, `TS2345` `src/config.ts:100:41`, `BUILD_FAILED` | `INCONCLUSIVE` 0/17 `MISSING_COVERAGE` | `INCONCLUSIVE` 0/20 | `RECEIPT_VERIFIED` |
| 4 | 2026-11-02, один OpenCode repair | тот же | `0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1` (меняется только `src/phpcompat.ts`, 4813 B) | run `mmp123-20261102T014652Z-cac1410a17b1`, driver head `79440b8dd…`; `research/mmp-123/evidence/local-79440b8d-*/…` | `INCONCLUSIVE` 2/6 (`BUILD_NOT_RUN`), compiler projection `g1Verdict PASS`, `DIAGNOSTIC_UNAVAILABLE` | `ERROR` **0/17** | `ERROR` **1/20** | `RECEIPT_VERIFIED` |
| 5 | 2026-11-01/02, MMP-108 known-good fixture | тот же | `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334` | head `f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c`, `research/mmp-108/evidence/local-f9a7b44/…` | **PASS 6/6** | **PASS 17/17** | **PASS 20/20** | `RECEIPT_VERIFIED` (не AI!) |
| 6 | MMP-108 synthetic mutant | тот же | `43eb3aeb392a65da325a5433246609c1a0d01c9b03633feeaf08a6d44a3e59f9` (`res.statusCode=503`) | там же | `PASS 6/6` | `FAIL` 17/17 `HTTP_STATUS` | `FAIL` 20/20 | `RECEIPT_VERIFIED` |
| 7 | MMP-104 synthetic controls | — | — | `research/mmp-104/README.md`, `validation.md`: 9 first-step faults → 0/17+1/20; 4 reset/initial faults → 0/17+0/20 | — | — | — | `RECEIPT_VERIFIED` (документ) |
| 8 | MMP-108 offline controls | — | — | `offline-synthetic-first-step-controls.json`: candidate/reference/malformed first-request → одинаковый 0/17+1/20 `ERROR`; comparator → `FAIL` 17/20; teardown → `ERROR` 17/20 | — | — | — | `RECEIPT_VERIFIED` |

Пины, общие для 2–6 (`RECEIPT_VERIFIED`): MANIFEST
`d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`, RECIPE
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`, archive
`32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`, PHP image
`php@sha256:620a6b9f4d4feef2210026172570465e9d0c1de79766418d3affd09190a7fda5`,
`SOURCE.clock = "2026-10-27 12:00:00"`, `initialSha256 = 4dad8da4…`.

Попытка 2 дополнительно (`incident.json`, `RECEIPT_VERIFIED`): 1 POST, HTTP 200,
`muse-spark-1.3`, input 5 985 / output 9 870 tokens, `estimatedCostUsd 0.04942875`,
`chargedCostUsd null`, `requestSha256 55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d`,
`contextSha256 21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345`,
`preservation NOT_APPLICABLE`, `cleanup VERIFIED_ZERO_RESOURCES`, finalizer PASS 0/0/0,
`attemptLedger.status UNKNOWN, attemptedRequests 1`, `stageClassification NOT_RECORDED`,
`historicalRootCause UNKNOWN`, `historicalCandidateSource UNAVAILABLE`,
`privateOperationPacks UNAVAILABLE`, G4 `INCONCLUSIVE/HELD_OUT_NOT_RUN`.

## 3. Датирование телеметрии (решает вопрос «почему её нет в обоих receipts»)

| Событие | SHA | Время | `failure-telemetry.ts` существует? |
| --- | --- | --- | --- |
| Meta run #41327197036 | `d199510…` | 2026-11-01 16:36:25Z | **НЕТ** |
| MMP-108 execution head | `f9a7b44…` | дата в локальной истории недоступна | **NOT_INSPECTED** (объект отсутствует в клоне). Базовые `9cbe1ef` / `114973c` — **НЕТ** (`git cat-file -e`); receipts формата `mmp108-first-step-proof-v1` поля телеметрии не содержат. PR-head `01d1f28` уже **ДА**, но Docker-перезапуска не было |
| `feat(oracle): add trusted bounded production failure telemetry` | `eb36864` | 2026-11-01 21:21:51+02:00 (=19:21:51Z) | ДА |
| Merge PR #113 «production trusted failure-stage telemetry» | `2b82c8f` | 2026-11-01 22:00:30+02:00 | ДА |
| GLM freeze `c482e19` (parent `8e85765`) | `c482e19` | 2026-11-02 03:06:48+02:00 | ДА |
| GLM draft/repair driver heads `a8cf79d`, `79440b8d` | — | 03:30 / 03:46 +02:00 | ДА |
| Текущий `main` | `074af75` | 2026-11-02 04:06 +02:00 | ДА |

Три независимые причины отсутствия полей в MMP-123 receipts (`GIT_VERIFIED`):
1. `research/mmp-123/verifier-proof.mjs:299-331` строит **собственный allowlist** (`pairsDetail`
   содержит только `scenarioId`, `cleanup`, `compilerDiagnostics`) и не копирует
   `failureTelemetry`, хотя `report.mjs:401` его проецирует.
2. `runtime.mjs:203-204` берёт `runId` из `process.env.GITHUB_RUN_ID` **только если**
   `GITHUB_SHA === headSha`; в `run-inner.sh` эти переменные не заданы → `runId: null` →
   `checkedBinding` (`failure-telemetry.ts:146-163`) → `createFailureTelemetry` возвращает
   `null` → `MISSING_BINDING`.
3. `runner.ts:562-564` возвращает `failureTelemetry` лишь при
   `input.failureTelemetry !== undefined`; `workshop-pilot.mjs:197-203` вообще вызывает
   `verifyPair` без этого аргумента.

Даже при `AVAILABLE` телеметрия даёт **stage + категорию** (`OPERATION_REJECTED`/
`SIGNAL_ABORTED`/`UNKNOWN`), а не root cause: `research/mmp-104/telemetry-design.md`
прямо оговаривает «*no root-cause attribution follows*», а `unclassifiedFailure()`
(`failure-telemetry.ts:492-495`) помечает неклассифицированные сбои `INTERNAL_ERROR`.

## 4. Различение статусов (обязательно)

- `FAIL` — доказана несходимость (есть `HTTP_*`/`DB_*` diffs); `ERROR` — сравнение не состоялось;
  `INCONCLUSIVE` — нехватка покрытия; `NOT_RUN` — не исполнялось.
- Per-pair/case `status: PASS` = **исполнительная целостность процедуры**, а не эквивалентность
  (`research/mmp-123/RESULTS.md`, `verifier-proof.mjs:299-301`).
- `G1 2/6` и `G1 PASS` одной пары ≠ `G1 aggregate 6/6 PASS` (`runtime.mjs:230-301`,
  `report.mjs` aggregation; executor-prefix semantics `INSIGHTS.md` §3).
- `0/17` ≠ «0 HTTP-запросов дошли до сервисов»: `runner.ts:284-350` сначала выполняет
  Reference request, затем Candidate; `executedHttp.push` — после `HTTP_COMPARE`.
- `HELD_OUT_NOT_RUN` (9 или 27 synthetic control IDs) ≠ формальный G4.
- `preservation NOT_APPLICABLE` + `ciphertextSha256: null` ≠ «источник восстановлен владельцем».
- `CI success` ≠ Oracle PASS ≠ product acceptance.

## 5. Пропущенные доказательства / противоречия

| Что | Статус |
| --- | --- |
| Исходный TS-кандидат Meta run #41327197036; private operation packs; исходный root cause | `UNKNOWN` / `UNAVAILABLE` (не реконструировались) |
| Реально списанная сумма за Meta POST | `UNKNOWN` (`chargedCostUsd: null`) |
| Причина `VERIFIER_ERROR` в run #41327197036 | `UNKNOWN`; одинаковый публичный профиль не доказывает общую причину с GLM |
| Авторство GLM 5.3 / ZCode, «не читал фикстуры до драфта» | `EXECUTOR_REPORTED`; `research/mmp-123/PROVENANCE.md:118-131` — `NOT_VERIFIED`, «self-reported» |
| Модель repair | `EXECUTOR_REPORTED` = `glm-5.3-flash-free` (OpenCode); Sol 6.1 был **запрошен**, не исполнен. `WITH_SOL_REPAIR` в имени receipt не доказательство (`PROVENANCE.md:125-131`, PR #124 body) |
| `contextPayloadSha256 21415d8b…` GLM реконструкции | совпадает со значением `contextSha256` в `incident.json`, но проект консервативно помечает равенство `NOT_VERIFIED` (`PROVENANCE.md:48-55, 234-235`); не A/B одного и того же wire-промпта |
| 5 fail-closed циклов MMP-123 до evidenced run | `EXECUTOR_REPORTED` (`RESULTS.md`); receipts не публиковались |
| Реконструкция DDL/initial state у GLM repair | `HYPOTHESIS` из `runner.ts:281` (`if (initialDiffs.length > 0) continue;`) + отсутствия `DB_*` findings: чтобы попасть в HTTP-цикл, initial DB должен был совпасть. Сильное, но косвенное |
| Противоречие имён deliverables | issue #126 просит 7 файлов, приложенный промпт — 9; см. `README.md` |
| Метаданные arXiv:2609.20257 | ID вида `2609.*`, но страница abs сообщает «Submitted on 28 Jul 2026»; на странице автора значится EMSE 2026 journal — статус `PREPRINT/AMBIGUOUS`, см. `04`, `08` |
| Claim «0 успехов» | Верно только для **AI-миграций**; constructive existence proof для scoped PHP→TS уже есть (MMP-108), но он не AI и не должен выдаваться за таковой |
