# Submission answers — English copy pack

`FORM_FIELDS_PENDING` · `VIDEO_URL_PENDING_USER_UPLOAD` · `NOT_SUBMITTED`.
VERIFIED means supported project facts, not owner approval to submit. Every
personal answer is `USER_CONFIRMATION_REQUIRED / OWNER_CONFIRMATION_REQUIRED`.

## Identity and choices

| Form field | Draft answer / status |
| --- | --- |
| Project name | Metamorph — VERIFIED repository identity |
| Team name | OWNER_CONFIRMATION_REQUIRED — exact spelling |
| Team members | OWNER_CONFIRMATION_REQUIRED — exact roster and approved public names; do not publish private contact details |
| Track | **Indie Developer Tools**, recommendation only; OWNER_CONFIRMATION_REQUIRED |
| Problem statement | **Push the Frontier**, recommendation only; OWNER_CONFIRMATION_REQUIRED |
| Public GitHub repository | VERIFIED public access: https://github.com/Meta-Project2026/Metamorph |
| 3-minute demo video | URL_PENDING_USER_UPLOAD — no recording/upload is established |
| Conditional special-track X post | OWNER_CONFIRMATION_REQUIRED: confirm whether the chosen optional track requires one; no post/link invented |

Recommendation basis (checked 5 November 2026): the official page describes the
indie track for individual builders/students and includes software in Push the
Frontier. This supports the theme fit; the team's eligibility and exact form
choice still require the owner. The public page calls it “Indie developer track”;
the owner's form labels it “Indie Developer Tools”. Do not infer special-track
rules, selection status or team eligibility from this page.
[Official event overview](https://dev.meta.ai/events/global-hackathon).

## Project Description — VERIFIED technical content, owner review pending

Metamorph helps developers inspect an AI-assisted migration from PHP to TypeScript
before accepting it. A bounded generation adapter proposes a candidate; an
independent Oracle compares build results, HTTP contracts and stateful SQLite
behavior against a pinned PHP reference. The offline evidence viewer makes exact
candidate identities, test coverage and failures inspectable without API keys or
a live model. In the recorded November 4 public run, one genuine model-generated
candidate passed 6 build/type checks, 17 HTTP comparisons and 20 state comparisons
across three scenarios. This is scoped public parity: real-candidate G0 was not
run, G4 remains inconclusive, and full product acceptance is not established.
[Original run](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137),
[receipt audit and limits](../mmp-194/provenance.md).

## Describe your use of Meta products — VERIFIED

We used the Meta Model API adapter with model ID `muse-spark-1.3` to generate a
TypeScript migration candidate. The November 4 public receipts record one
confirmed response, 6,571 input tokens and 11,170 output tokens, with zero repairs
in that run. The independent verifier recorded public G1, G2 and G3 PASS for that
exact candidate. A separate historical run records a real generation-and-repair
sequence that still failed public parity; we retain that outcome. No use of Muse
Code, Fireworks, Modal or Baseten is established by these receipts, and this answer
does not claim it. Cost is estimated; actual settled billing is unknown.
[Success run](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137),
[public artifact](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137/artifacts/13338052015),
[historical repair provenance](PROVENANCE.md), [exact audit](../mmp-194/provenance.md).

## Why are Meta's models important? — VERIFIED contribution; owner phrasing review

Muse Spark 1.3 supplied the genuine generated candidate in the demonstrated
workflow. That gives us a concrete model-produced program to evaluate, rather
than a scripted success fixture. Metamorph keeps generation separate from
verification: model output proposes the migration, while independent comparisons
decide the recorded public verdict. The adapter boundary is designed to permit
other providers; this result demonstrates Meta's contribution, not an exclusive
technical dependency or superiority over other models.
[Generation/trial provenance](../mmp-194/provenance.md),
[adapter documentation](../../packages/agent-real/README.md).

## Experience and ratings — human self-report only

| Form question | Safe draft / required human input |
| --- | --- |
| Experience with partner technologies (Fireworks, Modal, Baseten) | OWNER_CONFIRMATION_REQUIRED: name only products actually used and describe actual experience. Engineering receipts here do not establish partner use. |
| Meta Model API familiarity | OWNER_CONFIRMATION_REQUIRED: choose your actual familiarity level. |
| Overall favorability of Meta Model API | OWNER_CONFIRMATION_REQUIRED: supply your own rating and reason. |
| Muse Code recommendation rating | OWNER_CONFIRMATION_REQUIRED: answer only from actual use; use the form's “not used” option if truthful and available. |
| Biggest obstacle | OWNER_CONFIRMATION_REQUIRED. Fact-grounded draft, only if it matches your experience: “Making a generated migration preserve API scalar types and stateful behavior, and distinguishing verifier failures from candidate defects.” Historical failures support the engineering issue, not a personal ranking. [Historical evidence](PROVENANCE.md) |
| Comparison with other AI models | OWNER_CONFIRMATION_REQUIRED: no controlled comparison is established by this submission evidence. Do not invent a win rate, preference or benchmark. |
| Most important model/tool selection criteria | OWNER_CONFIRMATION_REQUIRED. Optional wording to adopt only if true: “Behavioral correctness, inspectable evidence, predictable cost and bounded tool access.” |
| Reasons to switch tools | OWNER_CONFIRMATION_REQUIRED: state your actual switching criteria; no fabricated intent. |
| Blockers to production | VERIFIED technical limits: real-candidate G0 NOT_RUN; formal G4/held-out acceptance INCONCLUSIVE; private custody not independently established; product NOT_ESTABLISHED. OWNER_CONFIRMATION_REQUIRED for which was most significant personally. [Audit](../mmp-194/provenance.md) |
| Publicity/usage consent and final submit | OWNER_ACTION_ONLY: human reads the actual terms and chooses; no consent or submission recorded. |

Reuse/provenance: workshop PHP fixture comes from Tanjila Afsari Rubina's MIT
upstream; notice is retained. Project tooling and demo work are distinct from
reused inputs and pre-event research. No claim of all-new hackathon authorship.
[Upstream notice](evidence/LICENSE.upstream).

## v2: tighter judge-facing wording (same facts, optional)

These are shorter, positive versions of the three free-text answers above. The
facts are the same and the sources are the same audit links. Disclaimers about
what we do *not* claim are dropped, because a form answer does not need to list
non-claims. Owner review is still required.

**Project Description.** Metamorph lets developers hand a legacy PHP service to
AI and get back a TypeScript migration with evidence of whether it still behaves
the same. Meta's Muse Spark 1.3 generates the complete TypeScript project. An
independent Oracle then builds it in a disposable Docker sandbox, runs the
original PHP app and the candidate side by side, replays identical HTTP
scenarios, and compares every response and the SQLite database state step by
step. Failures go back to the model as allowlisted codes for one capped repair.
Every verdict is tied to exact hashes and published as receipts that anyone can
hash-check offline in 30 seconds. In our 4 November run, a single Muse Spark
response passed 6/6 build, 17/17 HTTP and 20/20 state comparisons on the public
scenarios. Hidden held-out tests are next.

**Describe your use of Meta products.** Muse Spark 1.3 on the Meta Model API is
our migration engine. We send the pinned PHP source with a strict migration
contract and request JSON-schema structured output, so each response is a
complete, machine-checkable TypeScript project. When the independent Oracle
finds a defect, Metamorph sends only allowlisted failure classes (for example
`HTTP_JSON_TYPE`) back to Muse Spark for a capped repair attempt. A real
generate, verify, repair, verify cycle is recorded in run 41726833705. Our
4 November run used one Muse Spark response: 6,571 input and 11,170 output
tokens, about USD 0.056 estimated. Its candidate passed public G1 6/6, G2 17/17
and G3 20/20. Calls go only through a guarded GitHub Actions workflow with a
cost ceiling and no retries, and the API key is kept away from the sandbox.

**Why are Meta's models important?** Muse Spark 1.3 does the hard creative part.
In a single structured response it translates a whole PHP service, including its
JSON and database behavior, into strict TypeScript, and it can revise that code
from compact Oracle feedback. Each attempt is one request, one candidate hash and
one verdict, at a few cents. That makes migration an auditable transaction and
keeps repeated, verified attempts affordable. Metamorph adds independent
verification on top, so a team can use Muse Spark for real migrations without
taking its output on faith.
