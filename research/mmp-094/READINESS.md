# MMP-094 — exact-main paid-v2 readiness

**VERDICT: NO_GO — NO_GO_PENDING_PARITY_RETENTION_DECISION.**
`CODE_REVIEW = READY_FOR_INDEPENDENT_REVIEW`; `PAID_SPEND = NO_GO`.
This is an offline decision package for [#94](https://github.com/Meta-Project2026/Metamorph/issues/94),
not authorization to dispatch or spend. No production or workflow changes.

## Decision

The current approved Option B preserves an attributable **G1 FAIL / BUILD_FAILED**
only. If the next candidate compiles but fails HTTP or SQLite parity, preservation
returns `NOT_APPLICABLE` and no source artifact is uploaded. The generated TS and
private observations disappear with the ephemeral runner. This is a **P0** risk
to the value of the single next paid experiment. Do not spend until the owner
explicitly accepts that risk or separately authorizes, implements and independently
reviews a minimal candidate-only retention extension. This PR does neither.

Actual owner-recipient decryption is also `OWNER_DECRYPT_NOT_VERIFIED`. Existing
20/20 executor and 20/20 independent throwaway-key controls prove implementation
behavior in their scope, not that the owner can decrypt the pinned recipient.
The harmless local [owner checklist](owner-key-roundtrip.md) requires no key
sharing. No outcome has been supplied or inferred.

## Exact identity

```text
MAIN_SHA = 53b4d5a1da99e49a223fa9cafe03ff24b280bf86
AUDIT_HEAD_SHA = 53b4d5a1da99e49a223fa9cafe03ff24b280bf86
REQUEST_SHA256 = 55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d
CONTEXT_SHA256 = 21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345
SOURCE_COMMIT = d272170d0aecbd28eb5b13e272d9dd11d545b66c
SOURCE_ARCHIVE_SHA256 = 32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4
MANIFEST_SHA256 = d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4
RECIPE_SHA256 = f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3
PRICING_SOURCE_AND_TIMESTAMP = https://dev.meta.ai/docs/pricing-rate-limits ; 2026-10-30T10:08:39Z
ESTIMATED_USD_AND_CEILING_SEMANTICS = 0.224402; proposed selector 0.25; NO_PROVIDER_HARD_CAP
G1_FAILURE_DIAGNOSTICS = IMPLEMENTED_AND_PRIOR_OFFLINE_CONTROLS_VERIFIED; ACTUAL_UPLOAD_NOT_RUN
G2_G3_FAILURE_SOURCE_RETENTION = GAP_NEEDS_SEPARATE_OWNER_DECISION
OWNER_RECIPIENT_DECRYPTION = NOT_VERIFIED
OWNER_ONE_POST_PAID_AUTHORIZATION = NOT_GIVEN
PRODUCT_ACCEPTANCE = NOT_ESTABLISHED
VERDICT = NO_GO
```

## Observed

- Fresh clean main is the merge of PR #93. [Post-merge CI 41014429601](https://github.com/Meta-Project2026/Metamorph/actions/runs/41014429601)
  completed SUCCESS on Node22/24 at the exact main SHA. Open PR #87 at
  `a10265532e7c24024294a378c209703cc4ff1ae8` remains separate.
- Read-only GitHub metadata passes the existing environment-policy validator:
  public repository, protected main at the audited SHA, `META_API_KEY` environment
  restricted to main. There are no required environment reviewers or wait timer.
  These metadata reads access no secret value. Real signed OIDC admission is
  **NOT_RUN** here; it is checked in a future separately authorized workflow.
- Existing `audit-request.mjs` ran after frozen install/build on clean exact main,
  in a fresh minimal environment with all network entrypoints denied. Zero blocked
  attempts, no provider construction and no credential mapping. It invokes the
  same `prepareMetaMigration` serializer as production admission and generation.
- Full serialized request: **22,762 UTF-8 bytes**, messages 21,209 bytes,
  `muse-spark-1.3` Standard, API effort `low`, 16,384 completion tokens including
  reasoning, strict changes-only JSON Schema, no tools/history/streaming.
- Request/context/source/manifest/recipe identities equal MMP-086 values **after
  recomputation**. The main/head identity changed; it is not serialized into the
  request/context. The merged diagnostics changes therefore need not change those
  byte hashes. [Request receipt](evidence/request-audit.json).
- Frozen install/lint/typecheck/tests/build, research syntax and coverage checks
  exited 0 on this main. Windows root: 357 PASS, 102 SKIP, 0 FAIL; skips remain
  unexecuted checks. [Validation](validation.md).
- Current target contract remains strict ES2022 NodeNext/CommonJS without a
  candidate package.json; Node24.11.0, TS5.9.3, @types/node22.20.5 and SQLite3.50.4.
  No runtime, compiler, fixture, comparator or Oracle policy was changed.

## Hypotheses and unknowns

The main risk is source loss on parity failure; exact cause/outcome of a future
model response cannot be predicted by green CI. Compiler/runtime timeout #84
remains unresolved. MMP-089's additional unchanged baseline is PARTIAL /
EVIDENCE_ERROR with build ETIMEDOUT/SIGTERM; original proof process exit was not
recovered (exit1 is source-derived inference). The earlier MMP-083 three clean
trials do not erase this later observation. Original real run40900698372 remains
G1 FAIL/BUILD_FAILED with unavailable source/compiler text and ROOT_CAUSE_UNKNOWN.

Account entitlement/balance/current quota, next model output, actual token usage,
settled cost, owner-key decryptability and actual Actions ciphertext upload are
not established here. Public documentation is not account authorization.
G0/G4 stay INCONCLUSIVE and [#61](https://github.com/Meta-Project2026/Metamorph/issues/61)
stays OPEN / NOT_ESTABLISHED.

See the [retention truth table](failure-retention-gap.md),
[owner decision card](owner-authorization-card.md) and
[historical provenance](evidence/historical-provenance.json). Internal read-only
agent support is not the required independent ChatGPT approval. Review must use
the final pushed PR SHA. No self-merge; even a documentation merge changes main
and invalidates this card until fresh exact-main audit and owner decision.
