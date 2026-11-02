# 09 — 12 обязательных итоговых ответов

1. **Реально ли сделать строго верифицируемый PHP→TS перенос в этом sandbox?** —
   **CONDITIONAL**. Принципиально ДА: `packages/target-worker/fixtures/workshop` даёт G1 6/6,
   G2 17/17, G3 20/20 в disposable Linux Docker (MMP-108) —Oracle исполнил и непротиворечив.
   Условия: раскрыть несообщённый контракт `x-request-id`, получить рабочую stage/side
   телеметрию, отдельное согласие владельца на Docker/POST, точная карта #116, и **не** путать
   scoped parity 17/20 с формальным G4/product PASS. В READ-ONLY режиме этой сессии перенос не
   выполнялся.

2. **Какой доказанный блокер наиболее ранний?** — Для публичного GLM repair `0cf5ba0b…`:
   отсутствие echo `x-request-id` в `repair-candidate/src/main.ts:125-129` при жёсткой проверке
   `controller.mjs:686-690` и `mapping.mjs:22`; это детерминированно даёт `OBSERVATION_ERROR` →
   `VERIFIER_ERROR` **до** `executedHttp.push` (`runner.ts:350`). Для Meta #41327197036 самый
   ранний доказанный блокер — **отсутствие диагностики** (`stageClassification: NOT_RECORDED`,
   исходник `UNAVAILABLE`); причина `UNKNOWN`.

3. **Какие гипотезы `VERIFIER_ERROR` доказаны, какие неизвестны?** — Доказаны: (а) профиль
   `0/17+1/20` = исключение в интервале `runner.ts:284-349`; (б) он **не уникален** — 3 разных
   fault дают его (MMP-108 controls); (в) cleanup как финальная причина исключён (0/0/0);
   (г) GLM repair статически не может пройти step-0. Неизвестны: точная причина Meta, была ли
   она той же, таймаут vs malformed observation, target vs reference vs verifier в hosted runner,
   реально списанная сумма.

4. **Что проверено в `failure-telemetry.ts` и записана ли телеметрия в обоих receipts?** —
   Прочитан весь файл: `mmp104-trusted-stage-v1`, 30 stages, 3 категории, `AVAILABLE/UNAVAILABLE`,
   `firstFailureStage`/`lastCompletedStage`/`stepIndex`/`scenarioIndex`, 2048 B, host-only binding
   с обязательным numeric `runId`, активация только на `[MANIFEST[i]]`, `unclassifiedFailure →
   INTERNAL_ERROR`. **НЕ записана ни в одном.** Добавлена `eb36864` 2026-11-01 19:21Z — **после**
   Meta run (16:38Z); MMP-108 head `f9a7b44` тоже старше; MMP-123 драйвер
   (`verifier-proof.mjs:299-331`) отбрасывает поле, а локальный `runId=null` дал бы
   `MISSING_BINDING`. Плюс `runner.ts:415-419` глушит исходное исключение.

5. **Самое ценное диагностическое действие до Meta POST?** — Статическое сравнение
   модельно-видимого контракта с требованиями observation-протокола (уже сделано), затем **один
   авторизованный не-генерационный Docker-прогон** со старым неизменным `0cf5ba0b…` и
   категорическим `{status, firstFailureStage, failureCategory, side}` receipt + negative
   controls (known-good / x-request-id-мутант / reference-fault). 0 inference, 0 новых POST.

6. **Нужно ли менять исходный PHP / объём migration unit или пока рано?** — **Пока рано**.
   11 функций / 5 actions / 1 атом уже почти сработали у GLM (скомпилился после 1 repair, initial
   DB совпал). Декомпозиция дробит SQLite DDL/сидинг/транзакции/диспетчер и стоит ≥3 POST.
   Пересмотр source scope — только если после исправления контракта три итерации не дадут нового
   `executedHttp`, и тогда с **новым** benchmark ID.

7. **Нужно ли менять промпт Meta, и на основании какого evidence?** — **Да, но минимально и не
   «по качеству»**: добавить в `context.target` disclosures уже существующего протокола
   (`x-request-id` echo, точный `Content-Type`). Evidence — код `controller.mjs:686-690`,
   `mapping.mjs:22`, `inspect.mjs:139-141` против байт `migration-context.mjs:25-46` и
   `repair-candidate/src/main.ts`. MMP-120 Proposal A/B (`500b34dc…`/`dd28517a…`) — **HOLD**:
   `PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED`. Любая правка меняет body SHA → новая карта.

8. **Стоит ли переходить к staged/repair pipeline сейчас?** — **Нет**. Один repair уже закрыл
   compile gap; #123 «one repair» израсходован; #116 fix policy = 1 POST / 0 repair. Двухфазный
   compile-first (D) — **резерв**, включаемый только при новом воспроизводимом G1-диагностике
   после C0, с отдельными immutable SHA на каждом hop и отдельным разрешением.

9. **Нужна ли новая модель, или сначала устранить instrumentation gap?** — **Сначала
   instrumentation + контракт**. Ни одного `AVAILABLE` stage receipt в истории нет; смена модели
   без измеримой гипотезы запрещена (`TRIAGE.md` row 9) и израсходует единственный POST.
   «Модель слабая» опровергается 37 269 B GLM-кандидата с `phpInt`/`empty('0')`/`checkdate`/
   Asia/Dhaka/строковым `lastInsertId()`/явным rollback.

10. **Какой первый доказуемый milestone за 24 часа?** — Категорический read-only receipt:
    `main@074af75` зафиксирован, Fast CI success, 3 запуска GitHub workflow, из которых 2 подтверждённых Meta POST (последний 16:38Z 01.11),
    `x-request-id` gap подтверждён в 4 независимых местах кода, телеметрия датирована,
    `0/17+1/20` объяснён как вырожденная сигнатура, определены 3 mutually discriminating
    outcomes (O1/O2/O3). **0 inference, 0 Docker, 0 production-изменений**; плюс уже существующий
    оценённый `workshop-business:step-0` из MMP-108 (G2 PASS и scored FAIL мутанта).

11. **Самая большая опасность ложного заявления о Product PASS?** — Выдать
    `case status PASS`/per-pair `G1 PASS`/green CI/`HELD_OUT_NOT_RUN`/known-good fixture или
    упрощённый vertical slice за полный автономный AI-миграционный `G1 6/6 + G2 17/17 + G3 20/20`
    с формальным G4. Усугубляется тем, что `ERROR` может скрывать несообщённый контракт: тогда
    «verified» означает «verified against an undisclosed protocol» и независимый reviewer вправе
    отклонить результат.

12. **Какой ровно следующий GitHub Issue/PR предлагается, какие файлы и критерии?** —
    **Не создавать новый Issue** (#126 уже есть; #125 READY_TO_PLAN, #116 HOLD). Предлагается
    **один draft PR** (этот отчёт уже лежит в `research/mmp-126/`) с `Refs #126 #125 #61 #116`,
    точным HEAD `074af751e9012abad1be2749c360c5d8b86218e0` и запросом independent ChatGPT
    exact-SHA review, **без merge**. Следующий *исполнительный* PR — только `C0`: файл
    `packages/agent-real/src/migration-context.mjs` (+1 disclosures в `target`), синхронное
    обновление `research/mmp-120/source-to-prompt-audit.md` §1/§5, пересчёт body SHA через
    `node research/mmp-120/audit.mjs`, `mmp120-generation-readiness.test.mjs` без scenario
    IDs/expected outputs/held-out, Node22/24 Fast CI на точном pushed SHA, **ноль** изменений в
    `packages/oracle/**`, `packages/differential/**`, workflows и comparator. Критерии: новый
    body SHA зафиксирован, новая immutable authorization card #116 подписана владельцем,
    `#116` остаётся HOLD до #115 gates + тарифа до `2026-11-05T00:00:00Z` + явного выбора
    `max_estimated_usd`. **Никакого dispatch, POST или Docker без отдельного согласия.**
