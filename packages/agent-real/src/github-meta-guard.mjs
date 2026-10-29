// Trusted GitHub metadata only. This module never reads a Meta credential.
export const META_REPOSITORY = "Meta-Project2026/Metamorph";
export const META_OWNERS = Object.freeze({
  barbalatv: "85129726",
  l1ncolny: "338248494",
});
export function gate(value, code) {
  if (!value) throw Object.assign(new Error(code), { code });
}
export function validateWorkflowIdentity(env, head, inputs, paid = false) {
  gate(
    env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      env.GITHUB_REPOSITORY === META_REPOSITORY &&
      env.GITHUB_REF === "refs/heads/main" &&
      /^[a-f0-9]{40}$/.test(head) &&
      head === env.GITHUB_SHA &&
      head === inputs.reviewed_sha,
    "WORKFLOW_IDENTITY_BLOCKED",
  );
  gate(Object.hasOwn(META_OWNERS, env.GITHUB_ACTOR), "ACTOR_BLOCKED");
  if (paid) {
    gate(
      env.GITHUB_ACTOR_ID === META_OWNERS[env.GITHUB_ACTOR] &&
        env.GITHUB_RUN_ATTEMPT === "1" &&
        /^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? "") &&
        env.RUNNER_ENVIRONMENT === "github-hosted" &&
        env.GITHUB_WORKFLOW_REF ===
          `${META_REPOSITORY}/.github/workflows/meta-paid-migration.yml@refs/heads/main` &&
        inputs.confirm_paid === "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP" &&
        inputs.model_provider === "meta" &&
        ["0.10", "0.20", "0.25", "0.50", "0.75", "1.00"].includes(
          inputs.max_estimated_usd,
        ),
      "PAID_CONFIRMATION_BLOCKED",
    );
  }
}
export function validateMetaEnvironment(
  { repository, branch, environment, policies },
  sha,
) {
  gate(
    repository?.full_name === META_REPOSITORY &&
      repository.default_branch === "main" &&
      repository.private === false &&
      branch?.protected === true &&
      branch.commit?.sha === sha,
    "PROTECTED_MAIN_BLOCKED",
  );
  gate(
    environment?.name === "META_API_KEY" &&
      environment.deployment_branch_policy?.custom_branch_policies === true &&
      environment.deployment_branch_policy.protected_branches === false &&
      Array.isArray(environment.protection_rules) &&
      environment.protection_rules.every((r) => r.type === "branch_policy") &&
      policies?.total_count === 1 &&
      policies.branch_policies?.length === 1 &&
      policies.branch_policies[0].name === "main" &&
      policies.branch_policies[0].type === "branch",
    "ENVIRONMENT_POLICY_BLOCKED",
  );
  return Object.freeze({
    status: "VERIFIED",
    main: sha,
    reviewers: 0,
    waitTimer: 0,
    branch: "main",
  });
}
export async function githubJson(url, token) {
  gate(
    typeof token === "string" && token.length > 0,
    "GITHUB_METADATA_UNVERIFIED",
  );
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    gate(r.status === 200, "GITHUB_METADATA_UNVERIFIED");
    const bytes = await r.arrayBuffer();
    gate(bytes.byteLength <= 256 * 1024, "GITHUB_METADATA_UNVERIFIED");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Object.assign(new Error("GITHUB_METADATA_UNVERIFIED"), {
      code: "GITHUB_METADATA_UNVERIFIED",
    });
  }
}
export async function verifyHostedMetaPolicy(
  sha,
  token = process.env.GH_TOKEN,
) {
  const base = `https://api.github.com/repos/${META_REPOSITORY}`;
  const [repository, branch, environment, policies] = await Promise.all([
    githubJson(base, token),
    githubJson(`${base}/branches/main`, token),
    githubJson(`${base}/environments/META_API_KEY`, token),
    githubJson(
      `${base}/environments/META_API_KEY/deployment-branch-policies`,
      token,
    ),
  ]);
  return validateMetaEnvironment(
    { repository, branch, environment, policies },
    sha,
  );
}
