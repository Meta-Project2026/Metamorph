# MMP-169 — Независимый аудит Metamorph: код, риски live- демо и приоритеты к хакатону

## Метаблок отчёта

| Поле | Значение |
| --- | --- |
| Исполнитель | Arena AI — sol 6.1, effort ultra. Полностью независимый аудитор; не участвовал в разработке Metamorph, не защищает решения команды |
| Репозиторий | https://github.com/Meta-Project2026/Metamorph (public) |
| Issue | #169 |
| Аудитированный SHA | `9b8b2b17d8c9231e0e543b75bab7ec846a86f0f9` — `main` после merge PR #168 (MMP-167 offline build-phase diagnostics). Совпадает с локальным HEAD и `origin/main`; сверено через `git log` и GitHub API |
| Дата аудита | 2026-11-04 (UTC) |
| Язык отчёта | Русский |
| Режим | Исследование и read-only adversarial review; изменения без отдельного поручения не реализовываются |
| Уровни доказательств | `VERIFIED CODE` (исходник прочитан), `ACTUALLY_RUN` (команда выполнена автором отчёта), `HOSTED CI` (статус ран через GitHub API, чужой CI не приписывается себе), `AUTHENTIC PAID RUN` (метаданные оплаченных runs, опубликованные receipts), `DOC-ONLY`, `INFERENCE`, `UNKNOWN` |

**Соблюдённые ограничения аудита:** без платных Meta/API вызовов, без новых `workflow_dispatch`/re-run, без расшифровки зашифрованного кандидата, без доступа к секретам/токенам, без изменений source/tests/workflows, без деструктивных атак. В репозиторий добавляется только этот файл (`research/external-audits/MMP-169-ARENA-INDEPENDENT-AUDIT.md`).

---

## 1. Executive verdict (менее 400 слов)

**Готовность проекта смешанная и оценивается по трём измерениям отдельно:**

1. **Technical/research prototype: 70/100** — сильный верификатор (строгое сравнение HTTP/JSON и SQLite с детекцией дубликатов ключей, потери точности чисел, типов, порядка массивов), независимые синтетические контролы (9 случаев: 6 HTTP + 3 DB), зашифрованная кодификация кандидатов с аутентифицированным readback, строгая изоляция в Docker (network none, read-only, nonroot, 256 MiB, 1 CPU, лимиты pid), 876 тестов зелёных локально (ACTUALLY_RUN), реальная история оплаченных генераций Muse Spark 1.3. Вывод: инфраструктура доказательства реализована на уровне research prototype.

2. **Working product/MVP: 30/100** — пользовательского веб-приложения нет (отложено), health-эндпоинт возвращает статические метки `migration: not_implemented, oracle: not_implemented, metaApi: not_integrated`. Нет сквозного пользовательского потока «загрузил legacy → получил TS → увидел равенство/неравенство → ремонт» без ручной поддержки инженера. Г0 и Г4 никогда не выполняются (хардкод `INCONCLUSIVE`); продуктовый PASS невозможен по конструкции.

3. **Hackathon/demo competitiveness: 50/100** — записанный offline-viewer с пятью треками (A–E) существует, работает локально без ключей и Docker, лучший трек E — реальный оплаченный запуск (41505679809): G1 PASS, выполнено 17/17 HTTP и 20/20 SQLite сравнений, но агрегатные G2/G3 FAIL `HTTP_JSON_TYPE`, точное offending field UNKNOWN. Это можно показать честно. Живой автономный запуск рискован: в лучшем реальном прогоне типчек завершился штатно (`executedTestIds` включает `workshop-business:typecheck`), а сбой произошёл позже — в фазе build или во внешней операции; точный subtype `UNKNOWN`. Прошлый замер холодного типчека из MMP-167 12 264 мс `ETIMEDOUT` (`research/mmp-167/RESULTS.md`, кэшированный образ) — это замер Arena, НЕ доказательство причины сбоя хоста #41749479450.

**Вердикт:** `GO WITH FALLBACK` — демонстрировать research prototype с заранее подготовленным честным записанным сценарием (трек E) и баннером `PRODUCT NOT_ESTABLISHED`. `NO-GO` для любого утверждения «успешная автономная миграция PHP→TS с доказательством поведения».

**Самый большой P0:** фаза G1 сборки может прерваться на хосте — `packages/target-worker/runtime/build.mjs:43` жестко задаёт `timeout: 12000` ms на каждую фазу `tsc` в рамках общего Docker-таймаута `provision()` 35 с (`packages/target-worker/src/controller.mjs`) и жизненного цикла 180 с (`POLICY.lifetimeMs`). Локальный замер холодного типчека 12 264 мс `ETIMEDOUT` — замер из MMP-167 с кэшированным образом, не доказательство причины сбоя #41749479450. В реальном запуске типчек завершился штатно, сбой позже — в фазе build или во внешней операции, subtype `UNKNOWN`. Главный конкурентный козырь — не «использует AI», а проверяемая инфраструктура изоляции и сравнения; главный риск для жюри — утверждение о успешной миграции, которую лучший записанный запуск не подтверждает (G2/G3 FAIL).

**Лучший следующий шаг:** устранить P0 (согласованные бюджеты сборки: холодный тест Docker, защита очистки и изоляции; код в этом PR не менять), локализовать поле `HTTP_JSON_TYPE` (P0-2), заморозить пины трека E и отрепетировать 90-секундный честный сюжет с записанным фолбэком.

---

## 2. Scope & evidence: что проверялось

**Проверено чтением исходника (VERIFIED CODE):**

- `README.md`, `AGENTS.md`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `.github/workflows/meta-paid-migration.yml`
- `packages/contracts/` (Zod-границы, `GateResultSchema`, `HealthResponseSchema`), `apps/server/` (Fastify health, только `/api/health`)
- `packages/oracle/` — HTTP/SQLite сравнение (`http.ts`, `sqlite.ts`, `controls.ts`, `runner.ts`), PHP reference transport (`src/reference/docker.ts`, `manifest.ts`, `worker.ts`)
- `packages/target-worker/` — одноразовый TS-worker, доверенный билд-рецепт (`runtime/build.mjs`, `controller.mjs`, `admission.mjs`, `runtime/profile.mjs`, `runtime/launch.mjs`, `runtime/inspect.mjs`, `runtime/clock.mjs`)
- `packages/differential/` — публичный/php-дифференциал (`public.mjs`, `policy.mjs`, `target-adapter.mjs`, `strict.mjs`)
- `packages/agent-real/` — реальная модель, кодификация (`meta-migration.mjs`, `meta-paid-authorization.mjs`, `meta-wire.mjs`), рантайм пары (`runtime.mjs`), агрегат отчёта (`report.mjs`), кодификация/сайдкар (`custody-steps.mjs`, `build-phase-diagnostics.mjs`, `compiler-diagnostics.mjs`)
- `packages/agent/`, `packages/integration/`, `packages/workshop-audit/`, `packages/evidence-retention/` — ограниченный жизненный цикл, синтетический цикл repair, независимый аудит workshop, зашифрованное хранение
- `specs/017-formal-g4/` (протокол G4 — предложение), `specs/016-candidate-compat/`, `research/mmp-167/`, `research/mmp-061/`, `research/demo-readiness/` (записанный viewer)

**Выполнено локально ACTUALLY_RUN (Node 22.22.3, pnpm 11.25.0, lockfile frozen):**

| Команда | Результат |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK (55 пакетов, lockfile прошёл supply-chain политику) |
| `pnpm lint` | OK: 361 файлов, 4 предупреждения, 2 инфо, фиксов не требуется |
| `pnpm typecheck` | OK: все workspace-проекты завершены |
| `pnpm build` | OK: все пакеты собраны |
| `pnpm test` | OK: 876 тестов — 872 pass, 0 fail, 4 skipped |
| `pnpm --filter @metamorph/oracle test:reference` | OK |
| `node --test packages/oracle/probes/qualification.test.mjs` | OK: 2/2 |
| `pnpm --filter @metamorph/workshop-audit test` | OK |
| `pnpm --filter @metamorph/target-worker test` | OK: 69/69 |
| `node --test research/demo-readiness/*.test.mjs` | OK: 187/187 |

**NOT_RUN локально:** `docker` отсутствует в среде аудита — Docker-тесты (target-worker, PHP reference оракула, полный дифференциал) не могли быть выполнены; опираюсь на исходник, отчёт `research/mmp-167/RESULTS.md` и метаданные GitHub API.

**Верифицировано через GitHub API (HOSTED CI / AUTHENTIC PAID RUN, метаданные ран, не тела артефактов):**

| Run | Workflow | SHA | Событие | Вердикт | Дата |
| --- | --- | --- | --- | --- | --- |
| 41755247513 | Fast CI | `9b8b2b17` (текущий HEAD) | push | **success** | 2026-11-04 01:36 |
| 41754335382 | Fast CI (PR #168) | `d870dbdc` | pull_request | **success** | 2026-11-04 01:28 |
| 41749479450 | Meta paid migration | `32d173fc` | workflow_dispatch | **failure** | 2026-11-04 00:47 |
| 41739486774 | Meta paid migration | `ba7f2d19` | workflow_dispatch | **failure** | 2026-11-03 23:29 |
| 41726833705 | Meta paid migration | `f034d4df` | workflow_dispatch | **success** | 2026-11-03 22:00 |

Раны 41726833705, 41739486774, 41749479450 совпадают с описанными в задании аудита; выводы не принимались на веру — сверены по статусам и SHA. Юнит-тесты viewer (`research/demo-readiness/*.test.mjs`, 187/187) — это автоматические проверки кода, а не ручная браузерная проверка.

**Не проверено и не может быть проверено в рамках аудита:** точный подтип сбоя фазы сборки в запуске 41749479450 (`UNKNOWN`, зашифрованный кандидат не расшифровывался), тела оплаченных артефактов, реальные затраты (`chargedCostUsd` = null во всех опубликованных receipts), поведение на раннере GitHub в холоде, рынок и критерии хакатона (первоисточник не найден; используется условная универсальная система оценки).

---

## 3. Три отдельные оценки 0–100

### Оценка 1 — Technical/research prototype readiness: 70/100 (вес 35%)

**Доказательства (VERIFIED CODE + ACTUALLY_RUN + AUTHENTIC PAID RUN):**
- Верификатор `verifyPair` (`packages/oracle/src/runner.ts`) выполняет попарное сравнение HTTP + SQLite по манифесту сценариев, пишет доверенные evidence-пакеты, G4 всегда `INCONCLUSIVE` с `HELD_OUT_NOT_RUN` (held-out изоляция не выполняется) — честно, не выдаётся за PASS.
- Сравнение HTTP (`packages/oracle/src/http.ts`): строгий JSON-парсер с отказом на дубликаты ключей, потеря точности чисел, неконечные значения; коды `HTTP_JSON_TYPE`, `HTTP_JSON_VALUE`, `HTTP_JSON_MISSING`, `HTTP_STATUS`, `HTTP_HEADER`, `HTTP_BODY`. Стабильные заголовки: `content-type`, `location`, `cache-control`, `allow`.
- Сравнение SQLite (`packages/oracle/src/sqlite.ts`): логический снимок, типизация int64 как строки, `sqlite_sequence`, лимит 10 001 строк, сортировка строк, `DB_SCHEMA`/`DB_STATE`.
- Контролы `runControls` (`packages/oracle/src/controls.ts`): 9 случаев (http-positive, key-order, status-mutant, type-mutant, missing-mutant, order-mutant, db-positive, row-mutant, sequence-mutant); неверный компаратор → FAIL/ERROR.
- Кодификация агента (`packages/target-worker/src/admission.mjs`): 64 файла, 256 KiB на файл, 1 MiB всего, обязателен `src/main.ts`, запрещены symlink/junction, пути вне `src/`, резервные имена (`reference|oracle|tests|fixtures|held-out|policy|ci`), sha256 каждого файла и канонического кандидата.
- Изоляция (`packages/target-worker/src/controller.mjs`): Docker, `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--cpus 1`, `--memory 256m`, `--pids-limit 64`, `--ulimit nofile=128:128`, tmpfs `/work` 64 MiB, cleanup с проверкой `containers=0, volumes=0`, иначе `CLEANUP_ERROR`.
- Кодификация/readback (`packages/agent-real/src/custody-steps.mjs`): capture → encrypted `candidate.age` → finalize (zero-resources proof) → prepare-upload → verify-download (свериться по artifact-id и digest); неудача фиксируется как `custody-*-failure.json` с `state: NO_GO`, никогда не подменяет запись.
- 876 тестов зелёны ACTUALLY_RUN; реальные оплаченные запуски Muse Spark 1.3 достигли G1 PASS (41726833705, трек E 41505679809). Аутентифицированная кодификация в #41749479450 наблюдалась через метаданные ран (custody PASS, readback, zero-resources) — не следует обозначать как `NOT_LIVE_VERIFIED`.

**Слабые стороны:** G0 и G4 не выполняются (хардкод); G1 хрупок (12 с на фазу в рамках 35-с бюджета provision); `HTTP_JSON_TYPE` не устранён в лучшем запуске; `chargedCostUsd` всегда null (оценка ×4 токена/байт + 32768 framing — не предел провайдера); история оплаченных запусков: 2 успеха (оба с G2/G3 FAIL), 2 неудачи (custody/ошибка UNKNOWN; G1 ERROR).

**Что изменит оценку:** документированный G2/G3 PASS на запиранном кандидате + выполнение G4 по протоколу specs/017 → оценка выросла бы на 15–20 баллов.

### Оценка 2 — Working product/MVP readiness: 30/100 (вес 30%)

**Доказательства:**
- Health (`apps/server/src/app.ts`, `packages/contracts/src/index.ts`): `capabilities.migration: "not_implemented"`, `oracle: "not_implemented"`, `metaApi: "not_integrated"`, `benchmark: "undecided"` — статические метки сервиса, а не статус проекта (README это оговорено, но жюри может прочитать иначе).
- Нет UI: «The optional web app is deferred until there is real run data to display» (README). Демо — только локальный записанный viewer (`research/demo-readiness/`, `node research/demo-readiness/serve.mjs`, порт 4171, loopback).
- Нет онбординга, экспорта, документации ошибок, понятного CTA для нового пользователя.
- Нет сквозного пользовательского потока без инженера: Oracle требует Docker-образ целевого рабочего процесса, provisioning PHP-референса (docker pull + build + скачивание архива car-workshop с codeload.github.com — `packages/oracle/src/reference/docker.ts provisionRuntime`), манифест и ключи. PHP-квалификация требует Docker/сеть, но не платного Meta API.
- Лучший реальный запуск (трек E): G2/G3 FAIL `HTTP_JSON_TYPE` — продукт на сегодня не доказывает равенства поведения.

**Что изменит оценку:** хоть один задокументированный сквозной прогон пользовательского slice с G2/G3 PASS и честным отображением ограничений → +20–30 баллов.

### Оценка 3 — Hackathon/demo competitiveness: 50/100 (вес 35%)

**Сильные стороны:**
- Записанный viewer уже собран и проходит тесты (187/187); работает офлайн, без ключей; пять треков A–E с верифицированными пинами (SHA-256, размеры, байт-идентичность).
- Трек E — честный сильнейший материал: реальная генерация, G1 PASS, выполнено 17/17 HTTP и 20/20 SQLite, G2/G3 FAIL с кодом `HTTP_JSON_TYPE`; баннер `PRODUCT NOT_ESTABLISHED` виден на протяжении всей прогулки. Судья без знаний PHP сможет понять: «сравнение нашло несовпадение типов JSON — это и есть продуктовая проблема».
- RUNBOOK.md указывает целевой темп 90 с / ~4 мин и фолбэки.

**Слабые стороны:**
- Живой запуск может упасть на сборке (12-с лимит фазы в рамках 35-с бюджета provision; типчек в реальном запуске завершился штатно, сбой позже — subtype UNKNOWN). При G1 `ERROR` ремонт не авторизуется (требуется завершённый подходящий `FAIL` с допустимыми кодами обратной связи) — сценарий тупиковый для демо.
- Лучшая запись демонстрирует не равенство, а несовпадение — для жюри это честно, но может быть истолковано как незавершённость.
- Нет живого пользовательского интерфейса; demo — локальный viewer на 127.0.0.1:4171 (не работает через file://, нужен сервер).

**Вердикт по измерению:** можно соревноваться в категории «research prototype с честным демо»; утверждение о «working product» не поддерживает. 

**Условные вердикты:** `GO WITH FALLBACK` для демо research prototype с записанным фолбэком (трек E); `NO-GO` для утверждения «live autonomous migration с доказательством поведения».

---

## 4. Actual end-to-end coverage matrix

| Узел цепочки | Где реализован | Состояние | Самая сильная проверка | Основной риск для демо | Без платного API? |
| --- | --- | --- | --- | --- | --- |
| Исходная квалификация PHP | `packages/oracle/src/reference/docker.ts`, `manifest.ts` (`SOURCE.archiveSha256`) | IMPLEMENTED (требуется сеть: pull/build/codeload; не платный Meta API) | ACTUALLY_RUN qualification.test.mjs 2/2 | сеть/образ на раннере | Да (нужны Docker и сеть, но платный Meta API не требуется) |
| Генерация кандидата (модель) | `packages/agent-real/src/meta-migration.mjs` (`maxRequests: 1`, `maxRepairs: 0`) | AUTHENTIC_PAID_RUN (исторические запуски; в PR CI платных вызовов нет) | HOSTED CI метаданные ран 41726833705/41749479450/41739486774 | платный POST, модель, квота | Нет (workflow_dispatch, актеры) |
| Source lease / encrypted custody | `packages/agent-real/src/custody-steps.mjs`, `custody-checkpoint.mjs`, `custody-contract.mjs` | IMPLEMENTED — аутентифицированная кодификация наблюдалась через метаданные ран #41749479450 (custody PASS, readback, zero-resources) | метаданные ран 41749479450: custody PASS, readback, zero-resources | утечка метаданных в логи | Да (локальный синтетический цикл) |
| Хранилище кандидата / readback | `packages/agent-real/src/custody-steps.mjs` capture/finalize/verify-download | LIVE_RECEIPT_VERIFIED (run #41749479450, сохранённый ciphertext readback) | artifact-id + digest свериться | 7-дневный TTL артефактов | Да |
| Аутентифицированный readback | то же | LIVE_RECEIPT_VERIFIED (run #41749479450, authenticated readback) | `MMP115_ARTIFACT_ID` / `MMP115_ARCHIVE_SHA256` | действия через Actions API | Да (нужны GitHub Actions API и раннер, но не платный Meta API) |
| G1 сборка/типчека целевого объекта | `packages/target-worker/runtime/build.mjs:43` (`timeout: 12000` на фазу); `packages/target-worker/src/controller.mjs` (`provision`, общий Docker-таймаут сборки 35 с); `POLICY.lifetimeMs=180000`; `packages/agent-real/src/runtime.mjs` `buildReceipt` | PARTIAL — теплые прогоны проходят; в реальном запуске `executedTestIds` включает `workshop-business:typecheck` (типчек завершился штатно), сбой позже — в фазе build или внешней операции; точный subtype `UNKNOWN` | mmp-167/RESULTS.md: локальный холод 12 264 мс `ETIMEDOUT` (замер Arena, не доказательство для хоста); ран 41749479450 G1 `ERROR` | 12-с лимит фазы в рамках 35-с бюджета provision; subtype сбоя на хосте `UNKNOWN` | Да (локально с Docker) |
| G2 HTTP-дифференциал | `packages/oracle/src/runner.ts` `verifyPair` → `compareHttp` | PARTIAL — выполнено в реальных запусках, FAIL `HTTP_JSON_TYPE` | ран 41726833705 + трек E: 17/17 выполнено, FAIL | неидентифицированное поле mismatch | Да (синтетические фикстуры) |
| G3 SQLite-дифференциал | `packages/oracle/src/sqlite.ts` `compareSqlite` | PARTIAL — 20/20 выполнено, агрегат FAIL `HTTP_JSON_TYPE` (унаследовано из HTTP findings); snapshot базы совпадал в пределах манифеста (per demo-readiness README), точное поле SQLite не доказано | то же | sqlite_sequence, типы | Да |
| G4 held-out изоляция | `packages/agent-real/src/report.mjs` — хардкод `INCONCLUSIVE` + `HELD_OUT_NOT_RUN` | NOT_IMPLEMENTED (по конструкции) | нет пула held-out, нет регистрации (specs/017 — предложение) | нельзя утверждать product PASS | Да (но не реализовано) |
| Repair / обратная связь | `packages/agent-real/src/live-experiment.mjs`, `meta-migration.mjs` `maxRepairs: 0` | PARTIAL — только `generate_then_repair` через оплаченный workflow; G1 `ENVIRONMENT_ERROR` не семантический `FAIL` кандидата, безопасный default — `NO_GO` без отдельного approval | ран 41726833705: один repair POST, G2/G3 всё ещё FAIL | ERROR тупик (не repair-eligible) | Нет |
| Контролы G0/G4 | `packages/oracle/src/controls.ts` `runControls` (synthetic) | WORKS_SYNTHETIC — 9 случаев | `pnpm test` зелёно | не являются Docker-парным или held-out | Да |
| Публичный скоркард | `packages/agent-real/src/report.mjs` `aggregateAttempt`, `publicAttempt` | IMPLEMENTED | коды верифицированы; G4 никогда не PASS | ложное ощущение готовности | Да |
| Публичная демонстрация | `research/demo-readiness/` viewer (треки A–E) | AUTOMATED_TESTS_PASS (записанный viewer; ручная браузерная проверка NOT_RUN) | `node research/demo-readiness/serve.mjs`, тесты 187/187 | только записанные треки | Да |

**Таблица «заявленная функция → наблюдаемое поведение → источник»:**

| Заявлено | Наблюдается | Источник |
| --- | --- | --- |
| «Real PHP 7.4 qualification executed on isolated hosted Docker runner (MMP-005)» | Исторически выполнялось; сейчас Docker-конфигурация в коде, живого прогона в этой среде не проверить | `specs/006-php74-qualification/`, mmp-167, README (DOC-ONLY / HOSTED CI исторически) |
| «One authorized paid model generation 2026-10-29; candidate failed G1 build/typecheck» | Подтверждено метаданными: 4 оплаченных запуска, лучший — G1 PASS + G2/G3 FAIL | HOSTED CI метаданные (41726833705 и др.), трек E viewer |
| «G2/G3 17/17 HTTP и 20/20 SQLite выполнены» | Выполнено в запуске 41726833705 и треке E, но вердикт FAIL `HTTP_JSON_TYPE` | AUTHENTIC PAID RUN метаданные + viewer пины |
| «864/876 тестов зелёные = релизная готовность» | Измерено автором: 872 pass / 0 fail / 4 skipped (ACTUALLY_RUN); тесты не покрывают G0/G1/G4 и живой оракул | ACTUALLY_RUN — не доказательство продуктовой готовности |
| «Продуктовая миграция с формальным G4» | G0 и G4 хардкодом `INCONCLUSIVE`; `product: NOT_ESTABLISHED` | `report.mjs`, `public.mjs` (VERIFIED CODE) |

---

## 5. Top critical findings P0/P1

### Finding P0-1 — G1 фаза сборки может прерваться на хосте; 12-с лимит — гипотеза, не доказанная причина #41749479450

**Дефект:** `packages/target-worker/runtime/build.mjs:43` — `timeout: 12000` ms для каждой из двух фаз (`typecheck`, `build`), `:44` — `maxBuffer: 512 * 1024`. Общий Docker-таймаут `provision()` в `packages/target-worker/src/controller.mjs` — `timeoutMs: 35000`; `POLICY.lifetimeMs=180000`. Простое увеличение фаз до 60 с бесполезно — оно упрется в 35-с бюджет `provision()`.

**Call path:** `RealVerifier.execute` (`runtime.mjs`) → `runPair` → `target.provision` → `TargetWorker.provision` (`controller.mjs`) → `docker run node /opt/worker/build.mjs` → `buildReceipt` (`runtime.mjs`): в реальном запуске `executedTestIds=[\"workshop-business:typecheck\"]`, то есть типчек завершился штатно (ID добавляется только после нормального завершения фазы); сбой произошёл позже — в фазе build или во внешней операции. Контроллер (`controller.mjs` `provision`) при exit 2 маркирует операцию `BUILD_FAILED`; `runPair` прерывает цикл сценариев (`break` при `pair.errorCode` или gate `ERROR`); ремонт не авторизуется (требуется complete eligible `FAIL`).

**Доказательство:** AUTHENTIC PAID RUN 41749479450 (HOSTED CI метаданные, mmp-167/RESULTS.md): G1 `ERROR`, `executedTestIds=[\"workshop-business:typecheck\"]`, finding codes `[\"ENVIRONMENT_ERROR\",\"BUILD_FAILED\"]`, компиляторная диагностика `status=DIAGNOSTIC_UNAVAILABLE`, G2/G3 `ERROR` — 0/17 HTTP и 0/20 SQLite, ремонта не было (0 POST). Точный подтип сбоя на раннере остаётся `UNKNOWN`. Локальный замер холодного типчека 12 264 мс `ETIMEDOUT` (`research/mmp-167/RESULTS.md`, кэшированный/модифицированный образ) — НЕ новый замер текущего аудита и НЕ доказательство причины сбоя hosted paid run #41749479450.

**Что уточнило бы гипотезу:** тест холодной сборки известной фикстуры на точном образе и раннере выявит, достаточны ли лимиты; но установить причину исторического #41749479450 можно лишь из авторизованной диагностики именно того запуска. Результат новой сборки не доказывает задним числом его subtype. Нынешний сайдкар `build-phase-diagnostics.mjs` (уже реализован, MMP-167) эмитит `BUILD_PHASE_TIMEOUT` только для G1 `ERROR` и не публикует сырые stdout/stderr.

**Минимальное исправление:** согласованные ограниченные бюджеты (per-phase таймаут в рамках 35-с `provision()`), холодный тест Docker с фикстурой workshop, защита очистки и изоляции. Код в этом PR не менять (только отчёт).

**Acceptance criteria:** холодный контейнер целевой фиксы проходит `typecheck`+`build` с запасом ≥2× от измеренного времени; сайдкар эмитит `BUILD_PHASE_TIMEOUT` строго при `ETIMEDOUT`; демо-сценарий не падает на фазе сборки.

**Усилие:** оптимистично 2–4 инж. часа; реалистично 8–12 (нужен доступ к Docker для воспроизведения холода; в этой среде Docker отсутствует — проверка на раннере или у владельца).

**Риск:** средний: согласование временных бюджетов может затронуть жизненный цикл и cleanup; при успешной проверке эффект на стабильность демо высокий.

**Параллелизм:** независим от P0-2 и P0-3; может вестись параллельно.

---

### Finding P0-2 — Семантическая эквивалентность PHP↔TS не доказана: G2/G3 падают на `HTTP_JSON_TYPE` даже при G1 PASS

**Дефект:** Лучшие реальные прогоны (41726833705, трек E 41505679809) — G1 PASS, выполнено 17/17 HTTP и 20/20 SQLite сравнений, но агрегатные вердикты G2/G3 `FAIL` с кодом `HTTP_JSON_TYPE` для обоих кандидатов. Точное offending поле/корневая причина: `UNKNOWN` (трек E README). Issue #161: ремонт запускался, `HTTP_JSON_TYPE` остался.

**Call path:** `packages/oracle/src/http.ts` `jsonDiff` → `kind(left) !== kind(right)` → `HTTP_JSON_TYPE` (строгое сравнение типов JSON: boolean vs number vs string vs null vs missing). PHP 7.4 `json_encode` (bool → `true`/`false`, числа, `null`, отсутствующие ключи) vs TS `JSON.stringify` — равенство не доказано. PDO-типы, транзакции, `sqlite_sequence`, граничные случаи (пустая строка vs null, 0 vs false) находятся в зоне риска и не покрыты полевым сравнением.

**Доказательство:** VERIFIED CODE (`http.ts` `jsonDiff`, `compareHttp`), AUTHENTIC PAID RUN метаданные + `research/demo-readiness/README.md` трек E (`G2/G3 FAIL / HTTP_JSON_TYPE`, HTTP 17/17, SQLite 20/20 — выполнено, не пройдено), viewer пины (байт-идентичность, SHA-256).

**Что опровергло бы:** инструментированный public-safe diff найдет конкретное поле, и команда либо исправляет генерацию/нормализацию, либо объявляет поле вне зоны требований с честным отображением в демо.

**Минимальное исправление:** локализовать поле mismatch через логику `checkedDifferences`/публичные коды (без сырых тел), сравнить сериализацию конкретного поля PHP 7.4 и TS; либо зафиксировать как известное ограничение с упоминанием в питче.

**Усилие:** среднее (разведка 4–8 ч, фикс 4–16 ч в зависимости от причины).

**Риск:** средний — правка нормализации может замаскировать реальный дефект миграции; правило «never weaken tests or normalization to hide failures» (AGENTS.md) соблюдать.

---

### Finding P0-3 — G0 и G4 никогда не выполняются; продуктовый PASS невозможен по конструкции

**Дефект:**
- `packages/agent-real/src/report.mjs` `aggregateAttempt`: G0 всегда `gateResult("G0","INCONCLUSIVE",[],["G0_NOT_ESTABLISHED"],[])`; G4 принудительно `INCONCLUSIVE` + `HELD_OUT_NOT_RUN` даже если все проходные gates PASS (строки ~321–329).
- `packages/oracle/src/runner.ts` `verifyPair`: G4 verdict `INCONCLUSIVE` с находкой `HELD_OUT_NOT_RUN` ("Synthetic controls passed; held-out isolation has not been executed"); scope `verifyPair` — `synthetic-or-public-scenarios-only`; `manifest.notRun` включает `G0 target independence`, `G4 held-out isolation`, `PHP benchmark qualification`.
- `packages/differential/src/public.mjs`: `G0: "NOT_RUN"`, `G1: "NOT_RUN"`, `product: "NOT_ESTABLISHED"`, `heldOut: "NOT_RUN"`, `otherScenarios.workshop-rejected/capacity: "NOT_RUN"`.
- Спецификация G4 (`specs/017-formal-g4/protocol.md`) — предложение (PROPOSED): нет зарегистрированного бенчмарка, нет пула held-out, нет согласия владельцев (README: «No benchmark is registered; the workshop profile is proposed for agreement, not selected»).

**Доказательство:** VERIFIED CODE; README/AGENTS.md — `PRODUCT NOT_ESTABLISHED`, `G0/G4 INCONCLUSIVE` (DOC-ONLY, но честно).

**Что опровергло бы:** реализация и прохождение G0 (цель без PHP) и G4 (held-out) по утверждённому протоколу specs/017 с обеими подписями владельцев.

**Минимальное исправление:** для хакатона — не реализовывать полный G4, а честно зафиксировать «не выполнено» в скоркарде и питче; после хакатона — путь регистрации пула held-out по specs/017.

**Усилие:** высокое (требует регистрации, пула, проверки независимости — вне time-box хакатона).

---

### Finding P1-1 — При G1 `ERROR` ремонт невозможен; безопасный default — `NO_GO`

**Дефект:** `packages/agent-real/src/runtime.mjs` `runPair`: `if (pair.errorCode) break;` — при `errorCode` цикл прерывается; `live-experiment.mjs`: публичная `G1/G2/G3 ERROR` → `PUBLIC_VERIFICATION_ERROR`, `complete=false`; ремонтный шлюз требует complete eligible `FAIL` с allowlisted feedback codes. `maxRepairs: 0` в `meta-migration.mjs:29` — автономный ремонт заблокирован; ремонт только через оплаченный workflow `generate_then_repair` (актеры `barbalatv`/`l1ncolny`, максимум 2 подписанных POST).

`G1 ENVIRONMENT_ERROR` — не семантический `FAIL` кандидата. Без отдельного approval безопасный default — `NO_GO`; потенциальный повтор независимой проверки того же неизменного кандидата — отдельный governance gate. Никаких дополнительных POST, обходов allowlist или ослабления Oracle.

**Влияние на демо:** наблюдавшийся G1 `ERROR` не имеет пути восстановления в рамках показа; причина исторического сбоя остаётся `UNKNOWN`.

**Минимальное исправление:** документировать `NO_GO` для G1 `ENVIRONMENT_ERROR`. Возможная отдельная проверка того же неизменного кандидата требует owner-approved процедуры, без дополнительных model POST; синтетический тест должен сохранять запрет ремонта при `ERROR`.

**Усилие:** 4–8 ч. **Риск:** низкий.

---

### Finding P1-2 — Непрозрачность затрат: `chargedCostUsd` всегда null, жёсткого лимита нет

**Дефект:** `packages/agent-real/src/meta-migration.mjs:38` — `monetaryCap: "MONETARY_CAP_UNSET"`, `maxRequestCostUsd: null`; в receipt `chargedCostUsd: null`, `reportedCostUsd: null`, `usageStatus: "ESTIMATE_ONLY"`; `packages/agent-real/src/meta-paid-authorization.mjs` — `monetaryCap: "NO_PROVIDER_HARD_CAP"` в подписанном приёме, оценка `×4 токена/байт + 32768 framing` — не предел провайдера. Разы: estimate $0.0465–0.0494, `charged` UNKNOWN. Интерфейс workflow `meta-paid-migration.yml` сам предупреждает: «estimate is NOT a hard dollar cap».

**Влияние:** любое утверждение о стоимости генерации/ремонта не верифицировано; жюри может спросить «сколько стоит миграция?» — честный ответ: неизвестно.

**Минимальное исправление:** в публичных отчётах различать `estimatedCostUsd` и `chargedCostUsd` (null = неизвестно); не заявлять «hard cap».

**Усилие:** 2–4 ч. **Риск:** низкий.

---

### Finding P1-3 — Публичный контракт дифференциала покрывает только один сценарий

**Дефект:** `packages/differential/src/policy.mjs` — `SCENARIOS = Object.freeze([MANIFEST[0]])`, только `workshop-business` (6 HTTP шагов). `MANIFEST` (`packages/oracle/src/reference/manifest.ts`) содержит ещё `workshop-rejected` (5 шагов) и `workshop-capacity` (6 шагов); всего 17 HTTP + 20 SQLite = полный набор, но в `public.mjs` `otherScenarios.workshop-rejected/capacity: "NOT_RUN"`. Полные 17/17+20/20 возможны только в полном цикле агента (и прерываются при первой ошибке — P1-1).

**Влияние:** заявление «все сценарии workshop проверены» не верно для публичного продукта.

**Минимальное исправление:** документально зафиксировать охват (один сценарий в публичном пилоте; два других — `NOT_RUN`) или расширить `SCENARIOS` до всех трёх с обязательным прохождением.

**Усилие:** 2–6 ч. **Риск:** низкий.

---

## 6. Other issues P2/P3

| # | Finding | Evidence | Effort | Risk |
| --- | --- | --- | --- | --- |
| P2-1 | Health-эндпоинт возвращает статические `not_implemented`/`not_integrated`/`undecided` — легко ошибочно прочитать как статус проекта | `apps/server/src/app.ts`, `packages/contracts/src/index.ts` (VERIFIED CODE) | 2–4 ч (добавить дискаймер в viewer/питч) | Низкий |
| P2-2 | Нет пользовательского веб-приложения; демо только локальный записанный viewer | README «web app is deferred»; `research/demo-readiness/serve.mjs` 127.0.0.1:4171 (VERIFIED CODE) | — (по дизайну) | Средний для впечатления жюри |
| P2-3 | PHP-референс оракула требует сети: `docker pull`, `docker build` (`npm ci`), скачивание архива с `codeload.github.com` | `packages/oracle/src/reference/docker.ts` `provisionRuntime` (VERIFIED CODE) | — | Средний (холодный раннер, доступность образа) |
| P2-4 | `maxBuffer: 512 KiB` переполнение stdout сборки (`ENOBUFS`) классифицируется сайдкаром, но редко | `build.mjs:44`, `build-phase-diagnostics.mjs` `BUILD_PHASE_OUTPUT_OVERFLOW` | 2–4 ч (измерить реальные размеры stdout) | Низкий |
| P2-5 | `build.mjs` пишет артефакты с флагом `wx` — повторная запись существующих файлов упадет | `build.mjs` `writeFileSync(..., { flag: "wx" })` | 2 ч | Низкий |
| P2-6 | Spec Kit конституция `PROPOSED / PENDING OWNER RATIFICATION` — управление не ратифицировано | `AGENTS.md`, `README.md`, `.specify/memory/constitution.md` (DOC-ONLY) | — | Низкий |
| P2-7 | Тесты `research/mmp-108` падут на Windows без Git в PATH — экология, не регрессия | `mmp-167/RESULTS.md` раздел mmp-108 | 1 ч (документация) | Низкий |
| P3-1 | Нет онбординга, экспорта, документации ошибок, CTA для нового пользователя | отсутствует в репозитории (CODE_INSPECTED) | — | — |

---

## 7. Product UX & demo audit

**Предлагаемый сценарий для жюри (ручная репетиция NOT_RUN):** показать записанный трек E в офлайн-viewer (`node research/demo-readiness/serve.mjs`, `http://127.0.0.1:4171`):
1. Экран 1 — баннер `PRODUCT NOT_ESTABLISHED`, цель: PHP→TypeScript с независимой поведенческой проверкой.
2. Трек E: запуск 41505679809 (2 ноября 2026), настоящий ответ Muse Spark 1.3; генерация PASS; G1 PASS (3 сценария, 6 typecheck/build ID); HTTP 17/17 и SQLite 20/20 выполнены сравнениями; вердикт G2/G3 `FAIL / HTTP_JSON_TYPE` — несовпадение типов JSON между PHP и TS.
3. Закрыть: «это не «успешная миграция»; это честное измерение несовпадения, которое продукт именно ищет». Время ≈ 90 с (по RUNBOOK.md).

**Сценарий, который сорвёт демо (Weak):** утверждать, что автономная миграция «работает» и показывать живой запуск без фолбэка. История опровергает: 2 из 4 оплаченных провалов, лучший имеет G2/G3 FAIL, а типчек в реальном запуске завершился штатно, а сбой произошёл позже (subtype UNKNOWN). При `ERROR` ремонт невозможен — покажут тупик.

**Записанный фолбэк:** viewer треки A–E, локально, без ключей/Докера/сети/регистрации; пять пинов с байт-идентичностью; Трек D (`research/mmp-104/incident.json`) — случай verifier-ошибки с неизвестной корневой причиной, тоже честный материал. Все треки явно помечены как записанные снимки, а не живая трансляция. Демо-трек E — запись, не live.

**Оценка судью без технических знаний:** за 60–90 с поймет проблему (legacy PHP нужно перевести на TS и доказать, что поведение не изменилось), решение (автоматическое сравнение HTTP + базы в изолированном Docker) и ценность (риск регрессии при миграции). Понятия custody/G0–G4 не нужны для первого впечатления; они для второго этапа (ответы на вопросы жюри).

---

## 8. Market/differentiation analysis (гипотезы, не верифицированы)

**Целевой пользователь:** команды и клиенты с legacy PHP-приложениями (PDO/SQLite, узкая поверхность API), которым нужно перевести на TypeScript с доказательством равенства поведения — обычный coding-агент не даёт такого доказательства, а ручная регрессия дорога.

**Дифференциация:**
- Доказано: доверенная изоляция (Docker, network none, read-only, nonroot, ресурсные лимиты, cleanup с проверкой zero resources), строгое сравнение всего тела HTTP и полной логической таблицы SQLite (включая `sqlite_sequence`), шифрование кандидатов с аутентифицированным readback, 9 контрольных случаев оракула.
- Не доказано/не уникально как продукт: «использует AI» и «много тестов» — не дифференциаторы. Успешный сквозной прогон с G2/G3 PASS ещё не показан.

**Конкуренты (гипотезы, без ссылок, так как первоисточников рынка нет в контракте):** универсальные AI coding-агенты (Cursor, Copilot и др.) — генерация без поведенческого доказательства; транспиляторы/рефакторинг PHP (например, Rector) — локальные преобразования без сравнения с оракулом; специализированные платформы модернизации legacy — тяжеловесные, корпоративные. Конкретные сравнения с датами не приводились намеренно (гипотезы).

**Opportunity cost:** команда вкладывает существенные усилия в криптографическую кодификацию, контракты, сайдкары диагностики и независимые аудиты — это обосновано для research prototype, но в ущерб working vertical slice (нет UI, нет сквозного пользовательского потока, нет онбординга). Для хакатона приоритет — стабильный критический путь и честный pitch, а не полная G0–G4 инфраструктура.

---

## 9. Prioritized action plan

| Priority | Finding | Evidence | User & judge impact | Effort | Risk | Proposed solution | Acceptance criteria | Owner/parallelism |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | G1 фаза сборки может прерваться на хосте; 12-с лимит — гипотеза | `build.mjs:43`; `controller.mjs` `provision` 35 с; `POLICY.lifetimeMs=180000`; ран 41749479450 | Стабильность live-пути; без этого живой оракул не покажешь | 8–12 ч (нужен Docker) | Низкий регрессия, высокий эффект | Согласованные ограниченные бюджеты сборки (per-phase в рамках 35-с provision), холодный тест Docker на фикстуре workshop, защита очистки и изоляции; не просто повышение до 60 с | Холодный контейнер проходит typecheck+build с запасом ≥2×; сайдкар эмитит код только при ETIMEDOUT; демо не падает на фазе сборки | Владимир; параллельно с P0-2 |
| P0 | Корневая причина `HTTP_JSON_TYPE` не найдена | Ран 41726833705 + трек E: 17/17+20/20 выполнено, FAIL; issue #161 | Честность демо: показываем равенство или известный зазор, а не загадочный FAIL | 8–20 ч | Средний (не ослаблять нормализацию) | Инструментировать public-safe diff до поля; сравнить сериализацию PHP 7.4/TS; либо фикс, либо зафиксировать ограничение в питче | Точное поле и тип mismatch найдены; либо фикс даёт G2/G3 PASS на записи, либо честное отображение в демо | Владимир + Илья (ORACLE boundary) |
| P0 | Демо-скрипт + заморозка пинов трека E; баннер NOT_ESTABLISHED | `research/demo-readiness/` (автотесты PASS; ручная браузерная проверка NOT_RUN) | Жюри получает понятный 90-с сюжет | 4–8 ч | Низкий | Записать сценарий, заморозить трек E и пины, репетировать с фолбэком | Запуск viewer локально; прогон трека E без ошибок валидации пинов | Любой участник; параллельно |
| P0 | Политика ремонта при G1 `ERROR` — NO_GO default | `runtime.mjs` break; `live-experiment.mjs` PUBLIC_VERIFICATION_ERROR | Чёткая и безопасная реакция на G1 ERROR | 4–8 ч | Низкий | Документировать правило: при G1 ENVIRONMENT_ERROR — `NO_GO` без нового model POST; отдельно описать governance gate для повторной проверки того же кандидата | Синтетический тест шлюза ремонта; решение зафиксировано в issue/чате | Владимир |
| P1 | Охват публичного дифференциала только 1 сценарий | `policy.mjs SCENARIOS=[MANIFEST[0]]`; `public.mjs` otherScenarios NOT_RUN | Прозрачность претензий «все сценарии workshop» | 2–6 ч | Низкий | Расширить `SCENARIOS` до всех трёх или зафиксировать охват в docs | `public.mjs` отражает реально выполненные сценарии; тесты зелёны | Владимир |
| P1 | Прозрачность затрат | `chargedCostUsd=null`; `NO_PROVIDER_HARD_CAP` | Ответ на вопрос жюри «сколько стоит?» | 2–4 ч | Низкий | Разделять estimated/charged в публичных отчётах; не заявлять hard cap | Публичный отчёт показывает estimated vs actual (null) честно | Илья |
| P1 | Измерение холодного vs тёплого старта на раннере | mmp-167 результаты только локально (Windows) | Обоснование таймаута для жюри | 2–4 ч (нужен раннер) | Низкий | Замер на холодном раннере GitHub (без кандидата, фикстура workshop) | Цикл измерений задокументирован | Владимир |
| P2 | Дискаймер health-меток и отсутствие UI | `app.ts` capabilities | Предотвратить недопонимание жюри | 2–4 ч | Низкий | Добавить в viewer и питч раздел «что не является продуктом» | Текст дискаймера присутствует | Любой |
| P3 | Г0/Г4 реализация отложена после хакатона | `specs/017` — предложение; `report.mjs` хардкод INCONCLUSIVE | Сосредоточение на демо | — | — | Не начинать реализацию G4 до стабилизации критического пути | Решение зафиксировано (postpone) | Илья + Владимир |

**Параллелизация:** P0-1 (бюджеты сборки), P0-2 (поля mismatch) и P0-3 (демо-скрипт) независимы и могут вестись параллельно без пересечения контрактов. P1-1 блокирует выбор живого сценария ремонта — решать до репетиции. G4/held-out (P3) преждевременно — не трогать до хакатона.

---

## 10. План на ближайшие 24/48 часа и критерии GO / NO-GO

**24 часа:**
1. P0-1: согласованные ограниченные бюджеты сборки (per-phase в рамках 35-с `provision()`); холодный тест Docker с фикстурой workshop (Docker отсутствует в этой среде — замер у владельца или в CI).
2. P0-2: локализовать поле `HTTP_JSON_TYPE` через инструментированный diff (публичные коды, без сырых тел).
3. P0-3: заморозить пины трека E, написать 90-с демо-скрипт с баннером `PRODUCT NOT_ESTABLISHED`, отрепетировать с записанным фолбэком.
4. Зафиксировать решение по ремонту после `ERROR` (P1-1) — идти на демо с живым ремонтом или без (NO_GO default).

**48 часов (остаток до хакатона):**
5. Если владелец авторизует оплаченный прогон — один честный запуск Oracle на том же кандидате (ремонт не планировать: при `ERROR` тупик). Если авторизация невозможна — основное демо = записанный трек E, фолбэк = треки A–D.
6. P1-2/P1-3: отчёт о затратах и охвате сценариев в текст питча.
7. P2-1: дискаймер health-меток в viewer.

**Критерии GO для следующего live-demo:**
- типчек стабильно `PASS` на запиранном кандидате в холодном контейнере (margin ≥2× от измеренного времени);
- демо-скрипт показывает либо G2/G3 PASS, либо честно показывает `HTTP_JSON_TYPE` как известную открытую проблему;
- записанный фолбэк (трек E) готов и валидируется пинами;
- никто не утверждает «продуктовая миграция завершена».

**Критерии NO-GO:**
- любое утверждение об успешной автономной миграции без G2/G3 PASS;
- зависимость демо от живого оплаченного POST без записи фолбэка;
- типчек `ERROR` без сценария продолжения.

---

## 11. 5 задач STOP / POSTPONE

1. **POSTPONE** пользовательское веб-приложение (UI deferred) — нет реальных данных запуска для отображения; для хакатона достаточно записанного viewer.
2. **POSTPONE** реализацию G4 held-out изоляции до после хакатона — specs/017 — предложение, требует регистрации пула и согласия обоих владельцев; сейчас это сложность без эффекта на демо.
3. **POSTPONE** расширение бенчмарка на новые PHP-репозитории — слайс car-workshop ещё не доказан сквозно; новый репозиторий умножит риски демо.
4. **STOP** добавление оплаченных/model-запусков в PR CI — CI правильно ограничен `frozen install → lint → typecheck → test → build`; оплаченное — только `workflow_dispatch` владельцев.
5. **STOP** рассуждения «тесты зелёные = релизная готовность» в питче — 876 тестов не покрывают G0/G1/G4 и живой оракул; лучше честно сказать, что не покрыто.

---

## 12. Skeptical jury: 5 неудобных вопросов + лучшие честные ответы

**Q1. «Вы доказали, что PHP-проект реально работает на TypeScript без PHP?»**
A: Нет. Лучший записанный запуск (трек E): G1 PASS, все 17/17 HTTP и 20/20 SQLite сравнения выполнены, но вердикт `FAIL` на `HTTP_JSON_TYPE` — несовпадение типов JSON. G0 (работа цели без PHP) и G4 (held-out) не выполняются. Статус продукта: `NOT_ESTABLISHED`. Мы показываем инструмент измерения несовпадения, а не завершённую миграцию.

**Q2. «Почему живой запуск может упасть во время демо, и что вы покажете вместо этого?»**
A: В реальном запуске типчек завершился штатно (`executedTestIds` включает `workshop-business:typecheck`); сбой произошёл позже — в фазе build или во внешней операции, точный subtype `UNKNOWN`. Локальный замер холодного типчека 12 264 мс `ETIMEDOUT` — замер из MMP-167 с кэшированным образом, не доказательство причины сбоя хоста. При `ERROR` ремонт по правилам не запускается. Поэтому основное демо — записанный трек E с верифицированными пинами (байт-идентичность, SHA-256), чётко помеченный как запись; живой прогон — бонус, не опора сюжета.

**Q3. «Сколько стоит миграция и есть ли жёсткий лимит трат?»**
A: Фактически списанная сумма неизвестна — во всех опубликованных receipts `chargedCostUsd` = null. Жёсткого лимита провайдера нет (`NO_PROVIDER_HARD_CAP`); есть только оценка до выплаты (~$0.047 за генерацию в записях). Любая цифра стоимости сегодня — предположение, не счёт.

**Q4. «Распространяется ли это на любой PHP-проект или только на одну демо-фиксу?»**
A: Только на один зафиксированный срез: репозиторий `tanjilaafsarirubina/car-workshop`, 5 маршрутов API, 11 PHP-функций, без composer/vendor. Два других сценария манифеста (`workshop-rejected`, `workshop-capacity`) в публичном продукте не выполняются. Генерализация требует отдельного бенчмарка, регистрации пула и проверки владельцев — это работа после хакатона.

**Q5. «Что мешает конкуренту (обычному AI-агенту или транспилятору) сделать то же?»**
A: Сегодня — почти ничего с точки зрения задекларированного продукта: успешного сквозного прогона с доказательством равенства ещё нет. Реальное различие — инфраструктура доказательства (доверенная изоляция, полное сравнение HTTP + SQLite, шифрование кандидатов, независимые контролы), но она ещё не переведена в убедительный пользовательский продукт. Это наша открытая проблема, которой мы честно делимся.

---

## 13. Audit limitations (чего не удалось подтвердить)

1. **Docker отсутствует в среде аудита** — Docker-тесты (target-worker, PHP reference оракул, полный дифференциал) `NOT_RUN` локально; оценка основана на исходнике, отчёте `research/mmp-167/RESULTS.md` и метаданных GitHub API. Следующая проверка: запуск полного CI на раннере GitHub или у владельца с Docker.
2. **Точный подтип сбоя G1 в запуске 41749479450 — `UNKNOWN`** — зашифрованный кандидат не расшифровывался (запрещено аудитом); сайдкар MMP-167 позволит классифицировать следующий запуск, но не задним числом этот.
3. **Тела оплаченных артефактов и реальные затраты не проверялись** — только метаданные ран и публика receipts; `chargedCostUsd` всегда null.
4. **История ран проверена по GitHub API (статусы, SHA, актеры)** — тела workflow-запусков и артефакты не скачивались/не расшифровывались.
5. **Рынок, конкуренты, критерии хакатона — гипотезы** — первоисточник официальные критерии не найден; используется условная универсальная система оценки. Оценки изменятся после получения официальных критериев.
6. Локальные измерения холодного старта выполнены на кэшированном образе с наложенным скриптом (точный хостинговый образ собрать не удалось — `docker build --network none` `EAI_AGAIN`), что совместимо с гипотезой таймаута, но не доказывает её для запуска 41749479450. В реальном запуске типчек завершился штатно; сбой позже — в фазе build или внешней операции.

---

## 14. Issue proposals (только стоящие задачи)

### Issue 1: Согласованные ограниченные бюджеты сборки целевого рабочего процесса
- **Scope:** `packages/target-worker/runtime/build.mjs` (per-phase `timeout: 12000`, `maxBuffer`); `packages/target-worker/src/controller.mjs` (`provision`, 35 с); `POLICY.lifetimeMs=180000`. Не просто повышение до 60 с — упрется в 35-с бюджет provision.
- **Acceptance criteria:** холодный контейнер фикстуры workshop проходит `typecheck`+`build` с запасом ≥2×; замер таймаутов задокументирован; сайдкар `build-phase-diagnostics.mjs` эмитит `BUILD_PHASE_TIMEOUT` только при `ETIMEDOUT`; тесты `pnpm test` зелёны; защита очистки и изоляции сохранены.
- **Почему стоит:** снижает риск сбоя G1; причина исторического #41749479450 остаётся `UNKNOWN`.

### Issue 2: Найти и задокументировать корневую причину `HTTP_JSON_TYPE`
- **Scope:** `packages/oracle/src/http.ts` сравнение + сценарий `workshop-business`; инструментировать public-safe diff (коды, без сырых тел кандидата).
- **Acceptance criteria:** точное поле и несовпадение типов найдены; либо исправление даёт `G2/G3 PASS` на запиранном кандидате, либо ограничение зафиксировано и честно отображается в демо/питче.
- **Почему стоит:** без этого лучший записанный запуск остаётся на `FAIL` (P0-2).

### Issue 3: Зафиксировать политику ремонта после классифицированной ошибки среды G1
- **Scope:** `packages/agent-real/src/runtime.mjs` `runPair`, `live-experiment.mjs`, документация демо-скрипта. `G1 ENVIRONMENT_ERROR` — не семантический `FAIL` кандидата; безопасный default — `NO_GO` без отдельного approval; не расширять платную приёмку ремонта.
- **Acceptance criteria:** правило `NO_GO` после G1 `ENVIRONMENT_ERROR` зафиксировано; повторная верификация возможна только через отдельное разрешение; синтетический тест подтверждает запрет model repair POST при `ERROR`.
- **Почему стоит:** определяет безопасный fallback для G1 `ERROR`, не допуская необоснованный repair POST.

### Issue 4: Запретить интерпретацию health-меток и тестов как статуса продукта
- **Scope:** `research/demo-readiness/` viewer + текст питча; возможно, `README.md` дискаймер.
- **Acceptance criteria:** в viewer и питче есть раздел «это не статус продукта»; `migration/not_implemented` и т.п. не упоминаются как достижение команды; `pnpm test`/`lint` зелёны.
- **Почему стоит:** снижает риск недопонимания жюри (P2-1).

### Issue 5 (пост-хакатон): Реализовать путь к G0 и G4 по specs/017
- **Scope:** регистрация бенчмарка, пул held-out, протокол G4, согласие владельцев.
- **Acceptance criteria:** G0 `PASS` (цель без PHP) и выполнение G4 на зарегистрированном пуле; оба владельца подписали принятие.
- **Почему стоит:** без этого `product PASS` невозможен по конструкции (P0-3); преждевременно для хакатона.

---

### Примечание о доставке

Вся работа ведётся на отслеживаемой ветке `arena/3ef69108-metamorph` (разбиение на отдельную ветку `audit/mmp169-arena-independent-review`, указанную в задании аудита, невозможно без нарушения ограничений сессии). Отчёт добавлен как единственный новый файл `research/external-audits/MMP-169-ARENA-INDEPENDENT-AUDIT.md`; исходники, тесты и воркфлоу не изменяются. Отчёт готов к копированию в `.md` и перемещению в любое внешнее хранилище для независимой проверки.
