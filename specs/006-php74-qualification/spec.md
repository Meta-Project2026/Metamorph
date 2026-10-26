# MMP-005 — real PHP 7.4 qualification

Owner: Ilia. Issue #7. Branch: `feat/mmp-005-php74-qualification` from
`4dbd38e4d9853afd3f81115a9fd8a18308f16f98`. No benchmark registration or TS migration.

First execute pinned ExamSuite in a bounded disposable PHP 7.4.33 container.
Read its exact license and hash the source archive. Record actual image identity,
extensions, syntax/init/boot and SQLite runtime. Execute two independent clean-DB
replays of each public scenario: intake/pack/exam/empty-answer grading/export,
rejected intake followed by reads, and a new clean-state intake/read.

Keep raw bodies, upstream questions/answers and typed before/after DB snapshots
private in ephemeral scratch. Publish only allowlisted structural results and
hashes. Compare exact replay hashes without deleting UUID/time/random fields.
GO requires stable behavior or independently approved scoped invariants; boot
alone is insufficient. Report proven NO-GO or infrastructure BLOCKED honestly.

Use a separate same-repo/exact-branch PR workflow for the first authorized remote
execution if local Docker is absent, then remove its temporary PR trigger.
Preserve existing Fast CI, Oracle semantics, contracts and agent/integration code.
Run frozen install/lint/typecheck/tests/build; deliver an unmerged PR with Refs #7.
