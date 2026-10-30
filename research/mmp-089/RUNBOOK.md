# Owner-only source diagnostics

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
