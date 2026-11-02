# Operator runbook — MMP-140 recorded demo

Интерфейс английский, речь русская. Ниже **целевые слоты**, не измеренная
репетиция. Human timed rehearsal: **NOT_RUN**. Результаты и снимки:
[VALIDATION-140.md](VALIDATION-140.md).

## Подготовка

Нужны checkout с `research/demo-readiness/`, `research/mmp-104/incident.json`,
Node 22.13+ / 24 и современный браузер. Установка пакетов для показа не нужна.
Ни ключ, ни Docker, ни GitHub, ни Интернет не используются. Viewer HEAD отличается
от execution heads, записанных внутри исторических receipts.

```powershell
Set-Location -LiteralPath '<repository checkout root>'
node --version
node --test research/demo-readiness/demo.test.mjs research/demo-readiness/real-ai.test.mjs research/demo-readiness/incident.test.mjs
node research/demo-readiness/serve.mjs
```

Откройте [viewer](http://127.0.0.1:4171/). Сервер слушает только loopback; прямой
file:// не поддерживается. Если 4171 занят, не завершайте чужой процесс: примените
текстовый fallback. Для остановки своего сервера — Ctrl+C.

1. Первый экран: PHP → TypeScript, независимый Oracle, **NOT_ESTABLISHED**.
2. **From source to evidence**: пять кнопок объясняют концептуальные стадии;
   подсветка — выбор объяснения, не ход исполнения.
3. **Evidence desk** → **Load pinned public receipts**. Десять локальных JSON
   валидируются атомарно: A/B — пять historical, C — четыре original public,
   D — одна derived allowlisted summary. До успеха результаты не показываются.
4. Вернитесь к **Guided demo** через навигацию сверху. Выбирайте главы или
   **Next chapter / Previous**. У A/B/C/D глава выбирает карточку и даёт ссылку
   **Inspect track …** к подробностям. Переходов по таймеру нет.
5. Карточки A/B/C/D независимо выбирают подробности. Раскройте **Compare all
   G0–G4 verdicts & completed comparisons** для шести строк (B — три попытки).
6. Для вопросов раскройте identities выбранного реального трека. В **Inspect the
   allowlisted public receipt JSON** выберите `Real AI #81 / trial.json` или
   `Incident #104 / incident.json`. JSON других загруженных треков тоже доступен;
   смотрите подпись набора, а не только basename.
7. Завершите главой **The acceptance gap**. Обновление страницы очищает память;
   перед следующим показом загрузите набор снова.

Picker принимает один полный набор: пять JSON непосредственно в `evidence/`,
четыре из `evidence/real-ai-40900698372/`, единственный `incident.json`, либо один
`future-model.json` — только declaration preview **NOT_VERIFIED**. Имена
trial/finalizer совпадают между папками; не смешивайте их. Picker показывает
только выбранные треки, недоступная глава явно говорит «not loaded».

## 90 секунд — ручной сценарий

Целевой темп без auto-play; загрузите receipts до начала речи.

| Target | Глава / действие | Речь |
| --- | --- | --- |
| 0–15s | The premise / первый экран | «Metamorph мигрирует PHP в TypeScript с AI-агентом, а независимый Oracle проверяет сохранение поведения. Это сохранённые результаты; миграция сейчас не запускается. Product NOT_ESTABLISHED». |
| 15–25s | A · No generation | «A — исторический admission-only снимок: ноль генераций, кандидата нет. Поздние результаты этот снимок не переписывают». |
| 25–40s | B · Scripted control | «B — Docker-контроль: known-good PASS, намеренная mutation FAIL, scripted repair PASS по G2/G3. По 17 HTTP и 20 SQLite сравнений. Это не ответ AI». |
| 40–55s | C · Real AI, build FAIL | «C — настоящий ответ модели и созданный кандидат. Генерация PASS, но G1 build FAIL. HTTP 0/17, SQLite 0/20; G2/G3 INCONCLUSIVE. Оригинальные compiler diagnostics UNKNOWN». |
| 55–80s | D · Verifier ERROR | «D — другой настоящий запуск: генерация PASS, первая пара build PASS. Aggregate G1 INCONCLUSIVE; G2/G3 ERROR. HTTP 0/17 завершено, SQLite 1/20. Это не ноль отправленных запросов. Источник кандидата недоступен, историческая причина UNKNOWN». |
| 80–90s | The acceptance gap | «Generation PASS и одна build PASS не дают product PASS. G0/G4 INCONCLUSIVE. Новые эксперименты вне этих receipts. Проверяемая миграция ещё не установлена». |

## 3–5 минут — расширенный показ

Целевой центр — около четырёх минут; время человека не измерено.

| Target | Экран / действие | Что раскрыть |
| --- | --- | --- |
| 0:00–0:35 | Первый экран → pipeline | PHP → агент → TS-кандидат → независимая изоляция → receipts/verdict. Кнопка меняет объяснение, а не запускает стадию. Product NOT_ESTABLISHED. |
| 0:35–1:05 | A → scope | Historical generation NOT_RUN, candidate/cost null. Публичный MIT car-workshop, source SHA d272170…. Ограниченный SQLite API slice: пять действий, 11 PHP functions; не всё приложение, не route/function coverage. |
| 1:05–1:45 | B → matrix | Known-good / deliberate mutation / scripted repair: G2/G3 PASS → FAIL → PASS, по 17/17 HTTP и 20/20 SQLite. Числа включают проваленную mutation. G0/G4 INCONCLUSIVE; runtime controls не закрывают formal G4. |
| 1:45–2:25 | C → details / identities | Run 40900698372, 29 октября: Muse Spark 1.3, один запрос/ответ, generation PASS, G1 FAIL / BUILD_FAILED. G2/G3 INCONCLUSIVE / MISSING_COVERAGE, 0/17 и 0/20. Tokens 5818/9239; estimate USD 0.04653825, charged null. MMP-082 synthetic TS2322 относится к другому кандидату; не выдавайте его за диагностику C. |
| 2:25–3:20 | D → details / identities | Run 41327197036, 1 ноября: другой head/candidate. Один POST, HTTP 200, generation PASS; per-pair G1 PASS у workshop-business. Aggregate G1 INCONCLUSIVE / BUILD_NOT_RUN; G2/G3 ERROR / VERIFIER_ERROR. Завершены HTTP 0/17, SQLite 1/20 — initial snapshot. Tokens 5985/9870, estimate USD 0.04942875, charged null. Cleanup/finalizer 0/0/0 — отдельный факт. Source и private packs UNAVAILABLE; root cause UNKNOWN; stage classification NOT_RECORDED. |
| 3:20–4:00 | JSON → The acceptance gap | Сверьте run/head/candidate и естественные FAIL/ERROR. Pin доказывает совпадение bytes с reviewed snapshot; D — derived summary, не новая проверка оригинальных ZIP. G0/G4 INCONCLUSIVE. A–D заканчиваются 1 ноября; #137 / run 41505679809 не включён. Текущая работа #61/#115/#137/#139 отслеживается отдельно, её статус из старого viewer не выводится. |

G0 — independent complete target; G1 — executed build/typecheck; G2 — HTTP contracts;
G3 — stateful HTTP/typed SQLite parity; G4 — independent controls/held-out isolation.
Product acceptance требует всех применимых обязательных gates и сценариев
на точном кандидате. Estimate не равен списанию; null — неизвестно, не $0.

## Offline fallback и ошибки

| Условие | Действие |
| --- | --- |
| Нет Интернета / GitHub / модели / Docker / ключа | Обычный локальный запуск и десять committed JSON. Браузер не обращается к внешним сервисам. |
| Corrupt / missing receipt | Результаты и обзор очищаются, NOT_VERIFIED. Восстановите точные bytes из проверенного checkout. Не переименовывайте и не переформатируйте JSON для обхода pinning. |
| Один трек недоступен | Picker другого полного набора работает отдельно. Объявите, какие треки реально загружены; глава отсутствующего трека — только narration. A/B не заменяют результат C/D. |
| Нет Node / браузер не работает / порт занят | Откройте committed JSON, README и этот runbook в редакторе. Прочитайте поля; работу UI в этом случае не заявляйте. Screenshots — иллюстрация конкретной проверки, не свежий execution proof. |
| Попросили root cause / diagnostics | C diagnostics UNKNOWN; D root cause UNKNOWN, source UNAVAILABLE. Не заимствуйте диагностику другого кандидата. |
| Спрашивают про новую миграцию | Здесь recorded evidence. Live jobs/backend integration и новый receipt требуют отдельного scope/решения и проверенных pins; viewer их не предоставляет. |

Негативная репетиция: после успешной загрузки выберите только `generation.json` —
INCOMPLETE_BUNDLE; изменённый `incident.json` — PIN_MISMATCH; D + C вместе —
MIXED_SELECTION. Во всех случаях нет старых карточек, matrix, gates, identities
или JSON. **Load pinned public receipts** восстанавливает все четыре трека.
Шестая глава сохраняет PRODUCT NOT_ESTABLISHED при любом выборе.

Клавиатура: Tab/Shift+Tab по native controls, Enter/Space для кнопок, Enter для
details; первый Tab — Skip to content. Широкие таблицы прокручиваются внутри
фокусируемого региона; страница не должна расползаться по горизонтали.
Полностью отключённый ноутбук, screen reader и человеческую речь по секундомеру
проверьте отдельно: в текущей работе это NOT_RUN.
