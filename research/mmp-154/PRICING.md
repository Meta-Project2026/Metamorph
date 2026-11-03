# Meta Standard snapshot verified 2026-11-03

Read the current authoritative pages on 2026-11-03 before implementing this
snapshot. `muse-spark-1.3` Standard costs USD 1.25 per million input tokens,
0.15 cached input and 4.25 output. Standard content is not used for training.
Contributor is a separate model variant and is not enabled.
Source: https://dev.meta.ai/docs/pricing-rate-limits

Model API is token-based pay-as-you-go. Charges accrue with usage and can be
collected at a payment threshold or monthly. Account credit/prepayment terms,
available credit, balance and generation entitlement have NOT been verified.
The owner's reported 1,000 executions is not a technically verified call quota.
Source: https://dev.meta.ai/help/billing/api-bill

Spend alerts do not enforce a hard cap. The account remains responsible for
usage beyond an alert. The local projection is an engineering estimate only;
neither it nor the new snapshot guarantees provider settlement or a USD cap.
Source: https://dev.meta.ai/help/billing/spend-limit-alert

Retain Chat Completions for the first source-backed probe. Official protocol
guidance supports keeping the format the integration already speaks. Responses
reasoning continuity is optional subsequent work after a working baseline.
Source: https://dev.meta.ai/docs/protocols

`meta-standard-2026-11-03` replaces the October 29 snapshot for NEW runs only.
Historical receipts remain unchanged. November 10 00:00 UTC is this project's
seven-day review deadline, not a Meta price guarantee or a provider-announced
expiry. The adapter refuses at the deadline; another refresh requires checking
the authoritative documentation and reviewing a new version. Freshness before
dispatch is an operator prerequisite even inside this interval.
