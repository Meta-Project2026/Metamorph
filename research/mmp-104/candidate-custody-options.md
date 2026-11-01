# Candidate loss prevention — separate policy decisions required

Current run41327197036 is unrecoverable from the available public artifacts.
Candidate hash is an identity, not a source archive. No retry can recover identical
bytes by assumption. No source reconstruction, owner-key access or provider call
was attempted. #100's authorized single attempt is consumed.

Current [preserve.mjs](../mmp-089/preserve.mjs) deliberately emits NOT_APPLICABLE
for aggregate G1 INCONCLUSIVE/ERROR/NOT_RUN and for G1PASS with incomplete parity.
This is expected behavior under the approved contract, not proof of an encryption
failure. Selectors require full trusted bindings and normal cleanup; upload also
requires the independent finalizer0/0/0. Genuine BUILD_FAILED and completed
G1PASS+G2/G3PASS/FAIL retain their existing reviewed variants. Nothing changes here.

| Option                                                                                                | Benefit and boundary                                                                                                              | Decision status                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Keep current rule, add reviewed stage telemetry                                                       | Diagnoses the failing boundary with no expanded source export; candidate can still be lost on partial verification                | Current rule retained; production telemetry integration needs shared API review                  |
| Encrypt admitted candidate immediately after generation, before verification                          | Can preserve expensive output despite later verifier ERROR; candidate-only TS/manifest/identity, no provider reply or Oracle data | **NOT AUTHORIZED**; independent security review and new owner-approved retention policy required |
| Separate candidate-only UNVERIFIED variant after one genuine pair build PASS and partial/error parity | Binds source to observed build but preserves aggregate INCONCLUSIVE/ERROR; no runtime/compiler/Oracle/G4 data exported            | **NOT AUTHORIZED**; separate documented gate and independent security approval required          |

For either expanded option, the decision must specify trusted generation and exact
run/head/source/candidate/attempt binding, candidate admission/type/size bounds,
public-source-only scope, no raw provider payload, strict allowlist, fixed pinned
recipient, encryption failure/cancellation rules, cleanup/resource proofs,
fresh secret-free process and upload eligibility. Preserve meaningful UNVERIFIED
labels; never promote partial G1/parity to PASS to reuse an existing gate.

Security tests must reject foreign identities, mutated/oversized candidate bytes,
secret-marker cases, incomplete/forged build receipts, raw Oracle/reference/G4
records, unsuccessful finalizers and upload failure; no plaintext fallback.
Candidate content itself may contain echoed data, so marker filtering alone is
not a confidentiality proof. If choosing earlier retention, explicitly approve
the absence of later build/parity proof instead of silently removing that check.

Any future ciphertext is downloadable by public-repository readers for seven days;
encryption does not create owner-only GitHub ACLs or revoke downloaded copies.
Owner-local recipient/challenge attestation and actual upload/decrypt verification
remain separate facts; no new attestation is claimed by this task. Only the owner
handles the private age identity; no agent receives it or its local path.

Decision gate: explicit scope agreement by both owners for shared runtime/API work,
a separately reviewed retention design, independent security approval, focused
implementation/negative controls and independent exact-SHA review. Approval of this
forensic PR approves none of those export options and no additional paid attempt.
