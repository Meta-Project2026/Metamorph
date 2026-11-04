# Operator runbook — six-track recorded demo (MMP-162)

For the latest verified public G1–G3 snapshot and submission recording, start with
the [MMP-194 operator flow](../mmp-194/RUNBOOK.md) and
[exact 3-minute English storyboard](SUBMISSION.md). This A–F walkthrough remains
the historical fallback; it does not include the later candidate.

Интерфейс английский, речь русская. Все слоты — **target pacing**, не замер.
Human timed rehearsal: **NOT_RUN**. [Проверки и screenshots](VALIDATION-162.md).

## Запуск и навигация

```powershell
node research/demo-readiness/serve.mjs
```

Откройте [viewer](http://127.0.0.1:4171/) и нажмите **Load pinned public receipts**.
Для показа нужны Node 22.13+ / 24 и современный браузер. Интернет, установка
пакетов, API key, GitHub, PHP, Docker и модель не нужны. Сервер только loopback;
file:// не поддерживается. Ctrl+C останавливает свой сервер; чужой процесс на
4171 не завершайте, используйте fallback.

1. Первый экран: PHP → TypeScript, независимый Oracle, PRODUCT NOT_ESTABLISHED.
   Пять pipeline-кнопок объясняют стадии, не запускают их.
2. Атомарно загружаются A–F: 12 публичных inputs (5 historical A/B, 4 C,
   1 derived D, 1 projection E, 1 projection F). Никакого автозапуска.
3. Восемь ручных глав с Previous/Next; карточка выбирает главу и detail panel.
   **Inspect track …** ведёт к выбранному треку; narration без bytes не evidence.
4. Matrix содержит 9 строк: A + 3 scripted B + C/D/E + 2 genuine F.
   Числа — executed comparisons, включая неуспешные, а не PASS coverage.
5. F: статичная цепочка → две карточки → таблицы сценариев → identities.
   На desktop карточки рядом, на узком экране одна под другой. JSON inspector:
   **Real repair #162 / mmp162-track-f-v1.json**.
6. Закончите **The acceptance gap**. Refresh очищает память. Viewer HEAD
   отличается от historical execution HEAD; здесь нет новой Oracle execution.

Picker принимает ровно один полный набор: пять файлов `evidence/`; четыре C
`evidence/real-ai-40900698372/`; один D `incident.json`; один E
`evidence/real-ai-41505679809/mmp148-track-e-v1.json`; один F
`evidence/real-ai-41726833705/mmp162-track-f-v1.json`; либо lone future-model.json
(только NOT_VERIFIED preview). D/E/F выбираются по одному, без смешивания.
Absent chapter показывает E_NOT_LOADED / F_NOT_LOADED, а не новый gate verdict.

## 90 секунд — восемь глав

Receipts загрузите заранее. F занимает целевые **25 секунд**.

| Target | Глава | Речь |
| --- | --- | --- |
| 0–10s | Premise | «AI переносит PHP в TypeScript, независимый Oracle проверяет поведение. Здесь сохранённая история; product NOT_ESTABLISHED». |
| 10–16s | A | «До admission: генераций ноль, кандидата нет, стоимость неизвестна». |
| 16–26s | B | «Проверка verifier: scripted PASS → mutation FAIL → scripted repair PASS. Это не AI». |
| 26–34s | C | «Реальный ответ, но G1 build FAIL. HTTP и SQLite проверки не исполнились». |
| 34–44s | D | «Одна пара build PASS, aggregate INCONCLUSIVE; verifier ERROR. Завершены 0/17 HTTP и 1/20 SQLite». |
| 44–57s | E | «Все публичные сборки PASS; G2/G3 FAIL по HTTP JSON types. 17/17 и 20/20 выполнено, это не проходной балл». |
| 57–82s | F | «Впервые реальный repair: ответ модели, Oracle FAIL, feedback HTTP_JSON_TYPE, второй ответ и другой кандидат, снова Oracle FAIL. Обе сборки PASS, обе проверки полные: 17/17 и 20/20. Business/rejected FAIL, capacity PASS в обеих попытках. Агрегат не улучшился; изменения отдельных шагов неизвестны». |
| 82–90s | Acceptance gap | «G0/G4 INCONCLUSIVE, held-out NOT_RUN, успешная миграция не доказана. Estimate двух ответов $0.10929375; списание неизвестно». |

## 3–5 минут — расширенный показ

Целевой центр ~4:30; человеческий хронометраж NOT_RUN.

| Target | Экран | Детали |
| --- | --- | --- |
| 0:00–0:25 | Home / pipeline | Product NOT_ESTABLISHED до загрузки. Статичная концепция PHP → AI → TS → независимый Oracle → verdict. |
| 0:25–0:45 | A / scope | Исторический NOT_RUN, null candidate/cost. MIT car-workshop: 5 API actions / 11 PHP functions, ограниченный SQLite API slice. |
| 0:45–1:15 | B / matrix | Три scripted контроля с 17 HTTP и 20 SQLite сравнений каждый. Runtime controls не закрывают formal held-out G4. |
| 1:15–1:40 | C | Run 40900698372: genuine generation, G1 FAIL; downstream INCONCLUSIVE, 0/17 + 0/20. Original diagnostics UNKNOWN. |
| 1:40–2:10 | D | Run 41327197036: first-pair G1 PASS, aggregate INCONCLUSIVE; G2/G3 ERROR, 0/17 + 1/20. Source UNAVAILABLE, root cause UNKNOWN. Ноль завершённых сравнений не означает ноль запросов. |
| 2:10–2:45 | E | Run 41505679809: G1 PASS все 6 build IDs; G2/G3 FAIL HTTP_JSON_TYPE; 17/17 + 20/20 executed. G3 включает HTTP findings, отдельный DB defect не доказан. |
| 2:45–3:55 | F / сравнение | Run 41726833705 начат 3 ноября 22:00:07 UTC / 4 ноября 00:00:07 Кишинёв. REAL generation candidate 329cdcca… → Oracle FAIL → REAL repair candidate 572c6db9… → Oracle FAIL. Каждый ответ от muse-spark-1.3, HTTP 200, один response. Оба G1 PASS6; G2 FAIL17/17, G3 FAIL20/20. Сценарии business FAIL/FAIL, rejected FAIL/FAIL, capacity PASS/PASS — в обеих попытках. Published aggregate outcome pattern unchanged; per-step improvements unknown. Точное поле/тип/причину не угадываем. |
| 3:55–4:15 | F / provenance, cost | Tokens 6188/10556 и 14148/9179; estimates $0.052598 + $0.05669575 = $0.10929375, charged null UNKNOWN. Workflow SUCCESS означает завершённый процесс. Intermediate scorecard противоречив и не задаёт итог сессии; используются generation/trial пары. ZIP неизменён. |
| 4:15–4:30 | Acceptance | Формальный held-out NOT_RUN, G0/G4 INCONCLUSIVE, PRODUCT NOT_ESTABLISHED. Хеш удостоверяет bytes сохранённого снимка, не новую независимую execution. |

## F: ограничения рассказа

Публичные aggregate verdicts не раскрывают individual step deltas. Нельзя говорить
«ни один тест не улучшился», «все проверки провалены», «repair успешен» или
называть точное поле/тип/root cause. G3 включает HTTP findings; HTTP_JSON_TYPE
не устанавливает отдельный DB defect. Суммы — estimates, null charge не $0.

Исходный `scorecard.json` — промежуточная запись: maximumPosts=1 и
PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED расходятся с preflight.maximumPosts=2
и подлинными repair receipts. Поля исключены из projection; это явно описано в
identities. Final repair stop reason COMPLETE_PUBLIC_FAIL_AFTER_SIGNED_REPAIR.
#161 исправляет production отдельно; новые claims не меняют F автоматически.
Отдельных wall-clock timestamp для каждой попытки нет; показан старт всего run.

## Fallback и accessibility

При недоступном viewer используйте committed JSON и этот runbook, явно называя
их сохранённым снимком. Ошибка проверки очищает все старые карточки, matrix,
identities, JSON и preview; общий load восстанавливает A–F. Не меняйте bytes
ради PASS и не заменяйте AI FAIL scripted результатом B.

Tab/Shift+Tab, Enter/Space, Skip to content и фокусируемые table regions доступны;
при reduced motion нет анимации. Локальный Chrome smoke и viewport checks
выполнены; screen-reader audit, физически отключённый laptop и timed human
rehearsal — NOT_RUN. См. [VALIDATION-162.md](VALIDATION-162.md).
