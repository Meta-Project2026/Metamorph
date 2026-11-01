# MMP-107 decision request — DECISION_PENDING

Research only, based on canonical main `c3f697b4fcbd5ca9162ff47e0659659e07a1defc`.
Refs [#107](https://github.com/Meta-Project2026/Metamorph/issues/107),
[#61](https://github.com/Meta-Project2026/Metamorph/issues/61),
[#104](https://github.com/Meta-Project2026/Metamorph/issues/104).

The admitted candidate exists before Oracle: the source lease freezes its files,
and generation checks candidateSha against the provider receipt before releasing
the lease (`packages/agent-real/src/source.mjs:35`, `migration-trial.mjs:85`).
The verifier attempt UUID is allocated later (`runtime.mjs:523`). Early custody
therefore needs its own host-issued generation custody attempt identity, followed
by an explicit link to the later verifier UUID; it cannot pretend that UUID already exists.

Existing `preserve.mjs:43` intentionally skips collection/encryption for incomplete
verification. One pair build PASS does not satisfy aggregate G1 or preservation.
The historical candidate is UNAVAILABLE, root cause UNKNOWN. A hash is not an archive.
Current trusted stage telemetry improves diagnosis without recovering source.

| Choice                               | Availability                                                                    | Additional exposure/authority                                                      | Assessment                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A: admitted candidate before Oracle  | Preserves even if no build finishes, once ciphertext checkpoint is acknowledged | Capture/export of unverified source; malicious/secret-echo source remains possible | Recommended, with a distinct pre-Oracle checkpoint and explicit approval    |
| B: after one genuine pair build PASS | Loses source if the first build/provision never completes                       | Partial-result export; genuine trusted build receipt required                      | Smaller eligibility expansion, weaker protection against this failure class |
| C: existing selectors plus telemetry | Still loses source on partial/error paths                                       | No new export authority                                                            | Current production behavior; insufficient for recovery                      |

Recommend **A with two phases**, implemented only after both owners accept
[contract-v1.md](contract-v1.md) and a separate implementation passes independent review:

1. Capture the exact admitted immutable bundle into bounded ciphertext in a
   credential-free trusted collector, before any Oracle worker. Fixed existing
   owner public recipient, independently pinned tools; no private identity on runner.
2. A **new pre-Oracle checkpoint gate**, distinct from the existing post-Oracle
   selector, verifies capture/collector/encryptor cleanup and independent owned-resource
   inventory 0 containers / 0 volumes / 0 emergency removals. Upload exactly the
   ciphertext to an explicitly approved seven-day GitHub artifact. Require a trusted
   upload acknowledgment and matching retrieved ciphertext digest before starting Oracle.
   Later Oracle cleanup and results are reported independently and cannot rewrite custody.

This uses the existing ciphertext transport audience instead of introducing a new
storage service. Repository readers can download ciphertext; only the pinned key
holder should decrypt. Approval must explicitly accept this audience and the fact
that downloaded ciphertext cannot be revoked. Artifact expiry is not key destruction.
The owner downloads a copy to their own controlled storage; it is not owner-local
until that action is confirmed. Owner restore is rehearsed with a synthetic capsule
before authorizing a real request; private keys never enter CI or this prototype.

Encryption in RAM or on an ephemeral runner alone is **not durable custody**.
No crash guarantee exists between receiving the model response and a successful
durable checkpoint. This unavoidable window, failed checkpoints and unknown billing
must be acknowledged in the next experiment authorization. Do not start Oracle after
failed/missing acknowledgment; do not issue an automatic retry/model request.

The proposed new authority is precisely: retain admitted unverified candidate-only
bytes even without any G1 completion; publish their fixed-recipient ciphertext after
the new pre-Oracle cleanup checkpoint, including when subsequent G1/G2/G3 are partial,
ERROR or cancelled. No raw diagnostics, reference/Oracle/G4 export, verdict changes,
new recipient, broader file allowlist, paid call or arbitrary upload destination.
If a pre-Oracle checkpoint is rejected, A can remain runner-local quarantine, but
that weaker variant does **not** satisfy durable recovery readiness for the next paid trial.

Both owners must identify the exact reviewed contract commit and explicitly accept
or reject A, its checkpoint scope and public-ciphertext audience. Neither #104 approval,
the old paid authorization, this research PR, green CI nor silence supplies consent.
Production integration and genuine product acceptance remain separate gates.
