// Original Actions ZIP and member identities independently checked on 2026-10-29.
// Separate trust policy: never replace the five historical MMP-071 pins.
function freeze(value) {
  for (const item of Object.values(value))
    if (item && typeof item === "object") freeze(item);
  return Object.freeze(value);
}
export const REAL_AI_PINS = freeze({
  runId: "40900698372",
  headSha: "d21376747c7147043ca618e149fac87c0df80111",
  sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
  candidateSha:
    "afd9f726bcbc2a9dfc2f67128871db307fbd00f2ba4febdc41b5633da98dad8f",
  contextSha256:
    "b15d9d33d0f1f671ad383759c37cb8e02e007cf1beca7ec7c78267073f54cd1c",
  manifestSha256:
    "d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4",
  sourceArchiveSha256:
    "32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4",
  artifactId: "12909716502",
  artifactName: "meta-paid-public-40900698372",
  zipSha256: "95121c3291e4478d682dfd3375de86e2df4036f46bcdc81826ee6fdc5fb2a493",
  directory: "evidence/real-ai-40900698372",
  files: {
    "generation.json": {
      bytes: 2146,
      sha256:
        "b0dbc3909d2aa258dc81a61f8b65b1091f61a5c3005aa711527beb56e476b086",
      member: "meta-paid-public/generation.json",
    },
    "trial.json": {
      bytes: 6359,
      sha256:
        "3523b12101e851ec60ba5b3906ce8ecc9274cd4249271b90042f49ad30e108b3",
      member: "meta-paid-public/trial.json",
    },
    "finalizer.json": {
      bytes: 165,
      sha256:
        "377255db8805443e7f85a53afded058a4bdb391a49ad65f8e595b65fb53a7678",
      member: "meta-paid-public/finalizer.json",
    },
    "mmp078-40900698372-attempt.json": {
      bytes: 765,
      sha256:
        "17ad1b63b6b980d60b15fcca7015692c177ec16f7dcd9dbbccc9adb825896b5a",
      member: "mmp078-40900698372-attempt.json",
    },
  },
});
