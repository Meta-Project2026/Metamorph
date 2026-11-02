# MMP-115 operational custody gates — offline decision record

**Decision: NO_GO for a new production experiment.** The offline mechanisms below
are implemented and have scoped test evidence. Full production
generate→capture→cleanup→upload→readback→Oracle E2E and actual owner-key restore
remain **NOT_RUN**, not proven failures and not waived by green CI. #115 OPEN;
#116 HOLD; #61 PRODUCT_NOT_ESTABLISHED; formal G4 NOT_RUN.

Audited canonical main: **bb8f548bae35f9add0402c855da0cd247a124cf6**, fetched
2026-11-02. No open PRs at the initial GitHub check. This review adds documentation
only: no confirmed new code defect, authority change or uncovered case justifying
another test was found in this bounded source/test review. It is not a new
exhaustive security certification. Delivery SHA/CI are recorded in the PR.

## Evidence and authority

- **E1 — independently read now:** [main Fast CI41466658044](https://github.com/Meta-Project2026/Metamorph/actions/runs/41466658044),
  exact bb8f548, push/attempt1 SUCCESS. [Node24 job125349221984](https://github.com/Meta-Project2026/Metamorph/actions/runs/41466658044/job/125349221984)
  and [Node22 job125349222338](https://github.com/Meta-Project2026/Metamorph/actions/runs/41466658044/job/125349222338)
  each27 successful steps, root783 /780 PASS /3 existing SKIP /0 FAIL. The Linux
  custody filesystem/checkpoint tests execute here; this is synthetic code evidence,
  not real Docker/age/artifact/owner-key evidence.
- **E2 — executed in this review:** existing custody suite25 /19 PASS /6 Linux-only
  SKIP /0 FAIL on Windows Node24.21.0. Existing source/link/read-time mutation,
  receipt/identity, fake admission, secret-canary, transport-refusal, forged-permit
  and YAML-order controls are reused. Six Linux-only tests are NOT_RUN locally;
  E1 is their separately observed hosted evidence. Full commands are in
  [validation.md](validation.md#operational-gates-review).
- **E3 — independently verified governance/history:** accepted
  [contract-v1 at f2ca41d](https://github.com/Meta-Project2026/Metamorph/blob/f2ca41d89c96456ada5661e7a80c398a18eeb209/research/mmp-107/contract-v1.md)
  is unchanged in bb8f548. Its DECISION_PENDING heading is historical, not a new
  consent request: [Vladimir's explicit approval/report](https://github.com/Meta-Project2026/Metamorph/issues/107#issuecomment-6564661434)
  and [Ilia's directly authored ACCEPT6564705526](https://github.com/Meta-Project2026/Metamorph/issues/107#issuecomment-6564705526)
  identify that exact contract, audience and loss window. [PR117](https://github.com/Meta-Project2026/Metamorph/pull/117)
  merged as839a76c; [review5731067024](https://github.com/Meta-Project2026/Metamorph/pull/117#pullrequestreview-5731067024)
  on d0153f2 was SCOPED_MERGE_GO / PAID_NO_GO. Neither decision authorizes a new run.
- **E4 — archival executor reports, not rerun/independently re-executed here:**
  [versioned age receipt at afe7d59](evidence/linux-afe7d59.json) and the
  [later executor receipt on9f5cbbee](https://github.com/Meta-Project2026/Metamorph/pull/117#issuecomment-6565667206)
  report real Linux/Docker/pinned age3/3, ephemeral TEST-key restore, fixed-public-
  recipient capture, actual finalizers and fault refusal. They explicitly use mock
  transport and no Oracle candidate execution/owner private identity. Seventeen
  selected custody/source/workflow/test/manual-driver Git blobs are unchanged from
  reviewed d0153f2 to bb8f548; that does not re-execute crypto or attest every
  transitive dependency. In particular current request preparation includes PR131;
  body/context bindings must be recomputed, never borrowed from old receipts.
- **E5 — independently read service metadata plus attributable reviewer evidence:**
  [MMP122 run41366708136](https://github.com/Meta-Project2026/Metamorph/actions/runs/41366708136),
  push head f861be5, overall FAILURE. Job125028273477 records upload SUCCESS,
  exact-ID download SUCCESS, final metadata/readback step FAILURE. The
  [independent reviewer6566123432](https://github.com/Meta-Project2026/Metamorph/issues/122#issuecomment-6566123432)
  reports an additional existing-ZIP read:407 ZIP bytes, sole candidate.age267 bytes,
  exact byte/hash identity; final assertion confused bare action digest with the
  REST sha256: prefix. This review did **not** download that artifact or inspect
  private data. Service capability/byte identity is separately attested; full
  production transport is NOT_RUN. The old upload permission is consumed.

## Gate matrix

Code/test links below resolve to the audited **bb8f548** source; status is scoped
to the named evidence, never Oracle/product PASS. `T` means the existing
[custody.test.mjs](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/test/custody.test.mjs).

| Gate | Evidence: actual function, refusal/control | Verified-by | Status | Remaining decision |
| --- | --- | --- | --- | --- |
| Admitted response → custody identity | [runPublicMigration:78](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/migration-trial.mjs#L78) mints generation UUID before generate; response schema, lease candidateSha equals provider receipt. [capsuleFromLease:225](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-contract.mjs#L225) requires opaque admission, six bindings and request/response/context/manifest hashes. T:108/214/295 reject missing/foreign IDs, fake token/lease, changed candidate; capture rejection cannot trigger a second request. | E1/E2 + static | OFFLINE_CONFIRMED; new inference NOT_RUN | Fresh signed exact-main/body/actor/budget/time authorization is external; no old admission reused. |
| Immutable source lease → exact candidate capsule | [createSourceSession:17](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/source.mjs#L17) serializes writer/acquire/release and freezes admitted files. Capsule fd/path/root checks recompute bytes/digests, enforce UTF-8/license/allowlist. T:125/189/269/553/578 cover altered/missing/extra files, getters/proxies, links, known credential echo and read-time mutation. | E1/E2 + static | OFFLINE_CONFIRMED | Public MIT source only; quiescent trusted host namespace remains required. |
| Pre-Oracle candidate-only encrypted capture | [captureLease:11](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-capture.mjs#L11) forwards only selected capsule over stdin with credential-free child env; [collectCapsule:18](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-collector.mjs#L18) revalidates, bounds and encrypts. T:615 rejects timeout/late close/reuse and checks absent credentials. | E1; E2 six Linux cases skipped; E4 actual crypto archival only | CODE/REFUSAL_CONFIRMED; fresh actual crypto NOT_RUN | No new Docker/age qualification authorized here. Fixed recipient/tool/image remain unchanged. |
| Private ciphertext → atomic committed capture record | [commitPrivate:45](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-files.mjs#L45):0700 spool/0600 exclusive temp, bounded writes, fsync, stable read, no-clobber link and directory sync; receipt follows ciphertext. T:380/398/683 reject collisions/links/partial writes/flush failures; quarantine is not a successful receipt. | E1 Linux controls; E2 NOT_RUN locally for these cases | OFFLINE_CONFIRMED | POSIX ownership/durability checks are not Windows ACL proof or secure erasure. |
| Normal encryption cleanup → independent pre-Oracle0/0/0 | [encryptDiagnostic:61](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/encrypt-diagnostics.mjs#L61) requires removal plus inventory; [finalizeCustody:26 / checkpointReady:66](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-checkpoint.mjs#L26) require matching PRE_ORACLE identity and zero containers/volumes/emergency removals. T:326 rejects forged phase/identity/nonzero/emergency. | E1/E2 static/negative controls; E4 real archival finalizers | GUARDS_CONFIRMED; current real inventory NOT_RUN | Dedicated trusted runner only: prefix finalizer is not multi-tenant isolation. Emergency removal never grants readiness. |
| Ready checkpoint → durable ciphertext ACK | [artifactMetadata:92](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-checkpoint.mjs#L92) binds action outcomes, exact artifact ID/name, archive digest, length, nonexpired status and run/repo/head/attempt/workflow. [workflow:112](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/.github/workflows/meta-paid-migration.yml#L112) uploads candidate.age only,7d. T:344 rejects foreign/failed/expired/swapped ACK metadata. | E1/E2 mock controls; E5 separate synthetic service evidence | PRODUCTION_ACK_NOT_RUN | Needs a separately authorized actual production run; service ACK is bounded retention, not perpetual/owner-local durability. |
| Exact artifact-ID retrieval → matching ciphertext | [workflow:123](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/.github/workflows/meta-paid-migration.yml#L123) downloads returned ID. [verifiedReadback:147](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-checkpoint.mjs#L147) checks authenticated metadata and [exactReadback:138](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-files.mjs#L138): sole candidate.age, hash/length/header, stable unlinked file. T:425/726 reject altered/truncated/extra/linked files and HTTP errors/oversize metadata. | E1 Linux/mocked API; E2 applicable negatives; E5 reviewer byte-identity report | PRODUCTION_READBACK_NOT_RUN | No artifact upload/download/metadata transport experiment is performed by this review. |
| Verified readback → stored receipt binding | [saveTransport:269](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-checkpoint.mjs#L269) commits bounded transport fields then stored.json; [requireStoredCheckpoint:158](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-checkpoint.mjs#L158) rereads capture/finalizer/ciphertext/transport/readback and recomputes stored equality. T:449: missing checkpoint blocks; later synthetic validator setup ERROR preserves stored bytes/state. | E1; E2 this Linux case skipped; E4 mock-transport archival proof | OFFLINE_CONFIRMED; real stored checkpoint NOT_RUN | Interrupted separate file commits fail closed; source loss before ACK must be reported, not reconstructed. |
| Stored receipt → single-use Oracle permit | [consumeOraclePermit:197](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-checkpoint.mjs#L197) consumes a process-local WeakMap capability after candidate/head/source equality. [validateCustodiedMigration:149](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/migration-trial.mjs#L149) consumes before source access. T:449/521 reject reused/fake permits; no candidateRoot getter access on rejection. | E1/E2 + static | OFFLINE_CONFIRMED | One-use is per issued opaque token; not a cross-process durable execution ledger. Trusted fixed workflow and runAttempt1 remain required. |
| Permit → candidate run → independent post-Oracle finalizer | [validateGeneratedMigration:168](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/migration-trial.mjs#L168) re-admits source, requires Linux/no model key, uses original verifier/worker isolation and finish. [workflow:140](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/.github/workflows/meta-paid-migration.yml#L140) gates validation on stored success; finalizer always() at148. T:449/776 cover failure preservation/order. Custody/verifier UUIDs differ and link explicitly. | E1/E2 synthetic/wiring evidence; E4 actual finalizer, candidate execution explicitly NOT_RUN | FULL_CUSTODIED_ORACLE_E2E_NOT_RUN | No G0–G4/scoring change. An Oracle ERROR is not semantic FAIL, nor a reason to erase stored custody. |
| Stored artifact → owner-controlled exact-byte restore | [verifyAgeRestore:15](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/packages/agent-real/src/custody-restore.mjs#L15) checks qualified age/keygen, private identity file, fixed derived public recipient, ciphertext hash/length and capsule identity/license/manifest/source digest. CLI has no testRecipient override; output MATCH/UNVERIFIED only. [manual TEST-key case:106](https://github.com/Meta-Project2026/Metamorph/blob/bb8f548bae35f9add0402c855da0cd247a124cf6/research/mmp-115/real-age.test.mjs#L106) is archival E4, not owner possession proof. | Static + E4 executor TEST-key report | OWNER_RESTORE_NOT_RUN | Only owner can perform separately authorized restore on their controlled host with the real identity; never give the key to agent/CI. |

## Limits and future decision

No transition promotes custody beyond **UNVERIFIED** or establishes G1–G4/product
PASS. Existing tests cover the inspected rejection cases, not every possible host
failure. Trust remains in the fixed repository/workflow/action/service, dedicated
runner/UID/root/Docker and quiescent namespace. Regex/known-secret tripwires do not
prove absence of arbitrary encoded or unknown secret echoes. No raw provider
envelope, reference/G4 pack, SQL/HTTP observation, error/stack or source is exported
by this documentation. Plaintext staging/JS copies are not securely erased by
Docker cleanup. Public ciphertext can be retained past expiry and cannot be revoked.

**One future composite production test, proposed only — NOT_AUTHORIZED/NOT_RUN:**

1. After independent review, owners decide a fresh immutable action card for the
   then-current main/body/context/source/manifest/model/tariff, exact time window,
   explicit estimate/spend limits (not a provider hard cap), one POST/zero repairs/
   no retry, exactly one new candidate.age upload, its ID-specific readback and
   owner-local retrieval/restore. No previous authorization/run/artifact is reused.
   This document supplies neither a budget nor execution permission; #116 stays HOLD.
2. Use the existing production workflow on a fresh runAttempt1, recording fresh
   generation-custody UUID and later verifier UUIDs. Require response→lease→capture,
   normal plus independent PRE_ORACLE0/0/0, exact artifact ACK/readback and stored
   receipt **before** Oracle. Any missing/failing/cancelled gate stops; no retry.
3. Record actual Oracle coverage/outcome and both cleanup/finalizer observations
   without predetermining parity. Later Oracle ERROR must leave STORED_UNVERIFIED
   unchanged. Never upgrade ERROR/missing evidence to PASS.
4. Owner alone verifies the new exact artifact/receipt/run binding on their own
   controlled host, uses the existing qualified restore CLI and real private
   identity locally, and provides only the categorical byte-identity/manifest/
   original candidate-SHA result. No private key or plaintext returns to agent/CI/Git.
5. Independent reviewer decides only **custody operational acceptance** from the
   fresh chain plus owner proof; missing owner proof remains NO_GO. G0–G4/product
   acceptance and paid billing evidence remain separate. validate_only skips this
   custody path, and the old MMP122 push workflow cannot substitute for the fixed
   production workflow/run metadata. A fresh real production generation cannot be
   simulated by scripted fixtures or performed under this offline assignment.

No code repair, new tests, workflow/dependency/pin/policy/permission changes,
Docker/daemon run, provider/model call, dispatch, artifact transfer, private-pack
or owner-key operation is needed or authorized to publish this review.
