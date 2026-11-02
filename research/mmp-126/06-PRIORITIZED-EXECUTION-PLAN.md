# 06 — Prioritized execution plan (24 ч / 3 дня / 10 дней)

Оптимизация **по информации на единицу работы**, а не по количеству действий. Ни один шаг не
подразумевает автоматического Meta POST, `workflow_dispatch` (включая `validate_only`), Docker
без отдельного согласия, загрузки артефактов или ключа владельца. Все SHA — входные пины, а не
«примерные».

**Базовый вход для всех горизонтов:** `main@074af751e9012abad1be2749c360c5d8b86218e0`
(проверен 2026-11-02). Перед каждым шагом — `git ls-remote origin refs/heads/main` + Node22/24
Fast CI на точном HEAD. Если HEAD сдвинулся → **STOP**, пересчитать все пины.

---

## Горизонт 1 — первые 24 часа: поставить диагноз (0 inference, 0 Docker)

| Шаг | Предусловие / входной SHA | Действия | Файлы / issue | Acceptance criteria | Negative control | Что измеримо | STOP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | HEAD = `074af75` | Прочитать `runner.ts:284-350,415-419`, `controller.mjs:674-692`, `mapping.mjs:6-48`, `inspect.mjs:125-168`, `migration-context.mjs:25-46`, `meta-migration.mjs:74-91`, `specs/009-real-differential/interface-handoff.md:24-28`; сверить с байтами `research/mmp-123/repair-candidate/src/**` | этот отчёт, `02` | Категорический вывод: требование `x-request-id` есть в Oracle, отсутствует в модельном контексте, отсутствует у кандидата, присутствует у known-good fixture | Сверить **все** 5 файлов кандидата, включая вычисляемые имена заголовков; если echo найден → H1 опровергнута, перейти к 1.3 | Наличие/отсутствие точной строки; 4 независимых источника кода | Если `fixtures/workshop/src/main.ts:247` не содержит echo → вся аргументация `02` пересматривается |
| 1.2 | 1.1 | Аудит доступности телеметрии: `git log --follow -- packages/oracle/src/failure-telemetry.ts`, 3 прогона `meta-paid-migration.yml` из Actions API, `verifier-proof.mjs:299-331`, `runtime.mjs:203-204`, `run-inner.sh` | `01` §3, #125 | Подтверждено: **0** прогонов с `status: AVAILABLE`; у MMP-104 `NOT_RECORDED`, у MMP-123 поле отброшено + `MISSING_BINDING` | Проверить, что ни один из 3 workflow-runs не позже merge PR #113 (`2b82c8f`, 20:00:30Z) | Времена SHA/раннов; наличие поля в receipts | Если найдётся receipt с `AVAILABLE` → пересмотреть вывод 3 |
| 1.3 | 1.1–1.2 | Read-only повтор `node research/mmp-120/audit.mjs` и `audit.mjs variants`, `node research/mmp-069/validate.mjs`, `node research/mmp-069/check-syntax.mjs`, `node --test packages/agent-real/test/verifier-forensics.test.mjs` (**только доверенные локальные тесты, без candidate TS на хосте**) | #120, `research/mmp-120/TRIAGE.md` | Body SHA `55c7b844…`, 22 762 B, проекция `$0.224402`, default `$0.10` блокирует; `validate.mjs` = `VALID`; 9/4 fault-таблица воспроизводится | `check-syntax.mjs` не должен импортировать/исполнять research entrypoints | exit codes, точные SHA | Расхождение body SHA с `incident.json` → заморозить receipts, новый #116-анализ (TRIAGE row 7) |
| 1.4 | 1.1–1.3 | Опубликовать **категорический receipt** с ≥3 mutually discriminating outcomes (O1/O2/O3 из `02` §4), без приватных стеков; запросить у владельца разрешение ровно на один диагностический Docker-прогон | `research/mmp-125/**` (issue #125 READY_TO_PLAN), этот `research/mmp-126/` | Receipt содержит только enum/индексы/хэши; явно перечислены `UNKNOWN` | hostile canary-тест (как MMP-108 B1): приватные пути/токены не попадают в публичный JSON | 3 различных исхода определены до прогона | Владелец не дал согласия → остаёмся на read-only, **не** запускаем Docker |

**Ответ на вопрос «можно ли получить первый оценённый HTTP без inference?»: ДА, в двух смыслах.**
(а) Уже есть `research/mmp-108/evidence/local-f9a7b44/known-good-real-docker-first-step.json` —
первый `workshop-business:step-0` оценён (G2 PASS) и мутант оценён (G2 FAIL `HTTP_STATUS`),
**modelRequests=0**. (б) Первый оценённый HTTP **для AI-кандидата** можно получить без нового POST
диагностическим прогоном **уже существующего** `0cf5ba0b…` (шаг 2.2) — это не генерация и не
второй repair (#125 §2). Без согласия на Docker остаётся статический диагноз, но не оценка.

**Что требует чего (разграничение):**
- read-only прямо сейчас: 1.1–1.4, все статические выводы этого отчёта.
- нового **local Docker authorization**: 2.2 (отдельный запрос владельцу, #125).
- **пользовательского разрешения на изменение контракта**: 2.1/C0 и любая новая authorization
  card #116; также любое изменение `verifyPair`/comparator (не рекомендуется).

---

## Горизонт 2 — следующие 3 дня: доказать управляемость

| Шаг | Предусловие / входной SHA | Действия | Acceptance | Negative control | GO/HOLD |
| --- | --- | --- | --- | --- | --- |
| 2.1 (C0) | 1.4 + явное согласие владельца на контрактную правку | Один PR: +1 фраза в `migration-context.mjs` `target` о `x-request-id` echo и точном `Content-Type`; пересчёт body SHA; обновление `source-to-prompt-audit.md` §1/§5; Node22/24 Fast CI на точном pushed SHA; independent ChatGPT exact-SHA review; **без merge до ревью** | Новый body SHA зафиксирован; тест `mmp120-generation-readiness.test.mjs` подтверждает отсутствие scenario IDs/expected outputs/held-out; gates не изменены | Сравнить diff: в `packages/oracle/**`, `packages/differential/**`, `.github/workflows/**` изменений **ноль** | **GO** только после подписанной карты; иначе HOLD |
| 2.2 | 2.1 **или** отдельное согласие только на Docker; кандидат `0cf5ba0b…` **неизменен** | Один disposable local Linux Docker diagnostic по #125 §2-§3: unchanged production verifier, приватная инструментация **в отдельном scratch-адаптере**, публикация только `{status, firstFailureStage, failureCategory, side}`; negative controls: known-good `34c8325a…` и намеренный `x-request-id`-мутант | Категорический receipt с одним из O1/O2/O3; `cleanup VERIFIED_ZERO_RESOURCES`, finalizer 0/0/0; `modelRequests=0`, `aiGeneration AI_GENERATION_NOT_RUN` | Known-good → 17/17+20/20 без `firstFailureStage`; мутант → **O1**; подмена reference timeout → **O2** (защита от ложной атрибуции target/reference/environment) | **HOLD** без согласия; это **не** второй repair и **не** генерация |
| 2.3 | 2.2 = O1 | Зафиксировать подтверждение H1; сформировать **новую** immutable authorization card #116 с точным main/body/tariff/budget/1 POST/0 repair/timeout; убедиться, что #115 gates (encrypt→owner-local TEST key decrypt/restore, checkpoint до Oracle) закрыты | Карта подписана владельцем; тариф `meta-standard-2026-10-29` проверен до истечения `2026-11-05T00:00:00Z`; `max_estimated_usd` выбран явно (не «по умолчанию») | Проверить, что `#100` attempt не переиспользуется, `attemptedRequests=1`consumed; отсутствие ключа в runner | **NO_GO** при любой незакрытой #115 gate |
| 2.4 (milestone M1) | 2.3 | Один новый POST → первый **оценённый** HTTP AI-кандидата | `workshop-business:step-0` присутствует в `executedTestIds` G2; `executedHttp ≥ 1`; verdict `PASS`/`FAIL` с кодом, **не** `ERROR` | Если снова `ERROR 0/17` → H1 не подтвердилась или есть второй скрытый контракт → **STOP**, вернуться к 2.2 | GO/HOLD по receipt |
| 2.5 (M2) | 2.4 | Довести до `N/17` и `M/20`; точные test IDs: `workshop-business:step-0..step-5` (6), `workshop-rejected:step-0..step-4` (5), `workshop-capacity:step-0..step-5` (6); DB IDs: 3 × `:initial` + 17 × `:step-N` | `N>1`, `M>1`; каждый diff имеет код `HTTP_*`/`DB_*`, не `VERIFIER_ERROR` | Синтетический `res.statusCode=503` мутант (`43eb3aeb…`) по-прежнему даёт scored `FAIL` при 17/20 | При любом `ERROR` с полным покрытием → подозрение на teardown (MMP-108 control) |
| 2.6 (M3) | 2.5 | 17/17 + 20/20; отдельно **G1 6/6**: `{workshop-business,workshop-rejected,workshop-capacity}:{typecheck,build}` — все 6 ID | G1 `PASS 6/6`, G2/G3 без findings; G4 остаётся `INCONCLUSIVE/HELD_OUT_NOT_RUN`; product = **NOT_ESTABLISHED** до формального G4 | Не использовать known-good fixture или сгенерированный эталон как доказательство AI-миграции; сохранить draft→custody→Oracle цепочку SHA | Любая попытка выдать `2/6` за `6/6` → STOP |

Каждая веха: точные expected receipts (форматы `mmp123-verifier-proof-v1` для offline,
`mmp104-public-incident-v1` для hosted), основание GO/HOLD — **исполненный** coverage, а не
уверенность модели. `case status PASS` ≠ candidate PASS.

---

## Горизонт 3 — до 10 дней: убедительное end-to-end demo / MVP

| Шаг | Действия | Acceptance / negative control | Измеримое | STOP |
| --- | --- | --- | --- | --- |
| 3.1 | Выбор метода генерации: **C0 + один POST, 0 repair** (основной) vs **D compile-first** (резерв, только если M1 упёрся в G1) | Решение зафиксировано **до** POST, с измеримой гипотезой; запрещено «попробовать другую модель» без гипотезы | Число inference requests | Смена модели без новой гипотезы → STOP |
| 3.2 | Независимая provenance: отдельный freeze-коммит candidate source до Oracle; `admitDirectory` SHA; `contextSha256`/body SHA; модель/провидер **EXECUTOR_REPORTED** с явной пометкой, платформенная аттестация — `NOT_VERIFIED`, если её нет | Candidate SHA воспроизводим из байт; запрет на чтение fixtures/G4 до заморозки зафиксирован; `licenceNotice` MIT сохранён | Хэши, время freeze | Self-report модели выдан за аттестацию → STOP |
| 3.3 | Цепочка: модель → immutable candidate custody (#115/#117 gates) → Docker Oracle → partial/diff диагноз → demo с **честным** результатом | Каждый hop имеет SHA и receipt; `encrypted ciphertext` ≠ «восстановлено владельцем» до отдельного proof | Полнота цепочки | Разрыв custody → STOP |
| 3.4 | Плановые A/B (только при наличии **дополнительных** разрешений; сейчас не авторизованы): A = C0-body, B = C0+MMP-120 Proposal A (`500b34dc…`), C = C0+Proposal B (`dd28517a…`). Каждый вариант — **1 POST**, без retry, с собственной картой и своим freeze-коммитом | Одинаковые source/manifest/tool/recipient/clock пины; различается **только** body; A/B не смешивать с историей | Разница `executedHttp`/`executedDb`/G1 ID, **не** «успех/неуспех» | Любое сравнение без нового разрешения → STOP |
| 3.5 | Демо: публичный scope-контракт `03` §8, отдельные ID для упрощённого vertical slice, запрет называть его «G1/G2/G3 PASS полного benchmark» | `PRODUCT_NOT_ESTABLISHED` сохраняется до формального G4; green CI ≠ Oracle PASS | Честность формулировок | Ложный Product PASS → STOP (см. `07`) |
| 3.6 | Критерии остановки / смены scope / отказа от гипотезы | См. таблицу ниже | — | — |

### Бюджет и «без новых POST» (неизменные ограничения)

| Вариант | Число новых inference requests | Worst-estimated cost | Примечание |
| --- | --- | --- | --- |
| **V0 — «без новых POST»** (рекомендуется сейчас) | **0** | **$0** | Весь горизонт 1 + шаг 2.2 (диагностика на `0cf5ba0b…`) + MMP-108/MMP-123 offline receipts + этот отчёт. Даёт диагноз и, при согласии на Docker, первый оценённый HTTP |
| V1 — один POST после C0 | 1 | консервативная проекция **$0.224402** для baseline body 22 762 B / SHA `55c7b844…`; C0 изменит body ⇒ **пересчитать**; workflow default `$0.10` **отклоняет**; предложенные `$0.25` — оценочный выбор, **не** гарантированный charge cap; `chargedCostUsd` исторически `null` | Тариф `meta-standard-2026-10-29` истекает `2026-11-05T00:00:00Z`, live-подтверждение `NOT_RUN`; MMP-122 upload разрешение израсходовано; ключ владельца никогда не попадает в runner/модель/Git |
| V2 — A/B (A+B+C) | 3 | ≥ 3 × пересчитанная проекция; три карты, три freeze | **Не авторизовано**; только как план |
| V3 — «попробовать другую модель» | ≥1 | ≥ проекции | **Запрещено** без новой измеримой гипотезы (`TRIAGE.md` row 9) |

Исторический расход уже состоялся: 1 POST, `estimatedCostUsd 0.04942875`, `chargedCostUsd UNKNOWN`.
Повтор #100/ rerun #41327197036 / `validate_only` — запрещены.

### Критерии остановки и смены курса

| Сигнал | Решение |
| --- | --- |
| После C0 и нового POST снова `ERROR 0/17 + 1/20` | **STOP**: H1 опровергнута или есть второй скрытый контракт; вернуться к stage-телеметрии, не тратить второй POST |
| `firstFailureStage = REFERENCE_REQUEST` в 2.2 | **STOP по H1**, переключить P0 на hosted/reference/driver-форензику; новый POST не отправлять |
| `status = UNAVAILABLE / MISSING_BINDING` в 2.2 | **STOP**: инструментация не работает; сначала починить диагностику (в scratch, не в production) |
| `G1 FAIL 1/6` с воспроизводимым `TS*` после C0 | Включить **резерв D** (compile-first) с отдельным разрешением на repair; не «менять модель» |
| `FAIL` с `DB_SCHEMA` на ровном месте | Проверить буквальность DDL-текста (`sqlite.ts:220`); это overconstraint — решение о контракте G3, а не о модели |
| `FAIL` с `HTTP_HEADER` при валидном JSON | Проверить точную строку `Content-Type`; возможный overconstraint, требующий двухвладельческого решения |
| 17/17 + 20/20 + G1 6/6 достигнуты | **Не объявлять Product PASS**: G4 `HELD_OUT_NOT_RUN`, G0 независимость, product acceptance — отдельные gates |
| Тариф истёк / body SHA разошёлся / #115 gate открыт / карта не подписана | **HOLD #116** (как в issue), никакого dispatch |
| Три итерации подряд не дают нового `executedHttp` | Сменить **гипотезу**, не модель; рассмотреть G (repositioning) и сужение/смену source scope с **новым** benchmark ID, отделённым от исторического |
| Любое желание «ослабить normalize/ignore» чтобы получить PASS | **NO_GO** категорически (`AGENTS.md`, `TRIAGE.md`) |
