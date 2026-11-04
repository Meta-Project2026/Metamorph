# MMP-192 D0 handoff

**D0_DESIGN_PROPOSED / NO_OWNER_APPROVAL / ENGINE_FAULTS_NOT_RUN.** This is a plan for the next authorized slice, not authorization to execute it.

## Exact identity and delivery

| Item | Value |
| --- | --- |
| Fetched `origin/main` and starting HEAD | `14a54665a94394ca9fdb68a7c27f0c596428cbea` |
| Isolated branch | `Vladimir/mmp-192-isolated-fault-design` |
| Starting checkout | Dedicated local worktree; absolute workstation path withheld |
| Proposal HEAD | The actual Git commit that contains this file; bind the exact current `git rev-parse HEAD` externally in the PR, review and both owner decisions. A file cannot include its own final commit SHA without changing that SHA. |
| D0 review/approval | Independent ChatGPT exact-HEAD review `PENDING`; Vladimir and Ilia authenticated exact-HEAD decisions both `PENDING` |
| Engine faults | All 12 `NOT_RUN`; no VM/daemon was provisioned or operated in D0. |

## Minimal Sol 6.1 ultra D1 slice — only after D0 approval

1. Recheck main/issue state and the **same** reviewed design SHA and both explicit authenticated decisions. Resolve a named VM provider, administrator trust, socket identity, preflight, bounds, expiry, evidence custodian and externally independent supervisor. Do not proceed on incomplete decision fields or if a separate shared API/Oracle/worker/trust change is required without joint agreement.
2. On a new isolated branch, implement the smallest public/synthetic-only trusted harness and external supervisor consistent with the approved option. Enforce pinned endpoint and environment, no workstation fallback, no host candidate execution, one mutation at a time and no automatic retry. Design an independently observable barrier between unresolved old Docker work and any finalizer or recovery. Do not claim that the current in-process finalizer already provides it.
3. Implement exact-owner/role/full-ID and fail-closed inventory gates. Plan interrupted create and unpersisted ledger without deleting ambiguous orphans; preserve the different-owner synthetic sentinel. Never use the legacy #134 workshop finalizer, wildcard/prefix cleanup, global prune, or any foreign production resource. The original adapter creates no volumes.
4. Preserve independent normal/finalizer/receipt evidence, bounded external supervisor events, every failed/partial attempt and honest unknowns. Define and review crash durability and independent receipt commitment; current evidence code does not prove parent-directory fsync or cover `receipt.json` in the normal catalog, and post-write verification can return ERROR without rewriting that file. Require sticky `ERROR/INCONCLUSIVE` for adverse findings, separate emergency counts and unchanged positive behavior.
5. Add meaningful unit/fake-daemon controls for every unsafe branch and a separately reviewed, bounded real-engine driver for the 12 cases, each with an independent failing control. Distinguish an evaluator control successfully detecting a fault from the G0 result. Do not introduce a new privileged CI workflow. Keep PR CI to existing frozen install, lint, typecheck, tests and build; inspect MMP-069's research-module inventory if adding scripts.
6. Push a narrow draft implementation PR with exact source/base SHAs, complete planned case/receipt matrix and independent code/security review. **Do not perform D2 fault execution** until the implementation is reviewed and the owners separately authorize the actual disposable environment, execution window and operator.

Acceptance for D1: all 12 classes mapped to feasible isolated boundaries; deterministic falsifiers; no unauthorized resource mutation; no fabricated zero, receipt or owner approval; fixed resource/time/storage limits and functioning outside-guest supervisor with a recovery demonstration under its own explicit authorization; complete private normal/finalizer/incident catalog and safe public DTO; unchanged positive baseline; exact-HEAD Node22/24 CI and independent review. Mark any unexecuted actual engine controls `NOT_RUN`. If these guarantees cannot be demonstrated, report `BLOCKED` rather than expanding the trust boundary.

## Read-only reconnaissance actually performed

Commands below ran in PowerShell on 2026-11-05; grouped arguments were used only to read the listed files or metadata. `<worktree>` redacts the absolute workstation path. Exit statuses are actual process exits, not inferred test verdicts.

| Command | Exit / result |
| --- | --- |
| `git status --short --branch`, `git rev-parse --show-toplevel`, `git rev-parse HEAD`, `git branch --show-current`, `git worktree list --porcelain`, `git remote -v` | 0; original checkout was on a different branch; new worktree started at fetched main |
| `git rev-parse origin/main`, `git branch -a --list '*mmp-192*'`, `Test-Path -LiteralPath '<worktree>'` | 0; exact base above; branch/path absent before creation |
| `Get-Command git,gh,pnpm,node -ErrorAction SilentlyContinue`; `gh auth status`; `node --version`; `pnpm --version` | 0; Node `v22.23.1`, pnpm `11.25.0`, authenticated GitHub CLI |
| `Get-Content -LiteralPath` for `AGENTS.md`, `README.md`, `.specify/memory/constitution.md`, `specs/002-foundation/{spec,interface-note}.md`, `specs/008-ts-target-worker/{spec,plan,tasks}.md` and `specs/013-workshop-independent-audit/{spec,plan,tasks}.md` | 0; read project boundaries and applicable feature history |
| `rg --files -g AGENTS.md research packages/workshop-audit packages/target-worker` | 1; no nested matches |
| `rg -n -i 'workshop.audit\|audit harness\|G0\|finalizer\|cleanup' specs/0*/spec.md specs/0*/plan.md specs/0*/tasks.md` | 1; Windows did not expand these path globs; corrected command below |
| `rg -n -i 'workshop.audit\|audit harness\|G0\|finalizer\|cleanup' specs -g spec.md -g plan.md -g tasks.md`; `rg --files specs` filtered for audit/worker specs | 0 |
| `rg -n '^'` on all eight `packages/workshop-audit/src/g0/{docker,finalizer,evidence,run,synthetic,cli,policy,probes}.mjs`; `rg -n` on `packages/target-worker/src/controller.mjs` and both G0 test files; `Get-Content` of the controller and test bodies | 0; source, CLI semantics, fault models and tests inspected |
| `Get-Content` on `research/mmp-183/{README,acceptance-matrix,linux-docker-validation}.md` and tail of `linux-docker-result.json`; `node -e "const x=require('./research/mmp-183/linux-docker-result.json'); console.log(JSON.stringify(x,null,2))"` | 0; later owner-reported 11+1 and exactly 12 fault IDs identified |
| `git diff 297919d3e1476eb7f17b1fb59e7e671787e0af94 8b40d9fc6ed1ee888596a6f9791a461236ec88a9 -- packages/workshop-audit/src/g0/probes.mjs packages/workshop-audit/test/g0.test.mjs` and corresponding `git diff --stat` | 0; #191 code diff and five changed paths inspected |
| `gh issue view <n> --repo Meta-Project2026/Metamorph --json number,title,body,comments,url,state,updatedAt` for `192,183,57,134` | 0 each; issue bodies and current comments read |
| `gh issue view <n> --repo Meta-Project2026/Metamorph --json number,title,body,comments,url,state` for `190,55,56,188` | 0 each; #190 is the resolved native-probe issue, not a PR |
| `gh pr view 190 --repo Meta-Project2026/Metamorph --json number,title,body,comments,reviews,commits,files,mergeCommit,mergedAt,url,statusCheckRollup` | 1; #190 is an issue, not a pull request; corrected by `gh issue view 190` |
| `gh pr view 191 --repo Meta-Project2026/Metamorph --json number,title,body,comments,reviews,commits,files,mergeCommit,mergedAt,url,statusCheckRollup` | 0; exact-head review and public evidence read |
| `gh run view 41921732994 --repo Meta-Project2026/Metamorph --json status,conclusion,headSha,event,jobs,url` | 0; historical #191 CI reports Node 22 and 24 success, not Docker fault qualification |
| `gh pr list --repo Meta-Project2026/Metamorph --state open --json number,title,headRefName,headRefOid,url` | 0; no open PR at reconnaissance |
| Docker documentation | Read official engine-security, daemon-storage, resource-limit, rootless, socket-access and event-retention pages linked in [architecture-options.md](architecture-options.md); no local daemon accessed. |

Other local actions: `git fetch --prune origin` exit 0; `git worktree add -b Vladimir/mmp-192-isolated-fault-design <worktree> origin/main` exit 0; `pnpm install --frozen-lockfile` exit 0, using the local package store. Installation and checks also produced ignored dependencies/build outputs and temporary test artifacts. No Docker, untrusted candidate, engine fault, privileged, private/hidden or paid operation was run.

## Validation

| Local command / check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0; four existing warnings and two informational notices |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0; 947 passed, 0 failed, 131 skipped on Windows; skipped checks are `NOT_RUN` |
| `pnpm build` | exit 0 |
| `pnpm --filter @metamorph/workshop-audit test` | exit 0; 79 passed, 0 failed, 2 POSIX-only skips; tests use models, not Docker |
| Read-only PowerShell link-target check | exit 0; all relative Markdown targets exist |
| Read-only PowerShell comparison of matrix IDs to result JSON | exit 0; exactly 12 IDs in source order |
| `git diff --cached --check` | exit 0 after staging the six documents |
| `git diff --check` | exit 0 |

Hosted CI, independent review and owner approvals are separate from local validation.

## Remaining gates

- Before any implementation: both-owner D0 decision on exact reviewed design SHA; all concrete identity, boundary, limit, recovery, authority, expiry and evidence fields resolved.
- Before any real fault: independently reviewed implementation, exact-HEAD CI, explicit execution authorization, demonstrably exclusive full-lifetime VM, separate external recovery and evidence-preserving stop.
- After public fault work: genuine owner-local candidate provenance and G0, #57 composition, #55/#188 real retention, #56 independent G4 D1–D7, formal G4 and product acceptance remain separate. No past or future public synthetic result closes these gates.
