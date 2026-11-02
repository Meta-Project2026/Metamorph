# 02 — First-HTTP forensics: `VERIFIER_ERROR`

Всё статически, READ-ONLY. Ни один Docker/прогон не выполнялся. Ссылки вида `файл:строка`
относятся к `main@074af751…`; исторический Meta-run исполнялся на `d199510…`, но
`research/mmp-104/README.md` «Supported failure interval» явно закрепляет тот же путь в этом SHA.

## 1. Карта последовательности (со стрелками)

```
validateGeneratedMigration (packages/agent-real/src/migration-trial.mjs:168-239)
  → createEnvironment / RealVerifier.verify → runPair (runtime.mjs:319-493)
      → admitDirectory (target-worker/src/admission.mjs:45-99)  [только src/**/*.ts, ≤64 файла, 1 MiB]
      → TargetOracleAdapter.provision (differential/src/target-adapter.mjs:181-190)
          = «public-initial» reset + cleanInitial snapshot
      → clock / validateTargetClock (runtime.mjs:376-389; runtime/clock.mjs)
      → createFailureTelemetry (runtime.mjs:331-341 → oracle/src/failure-telemetry.ts:165-191)
      → verifyPair (oracle/src/runner.ts:86-565)
```

Внутри `verifyPair` (номера строк — `runner.ts`):

```
[140-142]  mkdtemp("oracle-*") + http/ db/ diffs/                         EVIDENCE dir
[209-223]  runControls() → controls.json                                 EVIDENCE_CONTROLS_WRITE
[226]      REFERENCE_RESET   ──► PhpReferenceWorker.reset (reference/worker.ts:89-117)
                                  → transport.reset (reference/docker.ts:257-318):
                                    volume create, `php -S 127.0.0.1:8080`, 40× readiness fsockopen
                                  → BOOTSTRAP GET get_slots&date=2099-06-15
                                  → capture() → inspector.php → decodeInspection (docker.ts:172-235)
                                    проверка php 7.4.33 / sqlite 3.34.1 / phpUtc==sqliteUtc==
                                    SOURCE.clock / clockPackageVersion=="0.9.8-9"
                                  → ensure(initial.legacySha256 === SOURCE.initialSha256)
[229]      CANDIDATE_RESET  ──► TargetOracleAdapter.reset (target-adapter.mjs:191-215)
                                  → worker.reset → DIRTY_TARGET_RESET check против cleanInitial
[232-241]  REFERENCE_INITIAL_SNAPSHOT → capture → REFERENCE_OBSERVATION_CLONE
[243-248]  EVIDENCE_INITIAL_REFERENCE_WRITE
[249-258]  CANDIDATE_INITIAL_SNAPSHOT → CANDIDATE_OBSERVATION_CLONE
[259-267]  EVIDENCE_INITIAL_PAIR_WRITE
[268-272]  DB_INITIAL_COMPARE → executedDb.push("<scenario>:initial")   ★ счётчик 1/20
[273-279]  EVIDENCE_INITIAL_DIFF_WRITE
[281]      if (initialDiffs.length > 0) continue;   ★ если БД разошлась — HTTP не будет вообще
──────────────────────────── ПЕРВЫЙ HTTP, step-0 ────────────────────────────
[289-294]  REQUEST_CLONE → REFERENCE_REQUEST
             → reference/worker.ts:134-181 requestStep:
                 capture(before) → compareSqlite(this.last, before) → UNEXPECTED_STATE_CHANGE?
                 → transport.http (reference/docker.ts:319-345): `php -l` клиента,
                   `docker exec php -r <client> base64(request)`, fopen loopback, $http_response_header
                 → decodeHttp / validateHttp (docker.ts:143-166)
                 → capture(after) → evidence.write(attempt-N-step-01)
[295-310]  REFERENCE_OBSERVATION_CLONE → REFERENCE_HTTP_SERIALIZE →
           EVIDENCE_HTTP_REFERENCE_WRITE  (http/0-0-reference.json, flag "wx", 0600)
[311-321]  REQUEST_CLONE → CANDIDATE_REQUEST
             → TargetOracleAdapter.requestStep (target-adapter.mjs:248-294)
                 → currentIdentity / STEP_IDENTITY (253-264)
                 → worker.request (controller.mjs:674-692)
                      requestId = randomUUID()
                      observe({kind:"http",…}) → runtime/inspect.mjs:125-168
                          ЗАПРОС С "x-request-id": requestId (inspect.mjs:139-141)
                          ОТВЕТ: {requestId, status, headers: res.headers, bodyBase64}
                      ★ controller.mjs:686-690:
                          if (capture.headers["x-request-id"] !== requestId)
                              throw new WorkerError("OBSERVATION_ERROR")
                 → wire("http", since) / OBSERVATION_IDENTITY (target-adapter.mjs:217-238, 275-282)
                 → mapTargetHttp (differential/src/mapping.mjs:6-48):
                      raw.headers["x-request-id"] === requestId   (строка 22)
                      validateHttp(observation)                    (строка 44)
                      compareHttp(observation, observation)        (строка 46 → parseJson!)
                 → record("http", …) приватное evidence; cursor++
           → operation() catch (target-adapter.mjs:93-123): запись failure, worker.close(),
             throw new BridgeError(code)
[322-326]  CANDIDATE_OBSERVATION_CLONE
[327-346]  REFERENCE_HTTP_SERIALIZE / CANDIDATE_HTTP_SERIALIZE → EVIDENCE_HTTP_PAIR_WRITE
[347-351]  HTTP_COMPARE → compareHttp(reference, candidate) → executedHttp.push(...)  ★ счётчик G2
[352-359]  EVIDENCE_HTTP_DIFF_WRITE
[360-411]  REFERENCE_STEP_SNAPSHOT / CANDIDATE_STEP_SNAPSHOT → … → DB_STEP_COMPARE →
           executedDb.push("<scenario>:step-0") → EVIDENCE_DB_DIFF_WRITE
[415-419]  catch { telemetry.unclassifiedFailure(); fatal = "Worker, observation, comparator or
           evidence operation failed; …" }   ★ ЛЮБОЕ исключение выше → один и тот же текст
[420-431]  finally: REFERENCE_CLOSE / CANDIDATE_CLOSE; cleanup rejection → fatal override
[436-473]  makeGate: verdict = fatal ? "ERROR" : findings ? "FAIL" : !complete ? "INCONCLUSIVE" : "PASS"
[474-500]  G4 (controls PASS → INCONCLUSIVE / HELD_OUT_NOT_RUN)
[501-557]  manifest.json, events.jsonl, model-usage.json, report.html, gate-results.json
[558-565]  return { …, ...(failureTelemetry !== undefined ? {failureTelemetry} : {}) }
──────────────────────────── ПУБЛИКАЦИЯ ────────────────────────────
runtime.mjs:479-492  bindPairFailureTelemetry
report.mjs:373-410   publicAttempt → gates/coverage/pairs; raw completion/targetFailure НЕ публикуются
report.mjs:21-57     publicPairFailureTelemetry → projectFailureTelemetry (allowlist)
```

**Следствие (логически следует, `GIT_VERIFIED`+дедукция):** точка `executedHttp.push` (350)
находится *после* всех операций reference+candidate request, клонирования, сериализации,
записи evidence и `compareHttp`. Поэтому **любое** исключение в интервале 284–349 даёт
`0/17 HTTP` и `1/20 SQLite` (initial уже сосчитан на 271). Это и есть «интервал» из
`research/mmp-104/README.md` §«Supported failure interval».

## 2. Что реально проверено в `failure-telemetry.ts`

Прочитан целиком (538 строк). Факты:

- Формат `mmp104-trusted-stage-v1`, лимит 2048 байт (`failure-telemetry.ts:3-4`); 30 фиксированных
  `FAILURE_STAGES` (`:5-36`); категории только `OPERATION_REJECTED | SIGNAL_ABORTED | UNKNOWN`
  (`:37`); `REASONS` (`:39-50`); `BINDING_KEYS` `runId,headSha,sourceSha,candidateSha,attemptId,pairId`
  (`:52-62`).
- `FailureTelemetryRecord` (`:67-83`): `status AVAILABLE|UNAVAILABLE`, `unavailableReason`,
  `scenarioIndex`, `stepIndex`, `firstFailureStage`, `failureCategory`, `lastCompletedStage`,
  `cleanupFailures`, `truncated`. **Нет** `stageIndex`/`side` в виде «target vs reference» — сторона
  кодируется самим именем stage (`REFERENCE_REQUEST` / `CANDIDATE_REQUEST`).
- `createFailureTelemetry` (`:165-191`) — host-only, требует `scenarioIndex < MANIFEST.length`,
  `runId` = положительное десятичное число (`:154`), 40-hex `headSha`/`sourceSha`, 64-hex
  `candidateSha`, UUID `attemptId`/`pairId` и `binding.sourceSha === SOURCE.commit` (`:177`).
- `failureTelemetryRecorder` (`:439-458`) активируется **только если** переданный `scenarios`
  побайтово равен `[MANIFEST[scenarioIndex]]` — один публичный сценарий, «никогда hidden G4».
  `runtime.mjs:393` передаёт `[scenario]` → условие выполнимо.
- `observe` (`:512-536`) / `capture` (`:497-511`) фиксируют `firstFailureStage` и
  `failureCategory`; `fail` — first-write-only (`:476-480`); cleanup-ошибки отдельны;
  `finishFailureTelemetry` (`:395-436`) sealing.
- `projectFailureTelemetry` (`:378-394`) distrust: непроверенный/чужой объект → `UNAVAILABLE`.
- `report.mjs:21-57` — точная allowlist-проекция, `WeakMap` issuance.

**Ответ на вопрос «записана ли телеметрия в обоих исторических receipts?»: НЕТ, ни в одном.**

| Прогон | Почему | Evidence |
| --- | --- | --- |
| Meta `41327197036` | Модуль ещё не существовал (16:36Z < 19:21Z добавления / 20:00Z merge). `incident.json` прямо содержит `stageClassification: "NOT_RECORDED"`, `historicalRootCause: "UNKNOWN"` | `GIT_VERIFIED` (git log + API) |
| GLM `a8cf79d` / `79440b8d` | (a) `verifier-proof.mjs:299-331` отбрасывает поле целиком; (b) локальный `runId=null` → `createFailureTelemetry → null` → `MISSING_BINDING`; (c) даже если бы поле было, оно было бы `UNAVAILABLE`, а не `AVAILABLE` | `GIT_VERIFIED` |
| MMP-108 `f9a7b44` | Execution head недоступен в клоне (`NOT_INSPECTED`); базы `9cbe1ef`/`114973c` — без модуля; `mmp108-first-step-proof-v1` полей телеметрии не содержит | `RECEIPT_VERIFIED` + `UNKNOWN` |

Итого: **ни одного запуска с `status: AVAILABLE` в истории репозитория нет**. Это не «файл есть,
значит телеметрия есть» — это instrumentation gap. `GIT_VERIFIED`, уверенность ВЫСОКАЯ.

## 3. Ранжированные гипотезы (≥3 конкурирующие)

### H1 — Скрытый контракт `x-request-id` (candidate-side, детерминированный) · **ВЫСОКАЯ**

- **Failure-site:** `controller.mjs:686-690` (`OBSERVATION_ERROR`) и/или `mapping.mjs:22`
  (`HTTP_IDENTITY`), затем `target-adapter.mjs:93-123` → `runner.ts:415-419`.
- **Подтверждающее наблюдение:** `grep` по `research/mmp-123/repair-candidate/src/**` не находит
  `x-request-id`; `main.ts:125-129` ставит только `Content-Type`; `fixtures/workshop/src/main.ts:247`
  ставит echo и **проходит 17/17**; `migration-context.mjs:25-46` и `meta-migration.mjs:79` не
  содержат требования; `research/mmp-120/source-to-prompt-audit.md` (полный аудит модельно-видимого
  контекста и всех P0/P1 ловушек) его не упоминает; `task-card.md` запрещает читать fixtures до
  драфта.
- **Опровергающее наблюдение:** нет ни одного. Гипотеза фальсифицируема: если в
  `0cf5ba0b…` найдётся echo (в т.ч. через вычисляемое имя заголовка/нижний регистр), H1
  отпадает. Также её опроверг бы Docker-прогон, в котором Candidate request вернул валидное
  наблюдение, а сбой happened позже (`HTTP_COMPARE`/`EVIDENCE_*`).
- **Что невозможно вывести из публичного receipt:** код `OBSERVATION_ERROR`, сторона, стадия,
  что именно не совпало в заголовке, было ли это вообще исключение кандидата.
- **Минимальный тест:** (i) **read-only, уже выполнен** — статическое сравнение байт кандидата с
  `controller.mjs:686-690`; (ii) *отдельно авторизуемый* (#125 §2) один Docker-прогон с тем же
  неизменным `0cf5ba0b…` и scratch-инструментарием, проецирующим только
  `{firstFailureStage, failureCategory, side}`. Ожидается `CANDIDATE_REQUEST` /
  `OPERATION_REJECTED`.
- **Запрещено раскрывать:** приватные stdout/stderr, SQL, тела запросов/ответов, исходный код
  кандидата в публичный receipt, G4, ключи, private pack содержимое.
- **Ожидаемые различия:** target-fault → `CANDIDATE_REQUEST`; reference-fault → `REFERENCE_REQUEST`
  (и Reference evidence `http/0-0-reference.json` может отсутствовать); verifier-fault →
  `HTTP_COMPARE`/`*_WRITE`/`INTERNAL_ERROR`.

### H2 — Reference/transport/среда (PHP reset, `php -l`, loopback, inspector, stale bind) · **СРЕДНЯЯ**

- **Failure-site:** `reference/docker.ts:257-318` (readiness `WORKER_NOT_READY`), `:319-345`
  (`php -l`, `docker exec`, `decodeHttp`), `reference/worker.ts:159-166` (`UNEXPECTED_STATE_CHANGE`,
  `validateHttp`), `reference/process.ts:49-103` (`WORKER_TIMEOUT`, `COMMAND_EXEC_ERROR`,
  `PHP_CLIENT_PARSE_ERROR`, `EVIDENCE_WRITE_ERROR`).
- **Подтверждающее:** MMP-108 `README.md` finding 3 — чистый host/harness дефект (stale bind
  source `inspector.php`) дал «G1 PASS + G2/G3 VERIFIER_ERROR, zero executed observations» даже с
  known-good кандидатом; 5 fail-closed harness-циклов MMP-123 (`RESULTS.md`); MMP-104 controls
  «reference-first-request-failure» даёт тот же 0/17+1/20.
- **Опровергающее:** MMP-108 known-good full-path PASS **в том же классе окружения** сужает
  (но не снимает) «среда широко сломана»; hosted-runner #41327197036 недоступен для повтора.
- **Невозможно из receipt:** был ли PHP-сервер жив, дошёл ли запрос, был ли таймаут.
- **Минимальный тест:** авторизованный прогон с телеметрией; `REFERENCE_REQUEST` + категория
  `SIGNAL_ABORTED` подтверждал бы transport/timeout; `OPERATION_REJECTED` на `REFERENCE_RESET` —
  подготовку. Negative control: намеренный `php -l` fault на quarantine-стенде.
- **Ожидаемые различия:** см. H1.

### H3 — Исключение сериализатора/компаратора (в т.ч. спровоцированное корректным ответом кандидата) · **СРЕДНЯЯ**

- **Failure-site:** `http.ts:39-56` (`validateHttp`: нет `content-type`, не-`Uint8Array`, >1 MiB),
  `:65-101` (`parseJson`: fatal UTF-8, дубликат ключа, `JSON number would lose precision`,
  nesting >100), `:123-135` (`validateJson`), `mapping.mjs:36-47`, `runner.ts:304/337`
  (`rawHttp` → `Buffer.from(body).toString('base64')`), evidence `writeFile(..., {flag:'wx'})`
  (`runner.ts:174-182`).
- **Подтверждающее:** MMP-108 control `malformed-observation` → 0/17+1/20; MMP-104 nine
  first-step faults; `compareHttp(observation, observation)` в `mapping.mjs:46` выполняет
  `parseJson` **до** `executedHttp.push` — значит ошибка тела ответа кандидата классифицируется
  как `ERROR`, а не `FAIL`.
- **Опровергающее:** GLM-кандидат содержит отдельный `src/json.ts` и, судя по коду, сериализует
  валидный JSON; прямой static-проверки тела без запуска нет.
- **Невозможно из receipt:** какой именно код `HTTP_*`/какой валидатор упал.
- **Минимальный тест:** read-only unit-прогон `compareHttp` на синтетических наблюдениях уже
  есть в `packages/differential/test/bridge.test.mjs`; отдельно авторизуемый тест — тот же
  Docker-прогон с `HTTP_COMPARE`/`*_SERIALIZE` stage projection.
- **Ожидаемые различия:** `HTTP_COMPARE`/`CANDIDATE_HTTP_SERIALIZE` и `OPERATION_REJECTED` —
  verifier/classification fault, а не target request fault.

### H4 — «Тривиальная сигнатура»: оба 0/17,1/20 совпали не из-за общего бага · **ВЫСОКАЯ как объяснение совпадения**

- **Failure-site:** `runner.ts:415-419` + `makeGate` `:436-465` — один `fatal` на весь интервал.
- **Подтверждающее:** `offline-synthetic-first-step-controls.json` (3 разных fault → одинаковый
  профиль); `shapeNote`; MMP-104 nine-vs-four fault table; `research/mmp-108/README.md` §2.
- **Опровергающее (атака на саму H4):** одинаковый профиль **не объясняет**, почему в двух
  независимых линиях сбой случился именно на первом HTTP. Детерминированный общий контракт
  (`x-request-id`) — более сильное объяснение, чем «просто совпало»: он предсказывает и место, и
  повторяемость. H4 и H1 **не исключают** друг друга: H4 объясняет *неразличимость*, H1 — *причину*.
- **Атака на противоположную гипотезу («общий баг verifier»):** против неё — MMP-108 full PASS
  17/17+20/20 на неизменном verifier; `comparator-status-fault` даёт scored `FAIL`, а не `ERROR`;
  `worker-teardown-fault` даёт `ERROR` при 17/20, а не 0/17. Общий «всегда ломающийся» verifier
  опровергнут. Общий *точечный* дефект в hosted-окружении Meta остаётся `UNKNOWN`.

### H5 — Cleanup/evidence-publication fault · **НИЗКАЯ**

`runner.ts:420-431` cleanup rejection переопределяет `fatal`, но `incident.json` и MMP-123 receipts
имеют `cleanup VERIFIED_ZERO_RESOURCES` + finalizer PASS 0/0/0 → записанный cleanup-сбой как
финальная причина исключён (`RECEIPT_VERIFIED`). Поздний post-step DB/HTTP-diff write дал бы
`executedHttp`/`executedDb` ≥1 → не соответствует 0/17 (`research/mmp-104/README.md` §2, п.4).

## 4. Stage/side decision tree (категориальный receipt, без приватных стеков)

```
Публичный receipt: G2/G3 = ERROR VERIFIER_ERROR?
├─ executedDb = 0/20  → сбой ДО/НА initial snapshot
│    (REFERENCE_RESET | CANDIDATE_RESET | *_INITIAL_SNAPSHOT | DB_INITIAL_COMPARE |
│     EVIDENCE_INITIAL_* | controls)       [MMP-104: 4 reset-fault → 0/17+0/20]
├─ executedDb = 1/20 и executedHttp = 0/17 → интервал 284-349 (первый HTTP)
│    ├─ firstFailureStage = REFERENCE_REQUEST / REFERENCE_OBSERVATION_CLONE /
│    │    REFERENCE_HTTP_SERIALIZE / EVIDENCE_HTTP_REFERENCE_WRITE
│    │      → PHP reset/readiness/loopback/inspector/HTTP exception, transport timeout,
│    │        malformed reference observation, serializer/comparator exception на reference
│    ├─ firstFailureStage = CANDIDATE_REQUEST / CANDIDATE_OBSERVATION_CLONE /
│    │    CANDIDATE_HTTP_SERIALIZE / EVIDENCE_HTTP_PAIR_WRITE
│    │      → TS start/readiness/request exception, OBSERVATION_ERROR (x-request-id!),
│    │        malformed candidate observation, comparator/serialize exception
│    ├─ firstFailureStage = HTTP_COMPARE / EVIDENCE_HTTP_DIFF_WRITE
│    │      → comparator/evidence fault, уже ПОСЛЕ обоих ответов
│    ├─ failureCategory = SIGNAL_ABORTED → abort/timeout (не различает timer vs parent cancel)
│    └─ status = UNAVAILABLE / INTERNAL_ERROR → отказ инструментации; делать вывод НЕЛЬЗЯ
├─ executedHttp = 17/17 и executedDb = 20/20 при ERROR → cleanup/teardown fault
│                                                        [MMP-108 control]
└─ verdict = FAIL с HTTP_*/DB_* → доказательная несходимость (не ERROR)
```

Три mutually discriminating outcome для ближайшего диагностического прогона:
**O1** `CANDIDATE_REQUEST / OPERATION_REJECTED` (подтверждает H1),
**O2** `REFERENCE_REQUEST / SIGNAL_ABORTED|OPERATION_REJECTED` (подтверждает H2),
**O3** `HTTP_COMPARE|EVIDENCE_* / OPERATION_REJECTED` либо `UNAVAILABLE/MISSING_BINDING`
(подтверждает H3 или фиксирует отказ инструментации). Отрицательный контроль: тот же прогон с
known-good `34c8325a…` должен дать `AVAILABLE` без `firstFailureStage` и 17/17+20/20; намеренный
`x-request-id`-мутант известного кандидата должен дать **O1** (защита от ложной атрибуции
target↔reference↔environment).

## 5. Что запрещено и чего не хватает

Запрещено: реконструировать удалённое приватное evidence; читать G4/закрытые эталоны; запускать
Docker/CI/Meta без нового согласия; ослаблять gates или менять normalization; публиковать raw
stderr/SQL/стек/пути/исходник кандидата/промпт-ответ модели; использовать ключ владельца.
Не хватает: одного запуска с активной `AVAILABLE` телеметрией; категорического side/stage receipt
для `0cf5ba0b…`; подтверждённого владельцем восстановления зашифрованного кандидата Meta;
сверки точного `contextSha256`/body SHA на актуальном main перед новой авторизацией.
