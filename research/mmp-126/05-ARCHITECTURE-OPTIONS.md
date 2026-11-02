# 05 — Architecture options A–H

Оценки effort — инженерные диапазоны (часы/дни), **не** вероятности успеха.
Колонка «P(debugging benefit)» намеренно **качественная** (НИЗКАЯ/СРЕДНЯЯ/ВЫСОКАЯ/НЕИЗВЕСТНО) —
базы для численной вероятности нет, и промпт запрещает её выдумывать. «Inference budget» — число
**новых** платных POST; везде, кроме явно отмеченного, = **0**.

## 1. Матрица

| | Вариант | Expected impact | P(debugging benefit) | Effort | Inference budget | Security / impl. risk | Артефакты | Как фальсифицировать | Целостность benchmark | Blast radius | Demo utility | Дифференциация |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A** | **NO-PRODUCTION-CHANGE + P0 forensics** (настоящий отчёт + категорический stage/side receipt, статический аудит) | Снимает главную неопределённость: найден детерминированный скрытый контракт и instrumentation gap | **ВЫСОКАЯ** (уже получен результат) | 4–16 ч, 0 Docker | **0** | Минимальный: read-only | `research/mmp-125|126/*.md`, категорический receipt | Docker-прогон с `AVAILABLE` телеметрией показывает `firstFailureStage ≠ CANDIDATE_REQUEST` | **Повышает** (ничего не ослаблено) | **0** production-файлов | Высокая: честный «мы нашли, почему» | Высокая |
| **C0** | **Раскрыть контракт наблюдения** (`x-request-id` echo и др. обязательные observables) в модельно-видимом `context.target` | Устраняет earliest proven blocker для GLM-линии; вероятно и для Meta | **ВЫСОКАЯ** | 2–6 ч + review + новая authorization card | 0 (до нового POST) | НИЗКИЙ технически, **СРЕДНИЙ процессуальный**: меняет body SHA ⇒ новая карта #116, тариф, двухвладельческое согласие | 1 PR в `migration-context.mjs`, новый body SHA, `audit.mjs` variants | После правки повторный прогон того же кандидата (с добавленным echo) всё равно даёт `0/17` | **Повышает справедливость**: требование становится публичным, gates не тронуты | 1 файл + 1 тест/пин; **не** Oracle, не comparator | Высокая | Высокая |
| **B** | Неизменный one-shot JSON changes, «честная zero-repair», улучшение output-дисциплины внутри границ | Почти нулевой: детерминированный `OBSERVATION_ERROR` останется | **НИЗКАЯ** | 1–3 д | 1 POST (бесполезный) | Тратит единственный разрешённый эксперимент | Тот же receipt `0/17 1/20` | Уже фальсифицирован статически (`02` H1) | Нейтральна, но маскирует дефект контракта | Малый | Отрицательная | Нет |
| **C** | Source-aware prompt (MMP-120 Proposal A/B: PHP value semantics, compile discipline) | Потенциально снижает `HTTP_JSON_TYPE`/message/DDL риски **после** C0 | **НЕИЗВЕСТНО** (`PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED`) | 1–2 д + новая карта | 0 (до POST) | Средний: +531/+334 B, риск over-constraining и drift при re-pin | `prompt-proposals.md` → PR, новые body SHA `500b34dc…`/`dd28517a…` | A/B с одинаковым candidate SHA на двух прогонах (требует 2 POST — сейчас недоступно) | Нейтральна при честном A/B; опасна при «подгонке под 17 известных запросов» | 1–2 файла | Средняя | Средняя |
| **D** | Two-phase compile-first / compiler-in-the-loop: generation → deterministic TS admission/typecheck → bounded fix → parity | Закрывает класс G1 (`TS2345`), который GLM уже закрыл одним repair | **СРЕДНЯЯ** сейчас, ВЫСОКАЯ в долгую | 3–5 д + новая политика | 0 (детерминированный fix) или 1–2 POST при LLM-repair | **ВЫСОКИЙ процессуальный**: нарушает «1 POST / 0 repair» #116 и #123 «one repair consumed»; нужен отдельный commit на каждый hop; риск скрытого overfit к диагностике | Отдельные immutable candidate SHA для draft/fix, compiler-diagnostics sidecar, разрешение владельца | Если после C0 первый же draft проходит G1 6/6 — фаза не нужна | **Угроза**: repair feedback не должен содержать held-out/G4/expected outputs (`AGENTS.md`) | `migration-trial.mjs`, `meta-migration.mjs`, workflow | Высокая (прозрачный diff) | Высокая |
| **E** | Decomposition 1–3 функции, stable adapters, staged assembly | Теоретически снижает размер атома | **НИЗКАЯ для этого scope** | 5–10 д | ≥3–5 POST | Высокий: фрагментация SQLite DDL/сидинга/транзакций/`db`-хендла/диспетчера; рост вызовов и стоимости | Новый MANIFEST/юниты, контракты адаптеров | Если один атом после C0 даёт 6/6+17/17+20/20 — декомпозиция избыточна | **Риск**: новый benchmark ≠ старый; нельзя сравнивать с историей | Почти весь контур | Средняя | Средняя |
| **F** | Hybrid symbolic + LLM (php-parser/AST/IR/shim/templates) | Даёт детерминированные адаптеры для `empty('0')`, `(int)`, DDL, routes | **НЕИЗВЕСТНО** | 7–10+ д | 1–3 POST | **ВЫСОКИЙ**: новые зависимости, генератор кода под 484 строки, лицензии, сопровождение | AST-инвентарь, codegen, тесты каждого слоя | Прототип не проходит существующий admission/`compareSqlite` без правки контракта | Риск «подгонки под Oracle»; требуется отдельный review | Большой | Средняя | Высокая в долгую |
| **G** | Scope/product repositioning: «verified subset PHP→TS» → расширение покрытия; публичный benchmark отделён от demo | Снимает риск ложного Product PASS; создаёт честный MVP | **ВЫСОКАЯ (продуктовая)** | 1–3 д (документы/метрики) | **0** | Низкий | Матрица метрик `03` §8, отдельные ID для demo, публичный scope-контракт | Если упрощённый demo объявлен «G1/G2/G3 PASS» — вариант провален | **Повышает** | Документы только | Высокая | **Максимальная** |
| **H** | Смена пары/рантайма (PHP→JS, C→Rust, COBOL→Java) | Стратегическая диверсификация | **НЕИЗВЕСТНО / НЕ ПОКАЗАНО** | ≥10 д + переписывание Oracle | 0 | **ОЧЕНЬ ВЫСОКИЙ**: теряются G0–G4, PHP qualification, пины, custody, 150 коммитов | Новый benchmark | Любой расчёт выгоды из S1/S4 (там нет PHP→TS) | Обнуляет сопоставимость | **Весь репозиторий** | Низкая сейчас | Сомнительная |

## 2. Рекомендация

**Основной путь: A → C0 → (авторизованный диагностический прогон по #125) → один авторизованный
POST по #116. Резерв: D, затем G параллельно.**

Порядок и обоснование:

1. **A (сейчас, GO).** Диагноз поставлен без inference и без Docker: `02`. Это дешевле любого
   следующего POST и информативнее любой правки инфраструктуры. Именно на это указывают факты:
   MMP-108 full PASS (инфраструктура исправна), GLM repair скомпилился и совпал по initial DB
   (модель справилась), а сбой — на `CANDIDATE_REQUEST` из-за несообщённого заголовка.
2. **C0 (GO после новой карты).** Минимальная правка в
   `packages/agent-real/src/migration-context.mjs:25-44` — добавить в `target` (или в
   `instructions`, но лучше в структурированный `target`) одну фразу, например:
   *«Every response must echo the request header `x-request-id` verbatim; the service is
   identified by it. Emit `Content-Type: application/json; charset=utf-8` on every response.»*
   Это **раскрытие уже существующего контракта**, а не ослабление gate и не «улучшение качества
   промпта». Обязательно: пересчитать body SHA (`node research/mmp-120/audit.mjs` + `variants`),
   обновить `research/mmp-061`/пины только если контракт `bindMigrationContext` этого требует,
   новая immutable authorization card с точным main SHA / body SHA / тарифом / бюджетом / 1 POST /
   0 repair / timeout, финальное согласие владельца. **G0–G4, comparator, normalization,
   admission, cleanup — не трогать.**
3. **Диагностический прогон (HOLD → отдельное согласие).** По #125 §2-§3: один **не-
   генерационный** Docker-прогон со старым неизменным `0cf5ba0b…`; приватная инструментация
   живёт в **отдельном scratch/trusted адаптере**, не в production `verifyPair`; публикуется только
   `{firstFailureStage, failureCategory, side, status}` + negative controls. Ожидание по H1 —
   `CANDIDATE_REQUEST / OPERATION_REJECTED`. Это **не второй repair**.
4. **Один POST (HOLD).** Только после п.1–3, #115 gates, подтверждённого тарифа до
   `2026-11-05T00:00:00Z`, явного выбора `max_estimated_usd` (предложенные `$0.25` — **оценка, не
   гарантированный cap**), и подписанной карты. Без «попробовать другую модель».

**Резерв D** включается, если после C0 новый кандидат снова падает на G1 с воспроизводимым
`TS2345`-подобным диагностиком: тогда двухфазный compile-first с **детерминированным** fix (не
обязательно LLM) и отдельными immutable SHA на каждом hop даёт больше, чем смена модели. **G**
идёт параллельно всегда: она стоит 0 inference и защищает от главной продуктовой ошибки.

## 3. От чего отказаться явно

- **B** — детерминированно проигрывает; тратит единственный POST.
- **E** — атом 11/5/1 уже почти сработал; дробление ломает общее состояние SQLite и стоит
  ≥3 POST. Данных о выигрыше нет.
- **F** — зрелого PHP→TS транспайлера нет (`04` §3); php-parser даёт только AST, Uniter — малую
  часть stdlib, Rector — PHP→PHP. Строить codegen под один 484-строчный исходник за 7–10 дней
  дольше, чем исправить контракт за часы.
- **H** — S1/S4 не содержат PHP→TS и не дают «существенной стратегической выгоды»; цена перехода
  — весь G0–G4 и 150 коммитов.
- **C (Proposal A/B) как первый шаг** — `PROMPT_QUALITY_NOT_EMPIRICALLY_ESTABLISHED`; будучи
  применённым до C0, он изменит body SHA и израсходует карту, не устранив `x-request-id`.

## 4. Чего делать нельзя (по `AGENTS.md` и промпту)

Не переписывать на микросервисы; не добавлять «десять dependency»; не менять shared API
(`TargetOracleAdapter`/`verifyPair`/`GateResult`) ради рефлекторного фикса; не ослаблять gates и
normalization; не трогать comparator/controls/G4; не давать модели repair feedback с held-out
или expected outputs; не запускать candidate TS на хосте; не вносить ключ владельца в runner/модель/Git.

## 5. Сильное альтернативное решение (не выбранное, но заслуживающее фиксации)

**Переместить identity в доверенный инспектор**: `runtime/inspect.mjs:154-160` мог бы
самостоятельно проставлять `headers["x-request-id"] = action.requestId` в observation (поскольку
`requestId` уже доверенный, а не из кандидата), а `controller.mjs:686-690` и `mapping.mjs:22`
сравнивали бы с ним. Тогда требование к кандидату исчезает, benchmark становится справедливым
**без изменения промпта и body SHA**.

Почему **не рекомендуется как основной путь**: это изменение **production verifier/наблюдателя**
и shared API, требует явного согласия **обоих владельцев** (`AGENTS.md`, #111 «STOP at a documented
new two-owner decision»), меняет смысловую нагрузку G2 (header identity перестаёт быть
наблюдаемым поведением сервиса), создаёт риск «несамостоятельного» observation и требует
повторной сертификации всех MMP-104/MMP-108/MMP-123 негативных контролей. Blast radius и
процессуальный риск несопоставимо выше, чем у C0. Если владельцы всё же выберут его — его нужно
оформить **отдельным PR** с independent security review, а не «тихим фиксом», и явно задокументировать
изменение контракта G2.

## 6. Минимальный план по конкретным файлам (для C0, без исполнения)

| Файл | Действие | Критерий |
| --- | --- | --- |
| `packages/agent-real/src/migration-context.mjs` | +1 поле/фраза в `target` о `x-request-id` echo и точном `Content-Type` | `node research/mmp-120/audit.mjs` пересчитывает новый body SHA; тест `mmp120-generation-readiness.test.mjs` по-прежнему подтверждает отсутствие scenario IDs / expected outputs / held-out / comparator internals |
| `research/mmp-120/{source-to-prompt-audit.md,prompt-proposals.md}` | Новая строка в §5 «PHP-runtime knowledge» + новая строка в §1 «What the model receives»; убрать слепое пятно | В аудите явно перечислены все требования observation-протокола |
| `research/mmp-123/PROVENANCE.md` | Зафиксировать, что более ранние кандидаты не могли знать контракт (append-only, без переписывания истории) | Первый драфт и repair остаются immutable |
| authorization card (#116) | Новые exact main SHA / body SHA / tariff / `max_estimated_usd` / 1 POST / 0 repair / timeout | Финальное явное согласие владельца; `#116` остаётся HOLD до подписи |
| `research/mmp-069/coverage-matrix.json` | **НЕ трогать** | См. `README.md`: docs-only dir не попадает в `research/**/*.mjs`; строка сломает `validate.mjs:245-249` |

**Ни один production Oracle/comparator/workflow файл в этом плане не меняется.**
