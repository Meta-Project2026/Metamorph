# Plan — MMP-002

Use `packages/oracle/`, Node's test runner and built-in `node:sqlite` (available on
the supported Node 22.13+/24 lines). Add only a workspace dependency on contracts;
no new third-party runtime dependencies. Read pinned source metadata via GitHub
API without executing PHP. Keep Spec Kit selection explicit and non-persisting:
`SPECIFY_FEATURE_DIRECTORY=specs/003-oracle`, `SPECIFY_FEATURE_NO_PERSIST=1`.

Implement the kernel, real SQLite controls, bounded asynchronous adapter runner,
and evidence writer. Adapters are trusted host-side brokers to externally isolated
workers, not candidate code loaded into the Oracle. This package does not launch
untrusted workers or claim isolation. Keep fixed comparison policy in Oracle code.
Use new evidence directories and fixed artifact filenames; no agent-supplied paths.

Then document static benchmark findings, missing isolation if applicable, and a
manual PHP probe recipe with fresh state, limits and exact pinned sources. Preserve
licenses upstream; do not vendor third-party PHP or its tests/expected answers.

Run existing fast commands plus executable controls/evidence, inspect diffs and
publish a feature PR with `Refs #2` if real PHP qualification remains NOT_RUN.
Do not merge. G0, hosted CI and full PHP parity remain separate evidence claims.
