# Tasks

- [x] Verify pinned main, ownership and existing worker/Oracle/agent APIs.
- [x] Implement exclusive source admission and explicit offline replay provider.
- [x] Compose real external verifier, exact coverage and private evidence.
- [x] Add cancellation, stale/malformed/mutation/budget/cleanup negative controls.
- [x] Run frozen install, lint, typecheck, root65, build, reference56, target69,
      differential78 and new tests; report actual counts and skips.
- [ ] Execute known-good and FAIL/repair through real workers on final PR SHA.
- [ ] Record private hashes, public artifact identity and final zero inventory.
- [x] Commit, push, [PR30](https://github.com/Meta-Project2026/Metamorph/pull/30)
      Refs #23; no merge or issue closure.

Status: PARTIAL. Registration PR #33 is merged and dispatch is available.
The first real hosted run failed before runtime preparation with ENVIRONMENT_ERROR
because the composition's recipe pin did not match the unchanged Git/LF files.
The unchecked proof tasks remain NOT_RUN; see validation.md for exact receipts.

- [x] Fix G4 pair identity, reject duplicate pair IDs and label the lifetime policy.
- [x] Add synthetic partial-receipt, failure-precedence and policy-field tests.
- [x] Verify merged workflow registration and successfully dispatch PR #30.
- [x] Reproduce the recipe-pin defect and add byte-mutation/CRLF rejection tests.
- [ ] Execute a complete hosted proof against the corrected current PR #30 SHA.
