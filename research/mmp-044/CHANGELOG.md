# MMP-044 driver changes

- Added an isolated public host driver, original comparator/mapper integration,
  fixed schedule coverage checks, real controls and exact-job cleanup finalizer.
- Added explicit host-driver fault, CLI loading and public projection tests.
- Corrected job-level runner path expressions, preserved primary errors across
  cleanup, and made the verified public archive readable by sandbox uid 65534
  under the host's 077 umask. Failed executions remain separately recorded.
- Added optional bounded public projections and in-container language diagnostics;
  no frozen application, corpus, policy, worker, trusted API or comparator changed.
