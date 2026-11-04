# Implementation and trust map

Base independently fetched 2026-11-04:
`16fbcf64985f7141ec116f89eb68d5937db7faa5`. Separate worktree/branch;
`.specify/feature.json` and existing worktrees remain unchanged.

## Current production sequence and additions

1. `paid-run.mjs` reads original event inputs; `authorizePaidWorkflow` validates
   protected main, authenticated actor, fresh signed GitHub OIDC, current workflow
   bytes, context, model and tariff. v2 cards/claims bind their own version, plan,
   allowed repair kind and aggregate reservation. Historical v1 cards unchanged.
2. `runPaidAttempt` creates the existing restricted source session. Before POST 1,
   `startG1Recovery` requires opaque admission and durably commits a new host-only
   random 256-bit MAC key and original plan/root device+inode lease. These never
   enter candidate workers, artifacts, model input or public logs. The existing
   exclusive mmp078 first ledger is fsynced before send, including its directory.
   A confirmed native response, exact receipt and candidate capture are MAC-bound.
3. Existing capture/finalizer/upload/download/readback steps retain their APIs.
   `transfer.json` carries root/SHA between credentialed and credential-free
   steps, backed by the sealed root identity and exact re-admission; there is no
   claim that a JavaScript WeakMap lease survives a process boundary.
4. `validate-candidate.mjs` v2 calls `verifyG1RecoveryCandidate`. This invokes the
   real `validateCustodiedMigration`, consuming the real stored-checkpoint permit.
   `RealVerifier` tracks the trusted normal first-typecheck fact in WeakMaps, after
   recipe checks and settlement. Only an actual completed verifier result can
   supply its opaque origin; JSON cannot recreate it. Existing compiler producer
   and public projection remain unchanged. The original FAIL is persisted even
   if journal sealing fails; missing proof means NO_GO.
5. The actual `custodyVerificationLink` links distinct capture and Oracle attempt
   IDs. Its legacy JSON label stays UNVERIFIED; v2 authenticates the actual link,
   stored checkpoint, completed result and extra independent post-G1 inventory
   together in the private MAC journal. The classifier never treats UUID shape
   or equality of arbitrary supplied objects as authentication.
6. Original validator exit 1 remains exit 1. The existing v1 repair-gate condition
   stays exact. A separate `always() && !cancelled()` v2 gate requires successful
   generation/stored custody and failed original validator; missing/abnormal
   evidence produces NO_GO. It proposes routing and cannot grant a paid send.
7. `repair-run.mjs` independently reopens authenticated journal/lease/custody,
   fetches fresh artifact metadata and checks exact ciphertext readback and new
   independent zero-resource inventory. Only this path issues an opaque token.
   Authorizer requires that token for v2 attempt 2; public data cannot upgrade
   single/v1 plans. Second OIDC and policy/preflight bind exact private request
   bytes and original first-candidate identity. Native session revalidates again
   immediately before synchronous token consumption and exclusive fsynced ledger.
   Cancellation, crash, unknown send and any partial ledger/card never retry.
8. Existing separate attempt-2 candidate capture, ciphertext, readback and fresh
   verifier remain in the workflow. No third-send route exists. Scorecards retain
   initial failure/zero coverage and label G1 early recovery separately from
   complete public parity failure; charges remain estimated/UNKNOWN.

## Verification boundaries

Root-discovered tests exercise strict producer projections, schema/position and
identity negatives, versioned preflights and no forged capabilities on all OSes.
Linux-only test graph substitutes Docker/age OS boundaries using Node test
loader hooks, fake RSA-signed OIDC, fake authenticated GitHub artifact responses
and intercepted native HTTPS. It runs production entrypoints, immutable source
leases, capsule validation, checkpoint/readback, journal, admission and ledgers.
Test hooks exist only under `test/`; no production test flag or injected issuer.
Simulated G1/G2/G3 observations do not claim Docker or real compiler execution.

Required Fast CI is unchanged Node 22/24. Research spike tests run separately.
No new dependency or borrowed fixture/source is introduced; existing public
fixture attribution/notices remain. Additional acceptance: exact-head independent
security review; authentic Linux Docker/age integration if required by review;
separately owner-authorized real v2 trial and billing reconciliation. No such
trial is part of this implementation.
