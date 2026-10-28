# Bounded implementation plan

1. Read current main/Issue37/40 and Agent/usage contracts; use isolated branch.
2. Verify Meta API, Standard privacy, pricing/usage, model listing and billing.
3. Keep production financial admission closed; no invented caller-supplied cap.
4. Add only host-side GET transport, codecs, synthetic provider and disabled CLI.
5. Validate missing credentials, fixed egress, unknown usage, paths, no retries,
   cancellation/timeout, canaries and existing orchestrator gates offline.
6. Execute frozen install/lint/typecheck/build/root/scoped tests; record actual
   preflight/probe statuses, main/branch CI and separate real/mock evidence.
7. Commit/push focused PR Refs37; request independent review, no paid call/merge.

Existing Zod/Node libraries only, no new dependency or copied SDK implementation.
MMP040 settled-cost reconciliation, live migration and Issue44 are out of scope.
