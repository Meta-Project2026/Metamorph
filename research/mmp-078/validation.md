# MMP-078 validation

Local Windows / Node22.23.1 / pnpm11.25.0 checks completed:

| Command | Exit | Observed result |
| --- | --- | --- |
| pnpm install --frozen-lockfile | 0 | exact lockfile, no dependency changes |
| pnpm lint | 0 | 180 files checked |
| pnpm typecheck | 0 | build plus all workspace typechecks |
| pnpm test | 0 | 393 total; 291 PASS, 102 platform SKIP, 0 FAIL |
| pnpm build | 0 | all packages; also executed by typecheck/test |
| pnpm --filter @metamorph/oracle test:reference | 0 | 55 PASS / 1 SKIP |
| pnpm --filter @metamorph/target-worker test | 0 | 69 PASS |
| pnpm --filter @metamorph/differential test | 0 | 77 PASS / 45 SKIP |
| node --test packages/oracle/probes/qualification.test.mjs | 0 | 2 PASS |
| pnpm --filter @metamorph/workshop-audit test | 0 | 53 PASS / 1 SKIP |
| node --check research/mmp-078/*.mjs (each exact file) | 0 | entrypoint syntax |
| actionlint1.7.12 -shellcheck= -pyflakes= (three changed workflows) | 0 | syntax/context/permissions validation |
| git diff --check | 0 | no whitespace errors |

Actionlint was downloaded from its official GitHub release into a temporary tool
directory and checked against the release SHA256 file; no repository dependency
added. An initial Python YAML check could not run (PyYAML absent); actionlint
provides actual workflow-specific validation instead. Shellcheck/pyflakes were
not installed or run.

New paid suite: **30 PASS**. Together with original wire/migration suites these
exercise fake-key native HTTPS, real ModelResponseSchema/writer/SHA path, signed
offline RSA/JWKS, both owners concurrently, duplicate-capability/session/process
ledger, invalid refs/actors/env/metadata, missing key, timeout/cancel/malformed/error
responses, downward budget and expiry, and safe receipts. These tests prove code
reachability under the new authorization; they do not prove Meta entitlement or
live model quality. No model-generated code is executed by host unit tests.

Hosted Fast CI (all steps exit0):

- Initial implementation46d172a: [Node22](https://github.com/Meta-Project2026/Metamorph/actions/runs/40890286290/job/123504907297),
  [Node24](https://github.com/Meta-Project2026/Metamorph/actions/runs/40890286290/job/123504906992).
- Signed-validation follow-up49841dd: [Node22](https://github.com/Meta-Project2026/Metamorph/actions/runs/40891051286/job/123507631053),
  [Node24](https://github.com/Meta-Project2026/Metamorph/actions/runs/40891051286/job/123507631369).

Manual no-secret Ubuntu Docker run **40890281953**, exact46d172a, SUCCESS:
[job](https://github.com/Meta-Project2026/Metamorph/actions/runs/40890281953/job/123504900688).
Its real hosted GITHUB_TOKEN metadata step returned VERIFIED, reviewers=0,
branch=main, Meta GET/POST=0/0. This proves the configured token read permissions
work with actual repository/Environment APIs; no admin PAT is needed in workflow.

Original deterministic controls returned **PASS_SCOPED**: known-good public
G1/G2/G3 PASS (17HTTP/20SQLite), deliberate broken candidate FAIL then explicit
offline repaired candidate PASS; six runtime controls PASS. Each attempt and both
normal finalizer/independent inventory verified containers=0, volumes=0,
emergencyRemoved=0. This is replay/control evidence, **not model generation**.
Exact downloaded allowlisted receipts are in hosted/40890281953. Meta/Oracle/
source/worker implementation files are identical between46d172a and49841dd.

Independent review: SCOPED_GO at46d172a and49841dd; separate reviewer independently
reran30 paid tests, exit0. The latter actual CI is now green. No other-owner native
GitHub APPROVE is needed. Main-only signed OIDC validation will be run after the
reviewed owner self-merge, using explicit validate_only:true and checking that
the Meta network step is skipped. No billable run is part of this task.

Python comparison of original branch protection after deleting only the review
field equals the reread protection exactly: PASS. Protected source/Oracle/worker/
differential files have zero diff from original main: PASS.
Meta GET/POST observed: **0/0**. Real model trial **NOT_RUN**.
Settings before/after files are real authenticated admin reads. No secret value
retrieval or secret mutation. Original source/Oracle/manifest/runtime/control files
are unchanged. Local Windows tests may skip Linux-specific lifecycle cases;
hosted Ubuntu checks and separately dispatched Docker controls are distinct facts.
