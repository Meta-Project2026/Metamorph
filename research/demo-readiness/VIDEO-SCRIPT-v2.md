# Metamorph: 3-minute video script v2 (judge-oriented)

This is a tighter alternative to [SUBMISSION.md](SUBMISSION.md), with the same
facts. Changes: a stronger hook, the failure journey shown as proof that the
Oracle works, no unexplained gate codes, a credibility shot of the real GitHub
Actions run, and a forward-looking close. About 360 words, roughly 2:35–3:00 at a
calm pace. Timing is a target and has not been rehearsed.

Setup: run `node research/demo-readiness/serve.mjs`. Open tab 1 at
`http://127.0.0.1:4171/latest.html` (not verified yet) and tab 2 at
`http://127.0.0.1:4171/`. Open tab 3 at
<https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137>. Use a
1440×900 window, hide bookmarks and notifications, and show no keys or private
paths.

| Time | Screen | Narration (English) |
| --- | --- | --- |
| 0:00–0:20 | Tab 1 hero, nothing loaded | "Every company has a PHP service nobody wants to touch. An AI model can rewrite it in TypeScript in minutes. But can you trust it? Code can compile, pass review, and still change behavior. Metamorph answers that with evidence, not confidence." |
| 0:20–0:45 | Tab 2, click through the pipeline stages | "Metamorph sends the PHP source to Meta's Muse Spark 1.3 through the Meta Model API and gets back a complete TypeScript project. Then an independent Oracle takes over. It builds the candidate in a disposable Docker sandbox, runs the original PHP app and the TypeScript version side by side, replays the same HTTP requests, and compares every response and the database state step by step." |
| 0:45–1:15 | Tab 2, **Load pinned public receipts**, then select C, E, F | "Getting here was hard. Our first real candidate did not compile. A later one compiled perfectly, and the Oracle caught it returning JSON values with the wrong types, the kind of bug a compiler and a quick review miss. Here the model attempted a repair from the Oracle's feedback, and the Oracle still said no. We keep every failure visible." |
| 1:15–1:50 | Tab 1, click **Verify pinned public evidence**, show gate strip | "On November fourth, a single Muse Spark response produced a migration that passed all of its public build, HTTP and database checks: six of six build and type checks, seventeen of seventeen HTTP comparisons, and twenty of twenty database-state comparisons, across three booking scenarios. One response, zero repairs, about six cents, estimated." |
| 1:50–2:15 | Expand identities, then switch to tab 3 for about 8 seconds | "Every verdict is tied to exact hashes: the PHP source, the candidate, the evaluator commit and the original public archive. Your browser re-checks those bytes before showing anything. And this is the real GitHub Actions run that produced it. Anyone can open it." |
| 2:15–2:35 | Tab 1, usage line | "Muse Spark is the engine that writes and repairs the code. Its structured output returns a complete, machine-checkable project in one response. Paid calls run only in a guarded workflow with a cost ceiling and no retries, and the API key never enters the sandbox." |
| 2:35–3:00 | Tab 1, product-acceptance panel, then repository URL | "We are honest about scope. This proves parity on our public scenarios. Next come hidden held-out tests and isolation checks on this exact candidate, which is why product acceptance still reads 'not established'. Metamorph: let AI do the migration, and let evidence decide. Clone the repo and verify it yourself in thirty seconds." |

## Fact sources

- Run G: [41856569137](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137),
  with 6/17/20 PASS, 1 response, 0 repairs and an estimated USD 0.05568625
  ([audit](../mmp-194/provenance.md)).
- C, the G1 build failure: run 40900698372. E, build PASS with an
  `HTTP_JSON_TYPE` failure: run 41505679809. F, a real repair that still failed:
  run 41726833705 ([viewer README](README.md)).
- Browser SHA-256 check: `track-g-adapter.mjs` uses WebCrypto against the pinned
  digest.
- Structured output: `response_format: json_schema` in
  `packages/agent-real/src/meta-migration.mjs`.
- Guarded workflow limits: `.github/workflows/meta-paid-migration.yml`.

Do not say that the repair succeeded, name the exact field or type in E, claim
full G0–G4 or product acceptance, or present the estimate as a charged cost.
