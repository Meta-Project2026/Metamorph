# MMP-097 / MMP-099 validation — 2026-11-01

Base: `38aa818e4afe75512e4555390246f44b5d7798db`.
Current decision: **PASS_SCOPED / MERGE_NO_GO**, pending additional process/finalizer evidence and independent review. This file distinguishes executed SHAs from later delivery commits.

## Actual Linux Docker and age

Exact executed SHA: `b6f9abe46542bfd99ba6bc3211cba1b3cafd896b`.
[Run 41252167119](https://github.com/Meta-Project2026/Metamorph/actions/runs/41252167119), [job 124687753782](https://github.com/Meta-Project2026/Metamorph/actions/runs/41252167119/job/124687753782), ordinary `pull_request`, **SUCCESS**.
[Committed sanitized receipt](evidence/mmp099/41252167119.json). Node v24.22.1, Docker 28.0.4 linux/amd64. The receipt includes pinned age v1.3.2 binary/archive hashes and encryption image/recipe SHA.

The PR98 same-repo workflow checks out the actual PR head with no persisted credentials and contents:read. Installer/driver use an exact environment allowlist. Candidate TS executes only in the unchanged Docker sandbox. No artifact uploader, Meta/model request, workflow dispatch, owner private key, paid rerun/repair or live ciphertext upload is used. Actions infrastructure cost is not established as zero.

| Actual case              | G1 / G2 / G3                       | HTTP / SQLite coverage | Package / outcome                                     |
| ------------------------ | ---------------------------------- | ---------------------- | ----------------------------------------------------- |
| HTTP-only mutation       | PASS / FAIL / FAIL                 | 17/17; 20/20           | candidate-only; roundtrip PASS; eligible=true         |
| SQLite-only mutation     | PASS / PASS / FAIL                 | 17/17; 20/20           | candidate-only; roundtrip PASS; eligible=true         |
| Both mutations           | PASS / FAIL / FAIL                 | 17/17; 20/20           | candidate-only; roundtrip PASS; eligible=true         |
| Unchanged public fixture | PASS / PASS / PASS                 | 17/17; 20/20           | candidate-only; roundtrip PASS; eligible=true         |
| Genuine compiler failure | FAIL / INCONCLUSIVE / INCONCLUSIVE | 0/17; 0/20, expected   | legacy source+compiler; roundtrip PASS; eligible=true |

All five cases observed validator exit1 except the parity-positive exit0, preserver exit0, independent finalizer exit0 and gate exit0. Every preservation record remains ENCRYPTED_PENDING_UPLOAD. There is no uploader action and no false PRESERVED. Source plaintext SHA, canonical candidate SHA and every per-file manifest entry were checked after real decrypt exit0; wrong key and tampered ciphertext each exited1. Failed streaming output was discarded. Normal cleanup and each independent/global finalizer show 0 containers / 0 volumes / 0 emergency removals. Fresh temporary source, ciphertext and throwaway keys were removed; no secure erase is claimed.

### Owner clarification and selector correction

The requested G2 FAIL / G3 PASS row is unreachable under unchanged `packages/oracle/src/runner.ts`: G3 includes HTTP findings. The owner explicitly answered on 1 November: recognize the row as unreachable and verify HTTP-only coupling plus remaining reachable cases. No Oracle, normalization, reference, comparator, G4 or benchmark change was made. The actual HTTP-only case verifies G3 HTTP_STATUS with no DB findings. The new retention selector previously rejected these genuine completed G3 findings; it now accepts the existing finite HTTP codes alongside DB_SCHEMA/DB_STATE. All identity, source, coverage, compiler and cleanup requirements remain.

### Negative controls actually executed

- **27 PASS** receipt/filesystem/record controls: wrong head/source/candidate/attempt/pair, partial HTTP IDs, false aggregate, cleanup-error metadata, G1 ERROR/NOT_RUN/unfinished parity, missing/malformed/altered pack/index/sidecar, changed source, actual Linux symlink, unsafe path, oversized source, unexpected field, finalizer producer/error/nonzero metadata, real ciphertext tamper/cap, and record-upload failure/skipped. Production CLIs consume actual validated files and real ciphertext; metadata mutations are explicitly not new runtime faults. Trial bytes are unchanged by record paths.
- **4 PASS** independent encryptor faults: actual Docker worker crash exit23; unchanged 30-second deadline produced SIGKILL at 30,099 ms; ciphertext cap observed 5,242,903 output bytes and killed the child; actual successful production age encryption followed by a real injected cleanup child exit42 produced DIAGNOSTIC_CLEANUP_ERROR. That intentional cleanup fault required recovery of one owned stopped container, explicitly reported as such; post-recovery inventory0. Other crypto controls used normal zero-resource cleanup. Wrong recipient pin and oversized plaintext also refused.
- **6 PASS** validator controls: killed build -> G1/G2/G3 ERROR with ENVIRONMENT_ERROR; paused build -> ERROR/TIMEOUT after 35,333 ms at the unchanged outer build deadline; SIGTERM cancellation -> ERROR/CANCELLED; pre-entry real Node timeout -> ERROR/TIMEOUT with unfinished NOT_RUN trial; genuine admitted secret-marker candidate -> all public gates PASS but preserver REJECTED; real cleanup child exit42 -> G1 ERROR/CLEANUP_ERROR. All upload gates remained closed and independent finalizers0/0/0.

The paused-build test proves the existing Docker build-command deadline; it does not claim the separate inner compiler timer fired. Pre-entry Node timeout/crash harnesses exercise process-boundary classification, not inner tool execution. Fault injection programs are trusted harness code; candidate/worker recipes and budgets are unchanged.

Additional partial-SQLite, preserver/finalizer/gate process-boundary failures, actual finalizer emergency removal and actual nonzero-inventory refusal are currently executing at exact `ef2e0db352f55bd22bb48f5ab931a5a81222e763`, [run 41252358030](https://github.com/Meta-Project2026/Metamorph/actions/runs/41252358030). NOT_ESTABLISHED until its receipt is read. A subsequent hardening gives the secret-marker control a valid pinned age path so missing tooling cannot accidentally satisfy rejection; that patch must execute before final readiness.

## Local and Fast CI checks

Exact locally checked SHA: `ef2e0db352f55bd22bb48f5ab931a5a81222e763`, clean tracked checkout, Windows x64, Node v24.21.0, pnpm11.25.0.
[Command/exit/hash receipt](evidence/mmp099/local-ef2e0db.json).

All nine required commands exited0: frozen install, lint, typecheck, test, build, MMP097 Biome, active syntax, coverage validation and coverage-validator tests. Root tests531: 428 PASS / 103 SKIP / 0 FAIL. Syntax76 active modules; inventory77 including archive. Coverage-validator45 PASS. Reference56:55 PASS/1 SKIP; target-worker69 PASS; differential122:77 PASS/45 SKIP. Counts overlap and are not added. The first sandboxed target-worker attempt exited1 because Windows denied hardlink creation (EPERM); the unchanged suite passed outside that filesystem restriction. No candidate TS ran on the Windows host.

[Fast CI 41252358052](https://github.com/Meta-Project2026/Metamorph/actions/runs/41252358052) on exact `ef2e0db...`: Node22 and24 **SUCCESS**. Fast CI remains unchanged and distinct from actual Docker/crypto qualification.

## Earlier real attempts, retained honestly

| Run                                                                                   | Observed result                                                                                                                          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [41250245202](https://github.com/Meta-Project2026/Metamorph/actions/runs/41250245202) | Validator preparation ERROR; gates NOT_RUN; crypto not established; final0/0/0                                                           |
| [41250618249](https://github.com/Meta-Project2026/Metamorph/actions/runs/41250618249) | Separate trusted prep PASS; validator preparation ERROR; final0/0/0                                                                      |
| [41250887175](https://github.com/Meta-Project2026/Metamorph/actions/runs/41250887175) | Actual PHP build PERMISSION_DENIED because host-only HOME=/nonexistent; final0/0/0                                                       |
| [41251133850](https://github.com/Meta-Project2026/Metamorph/actions/runs/41251133850) | Fresh credential-free writable host HOME fixed Buildx; actual HTTP-only G1PASS/G2FAIL/G3FAIL exposed impossible expected row; final0/0/0 |
| [41251591683](https://github.com/Meta-Project2026/Metamorph/actions/runs/41251591683) | Actual first source roundtrip/wrong-key/tamper PASS; synthetic fault worker unreadable under umask077; harness ERROR; final0/0/0         |

Each immutable run/job/head receipt is in [evidence/mmp099](evidence/mmp099). Corrective commits trigger ordinary new PR jobs; no rerun API or workflow_dispatch is used. Historical MMP097 synthetic-only validation remains in Git history and `evidence/local-checks.json`; it is not relabelled as actual execution.

## Independent review and remaining gates

Prior astra6/max review at `bdbe856...` closed the original two driver-reporting findings. A new independent astra6/max review of exact `ef2e0db...` is requested after the successful actual Docker execution; result pending. Final ChatGPT exact-SHA review, reviewed merge and issue closure remain separate owner/project-brain actions. PR98 stays Draft.

G0/G4 INCONCLUSIVE; product/#61 NOT_ESTABLISHED; AI_GENERATION_NOT_RUN; OWNER_DECRYPT_NOT_VERIFIED. Owner harmless recipient roundtrip remains a separate future paid-request gate; no private key should be shared. Trust limits: same trusted host/daemon and no concurrent same-UID/root writer, SHA seals are not signatures, finite secret-marker rejection cannot detect all encoded secrets. Original harness/selector code is project work; the public workshop fixture and its MIT notice are reused unchanged. No new dependency or crypto primitive is introduced.

The new independent review of immutable ef2 identified three qualification findings (no confirmed production bypass): process faults could be collapsed into aggregate FAIL; secret/path/cap controls had unrelated rejection prerequisites; preparation PASS could survive cleanup failure/emergency recovery. Pending corrections preserve active stage/cause through every new helper/supervisor, supply valid pinned age behind secret rejection, rebind the intentionally invalid source across every trusted pair/identity/seal without executing it, and enforce prep completion0/0/0. Process/finalizer tests now require an actually all-PASS trial. Seven targeted reporting/projection regressions pass, including all preparation cleanup violations. These findings remain open for actual corrected-head execution and exact-SHA re-review.
