# MMP-089 plan and current execution map

Status: owner public recipient and separate explicit data-policy approval in
[spec.md](spec.md) received in this chat. Implementation and the required
executor/independent offline controls completed; [validation.md](validation.md)
retains the initial environment timeout and additional PARTIAL baseline proof.
No upload or paid request occurred. Delivery CI/review are recorded on the PR.

On continuation, remote main had advanced to
`59a6266801956a3048a4c1ceb915bc1fb0f773a9` (PR90 CI coverage and PR91 Docker
reliability evidence). Its [Node22/24 Fast CI 40961012738](https://github.com/Meta-Project2026/Metamorph/actions/runs/40961012738)
passed. The unpublished implementation checkpoint was rebased onto that fresh
main before executing implementation controls. Candidate/runtime/Oracle recipes
were unchanged by that main update.

## Verified current source ordering at the pinned base

1. `.github/workflows/meta-paid-migration.yml`: install/build trusted code;
   generation step alone maps `MODEL_API_KEY`; a fresh process calls
   `research/mmp-078/validate-candidate.mjs` after generation succeeds.
2. `validate-candidate.mjs`: rejects a mapped model credential, reads the
   private transfer and public trial, binds candidate/head, admits and validates
   through `validateGeneratedMigration`, writes public `trial.json`, and sets
   exit 1 when G1/G2/G3 or normal cleanup is not PASS/verified.
3. `packages/agent-real/src/migration-trial.mjs`: re-admits generated source,
   creates a separate restricted source session, prepares the unchanged trusted
   environment, runs `RealVerifier`, projects public attempts and always awaits
   environment finalization. Private host directories are not removed here.
4. `packages/agent-real/src/runtime.mjs`: `runPair` admits/fixes the bundle and
   identity, uses network-off target workers; its `finally` closes both workers,
   checks inventory, observes the trusted build and seals evidence. Genuine
   BUILD_FAILED plus observed G1 FAIL stays candidate FAIL. The sealed bridge
   includes a source record and a completion record containing worker evidence;
   it can also include Oracle/runtime data, so exporting the whole pack is
   forbidden. `createEnvironment.finish` verifies/seals packs and records
   resources that required emergency cleanup without erasing the failure.
5. The workflow's final inventory has `if: always()` and follows validation.
   Public artifact upload also uses `always()` and only explicit public files.
   No encrypted private artifact/collector exists. A future collector inserted
   as a normal success-only step would be skipped after G1 FAIL; it needs an
   explicit failure-aware condition plus strict generated-candidate binding.
6. The validation step omits the Meta secret but the job has `id-token: write`.
   Fresh step/process alone does not establish absence of Actions/OIDC/runtime
   credentials. Future collection/encryption must use explicit clean child
   environments and fixed executables/args. The trusted host selector retains
   Docker and filesystem access, but reads only fixed bounded indexed records;
   it is not a filesystem sandbox. Only the encryptor is isolated from host
   roots, homes, credential files and the Docker socket. Original source and evidence directories
   persist until the ephemeral runner is destroyed; normal Docker cleanup does
   not erase them. New plaintext staging needs its own checked cleanup.

## Historical preparation before owner inputs

- Fresh-main worktree prepared without changing the user's original checkout.
- Current source, issue/review, recipient requirements and public destination
  access inspected; option B selection recorded as distinct from export consent.
- Concrete minimal policy, data boundary and acceptance matrix prepared.
- Independent security review of this design only; no runtime/crypto PASS claim.

## Implementation sequence after recipient-pin and policy approval

1. Independently validate/pin supplied recipient and upstream age binary,
   version/hash/provenance. Keep the private key outside CI/GitHub.
2. Implement the smallest bounded, credential-free collection/encryption path,
   reading only admitted TS and selected trusted compiler phase receipts.
   Preserve existing signed admission, provider limits, recipe, gates and packs.
3. Add explicit preservation statuses; leave Oracle verdicts unchanged. Ensure
   validator failure cannot skip collection/finalization and no upload can run
   before complete encryption plus both cleanup proofs. Supervise crashes and
   remove/verify all new plaintext staging paths.
4. Execute synthetic/negative tests with throwaway keys and independent actual
   roundtrip/tamper/wrong-key/hash-equality observations. Distinguish these from
   owner-recipient decryptability, which remains unverified absent an optional
   owner-performed harmless challenge outside CI returning only its digest;
   no private-key disclosure or additional current approval request.
   Run Linux Docker G1
   FAIL controls with valid candidate/attempt/pair identities; no provider access.
5. Run frozen install, lint/typecheck/unit-contract smoke/build, with exact exits.
   Push sanitized code/evidence immediately, open PR Refs #89, inspect exact-SHA
   Fast CI Node22/24, and request independent exact-pushed-SHA ChatGPT security
   review (`astra 6`, effort `max`). Do not merge. Do not dispatch a workflow
   or make a model request under this task.

Independent review may require revisions; tests/receipts must distinguish
executor runs, hosted CI and independent execution. Missing checks are NOT_RUN.

## Historical preparation evidence (before implementation)

Observed 2026-10-29; these are read-only/preparation checks, not new runtime proof.

| Command / observation | Result |
| --- | --- |
| `git fetch origin main` | exit 0; base c3ddf08b1a7774c4a5ddecf89fd668c6b81c7651 |
| `git worktree add -b Vladimir/mmp-089-private-diagnostics ... c3ddf08...` | exit 0; isolated checkout created; original checkout unchanged |
| `gh api .../commits/c3ddf08.../check-runs` | exit 0; existing main quick(22) and quick(24) success, [Fast CI 40940984676](https://github.com/Meta-Project2026/Metamorph/actions/runs/40940984676); not branch validation |
| `gh api .../issues/89`, comments, and PR88 review 5703777776 | exit 0; no existing recipient/export approval found in those records |
| `gh repo view ... --json visibility,url` | exit 0; PUBLIC repository |
| `gh api repos/FiloSottile/age/releases/latest` | exit 0; upstream metadata observed; binary not downloaded/verified/executed |
| `docker version --format '{{json .Server}}'` | exit 0; available Linux amd64 engine 29.9.2; no candidate/container test executed |
| `git diff --cached --check` | exit 0 for the staged design documents |
| One-off Node public-recipient bech32/checksum/length/padding and SHA-256 check | exit 0; proposed exact recipient and decoded-key pins recorded in spec; no encryption/private-key access; age-tool acceptance NOT_RUN |
| Independent reviewer Python recipient check | exit 0; checksum/32-byte payload/zero padding and both SHA-256 pins agree; encoding/pin evidence only, no crypto roundtrip |
| New implementation, crypto tests, Linux Docker controls, branch CI | NOT_RUN |

One initial search using a wildcard as an explicit Windows rg pathname returned
exit 1 (invalid pathname); the corrected directory/file searches completed.
No model API call, credential retrieval, generated-source collection or upload.

Independent read-only design review (`gpt-6-astra`, effort `max`) found the
proposal ready for owner decision, with NO_GO for egress unchanged. Its
credential-isolation and plaintext-lifetime findings were incorporated;
identifier wording and canonical candidate-hash comparison were clarified.
This is review of working-tree design documents, not exact-pushed-SHA code
review, cryptographic qualification or independently executed Docker evidence.
