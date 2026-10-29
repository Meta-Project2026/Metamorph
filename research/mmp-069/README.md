# MMP-063 / 069 / 074 — executable CI coverage

Scope: Docker-free PR checks only. Base main `c3ddf08b1a7774c4a5ddecf89fd668c6b81c7651`.
PR #88 is merged; #87 remains separate at initial inspection. No paid/manual
dispatch, Oracle changes, hidden cases or candidate execution.

## Existing coverage and the defect

Main CI [40940984676](https://github.com/Meta-Project2026/Metamorph/actions/runs/40940984676)
already executed Workshop-audit tests, Active research lint and Validate coverage
matrix on Node 22 and 24. PR #73's 54 hosted audit tests remain historical evidence.
The old validator checked its JSON assertions, not the workflow/manifests.
It even listed nonexistent package test scripts. No old run is reclassified here.

## Design and implementation

- [Version 2 matrix](coverage-matrix.json) stores actual workspace names, paths and
  scripts, checked against manifests discovered from `pnpm-workspace.yaml`.
  Listing a manifest script does not mean it executes in CI; gates and expanded
  test files establish that separately. No invented N/A/test scripts. Pure MJS workshop-audit
  really has no build/typecheck script; its existing lint and test gate remain.
- [Validator](validate.mjs) parses actual YAML 1.2 using exact `yaml@2.8.1`
  (ISC, zero dependencies; upstream notice retained in installed package).
  [Upstream API](https://eemeli.org/yaml/) documents `parseDocument`.
  Duplicate keys, warnings and aliases are rejected.
- A deliberately narrow, reviewed CI dialect requires the actual ordered quick
  job/steps, Ubuntu, Node22/24, setup-node expression, unfiltered PR event,
  eight-minute timeout and contents:read. Unknown conditions, shells, defaults,
  environment overrides, dependencies, matrix exclusions, soft failure, comments,
  echo-only commands and shell wrappers fail closed. Supporting new workflow
  semantics requires updating code and controls, not guessing shell execution.
- Root and filtered test scripts are traced through the exact supported
  `pnpm build && node --test` forms. Expanded globs must be nonempty and cover
  every workspace `*.test.mjs`. New/removed/renamed packages or stale commands
  invalidate the matrix. Test discovery is not a test execution count.
- Research module discovery covers all `research/**/*.mjs`. Every discovered
  harness needs a matrix entry; every active module receives `node --check`
  (parse only, no imports/execution). Existing manual harnesses #34/#44/#49/#54
  are ACTIVE, not falsely archived. #61/#78/#82/#86 remain active and syntax
  checked without editing or invoking their privileged paths.
- Only `mmp-055/v1/linux-test.mjs` is the explicit archived privileged harness:
  the repository has no current workflow invocation of it. Its original local
  proof is not a hosted test. Dedicated privileged CI remains NO_DECISION/NOT_RUN.
- Scoped recommended Biome checks gate demo, this validator and connected tests.
  Demo `*.test.mjs` discovery automatically includes future #87 files; no claim
  of 83 executions until the files land and an actual run reports them.
- [Negative controls](validate.test.mjs) run the real validator CLI on isolated
  copies and require exit 1 for 43 mutations; clean copy exits 0. A new demo test
  discovery control proves wildcard inclusion. The normal matrix check and
  controls are separate unconditional CI steps.
- [History bootstrap](../mmp-054-connected/history.mjs) fetches exactly the two
  pinned commits at depth 2, no tags/submodules/retry/full-history fallback.
  Checks the full fix SHA, its exact parent and both historical SHA256 contents.
  It never changes `verifyPins()` or replaces history with JSON.
  Failure is HISTORY_MISSING_OR_INVALID or HISTORY_FETCH_FAILED, not SKIP.
- [History controls](../mmp-054-connected/history.test.mjs) create a real depth-one
  Git clone with no checkout/alternates. Missing history must fail the CLI, then
  exact-object bootstrap must pass while retaining shallow status. This uses
  authentic local Git objects without network; the ordinary hosted checkout
  separately exercises actual origin fetch and all 21 original adversarial tests.

## Status semantics and limitations

GATED_HOSTED means an unconditional checked Fast CI command selects the files,
not that they passed. Counts/PASS/FAIL/SKIP belong to actual run evidence.
HOSTED_SKIP: one Windows-only test and two uid-0 isolation tests are skipped on
unprivileged Linux. They are not all privilege-dependent and never become PASS.
MANUAL_DOCKER, PRIVILEGED_NOT_RUN, LOCAL_ONLY, ARCHIVED and NOT_VERIFIED are
distinct from automatically gated execution; unused labels are not fake runs.

This is drift detection, not protection against an adversary changing the
validator and its policy together, deleting the entire workflow or replacing
the toolchain. It does not prove a test's semantic adequacy. Static syntax alone
does not audit Docker mount/credential security. Full semantic lint/unit coverage
for active manual/privileged harnesses remains an explicit #69 gap, in each
matrix entry. No mass formatting of archived or other-owner scripts.

## Acceptance disposition

| Issue | Delivered | Remaining |
| --- | --- | --- |
| #74 | YAML/workspace/file reality checks; 45/45 controls in hosted Node22/24 | Independent review of final HEAD |
| #63 | Exact history bootstrap; 2/2 history controls and 21/21 original tests in hosted Node22/24 | Independent review of final HEAD |
| #69 | Preserve audit gate; demo tests; active inventory/syntax; honest skips/gaps | Semantic lint/test gaps in manual harnesses; privileged-runner NO_DECISION; keep OPEN |

Do not auto-close any issue or merge before independent review. This PR has no
bearing on #84 flakiness, #89 private diagnostics, historical ROOT_CAUSE_UNKNOWN,
G0/G4 INCONCLUSIVE or product NOT_ESTABLISHED.

## Reproduce

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @metamorph/workshop-audit test
pnpm exec biome check research/demo-readiness research/mmp-069 research/mmp-054-connected
node research/mmp-069/validate.mjs
node --test research/mmp-069/validate.test.mjs
node research/mmp-069/check-syntax.mjs
node research/mmp-054-connected/history.mjs bootstrap
node --test research/mmp-054-connected/history.test.mjs
node --test research/mmp-054-connected/verify.test.mjs
node --test research/demo-readiness/*.test.mjs
git diff --check
```

Ordinary Node tests execute trusted harnesses and synthetic transports, never
benchmark/candidate code on the host. Linux checkout must preserve pinned LF bytes.
See [validation](validation.md) for actual results. The final delivery SHA and its
separate CI links are published in PR #90.
