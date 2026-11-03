# MMP-154 real experiment log

**2026-11-03: no real experiment launched by this task. Actual Meta requests: 0.**

The generation-only fast-path implementation is in [PR #155](https://github.com/Meta-Project2026/Metamorph/pull/155).
Independent exact-head review, merge and authentic operator launch are pending.
The configured GitHub secret name was confirmed without reading its value.
Account balance/credit terms and generation entitlement remain unverified.

The offline preflight preview and synthetic regression results are not model
results. The local disposable Docker smoke stopped at daemon discovery, before
resource creation or any Oracle invocation; that is environment ERROR, not model
FAIL. Historical real runs and manual derivatives have not been altered or
reclassified. G0/G4 INCONCLUSIVE; product NOT_ESTABLISHED.

For the first authentic run, append: exact run URL and main/workflow identity;
REAL_META request/response/candidate hashes and actual count; provider token
usage and estimated cost versus charged UNKNOWN; separate custody artifact
ID/digests; G1/G2/G3 verdicts and 6/17/20 plus 27 public-control coverage;
normal/independent cleanup; safe feedback codes and stop reason. Identify the
dominant measured bottleneck and a concrete next experiment hypothesis before
another operator-triggered run. Do not invent that observation in advance.

Production signed repair and attempt-2 custody remain unimplemented. A first
public PASS must stop; a complete public FAIL currently stops with that precise
integration blocker. No synthetic FAIL-to-repair-to-PASS is a real trial here.

**2026-11-03 (MMP-156, offline diagnosis): no new real experiment launched.
Actual Meta requests this task: 0.**

First real run [41696312924](https://github.com/Meta-Project2026/Metamorph/actions/runs/41696312924)
(`main@de881e7`, candidate `1063fc5b…`, REAL_META `muse-spark-1.3` Standard,
one POST, 6,060 in / 9,923 out, estimated $0.04974775, charged UNKNOWN):
G1 6/6 PASS, G3 FAIL `DB_SCHEMA` at every initial snapshot (3/20, no
`DB_STATE`), G2 0/17 INCONCLUSIVE, formal G4 INCONCLUSIVE, product
NOT_ESTABLISHED. Public receipt deduction plus trusted-comparator mechanics
(`research/mmp-156/`): initial tables matched byte-for-byte (tables, columns,
primary keys, seeds, `sqlite_sequence` row); the mismatch is confined to
stored `sqlite_schema` DDL text (reformat/spelling/extra-object classes
consistent; missing table, missing seeds, dropped `AUTOINCREMENT` and
`IF NOT EXISTS` omission refuted). Exact candidate DDL delta stays UNKNOWN —
ciphertext-only custody without the owner key; mmp089 diagnostics are
`NOT_APPLICABLE` for G1-PASS runs. Smallest candidate-side change prepared:
`target.schemaContract` generation-prompt paragraph requiring byte-for-byte
source DDL preservation (new `contextSha256`; old receipts unchanged). No
Oracle/comparator/reference change, no repair-eligibility change, no paid
call. Next run needs independent exact-HEAD review, merge, a new exact-main
preflight card (ceiling $0.229517 worst case at the 2026-11-03 tariff) and
explicit operator launch.

**2026-11-03 (MMP-158, implementation): no new real experiment launched by this
task. Actual Meta requests: 0.**

The signed two-attempt repair vertical (MMP-158) is implemented for operator
review: `generate_then_repair` performs generation → full independent Oracle →
one repair POST, only after a complete eligible public FAIL (the exact
`COMPLETE_PUBLIC_FAIL` + `HTTP_JSON_TYPE` shape recorded by real run
[#41703793337](https://github.com/Meta-Project2026/Metamorph/actions/runs/41703793337),
whose sanitized receipt is embedded read-only as test evidence) → fresh
attempt-2 custody and a second full Oracle. Cross-run reuse of the sealed
#41703793337 candidate was rejected: it would need out-of-run candidate bytes
or runner-side decryption, both outside the trust contract. Per-attempt OIDC
admissions, distinct custody artifacts/readbacks, pessimistic two-send
reservation before the first POST, no third POST and fail-closed gates are
unit-tested offline (real-receipt eligibility, session sequence, custody
capsules, mode/confirmation pairing, preflight aggregates, scorecard
refusals). Full suite: 846 tests, 733 pass, 113 platform skips, 0 fail on the
implementation host; hosted CI records its own result. The live two-attempt
run remains NOT_RUN and requires the same review/merge/operator gate as
before; product NOT_ESTABLISHED.
