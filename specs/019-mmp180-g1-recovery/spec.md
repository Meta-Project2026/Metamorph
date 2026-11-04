# MMP-180: signed G1 compiler recovery v2

Refs #180 #160 #154 #161. Owner: Vladimir. Independent trust/Oracle review
required before merge. Constitution remains PROPOSED / PENDING OWNER RATIFICATION.
Vladimir reports Ilia's broad consent; this is not verified personal PR approval.

Add explicit `generate_then_repair_g1_v2`: two POSTs maximum, one compiler repair,
zero retries. The original signed first-send plan reserves generation plus the
96 KiB repair projection before any network send. Only one normal first
`workshop-business:typecheck` failure with one trusted TS2339/TS2769 diagnostic
may propose repair. Build is NOT_RUN; G2/G3 remain INCONCLUSIVE, 0/17 and 0/20.
v2 deliberately allows **only** G1_BUILD_RECOVERABLE; complete parity FAIL repair
remains the existing v1 mode. First public PASS stops with one send.

The trusted host must authenticate original generation, actual verifier origin,
distinct custody/Oracle IDs, stored ciphertext metadata/readback, same-run source
lease and both normal/independent zero-resource cleanup. A private same-run MAC
journal survives credential boundaries; a public JSON boolean grants nothing.
Only the revalidating host issues a short-lived, opaque, single-use capability.
Fresh signed OIDC/main/workflow/tariff/budget checks precede attempt 2, followed
by repeated source/custody/cleanup verification and exclusive durable reservation.
A partial record or UNKNOWN consumes that attempt permanently.

Declassify only mmp160-g1-feedback-v1 `{format,code,path,line,column,bindingDigest}`.
The credentialed host may return the model's exact original same-run changes to
Meta as data. Never publish source, raw compiler text, private observations,
keys, stacks or worker logs. Candidate execution remains isolated. A fresh
attempt-2 custody chain and verifier execute full G1 then all 17 HTTP/20 SQLite
observations; second failure stops. G0/G4/product remain NOT_ESTABLISHED.

No live Meta call, paid workflow dispatch/rerun, archived ciphertext/decryption,
reference/comparator/normalization/held-out edit, self-merge or product acceptance
is authorized. Synthetic tests are simulated observations, not compiler/parity
qualification or measured model efficacy.
