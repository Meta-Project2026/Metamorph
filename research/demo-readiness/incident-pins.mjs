// Byte identity of the committed derived incident summary research/mmp-104/incident.json
// (format mmp104-public-incident-v1, run 41327197036, completed 2026-11-01). This is the
// allowlisted projection produced by research/mmp-104/inspect-incident.mjs, not the original
// ZIPs, raw private receipts or a new verification. Update only through a reviewed content
// change of that file, never from an upload.
function freeze(value) {
  for (const item of Object.values(value))
    if (item && typeof item === "object") freeze(item);
  return Object.freeze(value);
}
export const INCIDENT_PINS = freeze({
  runId: "41327197036",
  jobId: "124909546925",
  headSha: "d199510fd802693d4af852bd5ed8498b5461d185",
  sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
  candidateSha256:
    "1120249ee45c0aa3efe73d57d01e813d522a9c2252fcd3e2d984a4000b9d9d2d",
  sourceArchiveSha256:
    "32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4",
  contextSha256:
    "21415d8b4ea38ad0bfcab92c3632777e30e36a8e3c74b17d95ec9abef8a5c345",
  manifestSha256:
    "d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4",
  requestSha256:
    "55c7b8442814b6dfb3a273d45063553ea00e4466046945fd72fd7ea2f38d5d5d",
  artifactIds: { public: "13091408776", policy: "13091647657" },
  actor: "barbalatv",
  modelId: "muse-spark-1.3",
  estimatedCostUsd: 0.04942875,
  sourcePath: "research/mmp-104/incident.json",
  bytes: 4785,
  sha256: "93729a0e6c2339835247d226ba5067de2c02b0e9b8014a6aa092869b7025392a",
  members: [
    {
      name: "public.zip",
      bytes: 4884,
      sha256:
        "c97b875427c2acd80d921b6cfab213fb8f29d590c113dbd7f797b8c7b3c4ec3a",
    },
    {
      name: "policy.zip",
      bytes: 250,
      sha256:
        "020530465e345aa7f750d8c7657ea5fd6bd0f40835a8117354fc40351884a006",
    },
    {
      name: "generation.json",
      bytes: 2152,
      sha256:
        "9b61d8a35307a309ac2c62f7a4b1f10979c721f4492ee064c52b5a81c8befc97",
    },
    {
      name: "trial.json",
      bytes: 8493,
      sha256:
        "715e6bb68af4db48d7ca64c8a347a1dc4f188523699d1fa3c5a33ec828a5c4ff",
    },
    {
      name: "finalizer.json",
      bytes: 165,
      sha256:
        "56ca31959920fe9ff87a31b38b7d8221fd5084bd32e1321245e0ad338ed897b1",
    },
    {
      name: "preservation.json",
      bytes: 451,
      sha256:
        "c0cbf38399434ad3bd90e57ece211572a850ff5a322aaf6b01073cedef222658",
    },
    {
      name: "mmp078-41327197036-attempt.json",
      bytes: 765,
      sha256:
        "7e337639cdc19afb7cb179224a785044cfcaa5287ca0c5f050690ae80eb3c05f",
    },
    {
      name: "policy.json",
      bytes: 137,
      sha256:
        "3adfaf34b2fdcc96a5c7aaf40ec63cab5d67369ed1854c6aa068efd7e8b6bd23",
    },
  ],
});
