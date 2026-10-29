# Operator runbook — 30 October 2026

The viewer language is English; the suggested spoken script below is Russian.
Slots below are **target pacing**, not measured human narration durations.
Actual technical smoke timing and unexecuted rehearsals are in VALIDATION.md.

## Before taking the stage

Use this isolated checkout, not Ilia's active branch:

```powershell
Set-Location -LiteralPath 'C:\Users\user\Documents\Metamorph-mmp-071'
git branch --show-current
git rev-parse HEAD
git diff --check
node --version
node --test research/demo-readiness/demo.test.mjs
node research/demo-readiness/serve.mjs
```

Expected branch `demo/mmp-071-hackathon`. Record the viewer head printed locally;
it is not the replay execution head. Node 22.13+ / 24, modern Chrome/Edge and the
local checkout are sufficient. No install or Internet needed at presentation time.
Open `http://127.0.0.1:4171/`. Click **Load pinned public receipts**. Expect
`PINNED_PUBLIC_SNAPSHOT`, five files, model requests 0, null candidate/cost, and
replay rows PASS → FAIL → PASS for G2/G3. Refresh and repeat once before the talk.
Do not open a GitHub environment or configure an API key to prepare this demo.

Alternatively select these five files together in the local picker:

```text
research/demo-readiness/evidence/trial.json
research/demo-readiness/evidence/summary.json
research/demo-readiness/evidence/finalizer.json
research/demo-readiness/evidence/inventory.json
research/demo-readiness/evidence/evidence-index.json
```

The architecture flow is at the top of the page and fits in one desktop screen.
Scroll down for attempts and provenance. Expand **Inspect the allowlisted public
receipt JSON** to inspect trial.json, then summary.json. No source/candidate executes.

## 3–5 minute storyboard (target 4 minutes)

| Target slot | Screen / action | Suggested narration |
| --- | --- | --- |
| 0:00–0:30 | Header, acceptance label, architecture flow | «Metamorph строит проверяемую миграцию PHP в TypeScript. Сегодня показываем реальный путь проверки на публичном ограниченном примере и явно отделяем его от ещё не выполненной AI-генерации. Product acceptance пока NOT_ESTABLISHED». |
| 0:30–1:05 | Scope and provenance | «Исходник — публичный MIT car-workshop на закреплённом commit d272170…. Измерены 5 API actions и 11 PHP functions; это SQLite API slice. Числа 831/439 относятся ко всем PHP-extension files: physical lines / nonblank PHP-region lines including comments. Это не 10–15 маршрутов и не покрытие всего приложения». |
| 1:05–1:40 | Track A / trial.json | «PR #70 связывает исходник и manifest с admission провайдера. Самой генерации не было: MODEL_GENERATION_NOT_RUN, generatedRequests=0; candidate и cost — null. Build, HTTP и stateful gates нового model candidate не запускались. Здесь нет скрытого готового ответа модели». |
| 1:40–2:35 | Track B / attempt table and SHA | «Отдельный hosted run 40793819074 выполнял реальный Docker Oracle для исторического deterministic replay. PHP reference и TS candidate изолированы. Known-good имеет G1/G2/G3 PASS; deliberate mutation — G2/G3 FAIL; scripted repair возвращает scoped parity. Это scripted repair, не работа AI. Для каждого кандидата указан точный SHA». |
| 2:35–3:10 | Comparison counts and cleanup | «На попытку выполнены 17 HTTP comparisons и 20 typed SQLite comparisons: initial state и post-step snapshots в трёх сценариях. Это не 17 endpoints. Даже падающий контроль имеет полные comparison counts. Шесть runtime controls PASS. Normal cleanup и finalizer показывают 0 containers / 0 volumes / emergencyRemoved=0 — только для этого replay». |
| 3:10–4:00 | G0/G4 and roadmap | «G0 и formal G4 остаются INCONCLUSIVE. Прежний PR #31 AUDIT_FAIL не отменён. Следующий шаг #61 — настоящий разрешённый model trial с provider/model/cost и candidate receipts, затем независимые checks для именно этого кандидата. Если модель естественно упадёт, покажем её FAIL/ERROR/NOT_RUN отдельно и вернёмся к честно помеченному recorded control». |

G1 means executed build/typecheck; G2 HTTP contracts; G3 stateful HTTP and typed
SQLite parity. G0 requires independently complete target; G4 requires independent
controls and held-out isolation. Public controls alone do not close formal G4.

## 90-second version (target)

0–20s, architecture/scope: «Это проверяемая PHP→TS миграция на публичном MIT SQLite
API slice: 5 actions, 11 functions. Источник и входы закреплены SHA».

20–40s, Track A: «Сегодня model generation NOT_RUN: 0 requests, candidate/cost null.
Никакой готовый deterministic replay не выдаётся за AI-ответ».

40–70s, Track B: «Исторический hosted Docker control отдельно показывает
known-good PASS, намеренную mutation FAIL и scripted repair PASS для G2/G3.
На каждую попытку — 17 HTTP и 20 typed SQLite comparisons. Cleanup 0/0,
emergencyRemoved=0. Всё привязано к run 40793819074 и execution SHA 6ab6e36…».

70–90s, acceptance/roadmap: «G0/G4 INCONCLUSIVE, product NOT_ESTABLISHED. Реальная
AI-генерация #61 и formal G4 — следующие отдельные доказательства. Этот offline
viewer показывает подлинные записанные receipts даже без API и GitHub».

## Failure rehearsal and factual fallback

| Condition | Operator action | Exact distinction to say |
| --- | --- | --- |
| Provider unavailable or not authorized | Show Track A; do not start/configure a model | «Admission only; MODEL_GENERATION_NOT_RUN, 0 requests, null candidate/cost». |
| Future model fails before candidate | Keep original public FAIL/ERROR/NOT_RUN record visible separately; select pinned bundle for replay | «Новый model trial не дал кандидата; ниже отдельный исторический control, не его результат». |
| Candidate build FAIL | Show that candidate's original G1 FAIL; never substitute replay G1 | «Этот candidate не прошёл build; downstream unexecuted gates NOT_RUN». |
| Candidate parity FAIL / partial coverage | Keep exact FAIL/INCONCLUSIVE and executed IDs; no comparator or fixture edits | «Обнаружено расхождение; неполные проверки не объявлены PASS». |
| GitHub/API/network outage | Use committed local files and loopback viewer | «Recorded hosted snapshot; новые GitHub/model действия сейчас не выполняются». |
| Corrupt/missing receipt | Viewer clears prior results and shows NOT_VERIFIED; restore exact file from this reviewed demo branch | «Этот выбранный набор не проверен; цифры из него не показываем». |
| Port 4171 occupied / Node unavailable / browser failure | Stop demo server if it is yours; otherwise use this runbook plus local evidence/*.json in a text editor | Read exact public receipt fields. Do not imply the viewer or a live run succeeded. |

For a public negative-input rehearsal, select only trial.json: expect
INCOMPLETE_BUNDLE, with model/replay result panels hidden. Restore with **Load pinned
public receipts**. For mutation failure evidence, show the real middle replay row;
do not edit JSON to manufacture a live failure.

Human timed narration and full disconnected-laptop rehearsal should be completed
by the presenter. Record stopwatch durations without relabeling target slots as
measured results. Stop the server with Ctrl+C when finished.
