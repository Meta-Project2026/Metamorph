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

Status: PARTIAL. Both workflow dispatch attempts returned404 because the new
workflow is absent from the default branch. The unchecked real-proof tasks are
NOT_RUN; see validation.md for the exact blocker and commands. A separate
workflow-only registration [PR33](https://github.com/Meta-Project2026/Metamorph/pull/33)
is open for independent review; it has not been merged or registered on main.

- [x] Fix G4 pair identity, reject duplicate pair IDs and label the lifetime policy.
- [x] Add synthetic partial-receipt, failure-precedence and policy-field tests.
- [ ] Obtain independent review and owner-authorized workflow registration, then
      execute the proof against the latest PR30 SHA.
