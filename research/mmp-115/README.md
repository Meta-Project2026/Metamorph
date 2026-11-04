# MMP-115 production custody — offline acceptance

Original implementation base: `d87a7029abf23c3d222bc309741d9185e502313e`. Refs #115 #107 #61.
Historical main synchronization and separate MMP122 evidence: see [validation.md](validation.md).
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
readback happened in this production path, which remains NOT_RUN. The separate MMP122
one-shot synthetic service transport has byte-identity evidence PASS but overall workflow
FAILURE; see validation.md. Its upload permission is consumed. No new upload is authorized.
No same-UID/root hostile-host protection or independent cryptographic producer signature
is claimed; trusted workflow/host ownership and authenticated transport remain boundaries.

Plan/tasks: implement identity+lease capture → private atomic ciphertext → independent
checkpoint → authenticated readback/one-use Oracle permit → real test-key age/restore
acceptance → negatives and frozen checks → exact-head CI and independent review.
PR #117 was independently accepted for scoped merge and merged; that acceptance
remains distinct from production operational readiness. The current
[offline operational gate review](operational-gates-review.md) audits
main bb8f548bae35f9add0402c855da0cd247a124cf6 and records the remaining decisions.
**Archived Linux age/capture/cleanup report: 3/3 PASS; NOT_RUN in this review.**
See validation.md for executor reports and separate current offline tests. **End-to-end durable custody and production/paid readiness: NO_GO.**
Full production generate/capture/transport/readback/Oracle E2E and actual owner-key
restore remain NOT_RUN and require distinct authorization/owner action. Separate
MMP122 transport evidence is not full production execution.
No new paid proposal is
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

## Current status addendum — 2026-11-04 (append-only; the snapshot above is preserved)

Post-snapshot facts, each within its own evidence boundary: the full production
chain for one real candidate was executed in paid run
[#41505679809](https://github.com/Meta-Project2026/Metamorph/actions/runs/41505679809)
at exact `main@a01bb65f8bb58c02c7a59e06ffedc9662576478e` — generate (candidate
`6140dbed…`), custody capture/encrypt (`CAPTURED_UNVERIFIED` →
`CHECKPOINT_READY_UNVERIFIED` → `STORED_UNVERIFIED`), pre-Oracle finalizer 0/0/0,
authenticated artifact upload (13169609004, ciphertext SHA `1afcc2a0…`, 31094
bytes) and exact-ID readback verified against the public receipt, then Oracle
`G1=PASS G2=FAIL G3=FAIL` and post-Oracle finalizer 0/0/0. Custody repeated with
cleanups 0/0/0 in run #41856569137 (artifact 13338306385). The earlier sentence
"Full production generate/capture/transport/readback/Oracle E2E and actual
owner-key restore remain NOT_RUN" is therefore **superseded for this specific
candidate/run**: the E2E chain ran, and `OWNER_RESTORE_PASS` for artifact
13169609004 is `owner-reported` (2026-11-02, #115) — attested by the owner with
the private age identity offline, not independently rerun by any agent or
reviewer. The acceptance verdict and matrix live in
[`research/issue-closeout-2026-11-04/115-custody-acceptance.md`](../issue-closeout-2026-11-04/115-custody-acceptance.md).
Unchanged: this is not formal G4 dual-domain durability (#55/#57), not product
acceptance (#61 NOT_ESTABLISHED); artifacts are GitHub-public-downloadable for
seven days, not owner-only or revocable; `STORED_UNVERIFIED` refers to pre-Oracle
product verification state only; cross-revision capsule restore compatibility is
still NOT_RUN. Custody artifacts for this run expire 2026-11-09 ~19:00 UTC.
