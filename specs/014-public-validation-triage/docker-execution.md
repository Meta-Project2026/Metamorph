# MMP-044 executable public experiment — 2026-10-28

Base: `aea0c5d97e3b1be44be82b8e11dc499e54ef782b` (PR #45 merged).
Original corpus, predictions, pins, candidate, reference, manifest, policy,
mapper, comparator and worker files are unchanged. Scope is the new host driver,
fault tests, a manual-only Docker entrypoint and this additive report.

Current classification: **NOT_ESTABLISHED / DOCKER_NOT_RUN**. No real public
PHP/TS pair, HTTP comparison or SQLite comparison has executed here. Local host:
Windows x64, no Docker executable. There is no runtime cleanup or parity claim.

The new host-driver unit command is explicitly
`node --test research/mmp-044/driver.test.mjs`: initial implementation passed
25 tests, 0 failed, 0 skipped (exit 0). These use original comparators and
synthetic wire-shaped receipts to test orchestration failures; they are not
Docker observations. Frozen install and package build also exited 0.

Runtime execution is pending registration of
`.github/workflows/mmp044-public-docker.yml` on the default branch. The main
driver PR and separate registration PR will be linked here after publication.
No existing private audit workflow is reused. Review and owner-authorized merge
of registration are required before the feature-ref dispatch can execute; no
self-merge is authorized. Planned command:

```sh
gh workflow run mmp044-public-docker.yml --repo Meta-Project2026/Metamorph --ref feat/mmp-044-public-docker-proof
```

The execution proof remains incomplete until a real exact-SHA run and independently
checked allowlisted artifacts exist. Counts are currently pairs 0/14, HTTP 0/38,
SQLite 0/52; real positive/negative controls and Docker final inventory NOT_RUN.
G0/G4 INCONCLUSIVE, public G1/G2/G3 NOT_RUN, product NOT_ESTABLISHED. The previous
private AUDIT_FAIL remains unchanged and no causal connection is inferred.
