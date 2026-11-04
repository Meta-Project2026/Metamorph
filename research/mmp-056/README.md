# MMP-056 — synthetic finite registry and one-draw seam

**Status: synthetic code and tests only; independent review pending.**
Formal G4 remains **INCONCLUSIVE**, product acceptance **NOT_ESTABLISHED**,
and a real registration, draw and run **NOT_RUN**. This work is for
[#56](https://github.com/Meta-Project2026/Metamorph/issues/56) and proposes a
handoff for [#57](https://github.com/Meta-Project2026/Metamorph/issues/57),
[#55](https://github.com/Meta-Project2026/Metamorph/issues/55) and
[#183](https://github.com/Meta-Project2026/Metamorph/issues/183).

The new [package](../../packages/g4-registry/) models an ordered, finite public
fixture registry, signed transition chain, independently signed checkpoint
interface, candidate freeze, one stratified draw and bounded attempts. Each
fixture is explicitly synthetic: its only represented bytes are the UTF-8
synthetic case ID and the indexed digest must match those bytes. No real case
bytes, expected output, actual benchmark source or hidden pool is ingested.
This narrowly proves code paths, not qualification of actual case bytes or
provenance. Case IDs, source URLs, role identities and keys in tests are fake.

The format binds scope, unit/route mapping, required strata and cases, pool
order, provenance claims, comparator/runtime pins, budgets, identity/exposure
declarations and the fixed sampler before the candidate freeze. Owner,
custodian and reviewer signatures cover the appropriate transition, and the
test witness checks and signs its checkpoint. A separate witnessed
`DRAW_STARTED` is durably appended before random selection. If processing
stops after that point, no API resumes or repeats the draw. Attempt authorization
binds the current candidate/selection and is valid only for the next transition
and a maximum of five minutes. A second attempt requires predeclared ERROR
classification, explicit reviewer/custodian and both synthetic owner signatures,
the same selection, and a new attempt ID. FAIL, PASS and unclassified ERROR do
not permit a retry. A witnessed behavioral FAIL remains sticky even if a later
harness ERROR ends the attempt. All previous terminal events remain in the
journal. The future runner must actually report observed failures; this module
cannot detect a failure the controller withholds.

The public package export has no real-admission mode or caller-supplied random
seed. A separate internal module seam supplies deterministic random values only
for synthetic tests. Neither module is an authorization or security boundary
against someone who can edit/import source. A public receipt exposes only
synthetic identifiers, coarse statuses, counts, blinded commitments and
checkpoint references. It never emits the selected IDs, nonce openings or raw
fixture/identity digests. Any attempt PASS is synthetic attempt data: the G4
verdict in the receipt remains INCONCLUSIVE.

## Trust and limitations

- The witness and signers in the tests run in the same test process and hold
  fabricated keys. The witness writes a separate temporary append log and
  validates the offered transitions, but this is **not** independent human,
  host, storage, administrative or organizational custody. The package takes
  an injected witness; it does not ship a production witness service.
- A signed high-water checkpoint detects a changed or truncated local journal
  while that *live and correctly pinned witness* remains authoritative.
  Signatures attest key possession, not a person's identity, a truthful exposure
  history, actual timing, license verification, absence of collusion, or
  physical separation. Restoring both journal and witness to an old state,
  replacing their code/keys or fabricating a new witness remains in the trust
  base. Global uniqueness across independent witness installations is not
  established.
- The journal uses a cooperative exclusive lock, bounded canonical records,
  append plus file fsync, chain signatures and witness checkpoint comparisons.
  A stale crash lock fails closed. No automatic recovery or directory-fsync,
  power-loss, WORM, tamper-proof clock, host filesystem/ACL or malicious-root
  guarantee is claimed. If the witness advances but the local append fails,
  recovery blocks instead of silently replaying or drawing again.
- The synthetic owner callback signs a digest; the tests do not establish that
  real owners independently reviewed its meaning. The journal contains
  synthetic pool entries, selected IDs and nonce openings in plaintext.
  **Do not point it at real or private material.** Its declaration checks are
  not evidence that a real corpus is unexposed, licensed, complete or safely
  stored. Production custody, key isolation and a reviewed signing protocol
  must be designed separately.
- Freeze identities and G0/G1 receipt digests are syntactic bindings. The
  implementation does not read candidate bytes, authenticate a #183 receipt,
  build anything, execute a case, inspect a real license or verify storage.
  A synthetic PASS is an explicitly supplied result, not an Oracle result.
- No changes were made to contracts, Oracle, comparator, worker, #55 or #57.
  The #55 field mapping in [interface.md](interface.md) is a tested compatibility
  proposal, not owner agreement or a deployed integration.

## Decision ledger

The source decision record is
[`specs/017-formal-g4/decision-record.md`](../../specs/017-formal-g4/decision-record.md).
These are real authority decisions, separate from synthetic test signatures:

| Decision | Remaining evidence or decision |
| --- | --- |
| D1 | Both owners' authenticated acceptance of the exact protocol, threat model, storage and checklist remains pending. |
| D2 | Both owners must choose an independence profile and name qualified C/E/R, storage admins and recovery delegates, with verified exposure/conflict and privilege boundaries. No qualified private custodian/pool is established here. |
| D3 | Both owners must agree a real benchmark source and license, complete versioned scope, unseen finite pool and selection rules; no real registration exists. |
| D4 | Local-first / 180-day retention / day-90 restore were reported as jointly agreed; the independently authenticated second-owner receipt and concrete physical media, key custody, restoration and administration remain pending. #55 tracks actual deployment. |
| D5 | Both owners must accept real attempt/finality/invalidation rules and budgets; synthetic signatures do not make that choice. |
| D6 | Both owners' scoped implementation/integration decision and independent code/security review remain pending, including actual #26/#34 dispositions and any shared-interface changes. |
| D7 | A separate exact-candidate/epoch/budget authorization and subsequent evidence-based review/acceptance are NOT_RUN. |

`G4_PROTOCOL_READY` and `IMPLEMENTATION_READY` require the corresponding
independent owner/reviewer evidence; they are not implied by this code or tests.
`REGISTERED`, `CANDIDATE_FROZEN`, `SELECTION_COMMITTED`,
`AUTHORIZED_RUN` and `G4_PASS` are not real-world statuses for this slice.
The synthetic receipt prefixes its internal states with `SYNTHETIC_`.
`NOT_RUN` is an execution label, not a fifth `VerdictSchema` value.
