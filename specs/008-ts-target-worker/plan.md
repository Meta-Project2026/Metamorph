# Implementation plan

1. Snapshot allowlisted source bytes in a trusted, exclusively owned staging
   directory. Reject links/reparse aliases, hardlinks, path traversal, manifests,
   scripts, protected names, wrong hashes and excessive size/count.
2. Prepare trusted Node 24.11.0 / TypeScript 5.9.3 image before admission. Pin
   base digest, npm integrity lock and libfaketime package. Retain dependency
   notices. Build input contains TS only; trusted recipes are immutable image files.
3. Compile twice (noEmit typecheck, emitted build) in isolated container. Bind
   artifact bytes to hashes. Only Docker CLI runs on the host.
4. Launch emitted JS in a separate offline nonroot container. Node permissions
   permit only emitted source read and candidate DB state read/write; deny child
   processes, native addons and worker creation by default. Use monotonic host
   deadlines and kill/reap the entire container.
5. Inspect HTTP in a separate container joined solely to candidate loopback;
   inspect the fixed DB path in another offline container with readonly volume.
   Inspector never imports candidate code or shares its PID namespace.
6. Execute positive and deliberately negative public controls; collect real exit
   codes, raw HTTP/DB, image IDs, hashes, timings and cleanup. Measure clocks
   without business-field patches or Oracle normalization changes.
7. Run root fast checks and owner tests, publish PR unmerged. Bootstrap runtime
   validation via temporary exact-branch PR trigger, remove it, then rerun the
   bootstrap definition checking out the final source branch. Evidence records
   actual checked-out SHA, separately from the triggering workflow SHA.

Docker is unavailable locally; GitHub-hosted Ubuntu x86_64 Docker is the
authorized runtime. No installation of Docker/WSL or host clock changes.
