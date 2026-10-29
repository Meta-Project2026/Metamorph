# Owner actions after implementation

Administrative updates succeeded; **ADMIN_ACTION_NEEDED: none**. Main remains
protected with force pushes/deletion disabled/admin enforcement, no required
review subresource and no rulesets. Environment reviewers/wait are absent;
exactly branch:main remains, can_admins_bypass=false. Existing secret META was
only listed by name and never changed. No other effective writers were found.

Before inviting more organization members, change the organization default
repository permission from admin to a suitably restricted permission; it currently
grants future members an effective trusted-workflow modification route. Existing
two owners are intentionally trusted. No organization-wide setting was changed.

After independent review and green CI, either owner can merge the implementation
PR without the other account's GitHub APPROVE. The paid workflow must be present
on main before it can be dispatched. #61 remains open until genuine public model
trial evidence exists. Merging is not a paid dispatch.

Recheck published Meta rates and the exact main SHA before a paid run. At most
one bounded attempt; **$1.00 is a pre-send projection allowance, not a hard dollar
cap or settled charge. Timeout/crash/429 may have been billed. No retry/rerun.**
Two owners can independently dispatch different runs, including concurrently.
Each command below authorizes that owner's one run; do not run it for testing:

```powershell
$paidMainSha = gh api repos/Meta-Project2026/Metamorph/commits/main --jq .sha
gh workflow run meta-paid-migration.yml --repo Meta-Project2026/Metamorph --ref main -f "reviewed_sha=$paidMainSha" -f confirm_paid=I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP -f max_estimated_usd=1.00 -f model_provider=meta
```

The owner must independently inspect/review that SHA, not blindly accept a changed
main returned by the example. Use max_estimated_usd=0.25 to lower the allowance for
the current projected $0.220377 input; 0.10/0.20 intentionally block before send.
Run identity and SHA checks must pass. Only inspect the sanitized public artifact;
do not upload candidate/raw response/private runner files. An UNKNOWN/missing
receipt requires billing inspection, not rerunning the workflow.

Read-only verification (no Meta request):

```powershell
gh api repos/Meta-Project2026/Metamorph/branches/main/protection
gh api repos/Meta-Project2026/Metamorph/environments/META_API_KEY --jq '{name,can_admins_bypass,protection_rules,deployment_branch_policy}'
gh api repos/Meta-Project2026/Metamorph/environments/META_API_KEY/deployment-branch-policies
gh api repos/Meta-Project2026/Metamorph/environments/META_API_KEY/secrets --jq '.secrets | map({name})'
```

Nonbillable real-runner admission verification after merge: use the same exact
reviewed main SHA/inputs above **with `-f validate_only=true`**. This explicitly
skips the secret-mapped network step and candidate/Docker validation; it checks
real GitHub OIDC/metadata and publishes authorization.json, Meta GET/POST=0/0.
The production default is validate_only=false. A validation run issues but never
consumes the opaque capability and cannot be rerun as a paid attempt (reruns block).
