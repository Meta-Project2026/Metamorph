# Historical evidence custody

Retrieved through authenticated GitHub artifact API as exact ZIP bytes; SHA256
is computed for ZIP and each uncompressed member before reading JSON. Only
existing public allowlisted artifacts are inspected. The machine-readable
custody records identify bytes, hashes, source/run/attempt/job and provenance.
No private evidence pack is reconstructed from a public pack digest.

| Incident / control | Run | Source SHA | Result |
| --- | --- | --- | --- |
| #84 original | [40907197167](https://github.com/Meta-Project2026/Metamorph/actions/runs/40907197167) | d9b5f62a9313e2b40727a7f9407662d98c6ec85e | PARTIAL / EVIDENCE_ERROR; initial G1 ERROR; later repair + six controls pass; cleanup 0/0/0 |
| #84 later control | [40926137817](https://github.com/Meta-Project2026/Metamorph/actions/runs/40926137817) | c1fc7183d3ea6388c122b1885aed80f1cc0e7bf0 | PASS_SCOPED; no causal fix demonstrated |
| #34 original, attempts 1 and 2 | [40588295315](https://github.com/Meta-Project2026/Metamorph/actions/runs/40588295315) | a14429ca9d5ac565dbb618e9f9c26297c9ead30b | items-smoke ERROR; negative pilot PASS; final inventory 0/0 but emergencyRemoved=1 each |
| #34 previous standalone controls | [40753497017](https://github.com/Meta-Project2026/Metamorph/actions/runs/40753497017) | source d133e65be24d939d86b9e43a83e4ba8770ecffd9 or a14429ca9d5ac565dbb618e9f9c26297c9ead30b; driver c86bce6e5d70f264d2b236d6654582e5b553a7fc | 2 repetitions per source, each 30/30; child exit0; cleanup 0/0/0 |

For #34, ZIPs 12771614054 (attempt1) and 12773531413 (attempt2) differ, while
both `regressions.json` and `finalizer.json` member bytes are identical. The
original historical SHA includes **dbb618**; the attachment's single-b spelling
does not identify the actual workflow commit.

## Attribution matrix

| Field | #84 known-good failure | #34 historical regressions |
| --- | --- | --- |
| Public failing scope | First target build/G1 observation plus operation BUILD_FAILED; final proof predicate EVIDENCE_ERROR | items-smoke child or wrapper validation ERROR |
| Exact Docker command | UNKNOWN; build boundary supported by code/receipt combination | UNKNOWN |
| Exit / signal / timeout | UNKNOWN for CLI and inner process | UNKNOWN for child and command |
| Reference HTTP / SQLite | No comparisons executed, 0/17 and 0/20 | Exact failing smoke case unavailable; mismatch pilot has its own separate PASS receipt |
| Readiness / DB stage | No evidence that the first pair reached these stages | UNKNOWN |
| Private diagnostics | Only sealed-pack IDs/digests; original contents unavailable here | Original child/case/private command receipts unavailable here |
| Normal cleanup | VERIFIED_ZERO_RESOURCES; all recorded pair scopes and completion | Not established; finalizer observed a survivor |
| Independent finalizer | 0 containers / 0 volumes / 0 emergency removals | 0 containers / 0 volumes after 1 emergency removal |
| Actual leak evidence | No surviving resources at observed cleanup boundaries | One residual resource before emergency cleanup; role/type UNKNOWN; zero after finalizer |

`packages/oracle/src/reference/docker.ts` verifies PHP image identity, creates
separate state, probes readiness and closes reference resources. In the #84 first
pair target provision precedes `verifyPair`; the available signature is not
evidence of a PHP failure. `workshop-controls.mjs` executes six independent
negative runtime cases and checks expected error plus worker cleanup.
`workshop-finalizer.mjs` never converts emergency recovery into normal success.

The #34 wrapper `workshop-regressions.mjs` and `target-worker/src/smoke.mjs` are
unchanged between a14429c and this base. See the existing
[independent #34 investigation](../mmp-034/incident-review.md) for prior source
triangulation and its explicit standalone-versus-wrapper limitation.

At reconnaissance, PR #87 was open at a10265532e7c24024294a378c209703cc4ff1ae8;
no #89 PR was listed, while issue #89 remains active owner-private work.
This change does not touch either implementation or their shared policy paths.
