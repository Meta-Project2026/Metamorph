# Validation

Base c211ee3fade371ae429af90d8450051e241523ba. Refs19.
Archive32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4
downloaded and hash-verified for static inspection. License46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9
matches. api.php7d66dc6ad489972a00c6b93619c13024ea3f6d577206579bc2e97f58cf74fd77;
config.php11216d306900f8a2e304908cebab52b9375cba83c1ead99a90278ec14b2c21bd.
Source is MIT; retain the untouched upstream license inside admitted source.

New original acceptance tests:17/17 pass, exit0. One development PK control
initially expected DB_SCHEMA; unchanged comparator reports DB_STATE for table PK
metadata, now asserted explicitly. Comparator/normalization unchanged.

Preparation checks: pnpm install --frozen-lockfile, lint, typecheck, test (65/65),
build, --filter @metamorph/oracle test:reference all exit0. Reference suite55:
54 pass,1 existing POSIX-only skip on Windows. Acceptance CLI offline import
smoke and git diff --check exit0. No additional dependencies/lockfile changes.

Actual MMP-009A qualification:

- [Run40563424187](https://github.com/Meta-Project2026/Metamorph/actions/runs/40563424187),
  [job122398231244](https://github.com/Meta-Project2026/Metamorph/actions/runs/40563424187/job/122398231244),
  event workflow_dispatch, exact source1a4fca019e0a32c98549eccef22b9834d1e5305e:
  SUCCESS. Existing manual workflow unchanged; proof=reference selects the trusted
  extended reference proof. Frozen install, root65 checks/build, all55 Linux
  reference tests (38 existing+17 new, zero skips), actual proof exit0.
- Two independent workers each scheduled exactly MANIFEST.map(s=>s.id):6 clean
  resets,34 business HTTP,6 separate bootstrap,114 replay inspector captures,
  plus1 original mapping inspection. Exact status/stable headers/raw body and
  full before/after typed state repeat at every corresponding step. Actual
  business cell types integer/text; synthetic fixture separately covers all5
  supported SQLite cell types including int64 boundaries and finite real.
- All21 controls effective:18 explicitly original synthetic mutations/fault
  injections;3 actual isolated process exit/timeout/cancel. Concrete codes appear
  in the allowlisted corpus. No synthetic control is counted as a PHP request.
- Private owner-only packs sealed/verified after close and actual independent
  Docker inventory containers0/volumes0. Evidence remains ephemeral runner-local.
- Actual derived PHP image sha256:d1962f3bcb3ee1e7189371a2d00fdfdcc5bb3732f6d8bb736e6782eea5e6aafd.
  Pinned source/API/config/license/base and inspector PHP7.4.33/SQLite3.34.1,
  fixed UTC/real monotonic checks passed. Derived image reproducibility not claimed.
- Public artifact12760774775, ZIP SHA256
  5d3112a5218a3ee65c995fb6e1bbaf78045f3d7b967bb72a132390b41dc5559e.
  Downloaded only public ZIP, asserted sole reference-summary.json entry, computed
  ZIP SHA independently and matched GitHub digest; complete envelope/corpus
  allowlist reconstruction compared for exact equality before copying corpus.
- [Fast CI40563486235](https://github.com/Meta-Project2026/Metamorph/actions/runs/40563486235):
  Node22 job122398441066 and Node24 job122398441560 SUCCESS at same source SHA.

After that run, public serializer additionally checks corresponding pass integrity
hashes itself (driver already compared actual observations). New mutation test
rejects different repeat-pass hashes. Latest new tests18/18 exit0; final hosted
reference suite will have56 tests. Committed corpus deliberately retains the
historical1a4fca0 SHA, not a fabricated final HEAD. Final exact-HEAD CI/manual run
receipts are recorded in PR20 after final push; no older-run-as-newer-run claim.
Final local reference suite56:55 pass,1 existing Windows POSIX skip, exit0;
latest lint and git diff --check exit0. Host Node24.21.0, pnpm11.25.0.

Privacy: raw outside Git, owner-only POSIX packs, no raw download. Public artifact
is existing reference-summary.json plus versioned allowlisted acceptanceCorpus.
External retention EVIDENCE_RETENTION_NOT_CONFIGURED / EXTERNAL_RETENTION_NOT_RUN.
TS interface BLOCKED_TARGET_OWNER_API; all PHP-to-TS gates NOT_RUN; product
NOT_ESTABLISHED. No upstream PHP/DB execution on this Windows host.
