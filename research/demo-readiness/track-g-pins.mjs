// Frozen PUBLIC metadata identities, not a new execution or admission.
function freeze(v) {
  for (const item of Object.values(v))
    if (item && typeof item === "object") freeze(item);
  return Object.freeze(v);
}
export const TRACK_G_PINS = freeze({
  filename: "mmp194-track-g-v1.json",
  directory: "evidence/real-ai-41856569137",
  bytes: 14601,
  sha256: "91631e07609bf344b3919eff61fc385a011e5c1a80e504ce1e548d1ed5dd83f5",
  provenance: {
    runId: "41856569137",
    runAttempt: 1,
    runStartedAt: "2026-11-04T15:19:45Z",
    workflowConclusion: "success",
    headSha: "95397bbff94f3e0121ebdc9fa375880762bcbac7",
    runnerLabels: ["ubuntu-24.04"],
    jobs: [
      {
        id: 126666718226,
        name: "guard",
        head_sha: "95397bbff94f3e0121ebdc9fa375880762bcbac7",
        status: "completed",
        conclusion: "success",
        labels: ["ubuntu-24.04"],
        html_url:
          "https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137/job/126666718226",
      },
      {
        id: 126666812872,
        name: "generate-and-verify",
        head_sha: "95397bbff94f3e0121ebdc9fa375880762bcbac7",
        status: "completed",
        conclusion: "success",
        labels: ["ubuntu-24.04"],
        html_url:
          "https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137/job/126666812872",
      },
    ],
    sourceRepository: "tanjilaafsarirubina/car-workshop",
    sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
    sourceArchiveSha256:
      "32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4",
    contextSha256:
      "9935a8e71ee05267fc60c2b0aa03a9174c0cb50b7f9e5c2f58ad3f6f83824065",
    manifestSha256:
      "d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4",
    workflowSha256:
      "346622c15a4cd3cf9169419e5658f01997c357ab2e872d636a8131854de399f7",
    artifactId: "13338052015",
    artifactName: "meta-paid-public-41856569137",
    sourceUri:
      "https://api.github.com/repos/Meta-Project2026/Metamorph/actions/artifacts/13338052015/zip",
    runUri:
      "https://github.com/Meta-Project2026/Metamorph/actions/runs/41856569137",
    zipBytes: 14807,
    zipSha256:
      "38fd34d24eca33630c79c9f4120194f623d7cfec4be5826355150a31089e4b1e",
    apiSnapshotSha256:
      "ed5aec56299cbc1052b6c78aee9f3435d9803cddf98d76ecdbeb17c14ebc5be4",
    members: [
      {
        name: "meta-paid-public/generation.json",
        bytes: 2527,
        sha256:
          "8682c1122e2cff974ac87781fe4418f9178860bb84cca22d2929a7225548009c",
      },
      {
        name: "meta-paid-public/preflight.json",
        bytes: 2466,
        sha256:
          "c5706b3979496cd4755d32df842ad97e54fed19a9c5ae0e34b9e2de270a8ff4d",
      },
      {
        name: "meta-paid-public/scorecard.json",
        bytes: 2496,
        sha256:
          "f37af813e291816c6a1d0e1031af507399bc45d05ac1ab1997764e26b0e46cab",
      },
      {
        name: "meta-paid-public/send-receipts/1.json",
        bytes: 2303,
        sha256:
          "6217b14e3c077f36cbee95839a7777e454c8c3eb25052d2cf4d2976dd2ffc76f",
      },
      {
        name: "meta-paid-public/send-receipts/2.json",
        bytes: 2527,
        sha256:
          "8682c1122e2cff974ac87781fe4418f9178860bb84cca22d2929a7225548009c",
      },
      {
        name: "meta-paid-public/trial.json",
        bytes: 21658,
        sha256:
          "3ce6ed090e1566c8bf3cb865f6f8b02049e5988b14888bdd9019bcd8673e7d81",
      },
      {
        name: "meta-paid-public/finalizer.json",
        bytes: 165,
        sha256:
          "07a08ac68ae4d18421b8ad3345d1147b478226763b5f8abcae4c3ec5a508c2d9",
      },
      {
        name: "meta-paid-public/preservation.json",
        bytes: 1020,
        sha256:
          "568e3477f313f8162d3bdca12ee165e0f0e026cd9d1be123fa9ede31bf4154fe",
      },
      {
        name: "meta-paid-public/custody-capture.json",
        bytes: 655,
        sha256:
          "f9bdd2d39e0afbb1be29c0a80ccd3f774f524403a2881282f864cb30de27f0fe",
      },
      {
        name: "meta-paid-public/custody-finalizer.json",
        bytes: 406,
        sha256:
          "e2360dc830889595a85543c14a2a2cc26c4d0497e897c5017f479de1dad12bba",
      },
      {
        name: "meta-paid-public/custody-checkpoint.json",
        bytes: 663,
        sha256:
          "8b524a8c7dbd52d74bc9c5bbe62c8ff9fabed7eca000ef34a0412c7f17e07062",
      },
      {
        name: "meta-paid-public/custody-stored.json",
        bytes: 660,
        sha256:
          "6909b3f5d66462b29ec4b383722468d36eb1da2488e86b4150096e13a1f4d660",
      },
      {
        name: "mmp078-41856569137-attempt.json",
        bytes: 1085,
        sha256:
          "7ab28c94664cd0c9a50a6ec15dbc9d00dcd1b2b826cba1c88d3884d459369a52",
      },
    ],
  },
  candidateSha256:
    "4207053ada23f8e94ecf6301452ee4ea8228a3717c0a478d3e550443cec130e6",
  oracleAttemptId: "ab94164e-5d98-4b5f-b28d-290055364999",
  generation: {
    status: "PASS",
    generationKind: "REAL_INFERENCE",
    provider: "meta-model-api",
    modelId: "muse-spark-1.3",
    modelVersion: null,
    inputSha256:
      "01cb64b4aef8206f7e7299dec4487cab6638718fb771f3e1a7c1d8fd5593121a",
    responseSha256:
      "9eebdcdfe36a389259e487c500a79bf64ae82f061af06c93a713eccabec306c4",
    attemptedRequests: 1,
    confirmedResponseCount: 1,
    httpStatus: 200,
    networkSend: "RESPONSE_RECEIVED",
    tlsPeerVerified: true,
    inputTokens: 6571,
    outputTokens: 11170,
    cachedInputTokens: 0,
    estimatedCostUsd: 0.05568625,
    chargedCostUsd: null,
    usageStatus: "ESTIMATE_ONLY",
  },
  syntheticG0: {
    basis: "OWNER_RECORDED_PUBLIC_SYNTHETIC_SUMMARY",
    sourcePath: "research/mmp-183/linux-docker-result.json",
    sourceSha256:
      "d4d56c7735805987e7b8688005db152d36902f2a7f57f44179429a4e45bd147d",
    sourceCommit: "14a54665a94394ca9fdb68a7c27f0c596428cbea",
    controls: 11,
    qualifiedPositive: 1,
    candidateSha256:
      "67dbb4b31a245ac304ebe7722aa7bfc13d6263001b3eea7e850e92e4edad1af0",
    verdict: "PASS",
    independentEngineAttestation: "NOT_ESTABLISHED",
    earlierAttemptVerdicts: ["ERROR", "ERROR"],
    faultControls: "NOT_RUN",
  },
  pairIds: [
    "1a522c38-e81b-479d-b246-b9d1c811c453",
    "7915c849-7db1-4aad-8dd5-6040a07d7ebf",
    "9c13b902-1f1e-49fe-9a8b-2ae7ad6ab921",
  ],
});
