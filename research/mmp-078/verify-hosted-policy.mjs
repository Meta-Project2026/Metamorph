// No Meta credentials or requests. May run from a reviewed feature branch.
import { githubJson, META_REPOSITORY, verifyHostedMetaPolicy } from "../../packages/agent-real/src/github-meta-guard.mjs";
try {
  const branch = await githubJson(`https://api.github.com/repos/${META_REPOSITORY}/branches/main`, process.env.GH_TOKEN);
  const result = await verifyHostedMetaPolicy(branch.commit.sha);
  console.log(`HOSTED_GITHUB_TOKEN_POLICY ${result.status}; reviewers=0; branch=main; Meta_GET=0; Meta_POST=0`);
} catch {
  console.error("HOSTED_GITHUB_TOKEN_POLICY_UNVERIFIED");
  process.exitCode = 1;
}
