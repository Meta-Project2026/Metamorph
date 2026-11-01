# MMP-115 validation and remaining gate

Canonical baseline `d87a7029abf23c3d222bc309741d9185e502313e`, post-merge Fast CI
41355819864 independently read SUCCESS. Isolated branch
`codex/mmp115-production-candidate-custody`; no shared checkout/pointer edits.
The exact final review head and CI links are recorded in PR #117 after commit.

## Executed evidence

- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`: each exit 0 during implementation. Windows Node 24.21.0 / pnpm 11.25.0.
  The pre-credential-echo full suite was 759 tests / 649 PASS / 110 platform/environment
  SKIP / 0 FAIL; the added echo control passed separately. Final counts are recorded
  in the exact-head PR receipt and hosted CI, not inferred from this earlier run.
- `node --test packages/agent-real/test/custody.test.mjs`: exit 0, 25 tests,
  19 PASS / 6 Linux-only SKIP / 0 FAIL locally. Directly reached by the existing fast glob.
- `pnpm exec biome check packages/agent-real/src packages/agent-real/test/custody.test.mjs research/mmp-115`:
  exit 0 after formatting. Root lint also passed.
- `node research/mmp-069/validate.mjs`: exit 0 VALID;
  `node --test research/mmp-069/validate.test.mjs`: exit 0, 45 PASS;
  `node research/mmp-069/check-syntax.mjs`: exit 0, 90 active modules, syntax only.
- Existing retention eligibility/negative tests, age policy/tools/encryptor,
  provider/admission/budget guards, reference/comparators/G4 and Fast CI workflow are
  byte-identical to baseline. Scoped `git diff --exit-code` comparison: exit 0.

Actual Linux age acceptance was executed on source SHA
`afe7d594b72180e24095da41630b5f68fc6539b4` (see the exact machine-generated head in
the adjacent evidence JSON; that record is authoritative). The later known-credential
echo refusal is an additional host-only negative control, not a claim that an older
execution used new code. Final exact-head replay/results are attached to the PR.

Commands: `docker build -t mmp115-offline-harness research/mmp-108/harness` exit 0;
`./research/mmp-115/Invoke-OfflineAge.ps1 -ScratchRoot <private scratch>` exit 0.
The harness reuses the pinned MMP108 trusted Linux image/CLI recipe, checks a clean
committed source bundle and per-run volume labels, rejects existing foreign worker
resources, and removes only its own labeled container/volumes. Worker inventory 0/0/0
excludes the trusted outer harness and its three temporary setup volumes; those are
removed separately. No candidate/reference code executes on the host or in the harness.

| Actual Linux case                                                                | Observed result                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qualified age v1.3.2, ephemeral TEST key encryption, executable restore verifier | PASS, original files/manifest/candidate digest exactly MATCH; wrong key/truncation rejected; default fixed-recipient mode refuses the TEST identity                      |
| Actual production generation/lease/collector path                                | PASS using a locally intercepted HTTPS adapter and pinned known-good public TS fixture, not model inference; fixed production public recipient, atomic ciphertext commit |
| Actual pre-Oracle and original post-Oracle finalizers                            | PASS, 0 containers / 0 volumes / 0 emergency removals each                                                                                                               |
| Local transport/state simulation followed by validator setup ERROR               | Stored record/ciphertext unchanged; Oracle candidate execution NOT_RUN                                                                                                   |
| Real encryptor crash/cancellation/30-second deadline                             | Rejected with zero remaining owned resources                                                                                                                             |
| Deliberately created owned resource, independent emergency removal               | One removal observed; checkpoint blocked, then zero remaining resources                                                                                                  |
| Missing/swapped recipient/hash/image                                             | Rejected before publication                                                                                                                                              |

The generated-key restore uses a private synthetic checksum receipt and an explicit
trusted TEST recipient override for the function only. It proves the qualified age
and restore mechanism, **not possession of the owner's actual private key**. Production
collector and restore CLI accept no policy/recipient override. The production-public-
recipient capture and the TEST-key decrypt are separate observations.

Two initial real runs ended ERROR at the strict restore executable-ownership check.
The qualified archive carries UID 1001; copying as root retained foreign ownership.
The fixture now creates a fresh owned inode from SHA-verified bytes. The ownership
guard was retained. The initial draft CI also rejected an inventory entry before its
research module existed; adding the real manual module resolved this without changing
the validator. Later Node22/24 run 41359826253 passed on b26bcc069d8911e53e45edda2904cbc554ad6469.

## Real versus simulated and NO_GO

REAL: qualified binaries, generated TEST keys, encryption/decryption, original byte
checks, Linux source/spool permissions/link/atomic-commit checks, credential-free
collector process, Docker encryption/teardown, both independent resource inventories,
fault/deadline/emergency tests. SYNTHETIC: original licensed TS and public known-good
fixture, locally signed OIDC/JWKS and intercepted native HTTPS generation, metadata/ack
and readback transport simulation. They do not attest a real GitHub stored artifact.

NOT_RUN: live artifact upload or authenticated service readback, owner private identity
or owner-recipient decryption, real model/API, paid dispatch/rerun/validate_only,
candidate Oracle execution in this task, formal held-out G4, new paid authorization.
The original exact 6/17/20 verification IDs and gate semantics remain unchanged; green
CI and stored UNVERIFIED metadata do not establish any gate or product PASS.

**NO_GO for end-to-end durable custody/production/paid readiness.** The task explicitly
forbids live uploads, so real external acknowledgment/readback cannot be demonstrated
under this authority. A separate explicit owner authorization for a synthetic ciphertext-
only transport exercise is required after independent exact-head security review.
Do not self-merge or declare durability from these mocks. Only after production
acceptance may a separate exact-main one-POST proposal be prepared.

Residual boundaries: response-to-ack loss window; seven-day requested public ciphertext
retention and irrevocable downloaded copies; trusted host/UID/root/workflow/tool and
GitHub action/service authority; JS strings are not securely erased. Known credential
values and common secret markers are refused before collection, but encoded/unknown
secret echo is not proven absent. Original private source/packs retain runner lifetime.
Historical candidate UNAVAILABLE, historical cause UNKNOWN, PRODUCT_NOT_ESTABLISHED.
