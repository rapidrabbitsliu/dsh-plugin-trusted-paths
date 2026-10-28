# Changelog

## 0.2.0

- Use one directory list with radio selection for exactly one primary. Switching primary retains the former primary as a reference; removing the current primary is blocked until another primary is selected.
- Reuse the core `directoryBrowser` Client Service for adding directories, with render props `open`, `busy`, `initialPath?`, `title?`, `confirmLabel?`, `onPicked`, and `onCancel`. The module dependency is now only `react`, not UI primitives.
- Add Host Home and real Windows Host locations from `GetLogicalDrives`, without probing 26 drive letters.
- Ship the complete 47-file companion core patch (existing 37 + picker 10) on the unchanged upstream baseline `1f81c047fc48fa190a683e469daa699857e9afe8`, plus `patches/harness-trusted-paths-0.1.1-to-0.2.0.patch` for already-patched v0.1.1 checkouts. Do not reapply the complete patch over the old patch.
- Document incremental `--check`/apply, stopping tasks and backing up, rebuilding Host/Client/Web, restarting the original service and refreshing its page in [INSTALL-CORE.md](./INSTALL-CORE.md).
- Validate 25 plugin tests (16 UI, 9 Host), 111 core picker tests and successful Host/Client/Web builds. The user confirmed all three UI changes in actual use. These are targeted results, not a full-suite pass; the earlier 634 passed / 1 skipped / 1 Windows symlink EPERM failure remains historical.
- Retain Windows-only full lifecycle support and conservative locks for pending/crashed/abandoned leases; no automatic crash recovery or relaxation of sandbox boundaries.

## 0.1.1

- Ship the complete companion Harness core patch (37 source/test files) in the repository, npm package and GitHub Release.
- Pin upstream baseline to `1f81c047fc48fa190a683e469daa699857e9afe8` and provide SHA-256, patched Git tree and affected file inventory.
- Add step-by-step checkout, apply, build, startup, plugin installation, verification and rollback instructions in `INSTALL-CORE.md`.
- Verify the patch applies against clean baseline blobs without changing the running core checkout's index.
- Complete the new Workspace Remote method in its Client test fake; targeted 21 tests pass.
- Explicitly document Windows-only full lifecycle support and conservative manual lease recovery limitations.
- Plugin runtime behavior is unchanged from 0.1.0. The companion core is not automatically applied by npm installation.

## 0.1.0

- Initial trusted folders plugin, workspace menu/dialog and directory browser.
- Required external custom core interfaces; initial package did not include the core patch.
