# MMP-004 implementation plan

Add `packages/integration` importing public Agent/Oracle/Contracts exports.
Keep Comparator, controls and runner solely in Oracle; do not edit their APIs.
Use original trusted loopback HTTP fixtures and separate real SQLite files.
Exact two-comment parser selects behavior without loading candidate code.

Verifier fixes the public corpus, validates current dedicated candidate source,
provisions new adapters, invokes real verifyPair, checks pack/files/journal and
coverage, rechecks candidate revision, and records private attempt metadata.
Sanitize model feedback and event findings; private GateResults stay in private
temporary artifacts. Final manifest links attempts and overall INCONCLUSIVE.

Cancellation stops admission and acceptance; combine operation signals for trusted
fetches and drain outstanding verification in demo. Existing Oracle operation and
cleanup timeouts are bounded async waits, not a new process-kill guarantee.
See package README for exact limitations and isolated-worker follow-up gate.

Use existing Node test runner, TypeScript and Biome; no new external dependency.
Root typecheck builds dependency declarations first for the new package depth.
Retain existing tests and CI workflow, add fast synthetic integration tests.
Manually adapt compact Spec Kit artifacts; do not run broad generation or mutate
`.specify/feature.json`. Any prerequisite invocation uses
`SPECIFY_FEATURE_DIRECTORY=specs/005-integration`, `SPECIFY_FEATURE_NO_PERSIST=1`.

Run all requested commands, record observed results only, check frozen scopes,
commit/push, open PR (Refs #6), wait for exact-head Node 22/24 CI, do not merge.
