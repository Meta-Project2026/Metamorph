# 00 — Executive verdict

> Всё ниже привязано к `main@074af751e9012abad1be2749c360c5d8b86218e0`; диапазоны строк —
> по файлам этого HEAD. Классы доказательств см. `01-FACTS-AND-EVIDENCE.md`.

## Кратко

**Ноль AI-миграций с G1 6/6 + G2 17/17 + G3 20/20 — это, с высокой вероятностью, не предел
возможностей моделей и не «поломанный» Docker-раннер.** Инфраструктура действительно зелёная
(Fast CI на 074af75 = success), а человеко/`assistant`-написанный known-good fixture проходит
**6/6 + 17/17 + 20/20** в disposable Linux Docker (MMP-108,
`research/mmp-108/evidence/local-f9a7b44/known-good-real-docker-first-step.json`). Значит,
полный конвейер «build → reset → initial DB → 17 HTTP → 20 DB → evidence → cleanup»
исполним и Oracle не «всегда красный».

С другой стороны, я нашёл **статически доказуемый, детерминированный разрыв контракта на
первом же HTTP-запросе**, который не требует Docker для обнаружения:

- `packages/target-worker/src/controller.mjs:686-690` отклоняет наблюдение, если
  `capture.headers["x-request-id"] !== requestId` → `WorkerError("OBSERVATION_ERROR")`;
- `packages/differential/src/mapping.mjs:22` повторно требует
  `raw.headers["x-request-id"] === requestId`;
- инспектор `packages/target-worker/runtime/inspect.mjs:139-141` **отправляет** этот заголовок,
  но Node.js не отражает (echo) его автоматически — кандидат обязан сделать
  `res.setHeader("x-request-id", req.headers["x-request-id"])`;
- known-good fixture это делает (`packages/target-worker/fixtures/workshop/src/main.ts:247`);
- **модельный контекст этого требования не содержит**: `packages/agent-real/src/migration-context.mjs:25-46`
  (`target` + `instructions`) и developer-сообщение
  `packages/agent-real/src/meta-migration.mjs:77-80` («*Never invent usage, request IDs, cost or
  verifier results*») — более того, последнее активно отвращает модель от генерации request ID.
  `research/mmp-120/source-to-prompt-audit.md` §1/§2/§5 перечисляет все модельно-видимые поля и
  все P0/P1 семантические ловушки, но **не упоминает `x-request-id`** — слепое пятно аудита.
  Внутренний `specs/009-real-differential/interface-handoff.md:24-28` и
  `packages/differential/README.md:42` описывают его как «service identity», т.е. как деталь
  *harness*, а не продукта; задание MMP-123 (`research/mmp-123/task-card.md`) прямо запрещает
  независимому автору читать `packages/target-worker/fixtures/**` и `packages/oracle/**`
  до заморозки первого драфта.
- Публичный GLM repair-кандидат `0cf5ba0b…`
  (`research/mmp-123/repair-candidate/src/main.ts:125-129`) выставляет только `Content-Type`;
  `x-request-id` в `research/mmp-123/{candidate,repair-candidate}/src/**` **отсутствует**
  (проверено `grep`, `GIT_VERIFIED`).

Следствие: если обработка до Candidate-запроса (включая Reference) завершится без ошибки,
для кандидата `0cf5ba0b…` на `workshop-business:step-0` Candidate-запрос неизбежно бросит
`OBSERVATION_ERROR` **до**
`executedHttp.push(...)` (`packages/oracle/src/runner.ts:350`), попадает в
`catch { … fatal = VERIFIER_ERROR }` (`runner.ts:415-419`) и может дать исторический публичный
профиль **G2 ERROR 0/17, G3 ERROR 1/20**. Обязательный echo-контракт и его нарушение
подтверждены неизменяемым кодом и байтами кандидата; атрибуция фактически записанного
`VERIFIER_ERROR` к этой проверке остаётся **СТАТИЧЕСКОЙ ДЕДУКЦИЕЙ**, а не отдельной
динамической stage-аттестацией. Для Meta run #41327197036 источник
кандидата `UNAVAILABLE`, поэтому та же причина там — **правдоподобная, но НЕ доказанная**
гипотеза (`HYPOTHESIS`).

## Три наиболее правдоподобные причины (с уверенностью)

| # | Причина | Уверенность | Класс |
| --- | --- | --- | --- |
| 1 | **Скрытый контракт наблюдения `x-request-id`**: Oracle/target-adapter требуют от сервиса заголовок, которого нет в PHP-исходнике, нет в модельном контексте и который независимому автору запрещено подсмотреть. Любой «честный» port PHP→TS падает на первом HTTP с `ERROR`, а не с `FAIL`. | **ВЫСОКАЯ для GLM-линии** (статически доказано), СРЕДНЯЯ для Meta | `GIT_VERIFIED` + дедукция |
| 2 | **Диагностический разрыв**: `packages/oracle/src/failure-telemetry.ts` добавлен `eb36864` 2026-11-01 21:21:51+02:00 (merge PR #113 `2b82c8f` 22:00:30+02:00), т.е. **после** Meta run (16:36:25–16:38:33Z). Ни один записанный прогон не имеет телеметрии со `status: AVAILABLE`: у MMP-104 она физически отсутствовала (модуль добавлен позже); у MMP-123 драйвер `research/mmp-123/verifier-proof.mjs:299-331` строит собственный allowlist, который **целиком отбрасывает** `failureTelemetry`, а локальный `runId` равен `null` (`runtime.mjs:204`), из-за чего `createFailureTelemetry` вернул бы `null` → `MISSING_BINDING`. Плюс `runner.ts:415-419` глушит исходное исключение и `report.mjs` публикует только категорию. | **ВЫСОКАЯ** | `GIT_VERIFIED` |
| 3 | **Строгость/классификация Oracle**: `compareSqlite` (`sqlite.ts:220`) сравнивает `JSON.stringify(schema)`, включая **текст DDL** — байтовую внутреннюю деталь, а не наблюдаемое поведение; `validateHttp`/`parseJson` (`http.ts:39-56, 65-101`) **бросают** при отсутствии `content-type`, не-UTF-8, дубликатах ключей, потере точности числа — превращая поведение кандидата в `ERROR`, а не в разбираемый `FAIL`; единый `VERIFIER_ERROR` не различает target/reference/verifier. Дополнительно: 11 функций / 5 actions / **1** генерационный атом на один JSON-ответ. | **СРЕДНЯЯ-ВЫСОКАЯ** (код доказан; вклад в конкретные прогоны — частично `UNKNOWN`) | `GIT_VERIFIED` + `HYPOTHESIS` |

Слабее и не подтверждены: «модель слабая» (GLM-кандидат реализовал `phpInt`, `empty('0')`,
`checkdate`, Asia/Dhaka, `date('F j, Y')`, строковый `lastInsertId()`, `BEGIN IMMEDIATE`/
`COMMIT`/`ROLLBACK` с явным откатом на ранних `exit`, HTTP-200 error bodies — 37 269 байт TS
на 484 строки PHP), «сломан hosted Docker» (MMP-108 full-path PASS), «общий баг у Meta и GLM»
(см. п. «Альтернатива» ниже).

## Альтернатива, которую обязательно надо атаковать

`research/mmp-108/evidence/local-f9a7b44/offline-synthetic-first-step-controls.json`
доказывает, что **три разные причины** (`candidate-first-request-failure`,
`reference-first-request-failure`, `malformed-observation`) дают **одинаковый** публичный профиль
`ERROR 0/17 + 1/20`; teardown- fault даёт `ERROR` при **полном** покрытии 17/20; comparator
mismatch даёт `FAIL` при 17/20. То есть совпадение двух исторических receipts **не есть
доказательство общего бага** — это тривиальная сигнатура любого исключения на первом запросе.
Это одновременно (а) опровергает «общий баг» и (б) не опровергает «общий скрытый контракт»:
если оба кандидата честно портировали PHP, оба обязаны были не знать про `x-request-id`.

## Что делать в первую очередь

1. **GO, read-only, 0 inference:** зафиксировать разрыв контракта как категорический receipt
   (сделано в этом отчёте), проверить `failure-telemetry` на доступность, повторно прогнать
   `node research/mmp-120/audit.mjs` на точном HEAD, не трогая production.
2. **GO после разрешения владельца:** единственное минимальное исправление — **раскрыть
   `x-request-id` echo в модельно-видимом `context.target`** (контрактная правка, а не
   «улучшение промпта качества»). Она меняет body SHA → требует новой immutable authorization
   card по #116; gates/OS Oracle не ослабляются. Альтернатива (перенести identity в доверенный
   инспектор) — уже изменение shared API/verifier, двухвладельческое решение, **ХУДШЕ**.
3. **HOLD до отдельного согласия:** один не-генерационный диагностический Docker-прогон со
   **старым неизменным** `0cf5ba0b…` по правилам #125 §2-§3 (инструментация в отдельном
   scratch-адаптере, только категориальные stage/side, negative controls). Это не «второй repair».
4. **NO_GO сейчас:** любой Meta POST / `workflow_dispatch` / смена модели / смена языковой пары /
   декомпозиция на 8 юнитов / ослабление gates / переписывание verifier.

## Чего НЕ делать

Не «пробовать другую модель» без новой измеримой гипотезы; не объявлять `VERIFIER_ERROR`
несовместимостью HTTP; не выдавать MMP-108 fixture за AI-миграцию; не называть `1/6`/`2/6`
G1 PASS; не называть `HELD_OUT_NOT_RUN` формальным G4; не называть строку в историческом
имени receipt (`WITH_SOL_REPAIR`) доказательством модели; не заявлять Product PASS по
зелёному CI; не трогать #116 (HOLD) и не расходовать единственный POST.

## GO / HOLD / NO_GO по сценарным решениям

| Сценарий | Решение | Основание |
| --- | --- | --- |
| A. NO-PRODUCTION-CHANGE + P0 forensics | **GO** (сделано) | Дешёвый статический диагноз найден до любого inference |
| C0. Раскрыть контракт `x-request-id` в `migration-context.mjs` | **GO** (после новой owner-карты/body SHA) | Устраняет детерминированный earliest blocker, не трогает gates |
| B. Один и тот же one-shot JSON changes без изменений | **NO_GO** | Детерминированный провал на step-0 сохранится |
| C. Source-aware prompt (MMP-120 Proposal A/B) | **HOLD** | `PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED`; вторично после C0 |
| D. Two-phase compile-first / compiler-in-the-loop | **HOLD → резерв** | GLM уже закрыл compile gap одним repair; сначала C0 + диагностика |
| E. Decomposition 1–3 функции | **NO_GO сейчас** | Один атом уже почти сработал; дробит SQLite/транзакции/состояние |
| F. Hybrid symbolic + LLM (php-parser/Rector/IR) | **NO_GO в 1–10 дней** | Нет зрелого PHP→TS транспайлера; риск и объём >> выигрыша |
| G. Product repositioning «verified/evidence-first migration» | **GO параллельно** | Реальная дифференциация; см. `04`, `05` |
| H. Смена языковой пары / рантайма | **NO_GO** | Инфраструктура G0–G4 и пины завязаны на PHP→TS; выгода не показана |
| #116 следующий платный POST | **HOLD** (как и в issue) | #115 gates, точный main/body SHA, тариф до 2026-11-05T00:00:00Z, карта бюджета, финальное согласие |

**Итог одной фразой:** сначала исправить *справедливость и наблюдаемость контракта*, а не
инфраструктуру, не промпт «качества» и не модель. Самый короткий путь к первому настоящему
AI-кандидату — одна строка disclosures + один авторизованный диагностический прогон с уже
существующим неизменным кандидатом, и только потом один авторизованный POST.
