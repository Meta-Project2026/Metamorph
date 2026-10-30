# Failure retention — actual policy, not a universal recovery promise

Audited implementation: main `53b4d5a1da99e49a223fa9cafe03ff24b280bf86`.
**NO_GO_PENDING_PARITY_RETENTION_DECISION.** This document proposes no policy
expansion and authorizes no spend or export.

## Code evidence

All links pin the audited revision:

- [preserve.mjs L43](https://github.com/Meta-Project2026/Metamorph/blob/53b4d5a1da99e49a223fa9cafe03ff24b280bf86/research/mmp-089/preserve.mjs#L43)
  returns `NOT_APPLICABLE` for generated G1 PASS, ERROR, INCONCLUSIVE or NOT_RUN.
- [diagnosticIdentity L69](https://github.com/Meta-Project2026/Metamorph/blob/53b4d5a1da99e49a223fa9cafe03ff24b280bf86/packages/agent-real/src/private-diagnostics.mjs#L69)
  requires G1 FAIL, BUILD_FAILED, downstream INCONCLUSIVE/NOT_RUN, exact
  run/head/source/candidate/attempt/pair, one business pair and selected sealed
  receipts. L121 requires normal cleanup 0 containers/0 volumes/0 emergency.
- [validator L24](https://github.com/Meta-Project2026/Metamorph/blob/53b4d5a1da99e49a223fa9cafe03ff24b280bf86/research/mmp-078/validate-candidate.mjs#L24)
  exits0 only for public G1/G2/G3 PASS and verified cleanup; all other observed
  verdicts exit1. Candidate source was saved privately by generation and copied
  into verification, not deleted by successful Docker inventory checks.
- [workflow L105](https://github.com/Meta-Project2026/Metamorph/blob/53b4d5a1da99e49a223fa9cafe03ff24b280bf86/.github/workflows/meta-paid-migration.yml#L105)
  explicitly uses `!cancelled()` and generation success, so validator exit1 still
  permits preservation. Finalizer L109 is `always()`. Gate L116 requires both
  producer outcomes success; upload L123 additionally requires `eligible=true`.
- [upload gate L24](https://github.com/Meta-Project2026/Metamorph/blob/53b4d5a1da99e49a223fa9cafe03ff24b280bf86/research/mmp-089/prepare-upload.mjs#L24)
  catches rejection, emits `eligible=false` and exits0. Gate-step success alone
  never means retention. It validates fixed record/identities, ciphertext
  size/digest, normal cleanup and finalizer PASS/0/0/0 before eligibility.
- [record-upload L9](https://github.com/Meta-Project2026/Metamorph/blob/53b4d5a1da99e49a223fa9cafe03ff24b280bf86/research/mmp-089/record-upload.mjs#L9)
  records PRESERVED only after actual upload success; upload failure becomes
  UPLOAD_FAILED. Invalid record/outcome exits1.

## Truth table

V = validation CLI; P = preservation CLI; G = upload eligibility CLI;
U = artifact action; R = recording CLI. Values describe source-derived behavior,
not newly executed Docker cases. Unless specified, generation completed, exact
bound receipts are intact and all cleanup conditions pass.

| Actual outcome | Exit/outcome chain | Private source during run? | Durable candidate after runner destruction? | Public diagnostics and unrecoverable information |
| --- | --- | --- | --- | --- |
| G1 FAIL / BUILD_FAILED | V1; P0 ENCRYPTED_PENDING_UPLOAD; G0 eligible=true; U success; R0 PRESERVED. Workflow remains failure because V1 | Yes: generation/verification source and selected sealed bridge records | One fixed `.age`, **only after successful upload**, seven-day retention; owner decryptability still NOT_VERIFIED | Candidate/identity hashes, gate IDs/counts/codes; bounded compiler code/path/line/column/count if parser succeeds. Ciphertext contains admitted TS, compiler phases and manifest only. Reference/Oracle/G4 are not exported |
| G1 PASS → G2 FAIL | V1; P0 NOT_APPLICABLE; G0 eligible=false; U/R skipped; workflow failure | Yes, private ephemeral roots/packs | **No approved ciphertext; source lost with runner** | HTTP finding codes/coverage/hash remain; TS and exact private HTTP values cannot be recovered from hashes |
| G1 PASS → G3 FAIL | V1; P0 NOT_APPLICABLE; G0 eligible=false; U/R skipped; workflow failure | Yes | **No approved ciphertext; source lost** | DB/HTTP structural findings/counts remain; exact TS/state/observations unavailable after runner |
| G1 ERROR / TIMEOUT / ENVIRONMENT_ERROR | V1; P0 NOT_APPLICABLE; G0 false; U/R skipped | Generated root normally exists; verifier pack only if source-record stage was reached | No approved source preservation | Fixed ERROR/TIMEOUT codes do not establish a TS compiler diagnostic. Precise command/phase/private output may be lost |
| G1 INCONCLUSIVE / NOT_RUN after generated candidate | V1; P0 NOT_APPLICABLE; G0 false; U/R skipped | Conditional on completed generation/transfer | None established | Missing coverage remains unexecuted; no reconstructed source |
| G1/G2/G3 PASS | V0; P0 NOT_APPLICABLE; G0 false; U/R skipped; workflow can succeed | Yes | **No durable generated TS**, even on public success | Scoped verdict/coverage/digests survive; success cannot be reproduced from digest alone. G0/G4 still INCONCLUSIVE |
| Generation/transfer fails, including timeout after possible POST | Generation1; V/P/G/U/R skipped; finalizer still requested | None guaranteed; partial private data may exist | No approved candidate ciphertext | Sanitized generation/UNKNOWN charge receipt may survive; no claim of a complete generated candidate |
| Cancellation before preservation/upload | Work may abort/report exit1; OS exit may be unavailable; P/G/U/R skipped on cancelled job | Partial private data possible | No guarantee | `always()` requests finalizer/public upload but cannot survive hard runner loss/SIGKILL |
| Missing/failed normal cleanup | V1; pair cleanup fault can force publicG1 ERROR → P0 NOT_APPLICABLE. If G1 remains FAIL but aggregate cleanup receipt is invalid/missing → P1 REJECTED. No upload | May exist privately | No approved upload | Cleanup error is preserved; a later empty inventory does not erase emergency removal or failed cleanup |
| Independent finalizer fails/missing | P may0/pending; finalizer1 or unavailable; G/U/R skipped | May exist; ciphertext may be ephemeral | No approved upload | Final inventory/error evidence if written; not PRESERVED |
| Incomplete/tampered private source/pack, wrong identity/recipe, secret marker or crypto failure while selecting otherwise eligible G1 FAIL | P1 REJECTED; G/U/R skipped. Other G1 states short-circuit as NOT_APPLICABLE before pack inspection | Partial/invalid source may exist | No approved upload; no plaintext fallback | Fixed preservation status only; no raw pack/error export |
| Receipt/ciphertext tampered after preservation; upload gate closed | P0 may precede tamper; G0 eligible=false; U/R skipped | Yes privately | No established upload | Gate success is not eligibility. Ciphertext digest mismatch never authorizes fallback |
| Artifact upload fails | V1; P0; G0 true; U failure; R0 UPLOAD_FAILED | Yes until runner ends | **Not established**; do not assert the service retained zero partial artifact | No authenticated PRESERVED receipt; source recovery cannot be relied on |
| Upload succeeds, cancellation/recording failure follows | U success; R skipped or1 | Yes until runner ends | Ciphertext may actually exist, but PRESERVED chain is incomplete | Inspect actual action/artifact plus trusted identities; missing receipt is not proof of absence or valid recovery |

Compiler environmental exceptions/signals are ERROR, not semantic FAIL. Unchanged
`runtime.buildReceipt` distinguishes real compiler nonzero exit from timeout,
cancel, spawn/overflow, inner error/signal/noninteger exit. The old #84 timeout
cannot be relabeled as a model TS error to admit an export.

The approved route encrypts memory/pipe-selected data; it does not archive mixed
evidence directories. Existing private originals remain until ephemeral-runner
disposal under current policy. Zero Docker inventory is not proof those originals
were securely erased. No in-process mechanism guarantees preservation after
hard termination. Seven-day expiry does not revoke previously downloaded copies.

## Owner choices, both currently undecided

1. **Explicitly accept the loss risk** for G2/G3 failure, G1 ERROR, cancellation
   and even a successful candidate. State the exact experiment's reduced
   diagnostic objective and separately authorize one POST only after other
   readiness conditions pass. No such acceptance has been given here.
2. **Separately authorize a minimal extension** before the second POST. Open a
   focused implementation issue/PR after the owner's export-content decision:
   candidate-only admitted TS plus minimal bound per-file manifest for G1 PASS
   with G2 or G3 FAIL. No raw HTTP/DB values, compiler/runtime logs, reference,
   Oracle/comparator or held-out packs. Keep identity/caps/recipient/fixed upload,
   clean environments, encryption and all cleanup/upload receipt checks. Decide
   G1 ERROR/all-PASS scope explicitly rather than expanding it by implication.

The extension would require authentic fresh real-Docker G2 and G3 failure
controls, unchanged positive/gate semantics, wrong identity/partial source,
cleanup/cancel/crypto/upload-denial negatives, independent source/hash roundtrip,
and exact-pushed-SHA independent review. It belongs to a separate authorized PR,
not this documentation package. The current #94 decision already tracks the gap;
no production implementation is technically required to finish this audit.

The older MMP-086 `recipient: NOT_PROVIDED` and no-preserver discussion is
historical. Current main pins the approved public recipient and implemented
Option B. That implementation closes only its narrowly approved G1 failure case.
