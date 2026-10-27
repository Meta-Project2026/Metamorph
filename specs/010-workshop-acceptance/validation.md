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

Real MMP-009A Docker qualification: NOT_RUN at preparation. Existing historical
MMP-006/008A results are context, not execution proof for this feature HEAD.
Hosted run/job/SHA, actual corpus and final CI receipts will be recorded after
execution. No business result/type inferred from source is labeled measured.

Privacy: raw outside Git, owner-only POSIX packs, no raw download. Public artifact
is existing reference-summary.json plus versioned allowlisted acceptanceCorpus.
External retention EVIDENCE_RETENTION_NOT_CONFIGURED / EXTERNAL_RETENTION_NOT_RUN.
TS interface BLOCKED_TARGET_OWNER_API; all PHP-to-TS gates NOT_RUN; product
NOT_ESTABLISHED. No upstream PHP/DB execution on this Windows host.
