# Proposed candidate custody v1 — DECISION_PENDING

This contract grants no authority until both owners sign the exact reviewed commit.
It is separate from unchanged MMP-089/097 eligibility. No production module imports
this research code. The inert TEST format is deliberately incompatible with production age.

## Identity and payload

Before generation the trusted host allocates a new `attemptId` UUIDv4 for
**GENERATION_CUSTODY**, not a verifier attempt. Bind exactly `runId` (positive decimal),
`runAttempt` (`"1"`), `headSha`/`sourceSha` (40 lowercase hex), `candidateSha` (64 lowercase
hex), `attemptId`. Missing/mismatched identities reject. Host authorization and provider
admission supply expected bindings independently of worker JSON. Record generation
sequence 1, request-body/response/context/manifest SHA-256 in encrypted admission metadata.
Later trusted verifier receipts link their separately minted attemptId/pairIds to this
custody identity through the same run/head/source/candidate pins; absence remains absence.

Proposed plaintext format `mmp107-candidate-only-v1`, exact fields:

| Field                               | Allowed value                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| format / verification / attemptKind | fixed version / UNVERIFIED / GENERATION_CUSTODY                                         |
| identity                            | exactly the six bindings above                                                          |
| admission                           | generationAttempt=1 and the four trusted admission hashes above                         |
| license                             | MIT, pinned public upstream commit/archive/notice hashes; verified retained full notice |
| manifest                            | sorted unique `{path, bytes, sha256}` for every admitted file                           |
| files                               | sorted exact `{path, content, sha256}`, identical to the admitted snapshot              |

Only 1–64 UTF-8 `src/**/*.ts`, mandatory `src/main.ts`, 256 KiB/file,
1 MiB combined source. Reject traversal, reserved Windows names, reference/oracle/tests/
fixtures/heldout/policy/ci paths, case-folded duplicates, NUL, malformed UTF-8, links,
nonregular files and unexpected fields. Canonical candidateSha is SHA-256 of JSON
of sorted `{path,sha256,content}` entries, matching current admission. Recompute all
digests/sizes from captured bytes, never supplied manifest claims. Bound the encoded
plaintext at 2 MiB, ciphertext at 3 MiB and collection/encryption at 30 seconds.
Escaping can exceed the envelope bound even when source bytes fit; reject, do not truncate.

Source/license scope is the frozen public workshop API, not general proprietary projects.
Raw provider envelopes, API credentials, reference/PHP, G4, mixed packs, HTTP/SQL observations,
runtime/stack/error text and private host paths are excluded. TS may itself implement
HTTP/SQL; this is candidate source, not permission to copy diagnostic observations.
Secret-marker tripwires are supplementary: arbitrary secret echo cannot be proven absent
by regex. The source context must stay public and the model must never receive host secrets.

## Storage and cryptography

Use the existing pinned age public recipient, decoded-key fingerprint,
qualified age binary/image and network-off encryptor; changing pins needs separate review.
No owner private key on runner, candidate, model context or Git. Stream the new candidate-only
package through memory/stdin; no new plaintext archive or fallback file. Original source
already exists in private runner staging; container cleanup does not erase it.

Future implementation: create a host-owned 0700 spool outside checkout with exclusive 0600
temporary ciphertext, fsync, bound/hash verification, atomic no-overwrite commit and durable
directory metadata where supported. Verify ownership, no links and same fd/path identity
before/after reads. Work from the held immutable lease; recheck original admission before
handoff. Trust requires a quiescent host-owned namespace: these checks do not sandbox a
hostile same-UID/root process. Interrupted writes never receive committed/preserved status.
Explicit source/spool lifecycle and runner destruction must be tested; deletion is not
certified secure erasure. Plaintext Buffers can be cleared; JS strings/GC copies cannot be
promised securely wiped. The inert prototype intentionally writes no archive/ciphertext file.

The concrete transport proposed for approval is one separately named GitHub artifact,
`mmp107-candidate-<runId>-<runAttempt>`, containing only `candidate.age`, seven-day requested
retention, no wildcard upload. GitHub readers can download ciphertext. The fixed owner
key controls decryption, not artifact access. An age file alone does not authenticate its
sender: retain exact trusted artifact/run/head/ciphertext hash/length binding and authenticated
retrieval. No cryptographic revocation of downloaded copies is claimed.

## States and failure precedence

| State                                              | Authority / next transition                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CREATED → ADMITTED                                 | Exact trusted identity, source/license and immutable bundle admitted                                                                 |
| ADMITTED → CAPTURING                               | Single capture capability consumed; cancellation/deadline active                                                                     |
| CAPTURED_UNVERIFIED                                | Complete bounded encrypted bytes, digest/length fixed; no G1 assertion                                                               |
| CHECKPOINT_READY_UNVERIFIED                        | New phase-specific normal collector/encryptor cleanup plus independent inventory 0/0/0; no Oracle workers started                    |
| STORED_UNVERIFIED                                  | Fixed artifact acknowledged, retrieved ciphertext hash/length verified; Oracle may start only under separately authorized experiment |
| CAPTURE_FAILED / CHECKPOINT_FAILED / UPLOAD_FAILED | No fallback, no retry, no Oracle start; unknown costs remain unknown                                                                 |
| CANCELLED / SEALED_UNVERIFIED                      | Terminal; late completion cannot publish/change receipt                                                                              |

Production cancellation before checkpoint produces no new export. A fully acknowledged
checkpoint remains stored if Oracle later fails/cancels; report its status honestly without
retroactive deletion claims. Uncommitted/cleanup-failed ciphertext stays quarantined until
bounded trusted disposal; it cannot become an export by an exception path. Independent
finalizer failure or any emergency removal blocks this checkpoint. Oracle still has its
own normal cleanup/finalizer after execution; preflight inventory is not that later proof.

Public custody record: fixed format/state/UNVERIFIED, the six identity bindings,
recipient fingerprint, ciphertext hash/length and categorical storage status only.
No dynamic error serialization or paths. Subsequent verification links/results use a
separate allowlisted receipt. None of ADMITTED/CAPTURED/STORED establishes G0–G4 PASS.

## What the executable prototype proves

`custody.mjs` uses real X25519 + HKDF-SHA256 + AES-256-GCM with fresh **test** keys,
authenticated version/recipient context, per-file manifest and exact canonical digest.
Its envelope is narrower: format, six-field identity, synthetic MIT license and files
with hashes/sizes/content. It does not model real provider admission metadata or a full
upstream license. It accepts only original synthetic fixtures. Its states substitute
`EXPORT_READY_UNVERIFIED` for the proposed checkpoint and `STORED_UNVERIFIED` for a
mock acknowledgment. Admission/finalizer/ack issuers and crypto injection are trusted TEST
HOST capabilities, never APIs to expose to workers. Raw JSON cannot replace branded tokens.

Capture commits an in-memory ciphertext snapshot atomically; cancellation, timeout,
failure and seal reject later publication. Sealing discards memory, so a simulated
STORED receipt is no durability claim. Mock cleanup/upload are not observed Docker/Actions
proofs. Durable file commit, real age interoperability, owner restore, remote checkpoint,
provider→custody→verifier linking and full production license enforcement are NOT_RUN.
These are mandatory separate implementation acceptance gates, not gaps waived by this PR.
