# Operator runbook — 30 October 2026 presentation (doc refreshed 2026-11-02)

Интерфейс английский, речь русская. Интервалы — **target pacing**, не измеренная
репетиция человека. Технические проверки в [VALIDATION-085.md](VALIDATION-085.md).
Human timed rehearsal: NOT_RUN.

## Подготовка и порядок экранов

Запуск из корня любого checkout, содержащего `research/demo-readiness/` и
`research/mmp-104/incident.json`; на 2026-11-02 это актуальный `main`. Viewer Git
HEAD отличается от execution heads внутри receipts. Достаточно Node 22.13+ / 24,
браузера и checkout, без установки и Интернета.

```powershell
Set-Location -LiteralPath '<repository checkout root>'
git rev-parse HEAD
git diff --check
node --version
node --test research/demo-readiness/demo.test.mjs
node --test research/demo-readiness/real-ai.test.mjs
node --test research/demo-readiness/incident.test.mjs
node research/demo-readiness/serve.mjs
```

1. Откройте http://127.0.0.1:4171/ и **Load pinned public receipts**: historical
   A/B (5 receipts) + PINNED_REAL_AI_SNAPSHOT C (4) + PINNED_INCIDENT_SUMMARY D (1).
2. Верх / architecture / NOT_ESTABLISHED → A historical admission → B replay.
3. C **Real AI trial — G1 build failure**: generation PASS, G1 FAIL, HTTP 0/17,
   SQLite 0/20, charged USD null. Прочитайте timeline.
4. D **Real AI trial — first-pair build PASS, verifier error**: generation PASS,
   первая per-pair G1 PASS (workshop-business), aggregate G1 INCONCLUSIVE /
   BUILD_NOT_RUN, G2/G3 ERROR / VERIFIER_ERROR (0/17, 1/20), cleanup/finalizer
   0/0/0, candidate source UNAVAILABLE, root cause UNKNOWN, charged USD null.
5. Раскройте **identities** у C и D; при вопросах **Inspect the allowlisted public
   receipt JSON** → Real AI #81 / trial.json или Incident #104 / incident.json.
6. Завершите на G0/G4 INCONCLUSIVE и product NOT_ESTABLISHED. Перед выступлением
   обновите страницу и повторите загрузку. После — Ctrl+C для остановки сервера.

Picker принимает один полный набор: пять JSON непосредственно в evidence/, либо
все четыре JSON в evidence/real-ai-40900698372/, либо единственный
`incident.json` (только отдельно, с exact pin). Имена trial.json/finalizer.json
совпадают, identities различаются; не смешивайте папки. Picker показывает только
выбранный набор, кнопка — все четыре трека. future-model.json — NOT_VERIFIED preview.

## 90 секунд — сценарий с целевыми слотами

| Target | Экран | Речь |
| --- | --- | --- |
| 0–15s | Верх | «Metamorph проверяет миграцию PHP в TypeScript на публичном SQLite API. Показываем четыре разных набора фактов, включая два настоящих платных AI-запуска. Product acceptance пока NOT_ESTABLISHED». |
| 15–30s | A → B | «A — исторический admission-only снимок без AI-генерации. B — deterministic Docker replay: PASS, намеренная ошибка FAIL, scripted repair PASS. Это контроль, не ответ модели». |
| 30–55s | C timeline | «29 октября Muse Spark 1.3 ответила на один разрешённый запрос и создала TS-кандидата. Генерация PASS. Но независимый Docker typecheck вернул G1 FAIL, BUILD_FAILED. HTTP и SQLite дальше не исполнялись: 0 из 17 и 0 из 20. Ошибка сохранена, успешной миграции здесь нет». |
| 55–80s | D timeline | «1 ноября — второй настоящий запуск. Генерация PASS и первая per-pair G1 PASS: typecheck и build workshop-business прошли. Но aggregate G1 INCONCLUSIVE — остальные builds не запускались, — а G2/G3 упали с verifier error: 0 из 17 HTTP-сравнений завершено, 1 из 20 SQLite. Ноль завершённых сравнений не значит, что запросы не доходили. Root cause неизвестен; источник кандидата недоступен». |
| 80–90s | Acceptance | «Оба реальных запуска: G0/G4 INCONCLUSIVE, product NOT_ESTABLISHED, списанные суммы неизвестны. Показан честный контур генерация → изолированная проверка → сохранение FAIL/ERROR; готовым продуктом Metamorph это не является». |

## Около четырёх минут — целевые слоты

| Target | Экран | Речь |
| --- | --- | --- |
| 0:00–0:35 | Верх / architecture | «Metamorph строит проверяемую миграцию PHP в TypeScript. Здесь два настоящих ответа модели и два созданных кандидата — 29 октября и 1 ноября. Важно отдельно видеть результат генерации и результат независимой проверки. Сегодня все данные записанные и закреплены по SHA; новых запросов сейчас нет. Это демонстрация работающего контура, но не завершённой миграции». |
| 0:35–1:05 | Scope → A | «Публичный MIT car-workshop закреплён на commit d272170…. Это ограниченный SQLite API slice: пять публичных actions и одиннадцать упорядоченных PHP functions в одном текущем agent unit `workshop-api`; не всё приложение. Отдельно существует внешнее исследование — план декомпозиции из восьми proposed migration units MU-01…MU-08 (репозиторий barbalatv/meta_research2510): это planning decomposition, не реализация. A — исторический admission-only снимок #70: generatedRequests ноль, candidate и cost null. Мы сохраняем этот этап истории отдельно». |
| 1:05–1:45 | B, три строки | «B показывает реальный исторический Docker replay. Known-good проходит, намеренная mutation падает на G2/G3, scripted repair возвращает scoped parity. На попытку выполнены 17 HTTP и 20 typed SQLite comparisons. Repair scripted, не AI. Coverage этого контроля нельзя перенести на другого кандидата, даже если используется тот же исходник». |
| 1:45–2:35 | C timeline | «Теперь настоящий запуск #81, 29 октября. Исходник заморожен; один запрос разрешён; Muse Spark 1.3 вернула ответ и создала кандидата с отдельным SHA. Generation PASS означает, что генерация состоялась. Затем кандидат поступил в изолированный Docker typecheck. Здесь G1 FAIL, BUILD_FAILED. HTTP и SQLite сравнения не исполнялись: 0/17 и 0/20. G2/G3 — INCONCLUSIVE с MISSING_COVERAGE. Независимая проверка остановила плохую сборку; FAIL не заменён успешным историческим replay». |
| 2:35–3:20 | D timeline | «Второй настоящий запуск, #41327197036, 1 ноября. Снова generation PASS: один POST, HTTP 200, один подтверждённый ответ, 5985 входных и 9870 выходных токенов, оценка 0.04942875 доллара, списание null — неизвестно, не ноль. Впервые на реальном AI-кандидате per-pair G1 PASS: typecheck и build для workshop-business. Но это только одна пара из трёх: aggregate G1 INCONCLUSIVE / BUILD_NOT_RUN. G3 ERROR / VERIFIER_ERROR: записан только начальный SQLite-снимок, 1 из 20. G2 ERROR: 0 из 17 завершённых HTTP-сравнений — это не значит, что запросы не доходили до сервисов; неопределённый интервал до первого подсчитанного сравнения. Cleanup VERIFIED_ZERO_RESOURCES и finalizer PASS: 0/0/0. Источник сгенерированного кандидата недоступен, приватные operation packs недоступны, историческая root cause UNKNOWN — никакой диагноз не выдумывается. Stage classification NOT_RECORDED: production-телеметрия появилась позже, в этом запуске её не было». |
| 3:20–4:00 | Identities / acceptance | «Все receipts закреплены по SHA-256; D — это derived allowlisted-сводка из mmp-104: совпадение хеша означает identity сводки, а не новую проверку исходных ZIP. У C и D разные run, head и candidate SHA — receipts не смешиваются. G0 и formal G4 не установлены; product NOT_ESTABLISHED для обоих запусков. Следующий платный эксперимент требует отдельного разрешения: #115 ещё ждёт production-доказательства, #116 остаётся на паузе; в этом демо никаких платных запросов не запущено. Сегодня показаны два честных результата независимой проверки — FAIL и ERROR — доступные даже без Интернета». |

G1 — build/typecheck; G2 — HTTP contracts; G3 — stateful/typed SQLite parity.
G0 требует independent complete target; G4 — independent controls / held-out
isolation. Public runtime controls не закрывают formal G4.

## Следующий измеримый эксперимент

Proposed, не авторизован и не исполнен: ровно один отдельный owner-authorized
Muse Spark 1.3 Standard paid-v2 POST на точном pinned main — без automatic
repair, retries, failover или reruns; любой дополнительный model repair вызов
потребует отдельного approved policy/authorization. Записывается результат
этого одного POST, включая failures, с новыми receipts и точными
run/head/candidate идентификаторами.
Готовность отслеживается в [#100](https://github.com/Meta-Project2026/Metamorph/issues/100),
продуктовая цель — [#61](https://github.com/Meta-Project2026/Metamorph/issues/61).
На 2026-11-02 #115 ещё требует production доказательства, а подготовка
следующего запуска #116 остаётся на HOLD: ни один плановый платный запрос
не запущен. Автоматических платных запросов нет; старые receipts никогда не
подменяют новые результаты, а новый кандидат появляется в viewer только после
отдельного reviewed pin/adapter обновления.

## Fallback и негативная репетиция

| Условие | Действие / формулировка |
| --- | --- |
| Нет сети / GitHub / модели / Docker / ключа | Bundled load использует десять локальных JSON. «Recorded hosted evidence, новых model/GitHub действий нет». |
| Реальный G1 FAIL | Покажите C без замены replay PASS. «Build failed; downstream comparisons не исполнены, G2/G3 INCONCLUSIVE». |
| Реальный verifier ERROR | Покажите D без догадок. «G2/G3 ERROR / VERIFIER_ERROR, 0/17 и 1/20; историческая причина UNKNOWN — точный интервал до первого подсчитанного HTTP-сравнения по доступным публичным данным не устанавливается». |
| Спрашивают текст ошибки | «Original diagnostics UNKNOWN. MMP-082 synthetic TS2322 — другой candidate. У D диагностик нет: DIAGNOSTIC_UNAVAILABLE, root cause UNKNOWN». |
| Спрашивают про routes / migration units | «Пять публичных действий; 11 упорядоченных PHP functions в одном текущем agent unit `workshop-api`. Внешнее исследование предлагает восемь proposed migration units MU-01…MU-08 — plan decomposition, не реализация и не измерение; 10–15 routes или 30–50 units не заявляются». |
| Спрашивают про списание | «Оба запуска: chargedCostUsd null — settled charge недоступен, это неизвестность, а не ноль. Оценки 0.04653825 (C) и 0.04942875 (D)». |
| Corrupt / missing receipt | Viewer очищает результаты, показывает NOT_VERIFIED. Восстановите точные bytes из этой ветки. Если D недоступен, picker единственного incident.json тоже проверяет exact pin; если C недоступен, picker пяти исторических файлов позволяет показать A/B, явно назвав их историческими. |
| Нет Node / порт занят / browser failure | Не останавливайте чужой процесс. Откройте локальные JSON и runbook в редакторе; прочитайте поля. Успешную работу UI в этом случае не заявлять. |
| Нет полного набора | README/PROVENANCE — текстовая справка; прямо скажите, что receipts не загружены, viewer NOT_VERIFIED. |

Негативная репетиция: выбрать только generation.json → INCOMPLETE_BUNDLE,
все результаты скрыты. Выбрать изменённый incident.json → PIN_MISMATCH,
NOT_VERIFIED, D не отображается. Затем **Load pinned public receipts**
восстанавливает все четыре трека. Реальные FAIL и ERROR показываются в C и D
без редактирования JSON. Человеческую речь на 90 секунд / ~4 минуты и полностью
отключённый ноутбук отрепетировать отдельно; записать секундомер, не выдавать
target pacing за фактический замер.
