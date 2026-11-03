# Operator runbook — five-track recorded demo (MMP-148)

Интерфейс английский, речь русская. Временные слоты — **target pacing**, не замер.
Human timed rehearsal: **NOT_RUN**. [Результаты и screenshots](VALIDATION-148.md).

## Запуск и порядок экранов

Из checkout этой ветки с Node 22.13+ / 24 и современным браузером:

```powershell
node research/demo-readiness/serve.mjs
```

Откройте [viewer](http://127.0.0.1:4171/), нажмите **Load pinned public receipts**.
Установка пакетов, Интернет, GitHub, API key, PHP и Docker для показа не нужны.
Сервер только loopback; file:// не поддерживается. Остановка своего сервера —
Ctrl+C. Не завершайте чужой процесс, если 4171 занят; используйте fallback.

1. Первый экран: PHP → TypeScript и независимый Oracle, PRODUCT NOT_ESTABLISHED.
   Pipeline-кнопки меняют объяснения, не исполняют стадии.
2. После атомарной валидации — A–E, 11 публичных inputs: A/B пять historical,
   C четыре originals, D одна derived summary, E одна versioned projection.
3. **Guided demo**: семь ручных глав, **Previous / Next chapter** или прямой
   выбор. Глава A–E выбирает detail panel; **Inspect track …** ведёт к нему.
   Карточка синхронизирует главу. Таймеров и live progress нет.
4. Раскройте **Compare all G0–G4 verdicts & completed comparisons**: семь строк
   (A + три попытки B + C/D/E). Числа — executed comparisons, не pass/route coverage.
5. Раскройте identities выбранного трека. Для E: JSON inspector →
   **Real AI #137 / mmp148-track-e-v1.json**. Это public projection, не код кандидата.
6. Завершите **The acceptance gap**. Refresh очищает память. Viewer HEAD и
   execution heads receipts — разные identities.

Picker принимает один набор: пять JSON в `evidence/`; четыре C в
`evidence/real-ai-40900698372/`; один D `incident.json`; один E
`evidence/real-ai-41505679809/mmp148-track-e-v1.json`; либо один
`future-model.json` — только **NOT_VERIFIED** preview. D/E принимаются отдельно.
Не смешивайте папки с одинаковыми trial/finalizer basenames. У отсутствующего
трека глава явно говорит **NOT_LOADED**, например E_NOT_LOADED; это не FAIL или
INCONCLUSIVE. Narration без загруженных bytes — не evidence.

## 90 секунд — семь глав

Receipts загрузите заранее. Целевой темп, не измеренная речь.

| Target | Глава | Речь |
| --- | --- | --- |
| 0–15s | The premise | «Metamorph переносит PHP в TypeScript с AI-агентом, а независимый Oracle проверяет поведение. Здесь сохранённые результаты, ничего сейчас не исполняется. Product NOT_ESTABLISHED». |
| 15–23s | A | «Исторический снимок до admission: ноль генераций, кандидата нет. Поздние результаты его не переписывают». |
| 23–35s | B | «Docker-контроль: G2/G3 PASS, намеренная mutation FAIL, scripted repair PASS. По 17 HTTP и 20 SQLite сравнений. Это не AI». |
| 35–45s | C | «Настоящий ответ, но G1 build FAIL. HTTP 0/17, SQLite 0/20; downstream INCONCLUSIVE». |
| 45–60s | D | «Первая пара build PASS, aggregate G1 INCONCLUSIVE; G2/G3 ERROR. Завершены HTTP 0/17, SQLite 1/20. Историческая причина UNKNOWN». |
| 60–80s | E | «Три публичных сценария и все шесть typecheck/build IDs прошли. Но G2/G3 FAIL: HTTP JSON types. Выполнены 17/17 и 20/20 сравнений. Проверенные SQLite-снимки совпали в этом manifest; отдельного DB-дефекта не установлено. Точное поле неизвестно». |
| 80–90s | The acceptance gap | «Прогресс сборки доказан, успешная миграция — нет. G0/G4 INCONCLUSIVE, held-out NOT_RUN, product NOT_ESTABLISHED. Списание неизвестно». |

## 3–5 минут — расширенный показ

Целевой центр — около четырёх минут; время человека не измерено.

| Target | Экран | Что раскрыть |
| --- | --- | --- |
| 0:00–0:25 | Первый экран / pipeline | PHP → агент → TS candidate → независимая изоляция → сохранённые verdicts. Кнопки — объяснения, не работающий агент. |
| 0:25–0:45 | A / scope | Generation NOT_RUN, candidate/cost null. Публичный MIT car-workshop, source d272170…. Пять API actions, 11 PHP functions — ограниченный SQLite API slice, не всё приложение. |
| 0:45–1:20 | B / matrix | Known-good / mutation / scripted repair: G2/G3 PASS → FAIL → PASS. По HTTP 17/17 и SQLite 20/20, включая failing mutation. Runtime controls не закрывают formal G4. |
| 1:20–1:50 | C | Run 40900698372, 29 октября: generation PASS, G1 FAIL / BUILD_FAILED. G2/G3 INCONCLUSIVE / MISSING_COVERAGE. Tokens 5818/9239, estimate USD 0.04653825, charged null. Original diagnostics UNKNOWN; MMP-082 synthetic TS2322 — другой кандидат. |
| 1:50–2:25 | D | Run 41327197036, 1 ноября: generation PASS, workshop-business per-pair G1 PASS, aggregate G1 INCONCLUSIVE / BUILD_NOT_RUN. G2/G3 ERROR / VERIFIER_ERROR, completed HTTP 0/17, SQLite initial 1/20. Ноль завершённых сравнений не означает ноль запросов. Tokens 5985/9870, estimate 0.04942875, charged null. Исторические source UNAVAILABLE, root cause UNKNOWN, stage classification NOT_RECORDED. |
| 2:25–3:25 | E / gates / metrics | Run 41505679809, 2 ноября: Muse Spark 1.3, один запрос/ответ, HTTP 200. Aggregate G1 PASS по трём сценариям и шести IDs. G2 FAIL по 17 HTTP IDs, G3 FAIL по 20 combined IDs; в каждом сценарии HTTP_JSON_TYPE. G3 включает HTTP findings, поэтому FAIL не доказывает отдельный DB mismatch. Все сравненные initial/step SQLite snapshots совпали в этом manifest. jsonDiff не спускается под kind mismatch: различия в пропущенных поддеревьях не исключены, точное поле/root cause UNCONFIRMED. Tokens 6060/9554, estimate USD 0.0481795, charged null/UNKNOWN. Cleanup/finalizer 0/0/0 — отдельный факт, не migration PASS. |
| 3:25–4:00 | E identities / JSON / gap | У C/D/E разные run/head/candidate. E — узкий snapshot из самостоятельно полученного original public ZIP: 8733 bytes, все девять members перепроверены. Pin подтверждает identity snapshot, не новую execution или подпись независимого исполнителя. Custody/restore-поля исключены. G0/G4 INCONCLUSIVE, held-out NOT_RUN, PRODUCT NOT_ESTABLISHED. Свежесть ограничена runs до 2 ноября; последующие работы/owner actions — отдельно. |

G0 — independent complete target; G1 — executed build/typecheck; G2 — HTTP contracts;
G3 — stateful HTTP/SQLite parity; G4 — independent controls/held-out isolation.
Product PASS требует всех применимых обязательных gates и сценариев на точном
кандидате. Estimate не равен списанию; null — неизвестно, не $0.

## Offline fallback и негативный показ

| Условие | Действие |
| --- | --- |
| Нет Интернета / модели / Docker / ключа | Обычный loopback viewer с committed публичными inputs, без внешних запросов страницы. |
| Corrupt/missing E или другой bundled input | Combined load целиком очищается, NOT_VERIFIED. Нельзя молча показать четыре трека и заявить пять. Восстановите точные bytes из reviewed checkout. |
| Нужен один доступный трек | Picker полного набора; объявите, что реально загружено. E_NOT_LOADED не трактуется как FAIL/INCONCLUSIVE и не заменяется B PASS. |
| Нет Node / browser failure / порт занят | Откройте JSON, README и runbook в редакторе; работу UI не заявляйте. Screenshots — конкретный capture, не новая проверка кандидата. |
| Попросили точный JSON defect | HTTP_JSON_TYPE — установленная категория; точное поле/значения этим snapshot не установлены. Не выдавайте H1/H2 или private observations за receipt. |
| Попросили owner restore | Это отдельная owner/custody workstream. E не содержит текущего restore-статуса; старые research-поля не переносятся. |

После успеха выберите только C `generation.json` — INCOMPLETE_BUNDLE; изменённый
E — PIN_MISMATCH; D + E — MIXED_SELECTION. Старые cards, gates, matrix,
identities, JSON и preview очищаются. **Load pinned public receipts** возвращает
A–E. Не редактируйте receipt bytes ради зелёного PASS.

Tab/Shift+Tab — native controls, Enter/Space — кнопки, Enter — details; первый
Tab — Skip to content. Таблицы прокручиваются внутри фокусируемых регионов.
Screen reader, fully disconnected laptop и человеческая речь с секундомером
в текущей работе **NOT_RUN**; scoped browser keyboard/focus smoke описан отдельно.
