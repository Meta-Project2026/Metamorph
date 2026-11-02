# 03 — PHP → TypeScript: инженерная осуществимость

Разбирается **конкретный** публичный MIT-исходник
`tanjilaafsarirubina/car-workshop@d272170d0aecbd28eb5b13e272d9dd11d545b66c`,
байты зафиксированы в `research/mmp-061/public-source.json` (`api.php` 11 956 B / 360 строк,
`config.php` 4 331 B / 124 строки), инвентарь — `research/mmp-061/inventory.json`.
Целевой контракт — `packages/agent-real/src/migration-context.mjs:25-46`. Admission —
`packages/target-worker/src/admission.mjs:8-40`: только `src/**/*.ts`, 1–64 файла, ≤256 KiB/файл,
≤1 MiB суммарно, обязательный `src/main.ts`, без `package.json`, без npm-зависимостей.

## 1. Ответ на главный вопрос

**Да, полный семантически эквивалентный (в объявленном scope) сервис существует в
Node 24.11.0 + TS 5.9.3 strict + `node:sqlite` при NodeNext/CommonJS emit.** Это не рассуждение,
а **constructive existence proof**: `packages/target-worker/fixtures/workshop/` (человеко/assistant-
написанный TS, 4813… см. ниже) даёт G1 6/6, G2 17/17, G3 20/20 в disposable Linux Docker
(MMP-108, `known-good-real-docker-first-step.json`, `RECEIPT_VERIFIED`). Также proof «почти»
дают 5 файлов GLM repair-кандидата (`0cf5ba0b…`, 37 269 B), которые компилируются и проходят
initial DB, но ломаются на скрытом контракте (`02`).

**Оговорка, которую нельзя терять:** прохождение 17/17 + 20/20 для **этого** MANIFEST
(3 сценария: `workshop-business` 6, `workshop-rejected` 5, `workshop-capacity` 6 HTTP-шагов;
20 = 17 post-step + 3 initial DB, `reference/manifest.ts:40-80`) — это **scoped parity на
публичном регистре из 17 запросов**, а не «весь PHP-сервис». Вне scope: UI (`index.php`,
`admin.php`, JS/CSS), MySQL-ветка `getDBConnection`, конкурентные гонки, unrestricted queries,
multipart-крайние случаи, DST/полночь, crash recovery (`reference/public.ts:48-51` явно
`crossLanguage/concurrency/clockAdvanceDst/crashRecovery: NOT_RUN`).

## 2. Все 11 функций и 5 API actions

Порядок = `orderedUnits` из `inventory.json` (`config.php` сначала, затем `api.php` по строкам),
ровно тот, что видит модель (`migration-context.mjs:83-96`).

| # | Функция / action | Побочные эффекты | Детерминированный адаптер? | Что требует contextual reasoning |
| --- | --- | --- | --- | --- |
| 1 | `defineSetting` (`config.php:9`) | `getenv`/defaults, `APP_TIMEZONE='Asia/Dhaka'`, `SQLITE_FILE` | Да: константы не нужны, `/state/target.sqlite` задан в `target.database` | PHP `define()`/`getenv` в долгоживущем Node-процессе — заменить статикой; MySQL-ветка мертва |
| 2 | `getDBConnection` (`config.php:31`) | один static PDO, `initSQLiteTables` + `ensureSeeded` при открытии, `die(json)` при ошибке | Да: `new DatabaseSync('/state/target.sqlite')` **один раз** до `listen` (`target.startup`) | Открытие на каждый запрос ломает G3-непрерывность; PHP `die()` → HTTP 200 JSON |
| 3 | `initSQLiteTables` (`config.php:79`) | `CREATE TABLE IF NOT EXISTS mechanics/appointments`, `AUTOINCREMENT`, FK `ON DELETE CASCADE`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP` | **Да, но с оговоркой**: DDL воспроизводится текстуально | `compareSqlite` (`sqlite.ts:220`) сравнивает **текст DDL** из `sqlite_schema.sql` и наличие `sqlite_sequence` → «Preserve original schema SQL» должно быть буквальным, включая пробелы/переносы. Это overconstraint (см. §4) |
| 4 | `ensureSeeded` (`config.php:105`) | 5 механиков (id 1–5, точные имена/телефоны/`max_daily_slots=4`) если count=0; `catch(Exception){}` | Да: точные значения видны в исходнике | Тихая обработка ошибок сидинга должна сохраняться; `created_at` = замороженное время |
| 5 | `isValidDate` (`api.php:30`) | `preg_match('/\d{4}-\d{2}-\d{2}/')` + `checkdate()` | Формат — да; **реальный календарь — нет** (PHP-знание) | Regex-only реализация примет `2026-02-30`. `phpcompat.ts:88` GLM явно реализует Gregorian 1–32767 |
| 6 | `beginBookingLock` (`api.php:43`) | `BEGIN IMMEDIATE` (sqlite) до первого чтения; early `exit` закрывает PDO ⇒ rollback | Механика — да | **Главный контекстный переход**: у Node соединение живёт между запросами; каждый ранний выход после лока (механик не найден, дубликат, ёмкость) и успех должны явно `COMMIT`/`ROLLBACK`, иначе транзакция зависнет и внешний read-only snapshot не увидит строк. GLM реализует `rollbackBooking` (`api.ts:172-180`) |
| 7 | `getSlots` (`api.php:52`) | `$_GET['date']`, `trim`, default/invalid → `date('Y-m-d')`; `COUNT(*)`; `max(0, …)`; `is_full`; 8 ключей в фиксированном порядке | Почти всё — да | `date('Y-m-d')` в Asia/Dhaka; `(int)` касты; bool как JSON bool. В пинах все даты 2099 → «today» инертно |
| 8 | `book` / `bookAppointment` (`api.php:91`) | POST-only; 7 полей; 7 проверок в фиксированном порядке; `implode(' ', $errors)`; лок; проверка механика; дубликат `DUPLICATE_CLIENT`; ёмкость `MECHANIC_FULL`; `INSERT`; `lastInsertId()`; 3 сообщения с `date('F j, Y', strtotime($date))` | Валидации/SQL/ключи — да | Три PHP-runtime факта: **`PDO::lastInsertId()` возвращает строку** → `"appointment_id":"1"` (иначе `HTTP_JSON_TYPE`); `empty('0')===true`; ошибки = **HTTP 200** + `success:false`. GLM: `api.ts:330-351` явно `String(insertId)` |
| 9 | `getAppointments` (`api.php:203`) | `$_GET`: `search`,`date`,`mechanic_id`; `LIKE '%term%'` по 4 колонкам; `ORDER BY appointment_date DESC, id DESC`; `a.*` + 2 aliased поля | Да (SQL идентичен в `node:sqlite`) | `a.*` включает `created_at`; пропуск/переименование → `HTTP_JSON_MISSING`. LIKE case-insensitivity движковая, одинакова |
| 10 | `update_appointment` / `updateAppointment` (`api.php:248`) | POST-only; `(int) id/mechanic_id`; «Invalid parameters provided.»; past-date; лок; 2 existence-чека; дубликат **исключает собственный id** и использует `phone/license` сохранённой строки; ёмкость исключает себя; `UPDATE`; сообщение с **сырой** `$new_date` | Да | Разница «сырая дата в сообщении» vs `date('F j, Y')` в `book` — легко перепутать; early-exit rollback (см. #6) |
| 11 | `cancel_appointment` / `cancelAppointment` (`api.php:339`) | POST-only; `(int) id`; `DELETE FROM appointments WHERE id=?`; success даже при 0 затронутых строк | Да | PHP `execute()` возвращает `true` при 0 rows → сообщение об успехе; в `DatabaseSync.run()` надо смотреть `changes===0` но **не** менять ответ |

Диспетчер (`api.php:1-28`): `$action` из `$_GET['action']` **или** `$_POST['action']` (GET имеет
приоритет), `trim`, `switch` по 5 actions, `default` → `{"success":false,"message":"Invalid action"}`,
заголовок `Content-Type: application/json; charset=utf-8` всегда, `require_once config.php`.

**5 actions:** `get_slots` (GET), `book` (POST), `get_appointments` (GET),
`update_appointment` (POST), `cancel_appointment` (POST). `inventory.json:apiActions`,
`migration-context.mjs:92`, `MANIFEST` (`reference/manifest.ts:28-38`).

## 3. Детерминированные адаптеры vs реальная семантика

| Явление | Реализуемо адаптером? | Конкретика / counterexample |
| --- | --- | --- |
| `empty('0')` | Да | `s === "" || s === "0"`; GLM `phpcompat.ts:26`, fixture `main.ts:30` |
| `(int)` leading-numeric | Да | `phpInt("12abc")=12`, `phpInt("abc")=0`; `Uint8Array` из `node:sqlite` → UTF-8 decode → leading numeric; именно здесь был `TS2345` GLM |
| `trim()` | Да | только ASCII `space,\t,\n,\r,\0,\v` (fixture `main.ts:20-28`) |
| `$_GET` vs `$_POST` | Да | `URL`/`URLSearchParams`; GET-action приоритетнее POST-action |
| HTTP-200 error bodies | Да | `php` никогда не меняет status в этих ветках; `res.statusCode=200` + JSON |
| `date('F j, Y')` | Да | `Intl.DateTimeFormat('en-US', {timeZone:'Asia/Dhaka', month:'long', day:'numeric', year:'numeric'})` → «June 15, 2099» без ведущего нуля (fixture `main.ts:46-53`) |
| Asia/Dhaka `today` | Да | frozen clock; `Intl` с `timeZone`; PHP `date_default_timezone_set` перекрывает `TZ=UTC` |
| `lastInsertId()` string | Да | `String(Number(lastInsertRowid))` |
| JSON escaping / key order | **Частично** | `http.ts:159-168` сортирует ключи при `jsonDiff` → **порядок ключей НЕ сравнивается**; `\/` vs `/` после `JSON.parse` равны. Но **тип** сравнивается (`HTTP_JSON_TYPE`), длина массивов, вложенность |
| DDL / transactions / `sqlite_sequence` | Да, но текстуально | `sqlite.ts:75-85,220`; G3 initial у GLM repair совпал → адаптер работает |
| `checkdate`, `strtotime`, `BEGIN IMMEDIATE`+exit-rollback | Контекст | Требует знания PHP-рантайма и перемоделирования жизненного цикла соединения |

**Неустранимых противоречий между оригиналом и целевым окружением не доказано.**
Минимальные контрпримеры на каждое «противоречие» не найдены: (a) «PHP superglobals
невыразимы» — выражаются `URL`+`URLSearchParams`; (b) «`node:sqlite` не даёт строковый
lastInsertId» — даёт bigint, `String()` решает; (c) «PHP `exit` ломает долгоживущий сервер» —
заменяется явным `COMMIT/ROLLBACK` + `res.end()`; (d) «`CURRENT_TIMESTAMP` недетерминирован» —
заморожен libfaketime; (e) «FK включены по-разному» — в scope недостижимо нарушение
(`source-to-prompt-audit.md` §5, последняя строка). Единственное **непреодолимое без изменения
контракта** препятствие — не семантика PHP, а **несообщённое требование harness**
`x-request-id` (см. `02`): оно не выводимо ни из PHP, ни из `target`, ни из модели DSL.

## 4. Где Oracle сравнивает наблюдение, а где — лишнюю деталь

| Слой | Что сравнивается | Наблюдаемое поведение продукта? | Вердикт |
| --- | --- | --- | --- |
| `http.ts:183-187` | status + 4 `STABLE_HEADERS` (`content-type`, `location`, `cache-control`, `allow`) **exact string** | Частично | `content-type` без `; charset=utf-8` семантически валиден, но даст `HTTP_HEADER`. Ужесточение, не ошибка, но хрупкое |
| `http.ts:189-200` | JSON → распарсенные значения, типы, длины; не-JSON → побайтно | Да (плюс защита от lossy parse) | Хорошо: key order/escaping не сравниваются |
| `http.ts:39-56,65-101` | **валидация наблюдения бросает исключение** | Нет | Классификационный дефект: сбой превращается в `ERROR`, а не в `FAIL` с кодом. См. H3 |
| `sqlite.ts:220` | `JSON.stringify(schema)` — **текст DDL**, `sqlite_sequence`, `created_at` как текст | **Нет, внутренняя деталь** | Overconstraint: продукт видит строки, а не `sqlite_schema.sql`. Требует «Preserve original schema SQL» буквально; не из модели, а из verifier |
| `sqlite.ts:222` | типизированные строки, отсортированные по PK | Да | Корректно |
| `controller.mjs:688`, `mapping.mjs:22` | `x-request-id` echo | **Нет** | Искусственное требование service identity, отсутствующее в PHP и в модельном контексте. Главный дефект справедливости benchmark |
| `reference/docker.ts:198-205` | php 7.4.33 / sqlite 3.34.1 / `phpUtc==sqliteUtc==SOURCE.clock` / libfaketime `0.9.8-9` | Нет (инфраструктура) | Контроль детерминизма, но жёстко привязан к образу |
| `runtime/profile.mjs:31-82` | точная ASCII-грамматика path/query, whitelist полей формы, `form.toString()===body`, UTF-8 fatal | Частично | Сужение входного языка; разумно для безопасности, но «непредусмотренная семантика» для модели |

**Реальный контракт продукта:** 5 routes, HTTP 200 + JSON, состояние SQLite после каждого шага,
замороженное время Asia/Dhaka. **Искусственные overconstraints:** дословный DDL-текст,
точная строка `content-type`, echo `x-request-id`, а также (потенциально) `HTTP_JSON_TYPE` для
`appointment_id` — хотя последнее всё же наблюдаемо клиентом и потому справедливо.

## 5. Может ли frozen reference быть nondeterministic?

| Источник | Как контролируется | Риск |
| --- | --- | --- |
| TZ | `config.php` → `Asia/Dhaka`; worker → `TZ=UTC` + libfaketime; `SOURCE.clock="2026-10-27 12:00:00"` (`reference/manifest.ts:13`); `docker.ts:20-26,281`; `controller.mjs:23-29` | Низкий, но **две разные версии libfaketime**: reference inspector ждёт `0.9.8-9` (`docker.ts:219`), target broker ждёт `0.9.10-2.1` (`runtime-broker.mjs:68`). Разные образы — допустимо, но требует проверки при смене базового образа |
| Clock / `CURRENT_TIMESTAMP` / `created_at` | `FAKETIME_DONT_FAKE_MONOTONIC=1`; `clock.mjs:4-29` семплирует Date/Date.now/`datetime('now')`/`CURRENT_TIMESTAMP`/монотонные часы; `validateTargetClock` | Низкий. `publicSummary` (`reference/public.ts:50`) помечает `clockAdvanceDst: NOT_RUN` |
| Seed / order / `sqlite_sequence` | `ensureSeeded` детерминирован; `snapshotSqlite` (`sqlite.ts:100-113`) сортирует по PK и full-row multiset | Низкий; `LIMIT 10001` + жёсткий лимит 10 000 строк |
| Locking / transactions / race | MANIFEST строго последователен; `public.ts:49` `concurrency: NOT_RUN` | Вне scope. Любая гонка двух `book` на последний слот не тестируется |
| HTTP multipart / Unicode | `requestPolicy` (`profile.mjs:67-81`) требует `form.toString()===body`, UTF-8 fatal, запрет control-char; `inspect.mjs:141` шлёт form-urlencoded | Низкий в пинах; GLM-кандидат дополнительно реализовал `parseMultipartFields` — лишняя, но harmless работа |
| JSON duplicate keys / precision | `parseJson` (`http.ts:69-99`) **отвергает**, `validateJson` — тоже | Намеренная fail-closed защита от «сравнения двух ошибок» |
| Окружение контейнера | `--network none`, `--read-only`, `--user 65534`, `--cpus 1`, `--memory 256m`, tmpfs (`docker.ts:27-57`) | Средний: 256 MiB / 1 CPU / 15 s operation / 30 s Oracle-operation при 17 шагах — реальный риск timeout, отделяемый телеметрией `SIGNAL_ABORTED` |

Практический вывод: **не обвинять AI в nondeterminism без контрольного прогона**. Нужны: (1) два
exact replay frozen reference без кандидата; (2) прогон known-good в том же окружении; (3) только
после этого — атрибуция. Всё это уже частично сделано в MMP-005/MMP-108.

## 6. Размер генерационного атома

- Один `MIGRATION_UNIT = "workshop-api"` (`migration-context.mjs:20`), один POST, `n:1`,
  `max_completion_tokens: 16384`, zero repairs (`meta-migration.mjs:74-91`, #116 policy).
- Тело запроса **22 762 UTF-8 байта**, SHA `55c7b844…` (`research/mmp-120/source-to-prompt-audit.md` §1,
  `prompt-proposals.md` baseline). Внутри: 2 PHP-файла verbatim, 11 `orderedUnits`, 5 routes,
  `target`, `scope`, developer-сообщение.
- Выход: `{"changes":[{path,content}…]}`, только `src/**/*.ts`. GLM repair = **5 файлов /
  37 269 байт / ~1 100 строк TS** на 484 строки PHP. Meta: 9 870 output tokens.

**Оценка:** это **не** «repository-level» по меркам RepoTransBench (там среднее 23 966 токенов,
2 394 LoC, 177 функций, 35 классов — см. `04`). 11 функций / 5 actions / 1 атом — крупный
относительно «one function per call», но **заведомо помещается в контекст** и, судя по GLM,
успешно порождается целиком. Риск «слишком крупный атом» есть (одна ошибка типа `TS2345` роняет
весь G1; executor-prefix даёт 1/6), но он **не является доказанным блокером**: он устраняется
одним repair, а не декомпозицией. Декомпозиция на 1–3 функции здесь скорее навредит (SQLite
схема, сидинг, транзакции, общий `db`-хендл, route-диспетчер — всё общее состояние).

## 7. Что именно доказывает known-good fixture — и чего не переносит

**Доказывает (constructive existence proof):** в точном pins-окружении существует TS-программа,
проходящая все 6 G1-ID, 17 HTTP и 20 DB сравнений при неизменном verifier; значит Oracle не
противоречив и не «всегда ERROR».

**НЕ переносится на AI-outputs:**
1. Fixture написан исполнителем, **знавшим внутренний контракт** (`main.ts:247` echo
   `x-request-id`, точный DDL в `src/schema.ts`) — модель этот контракт не получает и ей запрещено
   его читать (`task-card.md` §2).
2. Fixture не проходил через `admitDirectory` от модели, custody, encrypted retention и one-POST
   лимит; `licenceNotice`/provenance устроены иначе.
3. Fixture не доказывает `pass@1` ни для одной модели, не доказывает G0 (target independence в
   смысле «независимо сгенерировано»), G4, product acceptance.
4. `G4: INCONCLUSIVE / HELD_OUT_NOT_RUN` и у fixture тоже (`known-good-…json`) — 27 synthetic
   control IDs ≠ held-out.
5. Успех fixture на 17 фиксированных запросах не означает устойчивости к `2026-02-30`,
   `'0'`, Unicode, другому clock, multipart, конкурентным `book`.

## 8. Не смешивать цели (обязательная таксономия)

| Термин | Значение | Допустимо ли объявлять «G1/G2/G3 PASS» |
| --- | --- | --- |
| **Exact parity** | побайтовая/внутренняя идентичность (DDL text, wire-заголовки, ключи JSON) | Нет — это сверхконтракт; Metamorph его частично сравнивает в G3 |
| **Observable parity** | одинаковые status/наблюдаемые headers/parsed JSON/логическое состояние БД для данных входов | Да, это и есть G2/G3 |
| **Scoped parity** | observable parity на зафиксированном публичном MANIFEST (17/20), без UI/MySQL/конкурентности | Да, **только с явным указанием границ** |
| **one-shot pass@1** | один POST, ноль repair, полный G1 6/6 + G2 17/17 + G3 20/20 | Да — целевая метрика #61 |
| **repair-assisted pass** | тот же результат после ≥1 отдельно авторизованного repair | Да, но **отдельной метрикой**, не «pass@1»; цепочка draft→repair обязана быть в custody |
| **human-assisted migration** | человек/агент с доступом к внутренним контрактам/фикстурам | Да, но **не** AI-миграция; сюда относится known-good fixture |
| **Simplified demo** | урезанный scope, «вертикальный срез» 1 action / 1 scenario | **Запрещено** называть тем же G1/G2/G3 PASS: нужны отдельные ID, отдельный benchmark, отдельный receipt |

Запрещено объявлять упрощённый demo равным полному benchmark; запрещено повышать
`INCONCLUSIVE`/`ERROR` до `PASS`; запрещено «нормализовать» расхождения, чтобы скрыть FAIL.
