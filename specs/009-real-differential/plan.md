# Plan

1. Read actual main APIs and accepted handoffs. Use original PHP worker schedule
   exactly equal to scenario IDs; do not introduce a third PHP snapshotter.
2. New MJS trusted package and local TypeScript boundary declaration. Import
   existing controller/broker/admission modules unchanged and direct existing
   Oracle validators (not exposed by its package index). No SDK/model path.
3. Source pins: PHP car-workshop d272170d0aecbd28eb5b13e272d9dd11d545b66c,
   archive/license/base image in SOURCE. TS original src/main.ts file SHA256
   a59bc635bfed53f576704d76d138737e8f70cceacaa9d3624f880f5fe68d29c9;
   canonical admitted bundle SHA256
   67dbb4b31a245ac304ebe7722aa7bfc13d6263001b3eea7e850e92e4edad1af0.
4. PHP runtime7.4.33/SQLite3.34.1. Target measured Node24.11.0/SQLite3.50.4/
   TS5.9.3/libfaketime0.9.10-2.1; record actual image ID/recipe/source file hashes.
   Measure fixed UTC2026-10-27 12:00:00 and actual monotonic timers in isolated
   image before admission and active target runtime after provision.
5. Target adapter consumes provision public-initial, captures its baseline, then
   consumes one scenario reset. Check generation changes and clean baseline,
   preserve raw command receipt before duplicate-key-loss and map exact types.
   Use existing legacy mapper only after independent original fixture equivalence.
6. Set owner-only private root/umask077, distinct PHP/bridge packs and Oracle
   artifactParent. Run actual verifyPair(operationTimeoutMs30000), keep publication
   and actual executed IDs; bounded file catalog copied into atomic private pack.
7. Always close/join both, check real inventory and emergency owned-resource
   ledger. Verify private indexes after teardown; sanitize only hashes, pinned
   versions, known IDs/codes/counts and actual gate matrix.
8. Local root checks + separate adapter/worker tests. Own Ubuntu20min job with
   exact-branch same-repo bootstrap until manual workflow is registered; exact
   PR head checkout, no secrets/privileged workflows. Ordinary Fast CI unchanged.
9. Commit/push/open PR immediately, then record real job SHA/results/artifact
   provenance; no self-merge, issue closure or owner approval claim.

Two-owner follow-up: actual TS workshop business slice, generic non-mutating
readiness, hard state filesystem quota. Current bridge will not patch either
owner's worker to manufacture compatibility or missing isolation guarantees.
