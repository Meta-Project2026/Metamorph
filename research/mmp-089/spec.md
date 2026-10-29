# MMP-089: owner-only diagnostic preservation

Status: **B SELECTED; RECIPIENT AND DATA POLICY APPROVED; IMPLEMENTATION / QUALIFICATION IN PROGRESS**.
The owner selected option B in this chat on 2026-10-29. This selects the
mechanism. The owner then supplied the public recipient below and separately
approved this recipient and the proposed access/retention/destination policy in this
chat: "Подтверждаю recipient и указанную политику хранения, доступа и загрузки".
This approves implementation and conditional ciphertext egress under that
policy; upload remains gated by independent crypto and cleanup verification.
It does not authorize a paid call, workflow dispatch, retry, repair or merge.

Base: fresh `origin/main@c3ddf08b1a7774c4a5ddecf89fd668c6b81c7651`.
Branch: `Vladimir/mmp-089-private-diagnostics`.
Tracking: [issue #89](https://github.com/Meta-Project2026/Metamorph/issues/89).
The downloaded MMP-089 contract and the owner's execution instruction authorize
this task. Existing paid authorization remains consumed.

## Concrete policy for owner decision

The following policy was explicitly accepted by the owner in this chat on
2026-10-29. Implementation and qualification evidence are separate facts.

| Field | Proposed value / outstanding input |
| --- | --- |
| Recipient | Owner supplied `age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f`. No SSH/plugin/passphrase recipient, identity/private key or generated substitute. |
| Pin | Exact recipient UTF-8 SHA-256 `f829a274ca293c96d0fb80b2e6873eaa6e8ea7070e1d22f6342c8802bbd30917`; decoded 32-byte public-key SHA-256 `48218aef33dd17354761805a678f95481ad21131336cc348c23cefe99f714600`. Executor Node and independent reviewer Python checks agree on bech32 checksum/length/padding and both pins (exit 0 each); age-tool acceptance NOT_RUN. Separate owner approval of the pin and policy was received in this chat. |
| Destination | A separate GitHub Actions artifact in `Meta-Project2026/Metamorph`, named `mmp089-private-diagnostics-<runId>-<runAttempt>`, containing exactly one `candidate-diagnostics.age`. No Git commit, release, PR attachment, alternate destination or automatic fallback. |
| Retention | Seven days for the ciphertext artifact, matching the existing public artifact lifetime. No plaintext artifact. |
| Runner plaintext lifetime | Original generation/validator source and mixed evidence packs retain the existing private ephemeral-runner lifetime, until runner destruction. New diagnostic staging is explicitly removed and checked before upload; Docker zero-resource proofs do not prove filesystem erasure. No secure-erasure or crash-time cleanup guarantee. |
| Access | Repository is PUBLIC. Signed-in users with repository read access can download the ciphertext; plaintext access depends on exclusive owner custody of the private key. This is not an owner-only GitHub ACL. Owner must accept this ciphertext access policy or specify another destination. |
| Copies | Artifact expiry removes the hosted artifact under GitHub retention policy; it cannot revoke ciphertext already downloaded. Owner manages downloaded/decrypted copies and key retention. |
| Collection | One observed, attributable generated candidate with genuine trusted G1 FAIL. Collect in a fresh credential-free trusted Linux process, never by importing/executing candidate code on host. |
| Plaintext contents | Admitted TS files; trusted compiler phase receipts only; minimal run/head/source/candidate/attempt/pair identities and per-file SHA-256 manifest. |
| Excluded contents | Provider response/envelope, OIDC or any credentials, environment dump, transfer file, whole private evidence packs, reference files, database/state, Oracle/comparator results and hidden G4. |
| Public record | New fixed-format preservation record: status; approved bound identities; recipient fingerprint; binary/version/hash; ciphertext digest/size; cleanup status. No paths, source, source-derived identifiers, diagnostic messages or arbitrary exception text in this new record. Existing reviewed public compiler diagnostics remain unchanged. |
| Upload condition | Separately approved recipient/policy, independently verified crypto controls, complete bound receipts, successful encryption and required normal cleanup plus independent finalizer with zero resources and emergencyRemoved=0. |

Source limits remain the existing admission limits: 64 TS files, 256 KiB/file,
1 MiB total, `src/main.ts` required. Proposed additional package limits are
2 MiB total compiler phase output, 4 MiB serialized plaintext, 5 MiB ciphertext,
one attempt/pair and a 30-second encryptor deadline. These are diagnostic limits,
not changes to worker/compiler budgets or Oracle semantics. Confirm their
compatibility with actual trusted receipts during implementation.

Reject missing/wrong recipient pins, wrong candidate/source/pair identities,
missing sources, links, malformed/incomplete receipts, oversize, unexpected
fields, recognized credential/private-key markers, crypto failure, process
failure and cleanup failure. Rejecting a preservation package must not rewrite
the observed G1 FAIL or turn an ERROR into FAIL/PASS.

## Implementation boundary

The future collector must take its source snapshot from the existing admitted
candidate and select compiler phase receipts from trusted validation state.
Never archive an evidence directory recursively. Whole private bridge packs
contain source **and** Oracle/runtime records and are outside the export scope.
Compiler output remains untrusted data even though the compiler invocation is
trusted. Inspect bounded data only; never evaluate it, format it into commands
or emit it to logs.

The generation step alone retains its existing model credential mapping. The
job also has `id-token: write`: a fresh step without `MODEL_API_KEY` is **not**
proof that no Actions/OIDC/runtime credentials are available. Launch the trusted
host selector/supervisor and isolated encryptor with fresh explicit minimal
environments, fixed tool paths/arguments, no shell and no inherited
GitHub/Actions/OIDC/provider/token variables or unrelated descriptors. The
trusted host selector has filesystem access to the existing mixed private pack
directories and Docker daemon access to launch/clean the encryptor; its fixed
bounded reads select only public-bound indexes, provenance, admitted source and
compiler completion records. It is not a filesystem/socket sandbox. It must not
read credential files or unrelated/reference/Oracle records. The encryptor
container receives only the selected package via stdin and read-only tool/code
mounts, with no network, home, host roots, credential files or Docker socket.
Never mount/export whole Oracle packs. Same-UID/root and trusted-selector code
integrity remain explicit trust assumptions.

A post-validation collection step must still run after validator exit 1 for G1
FAIL, guarded by observed generation and exact identity binding. It must leave
the existing `always()` finalizer reachable. Only after both normal cleanup and
the independent finalizer pass can a separate uploader use the approved fixed
ciphertext path. No glob, directory upload, source/stderr fallback or retry.

Keep plaintext memory/files private (Linux directories 0700, files 0600); use a
bounded supervised process and explicit removal/verification of temporary
staging plaintext on normal completion, error, timeout and termination. This is
distinct from the existing source/bridge-pack lifetime described in the policy;
do not silently count Docker inventory as deletion of those originals.
SIGKILL/runner loss cannot guarantee in-process cleanup or durable preservation: the job must
not publish PRESERVED without completed encryption, cleanup and upload receipts.
Same-UID/root access remains a trusted-runner limitation. Decryption is an owner
operation outside CI; no owner private key enters the implementation or tests.
Synthetic controls may generate and destroy throwaway test identities only.
Independent throwaway-key roundtrips verify the implementation, not possession
of the owner's private key. Actual owner-recipient decryptability remains
NOT_ESTABLISHED until the owner independently decrypts a harmless synthetic
challenge outside CI and returns its expected digest. This is an optional later
operational confirmation, not an additional current approval request or a
substitute for independent crypto tests. No owner private key is
requested, stored, or sent to a reviewer. Do not describe throwaway-key tests as
successful decryption to the owner's recipient.

## Cryptographic qualification required

Use upstream age X25519 authenticated encryption; no custom cryptography. The
upstream release API currently advertises `v1.3.2` Linux amd64 archive SHA-256
`cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10`.
This is release metadata, **not** an independently verified binary pin. Before
implementation/recommendation, verify upstream provenance/proof, archive,
installed executable version and executable SHA-256; independent review must
repeat relevant verification. Executable pin, age-tool recipient acceptance,
crypto roundtrip, wrong-key and tamper controls are currently
**NOT_RUN / NOT_VERIFIED**. The public recipient encoding check is a separate
preparation observation and does not establish cryptographic qualification.

AEAD detects tampering; it does not authenticate who encrypted the package.
The owner's offline verifier must verify every per-file hash against the
decrypted manifest, recompute the canonical admitted bundle `candidateSha`, and
compare that digest and the ciphertext digest with trusted exact-run public
records; also compare all bound run/head/source/attempt/pair identities. Existing
public records do not contain every per-file hash. Reject mismatches before
troubleshooting.
No candidate source is executed during decryption or hash verification.

## Acceptance and product boundary

Execute actual network-off Docker G1 FAIL with valid bound identities; exercise
wrong SHA, missing private source/IDs, malformed/oversized inputs, credential
markers, wrong recipient, ciphertext tampering, encryption failure and process
crash controls. Independently decrypt synthetic ciphertext and prove exact
source/receipt/hash equality, wrong-key/tamper refusal, no plaintext in public
outputs, and zero-resource cleanup with emergencyRemoved=0. Run exact pushed
SHA Node22/24 Fast CI and independent security review before recommending B.

Question a later separately approved trial could answer: what exact TS bytes
and compiler evidence caused that new candidate's G1 failure? It cannot recover
the previous candidate/errors, whose status remains ROOT_CAUSE_UNKNOWN.
No new Meta request, workflow dispatch, retry, repair, merge, issue #61 closure
or paid-v2 authorization is part of this work. G0/G4 remain INCONCLUSIVE and
product remains NOT_ESTABLISHED.

## Primary references checked on 2026-10-29

- [MMP-089 owner decision and engineering gates](https://github.com/Meta-Project2026/Metamorph/issues/89).
- [Independent MMP-086 review](https://github.com/Meta-Project2026/Metamorph/pull/88#pullrequestreview-5703777776).
- [age project](https://github.com/FiloSottile/age), [format specification](https://age-encryption.org/v1), [v1.3.2 release](https://github.com/FiloSottile/age/releases/tag/v1.3.2).
- [GitHub artifact download permissions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).
