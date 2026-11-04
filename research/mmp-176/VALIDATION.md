# MMP-176 validation — 2026-11-04

Base `6c5a5337e7b4841a11805f99fe84ee398230b555` (authenticated GitHub main
and fetched origin/main matched). Branch `Vladimir/mmp-176-owner-local-g1-replay`.
The delivered exact HEAD and matching Fast CI are attached to the Draft PR;
independent review/merge remains pending. No production file, workflow, fixture,
Oracle/comparator, prompt, timeout or recipe pin changed.

| ACTUALLY_RUN                                                                                     | Result / exit                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                                                 | PASS / 0, Windows; repeated in disposable Linux checkout / 0             |
| `pnpm lint`                                                                                      | PASS / 0; four existing warnings and two infos in unrelated files        |
| `pnpm typecheck`                                                                                 | PASS / 0                                                                 |
| `pnpm test`                                                                                      | PASS / 0; 920 tests, 807 PASS, 113 platform/environment SKIP, 0 FAIL     |
| `pnpm build`                                                                                     | PASS / 0 (also executed by typecheck/test and on Linux)                  |
| `pnpm --filter @metamorph/target-worker test`                                                    | PASS / 0; 69/69                                                          |
| `node --test packages/agent-real/test/owner-local-g1.test.mjs`                                   | PASS / 0; 11/11 on Windows/root suite and 11/11 on Linux                 |
| `MMP176_TEST_TOOLS=<qualified-test-tools> node --test research/mmp-176/synthetic-acceptance.mjs` | PASS / 0; 6/6 Linux, real pinned age + generated TEST keys + real Docker |
| Biome on new research files with standalone recommended config                                   | PASS / 0                                                                 |
| Authenticated run/artifact API + original public ZIP download/hash/structure                     | PASS / 0; exact metadata and `custody-stored.json` binding checked       |

Linux acceptance: isolated disposable **source checkout**, Node `v22.22.1`, Docker
server `29.9.2`. This was not an offline owner-private VM. Trusted image preparation
remained connected; the TEST-only harness explicitly bypassed the owner-machine
network guard and separately proved that the actual guard refuses this connected
machine. The CLI exposes no override. The sandbox itself used `--network none`;
an actual trusted TCP control to reserved `198.51.100.1:443` returned
`ENETUNREACH`. No model/provider request or PHP/Oracle execution occurred.

Synthetic candidate SHA:
`34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334`.
Recipe SHA:
`f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3`.
The test restored exact admitted fixture bytes and passed actual
`workshop-business:typecheck` + `workshop-business:build`, then target startup.
Whole Docker build command elapsed **9,667ms** on the final recorded acceptance;
this is not a per-phase compiler measurement or a hosted performance claim.
Normal close plus further owned inventory: `VERIFIED_ZERO_RESOURCES`, true.
The separate network-control container was force-removed in `finally`, exit 0.
Nonsecret prepared image remains cached; no workload container/volume remains.

Controls actually exercised: exact raw receipt/hash/identity; foreign run/head/
source/candidate/attempt; earlier/missing/invalid receipt; ciphertext hash/length,
truncation/corruption and age authentication after test-only outer-hash changes;
wrong generated identity and production-recipient refusal; tool pin substitution;
invalid capsule manifest/source/license; 4KiB key bound; directory/file modes,
symlink/hardlink; network/daemon namespace snapshots; connected-host refusal;
actual missing Docker executable; actual sandbox denied network; cleanup failure
and emergency preparation cleanup; network reactivation after provision; bounded
handoff EOF/timeout/cancel; all compiler abnormal enum classes and outer failure;
arbitrary raw diagnostic marker excluded from public projection and exception output.
Fault/phase/cleanup injection controls are unit simulations, not observed production
faults. Real cryptography/filesystem/sandbox controls are separately identified above.

The initial CLI publication test caught a standard Node experimental warning;
CLI warning output was suppressed and the test now passes. An intermediate
research-lint check caught cleanup-precedence control flow in `finally`; the
function now performs explicit cleanup after capturing a preparation error, with
cleanup failure taking precedence. Neither finding involved private data.
The first hosted Fast CI at `d90f41ed5a4adfdaa77b852f9ad33127c0401d6d`
failed `Active research syntax` with `RESEARCH_INVENTORY_DRIFT`: the new research
directory had not been registered. Added its descriptive row to the existing
coverage matrix; private/Docker acceptance remains manual and no CI step changed.
After correction, `node research/mmp-069/check-syntax.mjs` passed 134/134 (exit 0),
`node research/mmp-069/validate.mjs` returned VALID (exit 0), and its negative
controls `node --test research/mmp-069/validate.test.mjs` passed 45/45 on both
Windows and Linux (exit 0). Scoped research lint also passed (exit 0).

| NOT_RUN                                                             | Status / reason                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Owner ciphertext download/retention                                 | OWNER_ACTION_REQUIRED; agent did not download genuine candidate ciphertext                           |
| Real owner-key possession, restore or G1 replay                     | NOT_RUN; owner-exclusive separate context                                                            |
| End-to-end owner CLI private phase under externally disconnected VM | NOT_RUN; tested component path with generated keys, actual private guard refuses current environment |
| Historical #41749479450 G1 subtype                                  | UNKNOWN; the synthetic result proves nothing about that candidate                                    |
| New Meta POST, paid dispatch/rerun, OIDC paid admission             | NOT_RUN; not authorized                                                                              |
| Real G2 17 HTTP / G3 20 SQLite / formal G4                          | NOT_RUN in this task; product NOT_ESTABLISHED, G0/G4 INCONCLUSIVE                                    |
| Independent review / merge                                          | PENDING; Draft PR only, no self-merge                                                                |

**Decision: OWNER_ACTION_REQUIRED / NO_GO for agent-run real replay.** The next
action with the greatest immediate value is owner retention of the exact
ciphertext and public receipt before **2026-11-11 00:49:25 UTC**. Then independently
review the helper exact HEAD and perform the owner-only procedure. A new successful
G1 replay does not establish the historical failure's subtype; a new abnormal
receipt informs a narrow separately reviewed remedy. Do not adjust 12/35/180s or
pins without that evidence. After G1, address #161's authentic `HTTP_JSON_TYPE`
blocker before requesting a fresh bounded model→PHP/candidate→G1→G2→G3 demo.

Provenance: new helper/tests are original project work; existing public workshop
fixture/license and custody validation are reused unchanged. Upstream age v1.3.2
release archive/binary SHA pins were verified; no third-party binaries, private
files or logs are committed. The current public generation-body SHA was checked
against the authentic run and still equals
`9b0a41c80b37ce7931c56c8455708edad178801ff2f3a390c37ecdcc341671f1`.
