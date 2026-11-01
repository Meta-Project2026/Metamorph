# MMP-100 validation — 2026-11-01

Scope: documentation/allowlisted JSON only; no runtime, policy, workflow,
benchmark, Oracle, hidden-G4 or dependency change. Audited fresh main:
`493dcb4b059b63d473a9bfbc3d083ea332ae7af4`. Branch:
`codex/mmp-100-offline-readiness` in the executor's reused clean worktree;
the original C:\Metamorph checkout and other agents' worktrees were untouched.
No Spec Kit active pointer was changed. Final branch SHA/CI is recorded in the
PR, separately from the audited-main identity in committed evidence.

## Observed preflight commands

| Actual command/check                                                                                                             | Observed result                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `git fetch origin`                                                                                                               | exit0; current origin/main493dcb4                                                                                     |
| `git switch -c codex/mmp-100-offline-readiness origin/main`                                                                      | exit0 from clean executor checkout                                                                                    |
| `git merge-base --is-ancestor 195c5297b7d2e8fb303e700b9ab3dbebdf03edda HEAD`                                                     | exit0                                                                                                                 |
| `git diff --quiet 195c5297b7d2e8fb303e700b9ab3dbebdf03edda HEAD` before docs                                                     | exit0; entire accepted PR98 tree equals merged main                                                                   |
| `gh pr view 98 ...` and `gh api .../reviews/5725969979`                                                                          | exit0; MERGED at493dcb4; independent review SCOPED_GO/MERGE_ELIGIBLE, COMMENTED state rather than native APPROVE      |
| `gh run view 41263638430 ...`                                                                                                    | exit0; actual main Fast CI Node22/24 completed/success                                                                |
| `gh run view 41254318570 --log`                                                                                                  | exit0; actual PR98-head sanitized MMP099_RECEIPT reread;5/28/4/6/8 PASS, normal prep/final0/0/0                       |
| `node research/mmp-086/audit-request.mjs <workspace-ignored-audit-file>` in fresh allowlisted environment                        | exit0, no signal/timeout, no MODEL_API_KEY; exact main request/context reconstructed                                  |
| Same actual audit with temporary network-deny preload                                                                            | exit0,0 attempted network calls; byte-for-byte same audit result                                                      |
| First preload invocation using a Windows absolute import path                                                                    | exit1, local harness import failure; corrected to file URL; no production code change                                 |
| Exact-main GitHub repository/branch/environment/deployment-policy metadata through `gh api`, then pure `validateMetaEnvironment` | exit0, VERIFIED; no secret values read and no signed OIDC admission issued                                            |
| `validateRuntimeRecipe` on local Windows checkout                                                                                | exit1, ENVIRONMENT_ERROR: Dockerfile CRLF bytes differ from immutable LF Git bytes                                    |
| Recompute sorted recipe hashes from `git show 493dcb4:<path>` and manifest from actual exported MANIFEST                         | exit0; canonical recipe/manifest equal production pins; no normalization of trusted checks or file changes            |
| Official public pricing/models/reasoning/Chat Completions documentation                                                          | retrieved1November2026; matching rates, Standard/low/max_completion_tokens/n1 supported; no authenticated API request |

Audit child environment keys were PATH,SystemRoot,WINDIR,ComSpec,TEMP,TMP,HOME;
HOME was a fresh task-local ignored directory. No MODEL_API_KEY, GH_TOKEN,
OIDC/runtime token or Node preload options were inherited. The temporary
network-deny module blocked fetch/http/https/net/tls entrypoints and recorded0
attempts; it was trusted local harness code, not a production change. The only
audit subprocess was local `git rev-parse HEAD`. Neither a provider session nor
paid admission was constructed.

The initial read against the old original checkout found no research directory;
the executor then used its actual current worktree. Those discovery errors are
not evidence of product or preflight failure. The local recipe mismatch is
preserved in [recipe-platform.json](evidence/recipe-platform.json), not hidden
by changing line endings or pins. The request reconstruction does not build
or execute a candidate.

## Required branch checks

All nine commands below actually exited **0** with no model credential in the
check processes, Windows x64, Nodev24.21.0, pnpm11.25.0. Code matched audited
main493dcb4; only new documentation/JSON was present. [Command/log-hash receipt](evidence/local-checks.json).

| Command                                          | Observed result                                                |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                 | exit0; no lockfile change                                      |
| `pnpm lint`                                      | exit0                                                          |
| `pnpm typecheck`                                 | exit0                                                          |
| `pnpm test`                                      | exit0;532 total,429PASS/103SKIP/0FAIL                          |
| `pnpm build`                                     | exit0                                                          |
| `pnpm exec biome check research/mmp-100`         | exit0                                                          |
| `node research/mmp-069/check-syntax.mjs`         | exit0;76 active modules parsed,0 failures; no module execution |
| `node research/mmp-069/validate.mjs`             | exit0;VALID,77 discovered research modules including archive   |
| `node --test research/mmp-069/validate.test.mjs` | exit0;45PASS/0FAIL                                             |

SKIP is not PASS; overlapping suites are not added. No tests were changed or
added for inert documents. Separate artifact checks verified29 recorded exact
Git code hashes, canonical recipe/manifest/cost and public challenge digest;
all passed. The owner PowerShell snippet was parsed successfully as text, never
executed. Final pushed-SHA checks and branch CI are recorded in the PR; these
local working-tree results are not silently relabelled as a future SHA.

Fresh Docker execution in this documentation task: **NOT_RUN**. The accepted
milestone workflow is scoped to PR98 and does not run on main or this PR.
Its own exact-head execution, full tree identity and independent final review
are linked in [accepted-docker.json](evidence/accepted-docker.json). No new CI
ritual, dispatch, rerun or broadened workflow is introduced for unchanged code.
Actual paid trial, live upload and owner-private-key challenge: **NOT_RUN**.

## Read-only reproduction and postmerge handoff

After this PR's independent review and an owner-approved merge, use a clean
checkout of fresh actual main. Recheck its full SHA, current-main CI, tariff
and code identity. Do not run paid-run.mjs, guard.mjs, authorizePaidWorkflow,
validate-authorization.mjs or any workflow dispatch as an offline substitute.

The existing audit accepts one optional output pathname; it does not itself
enforce a path allowlist or redact its static developer message. Supply an
ignored task path and keep raw audit output uncommitted. Example trusted
PowerShell wrapper, to be run from the exact audited checkout:

```powershell
$auditScript = @'
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const directory=resolve('.oracle-evidence/mmp100-local');
mkdirSync(directory,{recursive:true});
const env=Object.fromEntries(['PATH','SystemRoot','WINDIR','ComSpec','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
env.HOME=join(directory,'audit-home');
mkdirSync(env.HOME,{recursive:true});
const path=join(directory,'request-audit.private.json');
const child=spawnSync(process.execPath,['research/mmp-086/audit-request.mjs',path],{env,timeout:30000,maxBuffer:1024*1024});
assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0);
const a=JSON.parse(readFileSync(path));
const hash=s=>createHash('sha256').update(s).digest('hex');
console.log(JSON.stringify({headSha:a.headSha,requestSha256:a.requestSha256,contextSha256:a.contextSha256,sourceSha:a.sourceSha,sourceArchiveSha256:a.sourceArchiveSha256,manifestSha256:a.manifestSha256,recipePin:a.recipePin,model:a.model,reasoningEffort:a.reasoningEffort,maxCompletionTokens:a.maxCompletionTokens,requestBytes:a.requestBytes,messageBytes:a.messageBytes,projection:a.projection,developerMessageSha256:hash(a.developerMessage),exitCode:child.status},null,2));
'@
$auditScript | node --input-type=module
if ($LASTEXITCODE -ne 0) { throw 'NO_GO: offline audit failed' }
```

This only prints an explicit safe projection. Recompute canonical Git recipe,
exported manifest and source bindings as recorded in provenance, and compare
production code hashes. Check current official rates and actual policy expiry;
do not reuse the historical estimate without recomputation. Check owner public
challenge evidence. Publish the final exact-main card as a **comment on
issue100**, with current SHA/identities/limits/status and no commit. If owner
challenge, new review, tariff validity or consent is absent, publish NO_GO,
not an executable dispatch instruction. Re-fetch before using any final card;
SHA/policy drift makes it STALE_SHA_NO_GO.

This task stops at a reviewable pushed PR. It does not self-merge to manufacture
the postmerge state or claim that a future comment has already been published.
