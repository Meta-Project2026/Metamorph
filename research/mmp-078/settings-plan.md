# MMP-078 settings change and rollback

Original main: `0b90ecb353cfabed6465760d311991ef7cd8dab6` (PR70/77 merged).
The adjacent `*-before.json` files are original GitHub metadata, not secret values.

Before: main protected, one required approval, admin enforcement enabled,
force pushes/deletion disabled; no required status checks configured. No rulesets
or team grants. Effective collaborators and organization members are exactly
barbalatv/l1ncolny, both admin. Organization default repository permission is
**admin**: any future member would inherit admin; owners must restrict that
organization default before inviting anyone else. This task does not change
organization-wide permissions. Public read/fork access does not grant writes.

After: DELETE only main/protection/required_pull_request_reviews; retain every
other protection field, including existing absence of required checks. CI must
still pass before owner merge. PUT only the named environment with reviewers=[],
wait_timer=0, can_admins_bypass=false, custom branch policies=true. Preserve its
existing single deployment rule branch:main and secret META unchanged. No secret
value retrieval, secret API mutation, branch-protection deletion, or full branch
protection PUT. Re-read and compare immediately before mutation; abort on drift.

Rollback: POST/PATCH the review subresource with dismiss_stale_reviews=true,
require_code_owner_reviews=false, require_last_push_approval=false,
required_approving_review_count=1. PUT the environment with reviewers User IDs
85129726/338248494, prevent_self_review=true, wait_timer=0,
can_admins_bypass=false and the original deployment_branch_policy. Keep the
existing deployment rule and secret untouched. Review rollback bodies against
the original metadata before executing; rollback is not run automatically.

No-review means either trusted admin can modify the workflow and access the
environment through main. This is the explicitly selected trust boundary, not
cryptographic protection from those admins. Public forks/PR heads receive no key
in the new workflow; it is dispatch-only and enforces signed owner/main identity.
