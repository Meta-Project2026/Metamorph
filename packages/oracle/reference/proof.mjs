// Registered manual workflow entrypoint. The versioned acceptance corpus is an
// additive structural field alongside the existing allowlisted reference summary.
import { runAcceptance } from "./acceptance-proof.mjs";

await runAcceptance();
