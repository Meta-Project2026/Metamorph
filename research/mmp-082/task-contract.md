# MMP-082 — Safe G1 Compiler Diagnostics (Offline Only)

**Исполнитель:** `sol 6.1`
**Effort:** `xhigh`
**Репозиторий:** `Meta-Project2026/Metamorph`
**Issue:** https://github.com/Meta-Project2026/Metamorph/issues/82
**Текущая опора:** `main` (перед работой получи актуальный SHA и проверь отсутствие новых изменений, связанных с задачей).

## Миссия

Исправить **наблюдаемость** провала реального model-generated PHP→TypeScript кандидата на G1, а не задним числом исправлять/перегенерировать кандидат. Однократный разрешённый платный запуск GitHub Actions **#40900698372** (https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372) завершён, повторное выполнение и любой Meta GET/POST **запрещены данным контрактом**.

### Подтверждённые факты, которые нельзя менять или интерпретировать как успешную миграцию

- Meta `muse-spark-1.3` вернул HTTP 200; один оплачиваемый POST; `attemptedRequests=1`, `confirmedResponseCount=1`; сгенерирован кандидат с SHA256 `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f`.
- G1 `FAIL` / `BUILD_FAILED` на `workshop-business:typecheck`; G2/G3 `INCONCLUSIVE` из-за `MISSING_COVERAGE`, фактическое покрытие 0/17 HTTP и 0/20 SQLite. G0/G4 `INCONCLUSIVE`, продукт `NOT_ESTABLISHED`.
- Расчёт расхода по returned usage $0.04653825, окончательное списание **UNKNOWN**. Cleanup 0 containers, 0 volumes, emergencyRemoved=0.
- Оригинальный кандидат и исходные raw TSC diagnostics намеренно не опубликованы, поэтому **конкретную причину именно этого G1 нельзя утверждать или восстановить из выложенных артефактов**. Не имитируй восстановление.

## Точки кода для аудита

- `packages/target-worker/runtime/build.mjs`: доверенный Docker-рецепт уже собирает `checks[]`, где есть `phase`, `exitCode`, `stdout`, `stderr`. Это приватный TSC-вывод, потенциально содержащий source snippets.
- `packages/target-worker/src/controller.mjs`: `TargetWorker.provision` сохраняет `worker.evidence.build` с ограниченным stdout. Сетевого доступа кандидату нет.
- `packages/agent-real/src/runtime.mjs`: `buildReceipt(worker, scenarioId)` достоверно устанавливает `G1` verdict и `BUILD_FAILED`, но удаляет диагностические сведения из публичного представления.
- `packages/agent-real/src/report.mjs`: `publicAttempt` разрешает только фиксированные gate code; не ослабляй этот контракт.
- `packages/agent-real/src/migration-trial.mjs`, `research/mmp-078/validate-candidate.mjs`: безопасная публичная квитанция и постгенерационная проверка без ключа.
- `.github/workflows/meta-paid-migration.yml`: секрет `META` доступен только шагу единственного POST. **Не запускай этот workflow в paid mode**.

## Задачи

1. **Offline-only read-only audit**: открой исходники текущего `main`; сверяй действительный поток `build.mjs → controller → runtime.buildReceipt → publicAttempt → trial.json`. Зафиксируй точные текущие границы доверия и сохраняемые доказательства.
2. Добавь **строго ограниченный и безопасный деклассификатор диагностики**. В публичную квитанцию разрешены: `phase` (`typecheck`/`build`), коды формата `TS[0-9]{4,5}`, строго проверенный относительный путь `src/**/*.ts` (без traversal), положительные номер строки/колонки, количество ошибок и флаг обрезки, SHA-256 raw compiler output при необходимости. Максимум 20 кодов/локаций, фиксированный размер serialized output. **Запрещено** публиковать произвольный текст TSC, исходные строки и фрагменты кода, абсолютные пути, response body, секреты, JWT/OIDC, stack traces, PHP исходники, private Oracle packs.
3. Если компилятор сообщает многострочные code excerpts, ANSI или hostile injected strings, не переносить никакие такие байты в public receipt. При невозможности безопасного разбора — фиксированный `DIAGNOSTIC_UNAVAILABLE`. Не превращай эту ситуацию в PASS и не подменяй `BUILD_FAILED`.
4. Свяжи новый versioned diagnostic block с **candidateSha**, попыткой и G1 verdict, сохрани оригинальный G1/G2/G3/G4 интерфейс. Публикация должна быть явной allowlist, не `...worker.evidence`.
5. Добавь тесты: нормальные TS diagnostics, несколько файлов, нулевой/неполный stdout, ANSI, Unicode, абсолютные пути, path traversal, файл вне `src`, большие/вредоносные строки, инъекция секретоподобных маркеров, ошибка компилятора без числового кода, truncation, дубликаты, инвариантное G1 FAIL, отсутствие raw details в JSON, негативные кейсы.
6. Проверь, можно ли добавить **локальную компиляционную проверку** после модельного ответа без отдельного запроса и **без исполнения кандидата на доверенном host**, сохраняя authoritative G1 только у существующего network-off Docker worker. Реализуй лишь если сохраняет границы безопасности и действительно помогает; иначе объясни отказ.
7. Запусти доступные offline проверки: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, публичные позитивные и заведомо негативные Docker/Oracle controls по существующему стандарту. Проверь cleanup 0/0 и emergencyRemoved 0. Не редактируй и не ослабляй замороженный public benchmark, manifest, hidden G4, comparator, sandbox budgets, исходную рецептуру Docker или cost admission. Если неизбежно нужно изменить pinned recipe, объясни и отдельно обоснуй изменение hash; по возможности не трогай рецепт.
8. Запиши `research/mmp-082/report.md`: старый run и точный observed fail, что диагностика предыдущей генерации **не восстановима**, какие новые поля доступны **только для будущих** наблюдений, какие тесты запущены и точные результаты PASS/FAIL/SKIP; отметь отсутствие реальных Meta вызовов, затрат и новых owner permissions. Никакой фиктивной генерации.

## GitHub / Independent Review

Выполнив задачу, **сразу** сделай commit, push отдельной ветки и открой PR к `main`, связанный с Issue #82. Приложи точные commit SHA, изменённые файлы, test outputs и proof, что модельный endpoint вообще не вызывался. Если изменения требуют пересогласования или тесты падают, всё равно опубликуй ветку и PR в draft с явными blockers, а не скрывай результат.

**Независимую проверку PR выполняет ChatGPT после push**; не называй собственное ревью независимым ChatGPT review и не смерживай PR за ChatGPT. После позитивного аудита можно merge без approval второго GitHub аккаунта в соответствии с текущими правилами.

## Жёсткие запреты

- **Никаких** Meta GET/POST, `workflow_dispatch` с `validate_only=false`, rerun прошлых Actions, repair / regeneration кандидата или платных операций.
- Не читать и не копировать `META` secret, не менять его расположение или доступ, не включать endpoint из тестов.
- Не утверждать, что настоящий G1 исправлен или что product PASS. Цель этой задачи — диагностика, а не платный повторный эксперимент.
- Не публиковать raw TS исходники кандидата, compiler messages с content, приватные evidence packs, обращения к hidden G4.

**Финальный ответ агента:** URL issue/PR, SHA, краткое резюме, проверенные границы безопасности, результаты offline tests и честные ограничения, включая отсутствие retroactive compiler diagnostics.
