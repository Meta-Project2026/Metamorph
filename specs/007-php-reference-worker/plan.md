# Implementation plan

1. Keep the existing Oracle API and comparator unchanged. Add reference modules
   and exports only. Bind reset order to a trusted immutable public manifest.
2. Pull a digest-pinned base, build the original trusted runtime before admitting
   source; download bounded SHA-pinned archive and verify archive/license.
3. App: UID 65534, root read-only, network none, capabilities dropped, no-new-
   privileges, CPU/RAM/PID/tmpfs/wall deadlines. Bind only public verified archive.
   Bootstrap genuine upstream API; execute requests through trusted loopback client.
4. Use a unique Docker-managed 8MiB local tmpfs DB volume per reset. Pause app,
   mount DB read-only into a separate inspector and copy it into inspector tmpfs;
   unpause in finally. Reject symlinks/unexpected state files. Bind inspector code
   only there. Never parse third-party DB or extract its tar on host. Verify that
   containers AND the DB volume have been removed on cleanup. Docker cp from
   tmpfs is unsupported; that attempted transport was removed after a real failure.
5. Inspector runs a consistent query-only SQLite transaction, returns hashed
   legacy bytes plus runtime/clock checks. Strict mapper produces canonical existing
   sqlite-logical-v1; no comparator normalization changes.
6. Host evidence store uses private POSIX directories, exclusive no-follow files,
   fsync + atomic rename, unique IDs, size limits, an independently supplied index
   hash and verification after container teardown. Windows ACL support is deferred
   and fails closed. No application/inspector evidence mount.
7. Test negative controls locally and on Linux; manually dispatch existing Oracle
   workflow on feature SHA for Docker proof. Upload only reference-public summary.
   Preserve all 65 original tests and ordinary Fast CI scope.

External retention is an explicit missing deployment input. The implementation
retains local raw evidence beyond worker teardown, but ephemeral Actions runner
storage is destroyed at job teardown. No encryption/recipient or upload is invented.
