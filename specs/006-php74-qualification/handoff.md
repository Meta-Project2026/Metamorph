# Handoff to Vladimir — MMP-004 / issue #6

PHP runtime assistance is no longer needed for the measured reference profile:
the dedicated manual GitHub Docker workflow works. Proposed source:
`tanjilaafsarirubina/car-workshop@d272170d0aecbd28eb5b13e272d9dd11d545b66c`,
MIT. **GO only for sequential `workshop-clock`**: PHP 7.4.33, SQLite 3.34.1,
verified fixed wall time 2026-10-27 12:00:00 UTC and real monotonic time. Both
clean repeats of `workshop-business`, `workshop-rejected`, `workshop-capacity`
match exact HTTP/typed DB observations. The ordinary real-clock profile is NO-GO
for exact replay. ExamSuite runs but random IDs/state prevent exact replay GO.

[Run evidence](https://github.com/Meta-Project2026/Metamorph/actions/runs/40420872942),
tested HEAD `43287bb38280b4bf9b9fc93185c52ab1aaad809e`. The
[BenchmarkDefinition proposal](benchmark-proposal.json) is schema-checked, not
registered or jointly approved. Please review this scope before registration.
Migration unit names are proposed decomposition labels, not implemented units.

For a future real migration, keep an Oracle-owned host broker between the agent
Verifier port and independent disposable reference/TS workers. Copy only the
candidate source into the candidate worker; give it no reference network, DB,
Oracle code, fixtures, private evidence or held-out storage. Collect HTTP and DB
state through trusted inspection; no candidate-authored verdict/snapshot endpoint.
Both workers need equivalent independently verified initial logical state and
clock controls; **verify actual Node/SQLite clocks independently**, since a PHP
preload result does not prove Node's runtime uses the same clock APIs.

The probe's `php74-logical-v1` snapshots are reference research evidence, not an
adapter implementing the production `sqlite-logical-v1` interface. Map via a
reviewed Oracle-owned inspector without changing core comparator semantics.
Do not load this probe directly as an Agent Verifier or forward its raw data into
repair prompts. Only declassified public summaries may cross that boundary.

Before product use, add retained private raw evidence storage, isolated TS worker
build/start and G0/G1 checks, a frozen reviewed scenario manifest, independent
controls and held-out isolation. Concurrency/clock-boundary/crash recovery remain
NOT_RUN. The current sequential capacity/duplicate/rejection checks do not replace
those gates. No model/API entitlement or spend is authorized by this handoff.
