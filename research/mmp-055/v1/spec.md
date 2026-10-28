# MMP-055 v1 — synthetic encrypted retention

Base: `cb707bb3481ec115460b26ca0da4356a1b47a3ad` (fetched 2026-10-28).
Scope: new trusted-host adapter, original synthetic/public fixture tests and
filesystem simulation only. Real ingestion/deployment is rejected. No Oracle,
worker, comparator, strict DTO, historical audit or active feature-pointer edit.

- Reuse sealed `PrivateEvidence` v1, 16 MiB records / 128 MiB packs. Preflight
  bounded per-pair packs, root coverage, manifests, binary packing/AEAD and
  two-copy/journal/failure overhead before storage writes.
- Freeze exact bytes/index, status/outcome, run/epoch/candidate/attempt/pair,
  custody scope and finalizer errors. COMPLETE behavioral FAIL is distinct from
  INCOMPLETE ERROR/aborted evidence. Refuse links, weak modes, foreign ownership,
  mutation, missing/extra/duplicate entries and late writers.
- AES-256-GCM through Node/OpenSSL with fresh keys/nonces; RSA-OAEP-SHA256
  recipient/escrow wrapping, Ed25519 witness signatures. Public summaries expose
  only opaque IDs, coarse statuses, safe counts and blinded commitments.
- Independently signed prior full catalog and storage commitments are the
  reader's trust anchors. Restore each encrypted copy in a separate reader
  process after source/worker teardown, verify all exact bytes and the complete
  original index in a new 0700 directory. Missing trust/restore is NOT_VERIFIED.
- Enforce the owner-reported 180 UTC-calendar-day minimum and separate day-90
  full-restore task/receipt, holds, clock high-water, access/recovery/revocation
  journal and separately authorized deletion witnesses. No scheduler service.
- Synthetic directories, keys, principals, clocks and receipts never establish
  physical independence, 180 elapsed days, real day90, formal G4 or product PASS.

Acceptance: execute full 117/117 MANIFEST under umask 022, complete FAIL and
partial/error paths; adversarial storage/restore/calendar/security tests; frozen
install/lint/typecheck/unit tests/build; record actual OS support and skips.

Real admission remains blocked on named media/admin/key/recovery custodians,
authenticated second-owner governance, #56 registration and exact-run authority.
Historical #31 AUDIT_FAIL unchanged; G4 INCONCLUSIVE; PRODUCT NOT_ESTABLISHED.
