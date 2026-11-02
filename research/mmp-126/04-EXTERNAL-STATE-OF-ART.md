# 04 — External state of the art (проверено 2026-11-02)

Правило: **не экстраполировать чужие pass rate на Metamorph.** У нас другая пара языков, другой
oracle (HTTP+SQLite+DDL text), другой бюджет (1 POST, 0 repair), другой размер атома. Колонка
«Применимость» = релевантность **именно PHP→TS под этот Oracle**, 0–5, по *методу*, а не по цифре.
Вес определяется качеством evidence: исполняемые скрытые проверки и no-change baseline → выше,
вендорные блоги → ниже. False balance не делается.

## 1. Обязательные источники промпта: доступность, содержание, применимость

| # | Источник | Статус / дата | Задача, языки, модели, выборка, метрика | Ограничения внешней валидности | Применимость |
| --- | --- | --- | --- | --- | --- |
| S1 | **RepoTransBench** — Wang Y. et al., *IEEE TSE* 52(2):675–690, Feb 2026, [doi:10.1109/TSE.2025.3645056](https://doi.org/10.1109/TSE.2025.3645056), [Monash](https://research.monash.edu/en/publications/repotransbench-a-real-world-multilingual-benchmark-for-repository/), [GitHub](https://github.com/DeepSoftwareAnalytics/RepoTransBench), [PDF](https://nzjohng.github.io/publications/papers/tse2026.pdf) | **Published, peer-reviewed** | 1 897 репозиториев, 13 направленных пар, 7 языков (C, C++, C#, Java, JavaScript, Python, Rust, Matlab); среднее 23 966 токенов / 2 394 LoC / 177 функций / 35 классов / 163 импорта; исполняемые тест-сьюты. RepoTransAgent (ReAct) + Claude/GPT-4.1/Qwen3/DeepSeek-Chat/Gemini. Лучший **SR 32.8%**, compilation 54.8%; `TranslationOnly` 0.0%, `ErrorFeedback` 11.3–15.6%. **Dynamic→static <10% vs static→dynamic 45–63%** | **Нет пары PHP→TS**. Репозиторий-уровень >> наш 484-строчный срез. SR = «compile + tests», а не HTTP/SQLite-дифференциальная parity. Авторский agent, собственные тесты | **3/5** — важен направлением dynamic→static и тем, что итерационный агент даёт +21.5 п.п. к error-feedback; цифру 32.8% на наш проект переносить нельзя |
| S2 | **Code–Test Co-translation (CoTTrans)** — Li X., Xie X., Wu J., Liu T., Wang H., *PACMPL* 10(OOPSLA2), Art. 358, pp. 1217–1244, 01 Oct 2026, [doi:10.1145/3839490](https://doi.org/10.1145/3839490), [SPLASH](https://2026.splashcon.org/details/oopsla-2026/116/Code-Test-Co-Translation-Towards-Practical-and-Effective-Program-Migration-in-the-Wi) | **Published** (accepted 10 Jun 2026), артефакт [figshare](https://doi.org/10.6084/m9.figshare.33235821.v2) | CTCT: совместный перевод кода **и тестов**; метрика TCC (Test Case Consistency); итеративный translation–repair с adaptive backtracking при «state degradation / poor initialization traps». BigCodeBench, DeepSeek-V3: correctness **0.360 → 0.675** | Python-центричный BigCodeBench, не PHP; нет SQL/HTTP state; метрика TCC требует переведённых тестов, которых у нас нет (held-out закрыт) | **4/5** по методу: прямое доказательство пользы co-evolution + repair + backtracking; реализация в нашем контуре требует отдельного решения по G4 |
| S3 | **CODEMENV** — Cheng K. et al., *Findings of ACL 2025*, pp. 2719–2744, Vienna, [doi:10.18653/v1/2025.findings-acl.140](https://doi.org/10.18653/v1/2025.findings-acl.140), [ACL Anthology](https://aclanthology.org/2025.findings-acl.140/), [arXiv:2506.00894](https://arxiv.org/html/2506.00894) | **Published** | 922 примера, 19 Python/Java пакетов; 3 задачи (локализация несовместимых функций → описание изменения → адаптация кода); 7 (в абстракте) / 9 (в тексте) LLM; средний **pass@1 26.50%**, GPT-4o **43.84%** (Old2New easy), New2Old hard ~12.77% | **Кросс-ВЕРСИОННАЯ миграция внутри языка, а не PHP→TS** (промпт это прямо оговаривает). Oracle — 3 тест-кейса на пример; Confounded Old2New/New2Old; Python/Java только | **2/5** — полезен фактом «локализация ≠ миграция» (GPT-3.5 локализует 66.32%, мигрирует 7.32%) и асимметрией направлений; не бенчмарк для нашего scope |
| S4 | **A Direction-Aware Study … Across Eight Programming Languages** — Wang Q. et al., *ESEM 2026*, LIPIcs 394, 63:1–63:14, published **2026-10-05**, [doi:10.4230/LIPIcs.ESEM.2026.63](https://doi.org/10.4230/LIPIcs.ESEM.2026.63), [Dagstuhl](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESEM.2026.63), [artifact Zenodo](https://zenodo.org/records/20456638) | **Published, Emerging Results / preliminary** | 100 задач × 8 языков = **56 направленных пар**, 5 LLM, execution-based, **pass@5**; разворот пары меняет успех до **27.4 п.п.**; Python3/Java лучше как source, **JavaScript/Rust/Go лучше как target** | Авторы сами называют результаты preliminary и отказываются от «definitive model ranking»; PHP в выборке нет; pass@5, а у нас pass@1; алгоритмические задачи, не веб-сервисы | **3/5** — поддерживает «не усредняй направления» и гипотезу, что JS/TS-цель относительно благоприятна; не доказывает PHP→TS |
| S5 | **CodeTransBenchmark** — Kowalczuk V., Weißl O., Kacianka S., Stocco A., [arXiv:2609.20257](https://arxiv.org/abs/2609.20257), [HTML](https://arxiv.org/html/2609.20257) | **Preprint** (v1, страница abs: «Submitted on 28 Jul 2026»; ID `2609.*` расходится с датой; на [странице автора](https://tsigalko18.github.io/publications/) значится *Empirical Software Engineering* 2026 — статус **AMBIGUOUS**, рецензирование не подтверждено) | 8 open-source LLM (локальные/квантованные), 3 датасета, 12 языковых пар, **67 071 перевод**, **15 182 регенерации**; post-processing извлечения кода из «inconsistent LLM outputs»; **итеративный repair по automated feedback значимо улучшает точность**; большинство general-purpose моделей ошибаются в синтаксисе target-языка; нужен больший context window | Preprint; фокус на self-contained snippets и open-source моделях; нет PHP→TS, нет stateful HTTP/SQLite; нет криптографических receipts | **3/5** — подтверждает ценность output-discipline + bounded repair и роль prompt/post-processing; НЕ источник pass rate для Metamorph |
| S6 | **When Modernization Breaks Working Code: A Single-File Study of LLMs on Legacy PHP** — Mahmud A. et al., [arXiv:2610.40269](https://arxiv.org/abs/2610.40269), [HTML](https://arxiv.org/html/2610.40269), 29 Oct 2026, 6 стр. | **Preprint** (за 3 дня до отсечения) | **PHP→PHP** модернизация (WordPress 4.0 → PHP 8.3), 5 LLM × 100 файлов, **630 скрытых behavioral checks**, 511 Rector-findings, **no-change baseline**. Нет проектного контекста и execution feedback. Нетронутые: 83/100 проходят; лучший LLM — **59**; LLM ломают **32–51** рабочих файлов, чинят ≤10; **Rector: 82**, ломает 7, чинит 6. Только 37 находок (7%) реально требуют изменения; в совместимых файлах LLM ломают **36–60%** (Rector 8%). Регрессии в основном «файл вообще не загружается» из-за type declarations | **Не PHP→TS** (промпт это оговаривает). Один репозиторий, purposive sample, 100 файлов, возможное попадание в обучающую выборку, вариативность провайдера. Preprint, 6 страниц | **4/5** — **главный источник, противоречащий оптимистичному тезису об автоматизации**. Даёт методологический императив: измерять против no-change baseline и разделять «модернизацию» и «сохранение поведения». Это ровно то, чего не хватает большинству AI-демо, и аргумент в пользу G0–G4/evidence-first |

## 2. Найдено независимо: верифицированный перевод, repair, декомпозиция

| # | Источник | Что измерено | Ограничения | Применимость |
| --- | --- | --- | --- | --- |
| S7 | **Oxidizer** — Zhang H., David C., Wang M., Paulsen B., Kroening D., *PACMPL* 9(PLDI), Art. 212, June 2025, [doi:10.1145/3729315](https://doi.org/10.1145/3729315), [PDF](https://mengwangoxf.github.io/Papers/PLDI25.pdf) | **Go→Rust**, 8 open-source проектов, крупнейший 9.7K LoC / 780 функций. Разбиение на фрагменты по **post-order dependency graph**, I/O-equivalence validation на execution snapshots, **feature mapping rules** + **type compatibility checks**. Среднее **73% функций валидировано по I/O-эквивалентности**; без runtime errors; оба механизма критичны по абляции (есть таблицы `Full / No Type Check / No Feature Map`) | Go stdlib-only, без внешних зависимостей; 73% — не 100%; Rust-специфичные типы; нет HTTP/SQLite; проект level >> наш | **5/5 по методу** — **главный источник конкретной пользы современных методов**: декомпозиция + детерминированные правила отображения + проверка типов + I/O oracle. Но для нашего атома это *резерв*, а не первый шаг |
| S8 | **AlphaTrans** — [PDF](https://alirezai.cs.illinois.edu/assets/pdf/alphatrans.pdf) | Neuro-symbolic, Java→Python, фрагменты (field/method) в **reverse call order**, переводит **и код, и тесты**, многоуровневая валидация (GraalVM). **27.03% runtime validation, 25.14% functional equivalence**, ~34 ч на перевод; люди доводили до passing test suites за ~20.1 ч | Другая пара, умеренная open-модель (DeepSeek-Coder-33b), часы вычислений, низкий абсолютный результат | **3/5** — подтверждает, что декомпозиция без humans даёт частичный результат, а human review становится узким местом |
| S9 | **RustRepoTrans** — Ou et al., [arXiv:2411.13990](https://arxiv.org/html/2411.13990v1), [v5](https://arxiv.org/html/2411.13990v5) | 375 repository-level задач C/Java/Python→Rust, 4 LLM; Claude-3.5 **43.5% Pass@1**; **94.8% неудач = compile errors**; **77.9% ошибок = «не понял разницу между языками»** (semantic drift), 18.5% — фичи target | Другая пара; compile-centric; падение 74.3%→43.5% при добавлении репозиторного контекста | **3/5** — количественно подтверждает тезис MMP-120 §5: главный риск — *неявная семантика исходного рантайма*, а не синтаксис |
| S10 | **K³Trans** — [arXiv:2503.18305](https://arxiv.org/html/2503.18305) | Три эволюционирующих базы знаний (примеры зависимостей, target-сэмплы, успешные пары перевода) на RustRepoTrans; до self-debugging compilation errors 79.3% против 94.8% у базовой LLM | Тот же бенчмарк; знание-base нужно строить | **3/5** — аргумент за «source-aware prompt» (вариант C), но требует инфраструктуры, которой у нас нет |
| S11 | **Migrating Code At Scale With LLMs At Google** — Ziftci et al., [arXiv:2504.09691](https://arxiv.org/pdf/2504.09691) | 39 внутренних миграций, 12 мес., 3 разработчика, **595 code changes / 93 574 edits**; LLM сгенерировала **74.45%** изменений и **69.46%** правок; оценка экономии времени **~50%**; **human review стал rate limiter** | В основном **identifier 32→64-bit**, а не кросс-языковой перевод; внутренняя модель/инфраструктура; субъективная оценка времени; валидация + обязательный human acceptance | **3/5** — продуктовый аргумент: ценность в валидации и review-gates, а не в «магическом переводе»; ровно позиционирование G |
| S12 | **Agentic Method for Deterministic Validation of Legacy Code Migration** — [alphaXiv 2607.28271](https://www.alphaxiv.org/abs/2607.28271) | COBOL→Java, **Parity Gate** как детерминированный differential oracle с «behavioral fingerprint»; witness search 110/142 → 135/142 параграфов (95.1%), 397/432 ветвей; **166/166** тестов прошли parity | Preprint/обзор; COBOL; охват ≠ полнота; «broken-as-usual» поведения намеренно сохраняются | **4/5** — близкая идеология к Metamorph G2/G3: сохранять даже странное поведение, сравнивать наблюдаемое |
| S13 | **Metamorphic Testing of Transpilers via Mutation Consistency of Programs (MCP)** — [arXiv:2607.29247](https://arxiv.org/html/2607.29247), [review](https://pith.science/paper/2607.29247) | Метаморфические отношения над **сгенерированным исходным кодом** (а не рантаймом): 9 relations, ловят «silent miscompilation» — компилируемый, но неверный вывод; дифференциальное тестирование требует нескольких реализаций, чего обычно нет | Preprint; checkers пишутся вручную и могут кодировать конвенции реализации, а не семантику (см. рецензию); DSL→C | **4/5** — прямо указывает на слабое место «compiler PASS ≠ parity» и на ценность negative/mutation controls, которые у нас уже есть (MMP-104/MMP-108) |

## 3. PHP → JS/TS инструменты и PHP-AST экосистема (поисковые направления, НЕ одобренные решения)

| Инструмент | Версия / лицензия / зрелость | Реальная способность | Вердикт для Metamorph |
| --- | --- | --- | --- |
| [`glayzzle/php-parser`](https://github.com/glayzzle/php-parser) (npm `php-parser`) | 3.2.2 / 3.7.0, **BSD-3-Clause**, ~22 449 загрузок/нед., поддержка php5/php7/php8 | **Только AST/токены** (`parseCode`, `parseEval`, `tokenGetAll`), `withPositions`. Кодогенерации и семантики нет | Годен для тонкого *inventarization* слоя (11 функций/5 routes уже зафиксированы в `inventory.json` вручную), не даёт PHP-семантики. Новые зависимости не вводить |
| [`uniter/phptojs`](https://www.npmjs.com/package/phptojs) + [`asmblah/uniter`](https://www.npmjs.com/package/uniter) | `phptojs` 10.2.0/10.3.2, `uniter` 2.19.1, **MIT**, обновлялись 2025–2026 | PHP→JS **transpiler + runtime** в браузере/Node; [LiveCodes](https://livecodes.io/docs/languages/php/) прямо: «**only a small subset of PHP's standard library is supported**», для полной совместимости советуют `php-wasm` | **Не решает**: нет PDO/`node:sqlite`, `$_GET/$_POST`, `date_default_timezone_set`, `json_encode`-совместимости, `BEGIN IMMEDIATE`. Эмиссия JS-рантайма, а не самостоятельного TS-сервиса |
| Rector ([rectorphp/rector](https://github.com/rectorphp/rector)) | активен, 300+ правил, `nikic/PHP-Parser` AST, `withPhpSets(php81…php85)`, `--dry-run` | **PHP→PHP** рефакторинг/апгрейд; детерминированные codemods | Косвенно незаменим как **baseline** (S6 показал 82/100 против 59 у лучшего LLM), но не PHP→TS. Аргумент за «не доверять LLM то, что делает правило» |
| [`tree-sitter/tree-sitter-php`](https://github.com/tree-sitter/tree-sitter-php) | v0.25.1 (Oct 2026), **MIT**, 234 ★ | Грамматика / concrete syntax tree, инкрементальный парсинг | Только разбор; ни семантики, ни кодогенерации |
| [`dan-da/php2js`](https://github.com/dan-da/php2js) | 0.1.0 (2016), требует PHP 5.5 + PHC + SpiderMonkey | «**has not been maintained for years** … translation will never be 100%» | Мёртв; не рассматривать |
| `babel-preset-php`, `php-wasm` | нишевые | Подмножество PHP в браузере / WASM-интерпретатор PHP | Противоречит цели (нужен автономный TS-сервис, «no proxy to PHP») |

**Вывод:** зрелого общего **PHP→TypeScript семантического транспайлера нет**. Гибридный
symbolic+LLM слой (вариант F) пришлось бы писать с нуля под 484 строки конкретного исходника —
это не «короткий путь» и не оправдано до устранения контрактного разрыва.

## 4. Коммерческие/исследовательские системы и их ограничения

| Продукт | Что делает | Ограничение | Источник |
| --- | --- | --- | --- |
| **AWS Transform** (mainframe/.NET/custom) | COBOL/copybooks/JCL/DB2/CICS → Java; .NET Framework → cross-platform .NET; GA с мая 2025, refactor в 18 регионах с марта 2026; custom agent **$0.035/agent-min**, ориентир ~$2.52 за 17 000 строк Java; Thomson Reuters 1.5M строк/мес. | Привязка к AWS; валидация тестами, **не криптографические receipts**; PHP→TS нет | [pixelmatters 2026-10-19](https://www.pixelmatters.com/insights/application-modernization-software) |
| **IBM watsonx Code Assistant for Z** | COBOL/PL/I → Java, 7-stage workflow со стадией **Validate** (semantic equivalence), автогенерируемые unit tests, interop с CICS/IMS/Db2 | Mainframe-only, «selective refactoring, not whole-app», тяжёлый human review | [pixelmatters](https://www.pixelmatters.com/insights/application-modernization-software), [catio](https://www.catio.tech/blog/application-modernization-software) |
| **GitHub Copilot App Modernization** | Java 8→25 / Java EE→Jakarta EE 10, .NET, C++; **human review каждого diff** | Апгрейды внутри стека, не кросс-языковой перевод; нет независимого Oracle | [pixelmatters](https://www.pixelmatters.com/insights/application-modernization-software) |
| **Moderne / OpenRewrite, Google Rosie** | LST/AST-рецепты, шардирование больших изменений на независимо review-емые юниты | Детерминированные правила; не LLM-семантика | [augmentcode 2026-07-24](https://www.augmentcode.com/guides/code-migration-tools-vs-migration-loop) |
| **SoftwareMining / TSRI / Raincode / CoJaC** | COBOL→Java, 95–99% автоматизации на синтаксическом уровне, функциональная верификация | Другая пара; «структурно похожий» вывод; человеческая доводка | [hakunamatatatech](https://www.hakunamatatatech.com/our-resources/blog/cobol-to-java-conversion-tools) |

Общее: рынок продаёт **«agentic loop + validate/fail/retry + human review»**, а не «one-shot
магический переводчик». Публично заявленный «automation ceiling» 70–97% scoped files с длинным
хвостом сложных файлов ([augmentcode](https://www.augmentcode.com/guides/code-migration-tools-vs-migration-loop),
вендорный источник — вес низкий) согласуется с S11 и S6, но **не является независимым измерением**.

## 5. Зачем вообще TS: рыночная логика (низкий вес evidence)

Причины, которые называют практики: дефицит PHP-кадров, общий код backend/frontend/mobile,
единый язык и ускорение code review за счёт статических типов, современный AI/serverless/edge
tooling, не устраивающая модель масштабирования PHP-FPM, **EOL/security давление на PHP 7.4**
([nextgendigitalcraft](https://www.nextgendigitalcraft.com/migrations/php-to-nodejs-migration),
[flyitsolution](https://flyitsolution.com/blog/php2shell-legacy-php-to-nodejs-migration-security-hardening/),
[abbacustechnologies](https://www.abbacustechnologies.com/node-js-with-typescript-should-you-make-the-switch-in-2025/)).
Контрargument того же источника: «**If your stack works and your team is happy, stay**»; миграция
оправдана только при реальной боли. Все перечисленные — **вендорные блоги/маркетинг**, не
первичные исследования; использовать только как контекст, не как доказательство.

## 6. Продуктовая развилка и конкурентное преимущество

- Продавать «универсальный автоматический PHP→TS переводчик» — **плохая позиция**: S1 (32.8% на
  repo-level), S6 (LLM ломает 32–51 рабочих файлов из 100), S9 (77.9% ошибок от непонимания
  разницы языков) и собственные 0 успехов в 4 зафиксированных AI-прогонах это опровергают; конкуренты (AWS/IBM/GitHub) уже
  занимают «agentic modernization».
- Продавать **«verified / evidence-first migration»** — **сильная позиция**: у Metamorph есть то,
  чего нет у вендоров в публичном описании: независимый G0–G4 Oracle, HTTP+SQLite дифференциальная
  parity, замороженный clock, криптографическая custody кандидата, fail-closed различение
  `FAIL/ERROR/INCONCLUSIVE/NOT_RUN`, негативные контроли (MMP-104 nine faults, MMP-108 five
  controls), immutable receipts с SHA. S12 (Parity Gate) и S13 (MCP) показывают, что это
  **актуальное научное направление**, а не экзотика.
- Но ценность доказательства падает, если Oracle требует несообщённого контракта: тогда «verified»
  превращается в «verified against an undisclosed protocol», и независимый reviewer вправе
  отклонить результат. Поэтому **исправление справедливости контракта — не косметика, а условие
  существования продукта**.

## 7. Явный баланс без false balance

- **Источник против оптимизма:** S6 (arXiv:2610.40269) — самый сильный по дизайну
  (630 скрытых checks + no-change baseline + rule-based control), и он **непосредственно про PHP**,
  хотя и PHP→PHP. За ним S1 (peer-reviewed, repo-level 32.8%).
- **Источник за конкретную пользу современных методов:** S7 (Oxidizer, PLDI 2025, 73% I/O
  equivalence за счёт feature mapping + type checks + fragment decomposition) и S2 (CoTTrans,
  0.360→0.675). Оба — **исполняемые эксперименты с абляциями**, а не маркетинг.
- Вендорные обзоры (§4, §5) идут с минимальным весом и не участвуют в выводах `00`–`07`.
- Ни один из S1–S13 не измерял PHP→TypeScript с `node:sqlite` и HTTP/DDL-text Oracle ⇒ **ни одну
  цифру нельзя переносить на Metamorph**.
