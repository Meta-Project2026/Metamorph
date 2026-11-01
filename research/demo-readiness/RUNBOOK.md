# Operator runbook — 30 October 2026 presentation (doc refreshed 2026-11-01)

Интерфейс английский, речь русская. Интервалы — **target pacing**, не измеренная
репетиция человека. Технические проверки в [VALIDATION-085.md](VALIDATION-085.md).
Human timed rehearsal: NOT_RUN.

## Подготовка и порядок экранов

Запуск из корня любого checkout, содержащего `research/demo-readiness/`; на
2026-11-01 это актуальный `main`. Viewer Git HEAD отличается от execution heads
внутри receipts. Достаточно Node 22.13+ / 24, браузера и checkout, без установки
и Интернета.

```powershell
Set-Location -LiteralPath '<repository checkout root>'
git rev-parse HEAD
git diff --check
node --version
node --test research/demo-readiness/demo.test.mjs
node --test research/demo-readiness/real-ai.test.mjs
node research/demo-readiness/serve.mjs
```

1. Откройте http://127.0.0.1:4171/ и **Load pinned public receipts**: historical
   A/B (5 receipts) + PINNED_REAL_AI_SNAPSHOT C (4).
2. Верх / architecture / NOT_ESTABLISHED → A historical admission → B replay.
3. C **Real AI trial — G1 build failure**: generation PASS, G1 FAIL, HTTP 0/17,
   SQLite 0/20, charged USD null. Прочитайте timeline.
4. Раскройте **Real run / source / candidate / artifact identities**. При вопросах
   **Inspect the allowlisted public receipt JSON** → Real AI #81 / generation.json,
   затем Real AI #81 / trial.json.
5. Завершите на G0/G4 INCONCLUSIVE и product NOT_ESTABLISHED. Перед выступлением
   обновите страницу и повторите загрузку. После — Ctrl+C для остановки сервера.

Picker принимает один полный набор: пять JSON непосредственно в evidence/ либо
все четыре JSON в evidence/real-ai-40900698372/. Имена trial.json/finalizer.json
совпадают, identities различаются; не смешивайте папки. Picker показывает только
выбранный набор, кнопка — все три трека. future-model.json — NOT_VERIFIED preview.

## 90 секунд — сценарий с целевыми слотами

| Target | Экран | Речь |
| --- | --- | --- |
| 0–15s | Верх | «Metamorph проверяет миграцию PHP в TypeScript на публичном SQLite API. Показываем три разных набора фактов. Product acceptance пока NOT_ESTABLISHED». |
| 15–30s | A → B | «A — исторический admission-only снимок без AI-генерации. B — deterministic Docker replay: PASS, намеренная ошибка FAIL, scripted repair PASS. Это контроль, не ответ модели». |
| 30–65s | C timeline | «29 октября Muse Spark 1.3 ответила на один разрешённый запрос и создала TS-кандидата. Генерация PASS. Но независимый Docker typecheck вернул G1 FAIL, BUILD_FAILED. HTTP и SQLite дальше не исполнялись: 0 из 17 и 0 из 20, G2/G3 INCONCLUSIVE. Ошибка сохранена, успешной миграции здесь нет». |
| 65–90s | C cost / acceptance | «Оценка — 0.04653825 доллара; списанная сумма неизвестна, null. Cleanup и finalizer — ноль ресурсов. Исходные diagnostics неизвестны. G0/G4 INCONCLUSIVE. Показан контур генерация → изолированная компиляция → честный FAIL; product NOT_ESTABLISHED». |

## Около четырёх минут — целевые слоты

| Target | Экран | Речь |
| --- | --- | --- |
| 0:00–0:35 | Верх / architecture | «Metamorph строит проверяемую миграцию PHP в TypeScript. Здесь есть настоящий ответ модели и созданный кандидат. Важно отдельно видеть результат генерации и результат независимой проверки. Сегодня все данные записанные и закреплены по SHA; новых запросов сейчас нет. Это демонстрация работающего контура, но не завершённой миграции». |
| 0:35–1:05 | Scope → A | «Публичный MIT car-workshop закреплён на commit d272170…. Это ограниченный SQLite API slice: пять публичных actions — GET get_slots, get_appointments; POST book, update_appointment, cancel_appointment — и одиннадцать упорядоченных PHP functions в одном agent unit `workshop-api`; не всё приложение. Реальной декомпозиции на migration units нет, только proposed labels. A — исторический admission-only снимок #70: тогда generatedRequests было ноль, candidate и cost null. Это не текущее состояние всего проекта. Мы сохраняем этот этап истории отдельно». |
| 1:05–1:45 | B, три строки | «B показывает реальный исторический Docker replay. Known-good проходит, намеренная mutation падает на G2/G3, scripted repair возвращает scoped parity. На попытку выполнены 17 HTTP и 20 typed SQLite comparisons. Это сравнения в трёх сценариях, не число endpoints. Repair scripted, не AI. Coverage этого контроля нельзя перенести на другого кандидата, даже если используется тот же исходник». |
| 1:45–2:40 | C timeline | «Теперь настоящий запуск #81, 29 октября. Исходник заморожен; один запрос разрешён; Muse Spark 1.3 вернула ответ и создала кандидата с отдельным SHA. Generation PASS означает, что генерация состоялась. Затем кандидат поступил в изолированный Docker typecheck. Здесь G1 FAIL, BUILD_FAILED. HTTP и SQLite сравнения не исполнялись: 0/17 и 0/20. Если бы сборка прошла, G2 сверил бы все 17 HTTP-шагов замороженного манифеста (workshop-business 6, workshop-rejected 5, workshop-capacity 6), а G3 — 20 типизированных SQLite состояний (initial и после каждого шага) между reference и кандидатом; эти фиксированные знаменатели и показаны как 0/17 и 0/20. В оригинальных receipts G2/G3 — INCONCLUSIVE с MISSING_COVERAGE. Независимая проверка остановила плохую сборку; FAIL не заменён успешным историческим replay». |
| 2:40–3:20 | C cost / cleanup | «Receipt сообщает 5818 входных и 9239 выходных токенов. Estimated cost — 0.04653825 доллара. Charged cost null: оценка не доказывает списание. Cleanup VERIFIED_ZERO_RESOURCES и отдельный finalizer PASS показывают ноль контейнеров, томов и emergency removals. Это собственные receipts нового запуска, не заимствованные у replay. Полный candidate SHA и execution head доступны рядом». |
| 3:20–4:00 | Identities / acceptance | «Оригинальный ZIP и четыре публичных JSON сверены побайтно по SHA-256. Исходная TypeScript-ошибка неизвестна: TS2322 из #82 относится к другому синтетическому кандидату. G0 и formal G4 не установлены; product NOT_ESTABLISHED. Прежний AUDIT_FAIL не отменён. Следующий repair потребует отдельного разрешения и новых evidence. Сегодня показаны генерация, изолированная компиляция и честная обратная связь, доступные даже без Интернета». |

G1 — build/typecheck; G2 — HTTP contracts; G3 — stateful/typed SQLite parity.
G0 требует independent complete target; G4 — independent controls / held-out
isolation. Public runtime controls не закрывают formal G4.

## Следующий измеримый эксперимент

Proposed, не авторизован и не исполнен: отдельная authorized paid-v2 попытка
генерации/repair на точном pinned main с новыми receipts и точными
run/head/candidate идентификаторами, сохраняя каждую попытку, включая failures.
Готовность отслеживается в [#100](https://github.com/Meta-Project2026/Metamorph/issues/100),
продуктовая цель — [#61](https://github.com/Meta-Project2026/Metamorph/issues/61).
Автоматических платных запросов нет; старые receipts никогда не подменяют новые
результаты, а новый кандидат появляется в viewer только после отдельного
reviewed pin/adapter обновления.

## Fallback и негативная репетиция

| Условие | Действие / формулировка |
| --- | --- |
| Нет сети / GitHub / модели / Docker / ключа | Bundled load использует девять локальных JSON. «Recorded hosted evidence, новых model/GitHub действий нет». |
| Реальный G1 FAIL | Покажите C без замены replay PASS. «Build failed; downstream comparisons не исполнены, G2/G3 INCONCLUSIVE». |
| Спрашивают текст ошибки | «Original diagnostics UNKNOWN. MMP-082 synthetic TS2322 — другой candidate». |
| Спрашивают про routes / migration units | «Пять публичных actions; 11 упорядоченных PHP functions в одном agent unit `workshop-api`. Декомпозиции на migration units нет — только proposed labels; 10–15 routes или 30–50 units не заявляются». |
| Corrupt / missing receipt | Viewer очищает результаты, показывает NOT_VERIFIED. Восстановите точные bytes из этой ветки. Если C недоступен, picker пяти исторических файлов позволяет показать A/B, явно назвав их историческими. |
| Нет Node / порт занят / browser failure | Не останавливайте чужой процесс. Откройте локальные JSON и runbook в редакторе; прочитайте поля. Успешную работу UI в этом случае не заявлять. |
| Нет полного набора | README/PROVENANCE — текстовая справка; прямо скажите, что receipts не загружены, viewer NOT_VERIFIED. |

Негативная репетиция: выбрать только generation.json → INCOMPLETE_BUNDLE,
все результаты скрыты. Затем **Load pinned public receipts** восстанавливает их.
Реальный FAIL показывается в C без редактирования JSON. Человеческую речь на
90 секунд / ~4 минуты и полностью отключённый ноутбук отрепетировать отдельно;
записать секундомер, не выдавать target pacing за фактический замер.
