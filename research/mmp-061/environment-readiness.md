# MMP-061 protected Environment readiness after PR #70

Status: **READY_FOR_OWNER_AUTHORIZATION** (configuration metadata only).
Observed: **2026-10-29T13:30:21Z**.
Repository: `Meta-Project2026/Metamorph` (public).
Issue: [#76](https://github.com/Meta-Project2026/Metamorph/issues/76).
Inspected `main`: **`d8bb8c83f7fbb2c185abe9da09b8ea649448f098`**.

No Meta API request or workflow dispatch was performed. This report does not
authorize either. Independent ChatGPT review of this report remains pending.

## Merge and reviewed source

- [PR #70](https://github.com/Meta-Project2026/Metamorph/pull/70) is merged,
  at `2026-10-29T13:01:39Z`, into the exact `main` SHA above.
- Its final reviewed head is `76dfd549d8e41d2756a91241753a0e197cddd7a0`;
  the final scoped APPROVED review was submitted at `2026-10-29T13:01:24Z`.
  That review explicitly excludes read-only dispatch, paid activation and a
  second independent human sign-off. The GitHub principal is `barbalatv`.
- `git diff --exit-code 76dfd549d8e41d2756a91241753a0e197cddd7a0 origin/main --
  .github/workflows/meta-readonly-preflight.yml research/mmp-061
  packages/agent-real` exited **0**, with no differences.
- Other tree differences from that PR head are the previously reviewed demo/CI
  increments from [PR #72](https://github.com/Meta-Project2026/Metamorph/pull/72)
  and [PR #73](https://github.com/Meta-Project2026/Metamorph/pull/73). Their exact
  heads have scoped ChatGPT GO review comments, not native APPROVED reviews.
  No post-PR70 commit was present on `main` at capture time.

## Before and after administrative configuration

The connected principal `barbalatv` has repository `admin: true`. Before mutation,
`main.protected` was false; branch protection returned HTTP 404 and repository
rulesets were `[]`. Environment ID `25634200821` already existed, with
`protection_rules: []`, `deployment_branch_policy: null` and
`can_admins_bypass: true`. Listing custom branch policies then returned HTTP 404,
as expected with custom policies disabled. No existing protection was weakened.

| Setting | Re-read result after configuration |
| --- | --- |
| `main.protected` | `true` |
| `main.commit.sha` | `d8bb8c83f7fbb2c185abe9da09b8ea649448f098` |
| Branch `enforce_admins.enabled` | `true` |
| Required PR approvals | `1`; stale approvals dismissed |
| Branch force pushes / deletions | both disabled |
| Required status checks | `null`, unchanged from absence; CI source unchanged |
| Environment required reviewers | `barbalatv` (85129726), `l1ncolny` (338248494), both `User` |
| `prevent_self_review` | `true` |
| Environment `can_admins_bypass` | `false` |
| `deployment_branch_policy.protected_branches` | `false` |
| `deployment_branch_policy.custom_branch_policies` | `true` |
| Deployment policies | exactly one: `{"id":64793111,"name":"main","type":"branch"}` |
| Environment secret metadata | one secret, name `META`; value never requested |
| Secret `created_at` / `updated_at` | both `2026-10-29T00:24:12Z`, unchanged |
| Read-only preflight workflow run count | `0` |

The Environment uses explicit custom branch selection; `protected_branches:false`
here does not describe the actual protection of `main`. There are no tag,
wildcard or additional deployment rules. GitHub needs only **one** eligible
reviewer from the list. This is not joint approval by both owners. If `barbalatv`
initiates a future deployment, self-review prevention requires another eligible
reviewer, currently `l1ncolny`.

## Verification and command outcomes

Read-only GitHub API calls re-fetched `/branches/main`, its `/protection`,
`/environments/META_API_KEY`, its `/deployment-branch-policies` and `/secrets`
metadata, and `/actions/workflows/meta-readonly-preflight.yml/runs?per_page=1`.
Each final `gh api` read exited **0**. Secret metadata exposes names/timestamps
only; no secret-value API or secret write was used.

Administrative calls, in order, all exited **0**:

1. `PUT /repos/Meta-Project2026/Metamorph/branches/main/protection`.
2. `PUT /repos/Meta-Project2026/Metamorph/environments/META_API_KEY` with both
   reviewers, self-review prevention, custom branch selection and admin bypass
   disabled. Existing secret contents were outside the request.
3. `POST /repos/Meta-Project2026/Metamorph/environments/META_API_KEY/deployment-branch-policies`
   with `{"name":"main","type":"branch"}`. This is a GitHub settings write,
   not a Meta API call.

The exact JavaScript guard body was extracted from the unchanged workflow and
evaluated locally with its three GitHub read methods supplied by the captured
real metadata. `context.sha` was the exact `main` SHA above. Result: **exit 0**,
no `core.setFailed` calls. Additional assertions confirmed both reviewer logins,
disabled admin bypass, branch protection, unchanged secret metadata and zero
preflight runs. This is an offline evaluation of the guard against live metadata,
not an Actions execution or proof of the future `GITHUB_TOKEN` permissions.
The job-level main/exact-reviewed-SHA predicates were also inspected statically.

Workflow inspection confirms separate `guard` and `preflight` jobs. The latter
uses `environment: META_API_KEY`, exact-SHA checkout without persisted credentials,
Node 24 and `secrets.META` mapped to `MODEL_API_KEY` only on the single GET step.
It performs no package install/build/test/Docker/candidate execution. The GET
entrypoint additionally checks event/repository/ref/checkout/reviewed SHA.

An initial local comparison failed with exit **128** because the reviewed PR head
had not been fetched. Fetching that exact SHA exited **0**; the repeated scoped
comparison exited **0**, as recorded above. Initial HTTP 404 results describe
missing configuration, not successful verification.

Application lint/typecheck/tests/build, model probe and Docker validation:
**NOT_RUN** in this documentation/settings task. The documentation commit uses
`[skip ci]` to respect the no-workflow-run scope. No workflows or tests are edited.
Git whitespace/diff inspection is required before committing this single file.

## Owner actions before any future GET

1. Independently review this report and live settings. In repository
   **Settings > Branches > main**, confirm required PR review, admin enforcement
   and disabled force pushes/deletions. In **Settings > Environments > META_API_KEY**,
   confirm both reviewers, **Prevent self-review**, and that **Allow administrators
   to bypass configured protection rules** is unchecked.
2. Under **Deployment branches and tags**, confirm **Selected branches and tags**
   with exactly **Branch: main**. Under Environment secrets confirm only the name
   `META`; do not view, copy, rotate or re-enter its value to test readiness.
3. Obtain a new explicit owner decision authorizing exactly one read-only
   `GET /v1/models`. Re-read current `main` and settings and independently review
   its exact SHA. If this documentation PR or any other PR has since merged,
   the SHA recorded above is no longer the current dispatch SHA.
4. Only after that separate authorization, an authorized operator may select
   **Actions > Meta protected read-only preflight > Run workflow > main**, enter
   the newly reviewed exact SHA, and obtain an independent Environment approval.
   Do not perform this step as part of Issue #76 configuration work.

The human gate has not been exercised. Credential validity/entitlement, actual
Meta TLS/API response, hosted guard permissions and runtime success remain
unverified. Recheck settings for drift before any separately authorized run.
If protections become unsupported, keep activation blocked; use a separately
reviewed trusted host with independent human approval rather than moving the
credential to an ordinary repository secret.

## Scope and unchanged acceptance

This task made **Meta GET=0, Meta POST=0**, no generation and no billable model
request. No key value was read or changed, no spending setting was changed and
no production model admission was changed. No billing-account audit is claimed.
G0/G4 remain **INCONCLUSIVE** and product **NOT_ESTABLISHED**. Issues #37, #61 and
#76 remain open. There is no new owner approval, Oracle acceptance, G4 result or
self-merge. Independent ChatGPT review remains the next review step.

GitHub behavior references: [Environment configuration](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
[Environment REST API](https://docs.github.com/en/rest/deployments/environments),
[branch-policy REST API](https://docs.github.com/en/rest/deployments/branch-policies),
[branch protection REST API](https://docs.github.com/en/rest/branches/branch-protection),
and [skip-workflow commit instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).
