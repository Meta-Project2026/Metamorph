# Карточка владельца — MMP-094

**Сейчас: NO_GO_PENDING_PARITY_RETENTION_DECISION. Согласие на новый POST не дано.**
Карточка подготовлена для последующего отдельного решения; она не разрешает
dispatch, `validate_only`, повтор старого workflow или расход.

| Привязка | Проверенное значение |
| --- | --- |
| main / audit HEAD | `53b4d5a1da99e49a223fa9cafe03ff24b280bf86` |
| request SHA256 | `55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d` |
| context SHA256 | `21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345` |
| PHP source commit | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` |
| source archive SHA256 | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4` |
| manifest SHA256 | `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4` |
| recipe SHA256 | `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3` |

При будущем отдельном согласии: **один manual dispatch** существующего
`meta-paid-migration.yml` на защищённом `main`, `reviewed_sha` точно равен
актуальному проверенному SHA; actor `barbalatv` или `l1ncolny`, run attempt1.
**Один POST `muse-spark-1.3` Standard**, `reasoning_effort=low` именно для
API-модели; ноль retries, failovers, reruns и automatic repairs. Ранее данное
«всё подтверждаю» о ключе/политике/merge #93 не разрешает этот POST.

Лимиты: 22 762 serialized bytes; 16 384 completion tokens **включая reasoning**;
180 секунд запроса, 240 секунд сессии, ответ ≤2 MiB. Исходный prompt ≤128 KiB.
Проверка 65 536 input tokens происходит по usage **после** ответа и не защищает
от уже понесённой оплаты. Job timeout35 минут включает инфраструктуру/Oracle,
но не увеличивает лимит API-запроса. Состояние с неизвестной оплатой потребляет
единственную попытку; timeout после отправки может быть оплачиваемым.

Тариф проверен **2026-10-30T10:08:39Z** по публичной
[странице Meta](https://dev.meta.ai/docs/pricing-rate-limits): Standard USD/1M
tokens — input1.25, cached input0.15, output4.25. API effort `low` разрешён
[документацией reasoning](https://dev.meta.ai/docs/reasoning); это не effort
агента, выполняющего аудит. Policy expiration: **2026-11-05T00:00:00Z**,
на дату проверки не истёк. Перед любым разрешением тариф проверить заново.

Оценка без скидки cache:
`inputEstimate = 22762 × 4 + 32768 = 123816`;
`(123816 × 1.25 + 16384 × 4.25) / 1e6 = $0.224402`.
Предлагаемый для будущего решения `max_estimated_usd=0.25` — только сравнение
перед отправкой. **Не provider hard cap и не гарантия максимального списания.**
Default workflow равен1.00; будущий владелец должен явно выбрать согласованный
селектор. Точная токенизация/settlement неизвестны; `chargedCostUsd=null`.

Ожидаемая проверка после генерации: неизменённый Docker G1 → HTTP G2 → SQLite
G3 с отдельными состояниями reference/candidate. При G1 FAIL могут сохраниться
минимальные TS/compiler/manifest данные, зашифрованные только на recipient
`age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f`.
Один фиксированный `.age` загружается только после шифрования, проверенных
identity/receipt, нормальной очистки и независимого finalizer0/0/0. Public JSON
содержит структурные статусы/хеши и допустимые compiler codes/positions, без
исходника, compiler message/raw stdout/stderr или provider response.

Ciphertext artifact доступен читателям публичного репозитория семь дней;
это **не owner-only GitHub ACL**. Приватность зависит от секретности локального
age identity. В CI приватного ключа владельца нет. Локальная расшифровка
владельцем: **OWNER_DECRYPT_NOT_VERIFIED**; [безвредная инструкция](owner-key-roundtrip.md).

**Остаются блокеры:** при G1 PASS и G2/G3 FAIL исходник не экспортируется и
теряется после runner; выбор принять риск или отдельно разрешить минимальное
расширение не сделан. При G1 ERROR/timeout и all-public-PASS сохранения тоже нет.
Timeout #84 не устранён. Реальная загрузка ciphertext и owner-key roundtrip
не выполнялись. #61 OPEN, product NOT_ESTABLISHED, G0/G4 INCONCLUSIVE.

После любого сдвига main, включая docs-only merge этого PR: **STALE_SHA_NO_GO**
до повторного аудита точного нового main и обновления этой карточки. После
решения о retention и подтверждения ключа всё равно требуется новое отдельное
согласие владельца на один POST с точными identity. Сейчас
`OWNER_ONE_POST_PAID_AUTHORIZATION=NOT_GIVEN`, `PAID_SPEND=NO_GO`.
