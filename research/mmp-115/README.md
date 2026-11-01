# MMP-115 production custody — offline acceptance

Base: `d87a7029abf23c3d222bc309741d9185e502313e`. Refs #115 #107 #61.
Policy is the exact Option A contract at `f2ca41d89c96456ada5661e7a80c398a18eeb209`.
Vladimir's decision: issue107/comment6564661434; Ilia's direct ACCEPT:
[comment6564705526](https://github.com/Meta-Project2026/Metamorph/issues/107#issuecomment-6564705526).
These authorize the bounded implementation, not a paid request or self-merge.

Scope: true paid admission issues a new host custody UUID before generation; source
capture holds the branded original immutable lease and binds the original provider
receipt and candidate digest. The fresh credential-free collector receives only the
new allowlisted capsule via stdin, uses the unchanged pinned age encryptor, and commits
only ciphertext/metadata to a private Linux spool. Hard-link no-clobber commit, fsync,
directory sync and read-time hash checks precede any capture receipt. Crashed or incomplete
commits are quarantined and cannot authorize export/Oracle. Original source remains on
the private ephemeral runner; no secure erasure claim.

The new independent PRE_ORACLE finalizer inspects owned containers/volumes separately
from the unchanged original POST_ORACLE finalizer. Emergency removals block readiness.
Upload is exactly `candidate.age` in `mmp107-candidate-<runId>-1`, seven requested days.
Readback downloads the upload-produced artifact ID into a separate directory; the host
checks authenticated GitHub artifact/run metadata, archive digest and the retrieved
single-file ciphertext hash/size against the original capture before STORED_UNVERIFIED.
The paid validator rechecks persisted proofs and consumes a single-use opaque permit
before touching the Oracle source/runtime. Existing deterministic research validation
is explicitly separate. Original MMP089/097 preservation eligibility and G0–G4 are unchanged.

Transport uses existing actions:read permissions; no new secret or write permission.
The [upload action v4 contract](https://github.com/actions/upload-artifact/tree/v4#outputs)
provides an immediately addressable artifact ID. The [download action v4 inputs](https://github.com/actions/download-artifact/tree/v4#inputs)
support that ID in the current run. [Authenticated REST metadata](https://docs.github.com/en/rest/actions/artifacts#get-an-artifact)
binds run/name/head/digest. These documented capabilities do not prove a live upload or
readback happened here. Such external operations remain NOT_RUN under this assignment.
No same-UID/root hostile-host protection or independent cryptographic producer signature
is claimed; trusted workflow/host ownership and authenticated transport remain boundaries.

Plan/tasks: implement identity+lease capture → private atomic ciphertext → independent
checkpoint → authenticated readback/one-use Oracle permit → real test-key age/restore
acceptance → negatives and frozen checks → exact-head CI and independent review.
Current implementation/check evidence is recorded in the PR as it arrives.
**Offline crypto/capture/cleanup controls: PASS** (see validation.md and recorded real
Linux evidence). **End-to-end durable custody and production/paid readiness: NO_GO until
independent exact-head security review and a separately authorized live synthetic transport
proof.** No new paid proposal is
issued before production acceptance. Historical source UNAVAILABLE, cause UNKNOWN,
PRODUCT_NOT_ESTABLISHED. The response-to-durable-ack loss window remains accepted risk.

Owner restore (future owner-operated Linux machine, not agent/CI with the real identity):
download exact acknowledged artifact and public stored receipt, verify their trusted run/head,
retain a local controlled copy, and run:

```sh
node packages/agent-real/src/custody-restore.mjs /qualified/age /owner/private-identity /owner/candidate.age /owner/stored.json
```

Prepare a new owner-only directory (0700), install owned copies of both qualified pinned
`age` and `age-keygen` there, and set the identity/ciphertext/receipt files to 0600.
The executable checks both binary pins/permissions/links and derives the identity's public
recipient with qualified age-keygen, requiring the production fixed recipient. It decrypts
into bounded memory and validates
the exact capsule identity/license/manifest and canonical original source digest, and emits
only a structural MATCH/UNVERIFIED receipt. No plaintext file or fallback is written. The
private key stays on that owner's machine. Only generated ephemeral TEST identities may
be used by this task's offline exercise; a test restore is not owner-key possession proof.
The module-only testRecipient parameter is for trusted generated-key controls; the CLI
has no recipient override and never reads one from a capsule or environment.
