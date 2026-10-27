# MMP-008B validation

Base: `242fd49cfee891063836827eea3d8087249097ba` (fresh main at reconnaissance).
Branch: `feat/mmp-008b-ilia-workshop-target`; Git author/push account `l1ncolny`.
Issue21 explicitly delegates target-side work to Ilia. No co-owner approval implied.

Candidate source, source/archive/license hashes were inspected without running
PHP or candidate TS on the host. Typecheck/build/run of admitted candidates is
reserved for disposable Docker. Public source hash is pinned in workshop-policy.

Local Windows checks (Node v24.21.0, pnpm11.25.0): frozen install, lint,
typecheck, root test65/65 and build each exited0. Differential78 total:77PASS,
one POSIX-only evidence test SKIP, exit0. Reference56 total:55PASS, one
POSIX-only evidence test SKIP, exit0. Target-worker69/69PASS, exit0.
An unchanged bridge test initially exposed a prototype-call compatibility bug
in the new validation helper; implementation fixed, original test retained,
full differential/target suites rerun successfully. First lint formatting errors
were corrected before the passing lint. Candidate was never compiled/run on host.

Hosted execution on `d15daefdcde0c2678ee72f8ccc707f15cdfa7ae6`:
[manual run40572153508](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572153508)
completed SUCCESS. Proof job122428907476; regressions job122428907657.
[Fast CI40572161818](https://github.com/Meta-Project2026/Metamorph/actions/runs/40572161818)
completed SUCCESS for Node22 and24. Frozen install, lint, typecheck, root65/65,
build, reference56/56, differential78/78 and target69/69: exit0 on Linux, no skips.
Manual workflow has only workflow_dispatch. Its first dispatch on337523b failed
YAML validation (runner context at job env); fixed before any Docker execution.

Real admitted candidate typecheck/build and smoke: PASS in isolated Node24.11.0,
TypeScript5.9.3, SQLite3.50.4. PHP7.4.33/SQLite3.34.1 reference remains independent.
CandidateSHA `34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`.
Runtime recipeSHA `77f812f131f04073d0292b83e2d9ac2f8465e1c3eb82bff5cd5cf2aaf498a36c`.
Actual image digests and all12 pair-pack hashes are in [public-evidence.json](public-evidence.json).

Each row below executed in BOTH clean passes: real G2 PASS and G3 PASS per
scenario. No initial/HTTP/state divergence occurred. Exact executedTestIds and
per-run findings are retained in the generated allowlisted summary. Independent
coverage recheck confirmed34 HTTP +40 DB comparisons (6 initial +34 post-step).
There is no invented aggregate Oracle gate. Bootstrap/readiness is excluded.

Coverage required for each of two passes:

| Scenario | HTTP comparisons | Initial DB | Post-step DB |
| --- | ---: | ---: | ---: |
| workshop-business (each pass) | 6 | 1 | 6 |
| workshop-rejected (each pass) | 5 | 1 | 5 |
| workshop-capacity (each pass) | 6 | 1 | 6 |

Real storage controls: tmpfs16,777,216bytes measured with statfs; auxiliary
ENOSPC after16,760,832bytes; WAL SQLITE_FULL after14,614,528logical inserted bytes.
Separate admitted candidate programs independently hit auxiliary ENOSPC/WAL
SQLITE_FULL. Valid primary DB snapshots remained inspectable after releasing probe
files. Corrupt DB rejected; hung socket timeout, crash and cancelled readiness
rejected; each control cleanup verified. Reset after quota controls retained the
same aggregate deadline and returned a fresh DB; original real-monotonic timeout,
eight resets, typed SQLite and lifecycle failure controls remained green.

Original `/items` Docker30/30: PASS. Exact unchanged old mismatch pilot: regression
PASS with G2 INCONCLUSIVE/0HTTP, G3 FAIL/1initialDB (`DB_SCHEMA`,`DB_STATE`), G4
INCONCLUSIVE. Its default profile still has the historical read admission limit;
the workshop write quota is an explicit additional profile capability.

Both independent job finalizers: containers0, volumes0, emergencyRemoved0, PASS.
Private packs were sealed/hash-verified after teardown. Provenance packSHA
`6d9f3e6a3d0c6d1795816659df39fa111c5db5972afd4e7546a1d65314338077`.
Only safe public JSON downloaded. ZIP bytes independently SHA256-verified against
GitHub digests: proof artifact12765538339
`025af2093ab454cca44f8df27bf30e0595ae98228e5b8bce6b58f051c6881951`;
regressions12765733186
`4bfaeecea00666839203050de5cb39ebfa1d5f5b3556e7c2782c79e2e3816df7`.
Raw packs are runner-local and ephemeral; hashes/public summaries do not provide
external raw retention. Actions public artifacts expire after7days; checked-in
public-evidence contains structural receipts only.

This report and public receipt are added after the tested implementation commit.
Final PR-head rerun is required and linked in PR22; the receipt above applies
specifically to d15daef, not automatically to later commits. The final revision
also strengthens reset control: persist/independently observe a real dirty marker,
then assert its absence and an empty appointments table after reset. The candidate,
profile, comparators and original regressions are unchanged. Final head is
identified by the rerun's headSha and runtime recipe digest.

G4 runs the unchanged nine independent synthetic comparator controls per pair,
but remains INCONCLUSIVE (`HELD_OUT_NOT_RUN`). G0 completeness, external retention,
benchmark registration, model usage and product PASS remain NOT_RUN/NOT_ESTABLISHED.
