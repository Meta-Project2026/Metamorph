# MMP-194 public evidence audit — 5 November 2026

GO for recorded public G1–G3 evidence, not formal product acceptance.
Fresh base: `14a54665a94394ca9fdb68a7c27f0c596428cbea`.

Source: [run 41856569137, attempt 1](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137),
started `2026-11-04T15:19:45Z`, evaluator/runner source commit
`95397bbff94f3e0121ebdc9fa375880762bcbac7`. Both jobs record `ubuntu-24.04`
and this head. Workflow success alone is not a gate verdict.

Only [public artifact 13338052015](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137/artifacts/13338052015)
was downloaded: `meta-paid-public-41856569137`, **14,807 original ZIP bytes**,
SHA-256 `38fd34d24eca33630c79c9f4120194f623d7cfec4be5826355150a31089e4b1e`.
Downloaded bytes matched GitHub's artifact digest. Recorded expiry:
`2026-11-11T15:23:37Z`. The retained ZIP keeps offline mode independent of expiry.
Candidate and private-diagnostics archives were not downloaded.

All 13 member names/sizes/SHA-256 values are in
`research/demo-readiness/provenance/track-g/source-pins.json`. Original ZIP and
selected public run/artifact/job API metadata are retained beside it, unserved.
No prompts, candidate source, HTTP/DB payloads, ciphertext, keys or private logs
were fetched or added. Original public custody metadata is excluded from the
served projection and cannot establish independent custody verification.

| Identity | Recorded value |
| --- | --- |
| PHP upstream | `tanjilaafsarirubina/car-workshop` |
| Source commit | `d272170d0aecbd28eb5b13e272d9dd11d545b66c` |
| Source archive SHA-256 | `32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4` |
| Context SHA-256 | `9935a8e71ee05267fc60c2b0aa03a9174c0cb50b7f9e5c2f58ad3f6f83824065` |
| Public manifest SHA-256 | `d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4` |
| Candidate SHA-256 | `4207053ada23f8e94ecf6301452ee4ea8228a3717c0a478d3e550443cec130e6` |
| Oracle attempt | `ab94164e-5d98-4b5f-b28d-290055364999` |
| Request SHA-256 | `01cb64b4aef8206f7e7299dec4487cab6638718fb771f3e1a7c1d8fd5593121a` |
| Response SHA-256 | `9eebdcdfe36a389259e487c500a79bf64ae82f061af06c93a713eccabec306c4` |
| Workflow SHA-256 | `346622c15a4cd3cf9169419e5658f01997c357ab2e872d636a8131854de399f7` |

Generation, authorization ledger, preflight, final send receipt, trial, scorecard,
every scenario pair and finalizer were reconciled. Actual workflow Git bytes at
the run commit were independently hashed and match the receipt. Source/candidate/
request/response hashes are linked receipt identities: their source/payload bytes
were not downloaded or rehashed. Existing upstream MIT notice stays in
`evidence/LICENSE.upstream`; no new dependency or upstream source was copied.
Project demo work, reused fixture and historical model output remain distinct.

`trial.json` aggregate gates and all three pairs agree with `scorecard.json`:
G1 PASS IDs `{scenario}:typecheck` and `{scenario}:build`; G2 PASS IDs
`{scenario}:step-0` through `step-(N-1)`; G3 adds `{scenario}:initial` for each
scenario. Ordered scenarios: `workshop-business` N=6, `workshop-rejected` N=5,
`workshop-capacity` N=6. **6 build checks, 17 HTTP comparisons, 20 state
comparisons**, explicit PASS and empty findings at aggregate and pair level.
Full ordered ID sets and pair IDs are in the validated JSON inspector. Executed
counts alone never imply passing coverage or a percentage of the whole app.

Generation: `REAL_INFERENCE`, `meta-model-api`, `muse-spark-1.3`, exact version
unknown. One request, one confirmed HTTP 200 response, TLS peer verified. 6,571
input / 11,170 output / 0 cached tokens; estimate USD 0.05568625, charged/reported
cost unknown, `ESTIMATE_ONLY`, `NO_PROVIDER_HARD_CAP`. Zero repairs;
`FIRST_PUBLIC_PASS_STOP`. Preliminary send receipt remains ERROR/UNKNOWN before
the final response, not a second response. Negative historical results remain.

Recorded limits: 2 posts, 1 repair, 0 retries, 16,384 max output tokens; target
lifetime policy 180,000 ms. Historical policy values are not new authorization
or independent proof of resource-limit enforcement. Trial/pairs report
`VERIFIED_ZERO_RESOURCES`; finalizer PASS reports 0 containers, 0 volumes,
0 emergency removals. No fresh engine inspection occurred.

Separate synthetic G0: committed `research/mmp-183/linux-docker-result.json` at
base, 17,117 bytes, SHA-256
`d4d56c7735805987e7b8688005db152d36902f2a7f57f44179429a4e45bd147d`.
It records 11 controls plus a qualified positive matching expected outcomes.
Positive candidate `67dbb4b31a245ac304ebe7722aa7bfc13d6263001b3eea7e850e92e4edad1af0`
is different from the genuine AI candidate. Its scoped PASS is an owner-recorded
public summary here, not independent engine attestation. Two earlier ERROR
attempts and NOT_RUN fault controls remain recorded. No raw owner-private engine
logs were available to independently attest that session.

Formal genuine-candidate G0 = NOT_RUN (original aggregate INCONCLUSIVE with
`G0_NOT_ESTABLISHED`), G4 INCONCLUSIVE despite 27 public control IDs because
`HELD_OUT_NOT_RUN`, product NOT_ESTABLISHED, private custody not independently
verified. No benchmark registration or owner acceptance is inferred.

Offline reproduction, no candidate execution:

```sh
python -B research/demo-readiness/prepare-track-g.py research/demo-readiness/provenance/track-g/public-receipts.zip research/demo-readiness/evidence/real-ai-41856569137/mmp194-track-g-v1.json
node --test research/demo-readiness/track-g.test.mjs
```

Projection: 14,601 bytes, SHA-256
`91631e07609bf344b3919eff61fc385a011e5c1a80e504ce1e548d1ed5dd83f5`.
ZIP and member hashes are checked before parsing, with an explicit output
allowlist. Browser checks projection SHA before bounded strict JSON and exact
semantics. This frozen snapshot is not a new Oracle run, general source admission,
or authentication independent of the recorded trusted adapter.
