# Owner-only source diagnostics

MMP-097 adds a separate candidate-only payload for **G1_PASS_COMPLETED** after
all manifest pairs finish G2/G3 with PASS/FAIL and normal cleanup. It uses
`mmp097-candidate-only-v1`, with no compiler/runtime/HTTP/DB data. Its identity
case and bindingsSha256 must match the trusted public preservation receipt;
recompute every source hash/byte manifest and canonical candidateSha. There is
no compilerSha256 in this variant. Legacy **G1_BUILD_FAILED** remains
`mmp089-private-diagnostics-v1`, with the compiler checks described below.
Missing/unknown formats or cross-variant receipts must be refused.

The approved recipient/limits/fixed artifact/seven-day policy stay unchanged.
Actual new-case Docker/crypto acceptance remains NOT_TESTED and owner-key
decryption NOT_VERIFIED; see [MMP-097](../mmp-097/README.md). No paid call or
workflow dispatch is authorized by this extension.

The approved recipient is pinned in [spec.md](spec.md). Only its public key is
in this repository; the owner private key stays on the owner's own device.
No diagnostic task, reviewer or CI step needs that private key.

An eligible future run produces one `candidate-diagnostics.age` in a separate
seven-day Actions artifact. GitHub read access controls ciphertext download,
not decryption. The public `preservation.json` must report `PRESERVED` with an
actual successful upload; `ENCRYPTED_PENDING_UPLOAD`, `REJECTED` and missing
records do not establish durable availability. The implementation controls use
synthetic candidates and do not imply another model request was made.

Before decrypting, obtain the trusted public receipt for the exact reviewed
run/head/source/candidate/attempt/pair and compare the downloaded ciphertext's
SHA-256 and byte count with that receipt. Check the pinned recipient fingerprint
and tool version/hash. An age file alone does not authenticate its sender.

Decrypt on the owner's device into a private temporary file, never stdout,
shared logs or a public upload. Require age to finish with exit 0 before using
the result. Age streams plaintext: tampering can cause a nonzero exit after
earlier plaintext chunks have already been written. Treat any partial output
from a failed or interrupted decrypt as unauthenticated and do not use it.
Do not infer that a tamper-refusal test proves zero plaintext was emitted.

After successful decryption, parse the bounded JSON as data. Verify every
source file's SHA-256/byte count against its manifest; use the unchanged
`validateBundle` canonicalization to recompute `candidateSha` and compare with
the trusted exact-run public receipt. Recompute `compilerSha256` from the
serialized compiler object and compare all bound identities. Per-file hashes
are inside the encrypted package; the public candidate digest binds the whole
canonical bundle. Reject mismatches before troubleshooting.

Source and compiler output remain untrusted input. Inspect them as text; never
import/run recovered TS, install a candidate package, or run candidate commands
on the host. Any authorized reproduction must use the existing network-off
worker sandbox with the unchanged recipe and budgets. Artifact expiry cannot
revoke downloaded copies; the owner manages local plaintext, copies and key
retention under the approved policy.

This work cannot recover the historical MMP-081 candidate or compiler error:
ROOT_CAUSE_UNKNOWN remains. A future paid trial requires its own reviewed exact
main SHA/request/context, current pricing and explicit one-POST authorization;
no retries, failovers, reruns or repairs are authorized by this runbook.
