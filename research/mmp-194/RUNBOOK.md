# MMP-194 operator flow

One command from repository root (Node 22.13+ or 24, no install/build needed):

```sh
node research/demo-readiness/serve.mjs
```

Expected: `Metamorph read-only demo: http://127.0.0.1:4171 — Ctrl+C to stop`.
Manually open the URL, follow **Open the latest recorded PHP → TypeScript proof**,
or use `http://127.0.0.1:4171/latest.html`. Stop with Ctrl+C. An occupied port
reports `DEMO_SERVER_ERROR`, exit 1; stop your previous viewer, not unrelated apps.
No GitHub, network, API key, provider, Docker or candidate code is needed.

For a 3–5 minute presentation, use the exact 3-minute English storyboard in
[SUBMISSION.md](../demo-readiness/SUBMISSION.md), then spend up to two minutes on
the JSON inspector and source identities. Timings are targets, not measured.
Before validation, expect `NOT_VERIFIED` and hidden result panels. After **Verify
pinned public evidence**, expect `PINNED_PUBLIC_SNAPSHOT`, G1/G2/G3 PASS,
aggregate G0/G4 INCONCLUSIVE. Product panel remains visible throughout:
G0_REAL_CANDIDATE NOT_RUN / G4 INCONCLUSIVE / PRODUCT NOT_ESTABLISHED.

Russian speaking notes: «Это сохранённые receipts, а не живой вызов. Один ответ
модели и один кандидат: 6 проверок сборки, 17 HTTP и 20 сравнений состояния с
явными PASS. G0 11+1 относится к другим синтетическим кандидатам; его нельзя
объединить с этим результатом. Полная приёмка продукта не установлена».

60-second no-network fallback: home → Evidence desk → **Load pinned public
receipts** → F (real generation/repair, G1 PASS, G2/G3 FAIL) → matrix/product.
Six A–F cards must appear. B is a scripted control, never genuine AI success.
Missing/invalid G clears its result fields and shows NOT_VERIFIED; A–F load
independently. If local A–F bytes are also missing, use this local runbook and
report the missing file; never reconstruct a positive result from prose.

PASS = explicit scoped pass; FAIL = proven executed failure; ERROR = environment/
harness failure; INCONCLUSIVE = insufficient evidence; NOT_RUN = unexecuted;
NOT_VERIFIED = local bytes unvalidated; PINNED_PUBLIC_SNAPSHOT = reviewed byte
identity, not rerun/custody attestation. G3 includes HTTP and typed SQLite state.
See [provenance.md](provenance.md) for exact IDs, hashes, limits and unknowns.

Human timed rehearsal, physical disconnected-laptop test and screen-reader audit
remain NOT_RUN unless separately recorded. No fake typing, live progress or
invented repair should be added. Independent exact-head review remains pending.
