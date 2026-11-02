# 08 — Sources

Dата проверки: **2026-11-02**. GitHub-ссылки закреплены на
`074af751e9012abad1be2749c360c5d8b86218e0` (не на плавающий `main`). Для исторических прогонов
указан их собственный execution SHA. Внешние источники помечены **PUBLISHED** / **PREPRINT** /
**VENDOR** (вес см. `04` §7).

## 1. Первичные внутренние источники (закреплённые SHA + строки)

Префикс для всех: `https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/`

| Файл:строки | Что подтверждает | Что **НЕ** доказывает |
| --- | --- | --- |
| [`packages/oracle/src/runner.ts#L284-L350`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/runner.ts#L284-L350) | порядок `REFERENCE_REQUEST → … → HTTP_COMPARE → executedHttp.push` | что именно упало в историческом прогоне |
| [`.../runner.ts#L415-L419`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/runner.ts#L415-L419) и [`#L436-L465`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/runner.ts#L436-L465) | единый `fatal`/`VERIFIER_ERROR`; `ERROR` при любом исключении | сторону/стадию отказа |
| [`.../runner.ts#L562-L564`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/runner.ts#L562-L564) | `failureTelemetry` возвращается только при переданном контексте | что контекст был передан в исторических прогонах |
| [`packages/oracle/src/failure-telemetry.ts#L3-L83`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/failure-telemetry.ts#L3-L83) | формат, 30 stages, 3 категории, поля record | наличие record в receipts; root cause |
| [`.../failure-telemetry.ts#L146-L191`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/failure-telemetry.ts#L146-L191), [`#L439-L458`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/failure-telemetry.ts#L439-L458), [`#L492-L495`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/failure-telemetry.ts#L492-L495) | жёсткий binding (`runId` decimal), активация только на `[MANIFEST[i]]`, `INTERNAL_ERROR` | работоспособность в hosted runner |
| [`packages/target-worker/src/controller.mjs#L674-L692`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/target-worker/src/controller.mjs#L674-L692) | **`capture.headers["x-request-id"] !== requestId` → `OBSERVATION_ERROR`** | что кандидат обязан был это знать |
| [`packages/target-worker/runtime/inspect.mjs#L125-L168`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/target-worker/runtime/inspect.mjs#L125-L168) | инспектор шлёт `x-request-id`, читает `res.headers` | авто-echo в Node (его нет) |
| [`packages/differential/src/mapping.mjs#L6-L48`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/differential/src/mapping.mjs#L6-L48) | второй чек `x-request-id`, `validateHttp`, `compareHttp(o,o)` | почему модель не реализовала echo |
| [`packages/differential/src/target-adapter.mjs#L240-L294`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/differential/src/mapping.mjs#L240-L294), [`#L83-L130`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/differential/src/mapping.mjs#L83-L130) | candidate request pipeline; catch → `BridgeError` | код исходного исключения в публичном receipt |
| [`packages/oracle/src/http.ts#L39-L56`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/http.ts#L39-L56), [`#L65-L101`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/http.ts#L65-L101), [`#L174-L201`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/http.ts#L174-L201) | `oracle-exact-v1`, stable headers, structural JSON compare, бросающие валидаторы | equivalence «вообще»; не сравнивает key order |
| [`packages/oracle/src/sqlite.ts#L69-L121`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/sqlite.ts#L69-L121), [`#L213-L225`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/sqlite.ts#L213-L225) | snapshot включает `sqlite_schema.sql`; `compareSqlite` сравнивает `JSON.stringify(schema)` | что DDL-текст является продуктовым контрактом |
| [`packages/oracle/src/reference/manifest.ts#L4-L16`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/manifest.ts#L4-L16), [`#L40-L80`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/manifest.ts#L40-L80) | `SOURCE`, `clock 2026-10-27 12:00:00`, 3 сценария / 17 HTTP / 20 DB | формальный G4 / benchmark registration |
| [`packages/oracle/src/reference/docker.ts#L20-L26`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/manifest.ts#L20-L26), [`#L140-L141`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/manifest.ts#L140-L141), [`#L198-L205`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/manifest.ts#L198-L205), [`#L257-L318`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/oracle/src/reference/manifest.ts#L257-L318) | libfaketime, PHP loopback client, проверка версий/часов, readiness | hosted-runner состояние 01.11 |
| [`packages/agent-real/src/migration-context.mjs#L25-L46`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/migration-context.mjs#L25-L46), [`#L83-L96`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/migration-context.mjs#L83-L96) | **полный модельно-видимый `target`/`instructions`/11 units/5 routes**; нет `x-request-id` | что модель «могла догадаться» |
| [`packages/agent-real/src/meta-migration.mjs#L74-L91`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L74-L91) | developer message «Never invent … request IDs», `n:1`, JSON schema | фактически отправленный body в будущем |
| [`packages/agent-real/src/runtime.mjs#L203-L204`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L203-L204), [`#L319-L341`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L319-L341), [`#L390-L399`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L390-L399) | `runId` из `GITHUB_RUN_ID` только при `GITHUB_SHA===headSha`; `verifyPair({scenarios:[scenario]})` | что локальный прогон имел валидный binding |
| [`packages/agent-real/src/report.mjs#L21-L57`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L21-L57), [`#L373-L410`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L373-L410) | allowlist-проекция телеметрии, `publicAttempt` | raw completion/targetFailure (не публикуются) |
| [`packages/agent-real/src/migration-trial.mjs#L168-L239`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L168-L239) | `validateGeneratedMigration` → `publicAttempt` | Product PASS |
| [`packages/target-worker/src/admission.mjs#L8-L40`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L8-L40) | только `src/**/*.ts`, 1–64 файла, 1 MiB, `src/main.ts` | семантическую корректность |
| [`packages/target-worker/runtime/profile.mjs#L31-L82`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L31-L82) | точная грамматика path/form | что модель знала об этом |
| [`packages/target-worker/fixtures/workshop/src/main.ts#L245-L247`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L245-L247) | known-good **делает** echo `x-request-id` | что это AI-миграция |
| [`research/mmp-123/verifier-proof.mjs#L299-L331`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/agent-real/src/meta-migration.mjs#L299-L331) | allowlist receipt **отбрасывает** `failureTelemetry` | что телеметрия была `AVAILABLE` |
| [`research/mmp-123/harness/run-inner.sh`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-123/harness/run-inner.sh) | нет `GITHUB_SHA`/`GITHUB_RUN_ID`, нет credentials | что прогон был hosted |
| [`specs/009-real-differential/interface-handoff.md#L24-L28`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/specs/009-real-differential/interface-handoff.md#L24-L28) | «request-id echo … Header identity x-request-id» — внутренний контракт | что он передан модели |
| [`packages/differential/README.md#L40-L47`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/packages/differential/README.md#L40-L47) | «x-request-id is service identity» | продуктовую наблюдаемость |
| [`research/mmp-123/repair-candidate/src/main.ts#L125-L129`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-123/repair-candidate/src/main.ts#L125-L129) | `respond()` ставит только `Content-Type` | что кандидат «плохой» |
| [`research/mmp-061/public-source.json`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-061/public-source.json), [`inventory.json`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-061/inventory.json) | 2 PHP-файла, 11 функций, 5 actions, SHA/байты | весь репозиторий upstream |
| [`research/mmp-069/validate.mjs#L241-L249`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-069/validate.mjs#L241-L249) | `harnesses` из `research/**/*.mjs` ⇒ docs-only dir не регистрируется | что строка в matrix нужна |
| [`.github/workflows/meta-paid-migration.yml#L1-L29`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/.github/workflows/meta-paid-migration.yml#L1-L29), [`#L139-L146`](https://github.com/Meta-Project2026/Metamorph/blob/074af751e9012abad1be2749c360c5d8b86218e0/.github/workflows/meta-paid-migration.yml#L139-L146) | inputs `$0.10` default, `validate_only`, Oracle после custody | разрешение на dispatch |

Исторические (другие SHA):
- `d199510fd802693d4af852bd5ed8498b5461d185` — [`research/mmp-104/README.md`](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/research/mmp-104/README.md) «Supported failure interval»,
  [`incident.json`](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/research/mmp-104/incident.json),
  [`telemetry-design.md`](https://github.com/Meta-Project2026/Metamorph/blob/d199510fd802693d4af852bd5ed8498b5461d185/research/mmp-104/telemetry-design.md).
- `c482e19f8242850f1cc04f79a79add79e68658ee` — freeze GLM first draft.
- `f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c` — MMP-108 execution head.
- `a8cf79ddef1329b882c3277ff11c890047c64560` / `79440b8dd85b28936e1818c8ce79b35ddbd38fcf` — MMP-123 driver heads.
- PR #124 merge `074af75`; PR #117 merge `839a76c`; PR #121 merge `8e85765`; telemetry merge `2b82c8f`, feature commit `eb36864`.

## 2. GitHub API / CI (проверено 2026-11-02)

| Объект | Ссылка | Что подтверждает |
| --- | --- | --- |
| HEAD main | `git ls-remote` + `/commits/main` | `074af75…`, 2026-11-02T02:06:01Z |
| Issue #126 / #125 / #116 / #111 / #104 / #108 / #123 / #120 / #61 | `https://github.com/Meta-Project2026/Metamorph/issues/<n>` | статусы, тела, HOLD/READY_TO_PLAN, бюджет |
| PR #117 / #121 / #124 | `https://github.com/Meta-Project2026/Metamorph/pull/<n>` | merged, base/head/merge SHA |
| Run `41327197036` | https://github.com/Meta-Project2026/Metamorph/actions/runs/41327197036 | failure, `d199510…`, 16:36:25–16:38:33Z |
| Run `40900698372` | https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372 | 2026-10-29, `d213767…`, BUILD_FAILED |
| Run `40892520110` | Actions API | `success`, 2026-10-29 14:32:38Z, `head_sha d213767…`; `inputs` не проверялись (не утверждаем `validate_only`) |
| Fast CI `41338460923`, `41360702958` | Actions API | success на `114973c`, `b057462` |
| Check-runs на `074af75` | `/commits/<sha>/check-runs` | `quick (22)`, `quick (24)` success |
| Workflow runs list | `actions/workflows/meta-paid-migration.yml/runs` | **total_count = 3** |
| MMP-108 receipts | [`evidence/local-f9a7b44/`](https://github.com/Meta-Project2026/Metamorph/tree/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-108/evidence/local-f9a7b44) | known-good 6/6+17/17+20/20; mutant FAIL; 5 synthetic controls |
| MMP-123 receipts | [`evidence/`](https://github.com/Meta-Project2026/Metamorph/tree/074af751e9012abad1be2749c360c5d8b86218e0/research/mmp-123/evidence) | draft `1/6` TS2345; repair `2/6 + 0/17 + 1/20` |

## 3. Внешние источники (PUBLISHED / PREPRINT / VENDOR)

**PUBLISHED (peer-reviewed / официальные труды):**

1. Wang Y. et al. **RepoTransBench**, *IEEE Trans. Software Engineering* 52(2):675–690, Feb 2026 —
   [doi:10.1109/TSE.2025.3645056](https://doi.org/10.1109/TSE.2025.3645056) ·
   [Monash record](https://research.monash.edu/en/publications/repotransbench-a-real-world-multilingual-benchmark-for-repository/) ·
   [PDF](https://nzjohng.github.io/publications/papers/tse2026.pdf) ·
   [GitHub](https://github.com/DeepSoftwareAnalytics/RepoTransBench). **Не доказывает** ничего про
   PHP→TS (пары нет) и про HTTP/SQLite parity.
2. Li X., Xie X., Wu J., Liu T., Wang H. **Code–Test Co-translation (CoTTrans)**, *PACMPL*
   10(OOPSLA2) Art. 358, 01 Oct 2026 — [doi:10.1145/3839490](https://doi.org/10.1145/3839490) ·
   [SPLASH](https://2026.splashcon.org/details/oopsla-2026/116/Code-Test-Co-Translation-Towards-Practical-and-Effective-Program-Migration-in-the-Wi) ·
   [artifact](https://doi.org/10.6084/m9.figshare.33235821.v2). **Не доказывает** применимость
   0.360→0.675 к нашему Oracle.
3. Cheng K. et al. **CODEMENV**, *Findings of ACL 2025*, pp. 2719–2744 —
   [doi:10.18653/v1/2025.findings-acl.140](https://doi.org/10.18653/v1/2025.findings-acl.140) ·
   [ACL Anthology](https://aclanthology.org/2025.findings-acl.140/) ·
   [arXiv:2506.00894](https://arxiv.org/html/2506.00894). **Не** PHP→TS: кросс-версионная
   миграция Python/Java.
4. Wang Q. et al. **Direction-Aware Study … Eight Languages**, *ESEM 2026*, LIPIcs 394,
   63:1–63:14, published 2026-10-05 —
   [doi:10.4230/LIPIcs.ESEM.2026.63](https://doi.org/10.4230/LIPIcs.ESEM.2026.63) ·
   [Dagstuhl](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESEM.2026.63) ·
   [Zenodo artifact](https://zenodo.org/records/20456638). Авторы сами называют работу
   **emerging/preliminary**; PHP нет.
5. Zhang H., David C., Wang M., Paulsen B., Kroening D. **Oxidizer / Scalable, Validated Code
   Translation of Entire Projects**, *PACMPL* 9(PLDI) Art. 212, June 2025 —
   [doi:10.1145/3729315](https://doi.org/10.1145/3729315) ·
   [PDF](https://mengwangoxf.github.io/Papers/PLDI25.pdf) ·
   [Bristol copy](https://research-information.bris.ac.uk/ws/portalfiles/portal/460590511/3729315.pdf).
   **Не доказывает** 73% для Go→Rust ≠ наш scope.
6. Ziftci C. et al. **Migrating Code At Scale With LLMs At Google** —
   [arXiv:2504.09691](https://arxiv.org/pdf/2504.09691) (препринт формы, но опубликован как
   industry case study; статус смешанный) ·
   [review](https://www.themoonlight.io/en/review/migrating-code-at-scale-with-llms-at-google).
   Identifier migration, не кросс-языковой перевод.

**PREPRINT / статус требует проверки:**

7. Kowalczuk V. et al. **CodeTransBenchmark** — [arXiv:2609.20257](https://arxiv.org/abs/2609.20257),
   [HTML](https://arxiv.org/html/2609.20257). Страница abs: «Submitted 28 Jul 2026» при ID `2609.*`;
   [страница автора](https://tsigalko18.github.io/publications/) заявляет *EMSE 2026* —
   **AMBIGUOUS**. **Не доказывает** рецензированный статус.
8. Mahmud A. et al. **When Modernization Breaks Working Code … Legacy PHP** —
   [arXiv:2610.40269](https://arxiv.org/abs/2610.40269), [HTML](https://arxiv.org/html/2610.40269),
   29 Oct 2026, 6 стр. **PHP→PHP**, не PHP→TS.
9. Ou et al. **RustRepoTrans** — [arXiv:2411.13990v1](https://arxiv.org/html/2411.13990v1),
   [v5](https://arxiv.org/html/2411.13990v5).
10. **K³Trans** — [arXiv:2503.18305](https://arxiv.org/html/2503.18305) ·
    [PDF](https://arxiv.org/pdf/2503.18305).
11. **AlphaTrans** — [PDF](https://alirezai.cs.illinois.edu/assets/pdf/alphatrans.pdf).
12. **Agentic Method for Deterministic Validation of Legacy Code Migration** —
    [alphaXiv:2607.28271](https://www.alphaxiv.org/abs/2607.28271).
13. **Metamorphic Testing of Transpilers (MCP)** —
    [arXiv:2607.29247](https://arxiv.org/html/2607.29247) ·
    [критический разбор](https://pith.science/paper/2607.29247).

**Инструменты / официальные репозитории (VENDOR/DOCS, вес низкий-средний):**

14. [`glayzzle/php-parser`](https://github.com/glayzzle/php-parser) ·
    [npm php-parser 3.2.2 BSD-3-Clause](https://npm.io/package/php-parser) ·
    [jsDelivr 3.7.0](https://www.jsdelivr.com/package/npm/php-parser) — только AST/токены.
15. [`uniter/phptojs`](https://www.npmjs.com/package/phptojs) ·
    [`asmblah/uniter`](https://www.npmjs.com/package/uniter) ·
    [LiveCodes PHP docs](https://livecodes.io/docs/languages/php/) — «only a small subset of
    PHP's standard library is supported».
16. [`rectorphp/rector`](https://github.com/rectorphp/rector) ·
    [обзор 2026](https://kokil.com.np/blog/php-rector-for-automated-refactoring) — PHP→PHP only.
17. [`tree-sitter/tree-sitter-php`](https://github.com/tree-sitter/tree-sitter-php) ·
    [PyPI 0.25.1, Oct 2026](https://pypi.org/project/tree-sitter-php/) — MIT, грамматика.
18. [`dan-da/php2js`](https://github.com/dan-da/php2js) — 0.1.0, 2016, не поддерживается.
19. Коммерческие обзоры (VENDOR): [pixelmatters 2026-10-19](https://www.pixelmatters.com/insights/application-modernization-software),
    [catio 2026-09-30](https://www.catio.tech/blog/application-modernization-software),
    [augmentcode 2026-07-24](https://www.augmentcode.com/guides/ai-code-migration),
    [augmentcode tools-vs-loop](https://www.augmentcode.com/guides/code-migration-tools-vs-migration-loop),
    [hakunamatatatech COBOL](https://www.hakunamatatatech.com/our-resources/blog/cobol-to-java-conversion-tools).
    **Не являются** независимыми измерениями.
20. Рыночная логика (VENDOR): [nextgendigitalcraft](https://www.nextgendigitalcraft.com/migrations/php-to-nodejs-migration),
    [flyitsolution](https://flyitsolution.com/blog/php2shell-legacy-php-to-nodejs-migration-security-hardening/),
    [abbacustechnologies](https://www.abbacustechnologies.com/node-js-with-typescript-should-you-make-the-switch-in-2025/).

## 4. `NOT_INSPECTED` (не создаём видимость полного code review)

Не читались: приватные operation packs и forensic stderr/SQL/source MMP-104; закрытые reference
inputs, hidden G4 packs, expected outputs; исходный TS-кандидат run #41327197036; полные логи
CI-джобов (только статусы/check-runs); бинарные артефакты GitHub; содержимое
`packages/agent-real/src/meta-wire.mjs`, `meta-paid-authorization.mjs`, `migration-provider.mjs`
(полностью), `compiler-diagnostics.mjs`, `private-diagnostics.mjs`, `encrypt-diagnostics.mjs`,
`custody-*.mjs`, `github-meta-guard.mjs`, `source.mjs`, `proof.mjs`;
`packages/oracle/src/controls.ts`, `reference/evidence.ts`, `reference/mapping.ts`,
`reference/docker.ts` (строки 340–483), `reference/public.ts` (прочитан);
`packages/target-worker/src/controller.mjs` (строки 1–499, 560–659, 711–872),
`runtime-broker.mjs`, `runtime/launch.mjs`, `runtime/provenance.mjs`, `runtime/quota.mjs`;
`packages/differential/src/workshop-finalizer.mjs`, `workshop-controls.mjs`, `policy.mjs`,
`mapping.mjs` (прочитан частично через вызовы); `packages/oracle/probes/qualification.mjs`
(только `grep` по clock/faketime); `research/mmp-078/**`, `research/mmp-089/**`,
`research/mmp-097/**`, `research/demo-readiness/**` (только упоминания); `specs/**` кроме
`specs/009-real-differential/interface-handoff.md:15-35`. Выводов по ним нет.

Также **не выполнялись**: `pnpm install/lint/typecheck/test/build`, `node research/mmp-069/validate.mjs`
и `check-syntax.mjs` (нет `node_modules`: `ERR_MODULE_NOT_FOUND: yaml`) — оба **`NOT_RUN`**,
Docker, любой
`workflow_dispatch`, Meta GET/POST, загрузка/восстановление артефактов, исполнение candidate TS
на хосте. Все локальные проверки — чтение файлов, `git log/show/cat-file`, `grep`, `git
ls-remote`, `gh api` (read-only) и `web_search`/`fetch_page`.
