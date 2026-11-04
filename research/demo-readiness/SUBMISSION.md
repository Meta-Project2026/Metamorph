# Metamorph — three-minute recording storyboard

`DEMO_SCRIPT_READY` · `VIDEO_URL_PENDING_USER_UPLOAD` · `NOT_SUBMITTED`.
This is a recordable script, not a recording or an uploaded video.

Audience: a developer maintaining a PHP workshop service who wants to migrate its
API to TypeScript while checking behavior. This is a developer tool: source in,
candidate out, independent comparisons and inspectable evidence for review.
No candidate is executed by the viewer; all shown results are recorded.

Start from repository root:

```sh
node research/demo-readiness/serve.mjs
```

Open `http://127.0.0.1:4171/`, follow the latest-proof link. Browser starts manually.
Use 1440×900, hide personal tabs/notifications, keep the pointer still during speech,
and avoid keys, private paths or provider consoles. Verify the local load once,
then reload to the initial NOT_VERIFIED state before recording. Suggested speech
is about 330 words; the slots below total **3:00**, with room for clicks/pauses.

| Time / duration | Screen and action | English presenter script |
| --- | --- | --- |
| 0:00–0:25 / 25 s | Latest proof sheet hero, product panel visible; no results loaded. | “Moving a PHP service to TypeScript is easy to describe and hard to trust. A generated program can compile and still change behavior. Metamorph is a developer tool that pairs AI generation with an independent Oracle, so maintainers can review evidence before accepting a migration.” |
| 0:25–0:50 / 25 s | Click **Verify pinned public evidence**; show public gate strip. | “Here is one concrete workflow: take the pinned PHP workshop service, generate a TypeScript candidate, and compare its public API and state transitions. This screen loads saved public receipts from a real model run. It is an offline evidence demonstration, not live inference.” |
| 0:50–1:20 / 30 s | Show G1/G2/G3 and summary. | “The November fourth candidate passed all six build and type checks, seventeen HTTP comparisons, and twenty state comparisons across three public scenarios. We verified the explicit PASS verdicts and exact test IDs, not just how many tests executed. These counts cover the recorded manifest, not every possible behavior of the application.” |
| 1:20–1:45 / 25 s | Expand exact IDs/JSON briefly, then identities. | “Every result is tied to one candidate hash, one PHP source commit, and one evaluator commit. The original public archive and all thirteen members were hashed before preparing this view. This makes the result inspectable offline without publishing or running the candidate source.” |
| 1:45–2:10 / 25 s | Show usage, stop reason and cleanup. | “Meta’s Muse Spark 1.3 supplied the candidate through the Meta Model API adapter: one confirmed response, zero repairs in this run. Generation proposes code; the Oracle judges it. The displayed cost is an estimate, with actual billing unknown. Cleanup is receipt-reported, not a fresh engine inspection.” |
| 2:10–2:35 / 25 s | Scroll to separate synthetic G0 panel and identities. | “The separate G0 record contains eleven synthetic controls and a qualified positive. Those involve different candidates. We do not combine that result with this model candidate to claim all gates passed. The original failed and inconclusive outcomes remain in the historical tracks.” |
| 2:35–3:00 / 25 s | Return to product panel; end with repo URL visible separately. | “For this real candidate, G0 is not run, G4 is inconclusive, and product acceptance is not established. Our distinction is evidence tied to an exact candidate, with failures kept visible. Try the offline viewer from our public repository and inspect the receipts before trusting a generated migration.” |

Evidence for the quantitative claims: [original run](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137),
[public artifact](https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137/artifacts/13338052015),
[exact provenance audit](../mmp-194/provenance.md), and the pinned projection's
`gates`, `scenarios`, `generation`, `provenance`, `cleanup` fields. Synthetic G0
comes only from the distinct [committed summary](../mmp-183/linux-docker-result.json).
No claim of production readiness, full G0–G4 acceptance or Meta exclusivity.

60-second fallback: 0:00–0:15 explain the tool; 0:15–0:30 home → load A–F;
0:30–0:45 select F and show real repair ending in public FAIL; 0:45–1:00 show
product NOT_ESTABLISHED and call to inspect the pinned public evidence. Internet
or provider failure does not affect local files. If G is missing/invalid, show
NOT_VERIFIED and use A–F; never narrate a missing success as observed.

Recording/upload QA (owner): rehearse and trim to 3:00; check legibility/speech;
ensure no sensitive content; upload to the chosen host; copy the actual video
URL into the form pack; open that URL in an incognito browser without login and
play through the end. A screenshot/storyboard is not a video. No upload, social
post, final submission or consent is performed by this task.
