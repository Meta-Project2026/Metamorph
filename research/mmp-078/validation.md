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

Hosted exact-SHA CI and separate manual Docker evidence: pending publication.
Meta GET/POST observed: **0/0**. Real model trial **NOT_RUN**.
Settings before/after files are real authenticated admin reads. No secret value
retrieval or secret mutation. Original source/Oracle/manifest/runtime/control files
are unchanged. Local Windows tests may skip Linux-specific lifecycle cases;
hosted Ubuntu checks and separately dispatched Docker controls are distinct facts.
