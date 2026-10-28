# MMP-026 owner interface note

Refs #26. Ilia owns Oracle/baseline/comparator; Vladimir owns orchestration.

`runner.ts` changes one mkdir call to explicitly request 0700 for http, db and
diffs. Its inputs, outputs, file names, contents, comparator/control behavior and
gate meanings remain unchanged. This is the task-authorized permission repair.

The retainOracle import, arguments, write/path wrapper seam and returned
`{gates, manifest, initialDiffs}` remain compatible. The helper is extracted into
oracle-retention.mjs to keep the admission and publication checks together.
Catalog entries gain additive bytes/sha256; the catalog gains status/fileBudget.
COMPLETE describes complete retained evidence, including a fully executed FAIL,
not gate or product acceptance. ERROR publications remain INCOMPLETE.

Admission is stricter: only the writer's bounded layout, consistent manifest and
all mandatory references are accepted. PrivateEvidence.verify also refuses
unindexed files, duplicate index IDs and read-time mutation; the v1 envelope,
write/seal APIs and limits are unchanged. Existing packs with unindexed leftovers
must fail verification rather than be silently accepted. The caller still adds
its final metadata, seals and verifies; retainOracle does not seal early.

A publication exception is authoritative even if cleanup cannot remove a catalog.
After catalog-write failure, an already registered catalog ID may remain in the
in-memory index while its file is withdrawn; the partial pack must not be accepted
as verified. A safe retention-error receipt is best effort and never masks the
original failure. No retry/resume contract is introduced.

No substantive shared DTO/API proposal or policy ratification is included.
Owners should review the stricter admission and failure behavior alongside the
independent ChatGPT review; no notification or approval is asserted here.
