// Shape only, never provenance or paid authority. Separate from parity CODES.
export function compilerFeedback(value) {
  const fail = () => {
    throw Object.assign(new Error("REPAIR_FEEDBACK"), {
      code: "REPAIR_FEEDBACK",
    });
  };
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !==
      "bindingDigest,code,column,format,line,path" ||
    value.format !== "mmp160-g1-feedback-v1" ||
    !["TS2339", "TS2769"].includes(value.code) ||
    typeof value.path !== "string" ||
    value.path.length > 240 ||
    !/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(value.path) ||
    /gh[pousr]_|github_pat_|eyJ[A-Za-z0-9_-]{8}|(?:^|[/_-])(?:secret|token|password|credential|jwt|oidc)(?:[/_.-]|$)/i.test(
      value.path,
    ) ||
    !Number.isSafeInteger(value.line) ||
    value.line < 1 ||
    !Number.isSafeInteger(value.column) ||
    value.column < 1 ||
    typeof value.bindingDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.bindingDigest)
  )
    fail();
  return Object.freeze(
    Object.fromEntries(
      ["format", "code", "path", "line", "column", "bindingDigest"].map((k) => [
        k,
        value[k],
      ]),
    ),
  );
}
