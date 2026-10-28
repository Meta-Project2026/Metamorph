# Tasks

- [x] Verify pinned main, ownership and existing worker/Oracle/agent APIs.
- [x] Implement exclusive source admission and explicit offline replay provider.
- [x] Compose real external verifier, exact coverage and private evidence.
- [x] Add cancellation, stale/malformed/mutation/budget/cleanup negative controls.
- [x] Run frozen install, lint, typecheck, root65, build, reference56, target69,
      differential78 and new tests; report actual counts and skips.
- [x] Execute known-good and FAIL/repair through real workers on corrected code SHA.
- [x] Record private hashes, public artifact identity and final zero inventory.
- [x] Commit, push, [PR30](https://github.com/Meta-Project2026/Metamorph/pull/30)
      Refs #23; no merge or issue closure.

Status: PASS_SCOPED on `e2cc71ce1822e4eccf581d3f488e09ef489f077d`,
[hosted run 40685101415](https://github.com/Meta-Project2026/Metamorph/actions/runs/40685101415).
Three complete fresh attempts produced actual 51 HTTP / 60 SQLite comparisons,
negative FAIL then repair, six real controls and clean normal/finalizer inventories.
Agent and G0/G4 remain INCONCLUSIVE; product NOT_ESTABLISHED. This report commit
is REPORT_ONLY; its own final-head run is attached to PR #30 / Issue #23 afterward.

- [x] Fix G4 pair identity, reject duplicate pair IDs and label the lifetime policy.
- [x] Add synthetic partial-receipt, failure-precedence and policy-field tests.
- [x] Verify merged workflow registration and successfully dispatch PR #30.
- [x] Reproduce the recipe-pin defect and add byte-mutation/CRLF rejection tests.
- [x] Reproduce fractional-clock deadline rejection and preserve the exact policy.
- [x] Execute a complete hosted proof against the corrected PR #30 code SHA.
- [ ] Independent ChatGPT review of the final exact PR SHA and matching hosted proof.
