# MMP-126 — независимое исследование Arena AI (READ-ONLY)

**Issue:** <https://github.com/Meta-Project2026/Metamorph/issues/126> · **Refs:** #125 #61 #116 #104 #108 #123 #120 #115
**База, зафиксированная проверкой:** `main@074af751e9012abad1be2749c360c5d8b86218e0`
(проверено `git ls-remote origin refs/heads/main` и GitHub API `/commits/main`, дата коммита
`2026-11-02T02:06:01Z`). На момент исследования HEAD `main` **не изменился** относительно
точки отсчёта промпта. Fast CI на этом SHA: два check-run `quick (22)` и `quick (24)` — `success`.
**Дата отсечения внешних источников:** 2026-11-02.

## Режим и честное раскрытие ограничений

- Исполнитель: **Arena.ai Agent Mode**. Я не могу назвать конкретную модель/уровень effort и не
  заявляю, что работал «astra 6 / terra 6.1»: в этой сессии нет аттестованного выбора модели.
  Принятый режим — одиночный агент с полным read-only доступом к клону репозитория, к
  публичному GitHub API (`gh`/`git`) и к публичному вебу (`web_search`/`fetch_page`).
- **Вторая независимая модель не запускалась.** В `07-ADVERSARIAL-REVIEW.md` dissent второй
  модели явно помечен `SIMULATED_DISSENT` (реконструкция позиции по тем же исходным фактам),
  а не выдаётся за реальный независимый вывод. Итоговая рекомендация сформирована **после**
  просмотра исходников, receipts, CI и внешних публикаций (evidence-ledger в `01`).
- **READ-ONLY.** Не выполнялись: Docker, `workflow_dispatch` (включая `validate_only`), Meta
  GET/POST, генерация/инференс, загрузка артефактов, чтение приватных evidence/G4/закрытых
  эталонов, изменение production-файлов, исходных пинов, цен, gates, candidate source.
  Ключи владельца и секреты не запрашивались и не использовались.
- Не прочитаны (`NOT_INSPECTED`, честно): приватные operation packs MMP-104, закрытые reference
  samples/G4, исходный TS-кандидат Meta run #41327197036, полные логи CI-джобов,
  `packages/agent-real/src/{meta-wire,meta-paid-authorization,migration-provider,compiler-diagnostics,private-diagnostics,encrypt-diagnostics,custody-*}.mjs`
  (по ним — только точечный `grep`), `packages/oracle/src/{controls,reference/evidence,reference/mapping}.ts`,
  `packages/target-worker/src/runtime-broker.mjs`, `packages/differential/src/workshop-finalizer.mjs`.
  Выводы по ним не делаются.

## Файлы

| Файл | Содержание |
| --- | --- |
| `00-EXECUTIVE-VERDICT.md` | Вердикт ≤2 стр.: 3 главные причины, уверенность, GO/HOLD/NO_GO, чего не делать |
| `01-FACTS-AND-EVIDENCE.md` | Evidence ledger: попытки, SHA, run/CI/PR, классы доказательств, пропуски и противоречия |
| `02-FIRST-HTTP-FORENSICS.md` | Карта шагов first HTTP, телеметрия, ≥3 конкурирующие гипотезы, decision tree, controls |
| `03-PHP-TS-FEASIBILITY.md` | 11 функций / 5 actions, адаптеры, точная/наблюдаемая/scoped parity, overconstraints Oracle |
| `04-EXTERNAL-STATE-OF-ART.md` | Проверенная библиография DOI/arXiv, применимость 0–5, продукты и инструменты |
| `05-ARCHITECTURE-OPTIONS.md` | Варианты A–H, impact/effort/risk/cost, рекомендация, отказ от вариантов |
| `06-PRIORITIZED-EXECUTION-PLAN.md` | 24ч / 3д / 10д, acceptance criteria, negative controls, gates, бюджет |
| `07-ADVERSARIAL-REVIEW.md` | Опровержение сильнейшего тезиса, альтернативная модель, 5 фактов, 5 anti-patterns, dissent |
| `08-SOURCES.md` | Кликабельные первичные источники, закреплённые GitHub SHA/file/line, что источник НЕ доказывает |
| `09-FINAL-ANSWERS.md` | 12 обязательных коротких ответов |

Issue #126 в GitHub просил 7 файлов с другими именами (`01-EVIDENCE-LEDGER.md`,
`02-FORENSIC-DIFFERENTIAL.md`, `03-FEASIBILITY-AND-RESEARCH.md`, `04-DESIGN-OPTIONS.md`,
`05-90-PERCENT-PLAN.md`, `06-RED-TEAM-CHALLENGE.md`, `07-SOURCE-BIBLIOGRAPHY.md`).
Здесь использованы 9 имён из **приложенного владельцем промпт-артефакта**
`MMP-126-ARENA-DEEP-RESEARCH.md`, который является прямым поручением; покрытие всех семи
тематик issue #126 сохранено (соответствие: ledger→`01`, differential→`02`,
feasibility+research→`03`+`04`, design→`05`, plan→`06`, red-team→`07`, bibliography→`08`).
Плюс `09` с 12 ответами.

## Почему НЕ добавлена строка в coverage matrix

Проверен фактический контракт `research/mmp-069/validate.mjs:241-249`: множество
`harnesses` строится из `research/**/*.mjs` и сравнивается с `matrix.research[].path`.
`research/mmp-126/` содержит **только `.md`** → не попадает в `harnesses` → добавление строки
вызвало бы `RESEARCH_INVENTORY_DRIFT` и сломало `node research/mmp-069/validate.mjs`.
Следовательно, по фактическому контракту строка **не нужна и вредна**. Production-файлы не
менялись вообще.

**Локальные чеки:** `node research/mmp-069/validate.mjs` и `check-syntax.mjs` — **NOT_RUN**:
в клоне отсутствует `node_modules` (`ERR_MODULE_NOT_FOUND: yaml`), установка зависимостей не
выполнялась ( READ-ONLY ). Вывод о matrix сделан статическим чтением `validate.mjs:241-249`, а не
исполнением валидатора; в hosted Fast CI эти чеки пройдут при неизменном workflow.
