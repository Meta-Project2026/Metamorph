# MMP-104 validation

Base: d199510fd802693d4af852bd5ed8498b5461d185. Branch codex/mmp104-verifier-forensics.
Execution date2026-11-01. Local results below were executed on the final code
before commit. Exact pushed-SHA Node22/24 CI is reported in the PR handoff after
completion, so no later documentation commit is needed merely to record CI.

Frozen offline install and trusted package build exited0. Inspector verified both
original GitHub ZIP digests and six JSON members, producing incident.json.
Targeted Windows suite:20tests,19PASS/1Linux-only SKIP/0FAIL, exit0.
Linux preserver CLI execution is NOT_RUN locally; its hosted result must be read.

| Actual command                                                                       | Exit / result                                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| pnpm install --offline --frozen-lockfile                                             | 0; lockfile unchanged, no downloads                            |
| pnpm lint                                                                            | 0                                                              |
| pnpm exec biome check research/mmp-104                                               | 0 after documentation formatting                               |
| pnpm typecheck                                                                       | 0                                                              |
| pnpm test                                                                            | 0;552total/448PASS/104Windows or permission SKIP/0FAIL         |
| pnpm build                                                                           | 0                                                              |
| node research/mmp-069/check-syntax.mjs                                               | 0;79files, no execution                                        |
| node research/mmp-069/validate.mjs                                                   | 0;80research modules,40test files reached                      |
| node --test research/mmp-069/validate.test.mjs                                       | 0;45PASS/0FAIL                                                 |
| node --test packages/agent-real/test/verifier-forensics.test.mjs                     | 0;20total/19PASS/1Linux-only SKIP/0FAIL                        |
| node research/mmp-104/inspect-incident.mjs (ignored local public-artifact directory) | 0;8/8ZIP/member byte identities match; sanitized incident.json |

[local-checks.json](local-checks.json) records command timestamps/exits and SHA256
of ignored full local logs. Coverage inventory adds only the new research module
directory; existing CI already reaches the package test wildcard and research
syntax scan. No workflow or test gate was changed. Tests in research are reported
NOT_VERIFIED by the inventory because their entry test is in packages/agent-real;
the package tests themselves execute in normal Fast CI.

Development failures were retained and corrected in tests/config only: the initial
initial-diff-write control was rejected by unchanged validatePublication, so it is
now an explicit exclusion control rather than weakening publication. A strengthened
selector baseline first failed because synthetic pair pack IDs were unbound; valid
synthetic metadata now passes baseline admission before a gate-only mutation.
Biome config initially used a string extends; corrected to its required path array.

No historical candidate, provider inference/GET/POST, workflow dispatch/validate_only,
rerun, Docker benchmark, age private identity, live uploader or hidden G4 was used.
Tests use inert trusted adapters and synthetic build receipts; cleanup assertions
are mock close acknowledgements, not a fresh Docker0/0/0 inventory observation.

OSS/provenance: original forensic code and synthetic schema/adapters; reused
repository Oracle/report/retention and existing synthetic receipt builders.
No dependency, upstream source, fixture pin or license notice was changed.
