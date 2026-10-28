import {
  liveProbeStatus,
  metaFailureReceipt,
  preflightMetaModels,
} from "./meta-model-api.js";

try {
  const command = process.argv[2];
  if (command === "preflight") {
    const report = await preflightMetaModels({
      accountAlias: process.argv[3] ?? "owner-a",
    });
    console.log(JSON.stringify(report));
    if (report.status !== "READ_ONLY_VERIFIED") process.exitCode = 2;
  } else if (command === "probe") {
    console.log(
      JSON.stringify(liveProbeStatus(process.env.MMP037_STAGE_B_AUTHORIZATION)),
    );
    process.exitCode = 2;
  } else {
    console.log(
      JSON.stringify({
        mode: "BLOCKED",
        code: "CONFIG_DENIED",
        generatedRequests: 0,
      }),
    );
    process.exitCode = 2;
  }
} catch (error) {
  console.log(JSON.stringify(metaFailureReceipt(error)));
  process.exitCode = 2;
}
