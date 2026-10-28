# Decision: NOT_ESTABLISHED

Classification: **NOT_ESTABLISHED**. Reproduction: **static-only**.
Real public experiment: **DOCKER_NOT_RUN**, with zero PHP/TS HTTP and SQLite
comparisons. No executed Docker observation establishes a candidate defect or
evaluator defect. This is the completed result allowed by the task when Docker
is absent, not a claim of runtime equivalence.

Public source review supports two precise hypotheses: different whitespace
classes in validation regexes and different numeric-string integer conversion.
The preregistered corpus tests these rules along with nine predicted matching
cases. There are five predicted differing cases, not five observed failures.
All 38 request bytes pass the unchanged requestPolicy. Four synthetic comparator
controls behave as expected. Neither fact validates real transports or causality.

Confidence is high in source identities, public fixture provenance, policy
admission and the absence of local runtime evidence. Confidence in the runtime
predictions is provisional: the exact PHP 7.4/PCRE/form/SQLite behavior and full
typed observations remain unmeasured. No relationship to any specific private
sample or private failure cause is established. The existing private AUDIT_FAIL
remains unchanged. EVALUATOR_ERROR_CONFIRMED is unsupported, including by the
ordinary high-level MANIFEST admission restriction.

## Next small reviewable step

Implement and execute only the public host driver described in
[docker-handoff.md](docker-handoff.md) on an authorized disposable Linux Docker
host, using the existing low-level transports. Keep this preregistration and all
frozen inputs unchanged. Measure initial/per-step state, real positive/negative
controls, raw-versus-mapped observations, clock/provenance and final inventories.
The high-level manifest-bound adapters must not be bypassed by manifest mutation.
No new runtime execution workflow or shared API change is needed for this
handoff's proposed host driver. Runtime infrastructure is the current blocker.

If a divergence is independently confirmed, classify only that public case,
retain a minimal public regression, and propose a separate owner-reviewed fix
to the TS conversion or validation rule. Test ordinary decimal ids, nonexistent
ids, malformed numeric strings and character-class boundaries against actual
PHP behavior before changing a general conversion helper. Both owners explicitly
agree to any crossing API change; no agreement is inferred here.

If no public mismatch is established, keep NOT_ESTABLISHED and investigate
transport/mapping/comparator hypotheses as a separate scoped track. Never select
new private samples or tune this corpus to relabel the private audit.

## Gate and ownership limits

G0 and G4 are **INCONCLUSIVE**. Candidate isolated G1 and this corpus's real G2/G3
are **NOT_RUN**; completed host package checks are recorded separately in
[results.md](results.md). Product **NOT_ESTABLISHED**. Hosted fast CI is technical
validation only. No merge, Issue #44 closure, PR #31 change, candidate patch,
governance ratification, teammate notification or independent review is claimed.
