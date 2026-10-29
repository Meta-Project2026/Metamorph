# Evidence identities and source pointers

## Historical evidence recovered anew

Run [40900698372](https://github.com/Meta-Project2026/Metamorph/actions/runs/40900698372),
attempt 1, failure, head `d21376747c7147043ca618e149fac87c0df80111`.
Read using `gh api .../actions/runs/40900698372`, `/artifacts`, `/jobs`, the two
original `/actions/artifacts/<id>/zip` downloads and
`gh run view 40900698372 --repo Meta-Project2026/Metamorph --log`.
Guard job 123541864163 succeeded; generate-and-verify job 123541971213 failed.
Downloads/log remain outside Git; no credential retrieval or workflow mutation.

| GitHub artifact | ID | Original ZIP bytes | Original ZIP SHA256 |
| --- | --- | --- | --- |
| meta-paid-public-40900698372 | 12909716502 | 4085 | `95121c3291e4478d682dfd3375de86e2df4036f46bcdc81826ee6fdc5fb2a493` |
| meta-paid-policy-40900698372 | 12907789770 | 250 | `e7137e82dab3550cc3b2a73cc1429216b89b965d3edb2e4116f69a94254c0959` |

Both byte hashes match the API's artifact digests. Full filenames, per-file
SHA256/size, original fields and normalized observations are in
[original-evidence-audit.json](evidence/original-evidence-audit.json). ZIP members:
public finalizer.json, generation.json, trial.json and per-run attempt ledger;
policy ZIP contains policy.json only. No TS, JS, compiler stderr, source archive,
candidate transfer or private pack. The original CLI-rendered job log has 52090
bytes, SHA256 `a87f11d082fa28b1c2b2d2688ecb7d963f55baf1f8846f446c68745dc3b82f2e`,
zero numeric TS-code mentions and zero plain compiler-error headers. It records
the actual G1=FAIL/G2=INCONCLUSIVE/G3=INCONCLUSIVE validation summary.

Recovery conclusion: ORIGINAL_CANDIDATE_UNAVAILABLE and
ORIGINAL_COMPILER_ERRORS_UNAVAILABLE in the inspected authorized evidence.
Candidate digest `afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f`
is identity, not recoverable source. No synthetic TS error is attributed to it.

## Existing MMP-082 evidence read as historical context

[PR #83](https://github.com/Meta-Project2026/Metamorph/pull/83) merged at base main
`3fb4772ef9c5d2c659530ae75b3076612eb18a3f`. Read-only:
`research/mmp-082/{task-contract,plan,report,review-followup}.md`,
`docker-proof.mjs`, `evidence/40926137817/summary.json` and related receipts.
Its standalone synthetic compiler control and Node22/24 CI are previous
evidence, not a new model trial. The earlier original-control intermittent
ENVIRONMENT_ERROR in run 40907197167 remains separate
[#84](https://github.com/Meta-Project2026/Metamorph/issues/84), not fixed here.

## Owning source chain (relative to repository root)

| Boundary | Source |
| --- | --- |
| Public PHP and source inventory | `research/mmp-061/{public-source,inventory}.json` |
| Prompt + schema + request limits | `packages/agent-real/src/{migration-context,meta-migration}.mjs` |
| Signed one-shot policy/projection | `packages/agent-real/src/{meta-paid-authorization,github-meta-guard,meta-wire}.mjs` |
| Paid transfer/fresh validator | `research/mmp-078/{paid-run,validate-candidate}.mjs`, `.github/workflows/meta-paid-migration.yml` |
| Trusted source/SHA leases | `packages/agent-real/src/source.mjs`, `packages/target-worker/src/admission.mjs` |
| G1 receipt → public trial sidecar | `packages/agent-real/src/{migration-trial,runtime,compiler-diagnostics,report}.mjs` |
| Actual build/runtime | `packages/target-worker/src/{controller,runtime-broker}.mjs`, `runtime/{build,launch,profile,provenance}.mjs`, runtime package/lockfile and Dockerfile |
| Independent pair/state/evidence | `packages/oracle/src/reference/{docker,evidence,manifest}.ts`, `packages/differential/src/{target-adapter,resources,private-run}.mjs` |

There is no `runtime/run.mjs`; actual emitted-code startup is `launch.mjs`.
Source commit `d272170d0aecbd28eb5b13e272d9dd11d545b66c`, archive
`32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4`, MIT notice
`46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9`.
Manifest pin `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4`;
recipe pin `f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
All remain unchanged. The fixed original positive fixture candidate SHA is
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`.

## New measurements

Code head `b421465307d4dde3101ccbc4309660b5884d297e` is the exact Git checkout
used by the Linux matrix and original proof. [request-audit.json](evidence/request-audit.json)
records 22762-byte serialized request and changed context/request identities.
It was independently regenerated in Linux and compared with Windows.
See [offline-matrix.md](offline-matrix.md) for commands, statuses and receipt paths.
Final delivery head, PR CI and any final-head checks are pinned in the PR evidence
comment so no document pretends to contain its own commit hash.
