import { createHash, createPublicKey } from "node:crypto";

export class RegistryError extends Error {}

export function requireThat(condition, code) {
  if (!condition) throw new RegistryError(code);
}

export function object(value, keys, code = "INVALID_OBJECT") {
  requireThat(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"),
    code,
  );
}

export function array(value, maximum, minimum = 1) {
  requireThat(
    Array.isArray(value) && value.length >= minimum && value.length <= maximum,
    "INVALID_ARRAY",
  );
}

export function unique(values, code = "DUPLICATE") {
  requireThat(new Set(values).size === values.length, code);
}

export function id(value) {
  requireThat(
    typeof value === "string" &&
      /^synthetic-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
      value.length <= 80,
    "SYNTHETIC_IDENTIFIER_REQUIRED",
  );
}

export function digest(value, size = 64) {
  requireThat(
    typeof value === "string" && new RegExp(`^[a-f0-9]{${size}}$`).test(value),
    "INVALID_DIGEST",
  );
}

export function integer(value, min, max) {
  requireThat(
    Number.isSafeInteger(value) && value >= min && value <= max,
    "INVALID_INTEGER",
  );
}

export function canonical(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    requireThat(Number.isSafeInteger(value), "INVALID_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  requireThat(
    value !== null &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype,
    "INVALID_CANONICAL_VALUE",
  );
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(",")}}`;
}

export function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// A random 256-bit opening prevents guessing small synthetic catalogs from the
// public commitment. The opening and indexed bytes remain in the private journal.
export function commitment(domain, opening, value) {
  digest(opening);
  const bytes = Buffer.from(canonical(value), "utf8");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return hash(
    Buffer.concat([
      Buffer.from(`${domain}\0`, "utf8"),
      Buffer.from(opening, "hex"),
      length,
      bytes,
    ]),
  );
}

export function validateTrust(trust) {
  object(trust, [
    "principals",
    "owners",
    "author",
    "custodian",
    "reviewer",
    "witness",
    "storageAdmins",
    "recoveryDelegates",
  ]);
  object(trust.principals, Object.keys(trust.principals));
  const ids = Object.keys(trust.principals);
  array(ids, 20, 4);
  for (const principal of ids) id(principal);
  array(trust.owners, 2, 2);
  array(trust.storageAdmins, 8);
  array(trust.recoveryDelegates, 8);
  unique(trust.owners);
  unique(trust.storageAdmins);
  unique(trust.recoveryDelegates);
  for (const principal of [
    ...trust.owners,
    trust.author,
    trust.custodian,
    trust.reviewer,
    trust.witness,
    ...trust.storageAdmins,
    ...trust.recoveryDelegates,
  ]) {
    id(principal);
    requireThat(ids.includes(principal), "UNKNOWN_PRINCIPAL");
  }
  requireThat(trust.author !== trust.custodian, "AUTHOR_CUSTODIAN_CONFLICT");
  requireThat(
    trust.witness !== trust.custodian && trust.witness !== trust.author,
    "WITNESS_CONFLICT",
  );
  requireThat(
    !trust.storageAdmins.includes(trust.author) &&
      !trust.recoveryDelegates.includes(trust.author),
    "AUTHOR_PRIVILEGE_CONFLICT",
  );
  const fingerprints = [];
  for (const principal of ids) {
    let key;
    try {
      requireThat(
        typeof trust.principals[principal] === "string" &&
          trust.principals[principal].length <= 512,
        "INVALID_KEY",
      );
      key = createPublicKey(trust.principals[principal]);
    } catch {
      throw new RegistryError("INVALID_KEY");
    }
    requireThat(key.asymmetricKeyType === "ed25519", "INVALID_KEY");
    fingerprints.push(hash(key.export({ type: "spki", format: "der" })));
  }
  unique(fingerprints, "SHARED_KEY");
}

export function validateRegistration(reg, trust) {
  object(reg, [
    "format",
    "benchmarkId",
    "version",
    "epochId",
    "registrationId",
    "runId",
    "custodyScopeId",
    "source",
    "scope",
    "custody",
    "pool",
    "policy",
    "budgets",
  ]);
  requireThat(
    reg.format === "mmp-056-synthetic-registration-v1",
    "SYNTHETIC_ONLY",
  );
  for (const key of [
    "benchmarkId",
    "version",
    "epochId",
    "registrationId",
    "runId",
    "custodyScopeId",
  ])
    id(reg[key]);
  object(reg.source, [
    "kind",
    "repository",
    "commit",
    "license",
    "noticeSha256",
  ]);
  requireThat(reg.source.kind === "SYNTHETIC_PUBLIC_FIXTURE", "SYNTHETIC_ONLY");
  requireThat(
    /^https:\/\/example\.invalid\/synthetic-[a-z0-9-]+$/.test(
      reg.source.repository,
    ),
    "SYNTHETIC_SOURCE_REQUIRED",
  );
  digest(reg.source.commit, 40);
  requireThat(
    ["MIT", "Apache-2.0", "CC0-1.0"].includes(reg.source.license),
    "LICENSE_NOT_ADMITTED",
  );
  digest(reg.source.noticeSha256);
  object(reg.scope, [
    "routes",
    "units",
    "unitRoutes",
    "unsupported",
    "comparator",
    "runtime",
    "gates",
  ]);
  for (const key of ["routes", "units", "unsupported"]) {
    array(reg.scope[key], 64);
    reg.scope[key].forEach(id);
    unique(reg.scope[key]);
  }
  array(reg.scope.unitRoutes, 128);
  const pairs = reg.scope.unitRoutes.map((row) => {
    object(row, ["unit", "route"]);
    id(row.unit);
    id(row.route);
    requireThat(
      reg.scope.units.includes(row.unit) &&
        reg.scope.routes.includes(row.route),
      "SCOPE_DRIFT",
    );
    return `${row.unit}/${row.route}`;
  });
  unique(pairs);
  requireThat(
    reg.scope.units.every((unit) =>
      reg.scope.unitRoutes.some((row) => row.unit === unit),
    ),
    "UNIT_OMITTED",
  );
  requireThat(
    reg.scope.routes.every((route) =>
      reg.scope.unitRoutes.some((row) => row.route === route),
    ),
    "ROUTE_OMITTED",
  );
  for (const key of ["comparator", "runtime"]) {
    object(reg.scope[key], ["id", "sha256"]);
    id(reg.scope[key].id);
    digest(reg.scope[key].sha256);
  }
  object(reg.scope.gates, ["G0", "G1", "G2", "G3", "G4"]);
  requireThat(
    Object.values(reg.scope.gates).every((value) => value === true),
    "MANDATORY_GATE_REQUIRED",
  );

  object(reg.custody, ["profile", "sharedRoot", "exposures", "adminDomains"]);
  requireThat(
    ["LIMITED_TWO_PERSON", "INDEPENDENT_CUSTODIAN"].includes(
      reg.custody.profile,
    ),
    "PROFILE_REQUIRED",
  );
  requireThat(reg.custody.sharedRoot === false, "SHARED_ROOT");
  if (reg.custody.profile === "INDEPENDENT_CUSTODIAN") {
    requireThat(
      trust.reviewer !== trust.author &&
        trust.reviewer !== trust.custodian &&
        !trust.owners.includes(trust.custodian) &&
        !trust.owners.includes(trust.reviewer),
      "INDEPENDENCE_CONFLICT",
    );
  }
  array(reg.custody.exposures, 20, Object.keys(trust.principals).length);
  unique(reg.custody.exposures.map((entry) => entry.principal));
  for (const entry of reg.custody.exposures) {
    object(entry, [
      "principal",
      "cases",
      "answers",
      "entropy",
      "rawDifferences",
    ]);
    requireThat(
      Object.hasOwn(trust.principals, entry.principal),
      "UNKNOWN_PRINCIPAL",
    );
    requireThat(
      [entry.cases, entry.answers, entry.entropy, entry.rawDifferences].every(
        (x) => typeof x === "boolean",
      ),
      "EXPOSURE_UNKNOWN",
    );
    if (entry.principal === trust.author) {
      requireThat(
        !entry.cases &&
          !entry.answers &&
          !entry.entropy &&
          !entry.rawDifferences,
        "AUTHOR_EXPOSED",
      );
    }
  }
  requireThat(
    Object.keys(trust.principals).every((principal) =>
      reg.custody.exposures.some((entry) => entry.principal === principal),
    ),
    "EXPOSURE_MISSING",
  );
  array(reg.custody.adminDomains, 20, 2);
  for (const domain of reg.custody.adminDomains) {
    object(domain, ["id", "principals"]);
    id(domain.id);
    array(domain.principals, 20);
    unique(domain.principals);
    for (const principal of domain.principals) {
      requireThat(
        Object.hasOwn(trust.principals, principal),
        "UNKNOWN_PRINCIPAL",
      );
    }
    requireThat(domain.principals.length === 1, "SHARED_ADMIN");
    if (domain.principals.includes(trust.author)) {
      requireThat(
        !domain.principals.some((p) =>
          [
            trust.custodian,
            ...trust.storageAdmins,
            ...trust.recoveryDelegates,
            trust.witness,
          ].includes(p),
        ),
        "SHARED_ADMIN",
      );
    }
  }
  unique(reg.custody.adminDomains.map((domain) => domain.id));
  requireThat(
    Object.keys(trust.principals).every((principal) =>
      reg.custody.adminDomains.some((domain) =>
        domain.principals.includes(principal),
      ),
    ),
    "ADMIN_HISTORY_MISSING",
  );

  array(reg.pool, 256);
  unique(reg.pool.map((entry) => entry.id));
  for (const entry of reg.pool) {
    object(entry, ["id", "stratum", "unit", "route", "fixtureSha256"]);
    for (const key of ["id", "stratum", "unit", "route"]) id(entry[key]);
    digest(entry.fixtureSha256);
    requireThat(
      entry.fixtureSha256 === hash(Buffer.from(entry.id, "utf8")),
      "SYNTHETIC_FIXTURE_MISMATCH",
    );
    requireThat(
      pairs.includes(`${entry.unit}/${entry.route}`),
      "POOL_SCOPE_DRIFT",
    );
  }
  object(reg.policy, [
    "algorithm",
    "strata",
    "mandatoryCaseIds",
    "maxAttempts",
    "retryOn",
  ]);
  requireThat(
    reg.policy.algorithm === "stratified-fisher-yates-v1",
    "SAMPLER_NOT_ADMITTED",
  );
  array(reg.policy.strata, 64);
  unique(reg.policy.strata.map((entry) => entry.id));
  for (const stratum of reg.policy.strata) {
    object(stratum, ["id", "count"]);
    id(stratum.id);
    integer(stratum.count, 1, 256);
    requireThat(
      reg.pool.filter((entry) => entry.stratum === stratum.id).length >=
        stratum.count,
      "STRATUM_UNDERCOVERED",
    );
  }
  requireThat(
    reg.pool.every((entry) =>
      reg.policy.strata.some((row) => row.id === entry.stratum),
    ),
    "UNKNOWN_STRATUM",
  );
  array(reg.policy.mandatoryCaseIds, 256);
  unique(reg.policy.mandatoryCaseIds);
  for (const caseId of reg.policy.mandatoryCaseIds) {
    id(caseId);
    requireThat(
      reg.pool.some((entry) => entry.id === caseId),
      "MANDATORY_CASE_MISSING",
    );
  }
  for (const stratum of reg.policy.strata) {
    requireThat(
      reg.pool.filter(
        (entry) =>
          entry.stratum === stratum.id &&
          reg.policy.mandatoryCaseIds.includes(entry.id),
      ).length <= stratum.count,
      "MANDATORY_OVERFLOW",
    );
  }
  requireThat(
    pairs.every((pair) =>
      reg.pool.some(
        (entry) =>
          `${entry.unit}/${entry.route}` === pair &&
          reg.policy.mandatoryCaseIds.includes(entry.id),
      ),
    ),
    "MANDATORY_COVERAGE_MISSING",
  );
  integer(reg.policy.maxAttempts, 1, 2);
  array(reg.policy.retryOn, 2, 0);
  unique(reg.policy.retryOn);
  requireThat(
    reg.policy.retryOn.every((value) =>
      ["ENVIRONMENT_ERROR", "HARNESS_ERROR"].includes(value),
    ),
    "RETRY_CLASS_INVALID",
  );
  requireThat(
    reg.policy.maxAttempts === 2 || reg.policy.retryOn.length === 0,
    "RETRY_NOT_PREDECLARED",
  );
  object(reg.budgets, ["wallMs", "memoryMiB", "pids", "maxLogBytes"]);
  integer(reg.budgets.wallMs, 1, 3600000);
  integer(reg.budgets.memoryMiB, 1, 16384);
  integer(reg.budgets.pids, 1, 4096);
  integer(reg.budgets.maxLogBytes, 1, 1048576);
}

export function validateFreeze(value, registration) {
  object(value, [
    "registrationId",
    "epochId",
    "candidateGitSha",
    "candidateBundleSha256",
    "workspaceManifestSha256",
    "buildSha256",
    "runtimeSha256",
    "g0ReceiptSha256",
    "g1ReceiptSha256",
    "evaluatorSha256",
  ]);
  requireThat(
    value.registrationId === registration.registrationId &&
      value.epochId === registration.epochId,
    "REGISTRATION_MISMATCH",
  );
  digest(value.candidateGitSha, 40);
  for (const key of [
    "candidateBundleSha256",
    "workspaceManifestSha256",
    "buildSha256",
    "runtimeSha256",
    "g0ReceiptSha256",
    "g1ReceiptSha256",
    "evaluatorSha256",
  ])
    digest(value[key]);
  requireThat(
    value.runtimeSha256 === registration.scope.runtime.sha256,
    "RUNTIME_DRIFT",
  );
}
