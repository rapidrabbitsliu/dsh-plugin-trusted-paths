# Required Harness integration

This release requires a custom DeepSeek Harness runtime. It does not patch the runtime during installation. A stock runtime with the same version string is not necessarily compatible. No official minimum compatible release is known.

**Platform support:** the supplied runtime patch currently implements the full revoke/reconcile lifecycle on Windows only. Linux/macOS implementations explicitly reject nonempty extra-root lifecycle operations. This release is not a complete cross-platform solution. Pending reservations, crashed runners and abandoned lock directories do not automatically expire; manual recovery requires proof that related token processes have terminated.

Required contracts:

1. Host `sandboxPolicy.registerWritableRoots(provider)` returning an effect disposer. Additional roots must only extend `workspace-write`, never `read-only`.
2. Host sandbox `reconcileWritableRoots(workspaceRoot, roots)` and `revokeWritableRoots(workspaceRoot, roots)`, plus confined filesystem and subprocess enforcement of the same additional roots.
3. Windows ephemeral per-invocation extra-root SIDs, durable pending/running leases, tombstoned revocation, process/job exit before ACL cleanup, protected control records, and fail-closed path canonicalization.
4. Host `settings.configure({ restart: true, auto: false })` exposing ordinary Config through Settings and awaiting async unload/remount/rollback when saving. Volatile-only settings are not sufficient.
5. Workspace `setDefaultDirectory(path)`, `defaultDirectory`, `sessionDirectoryPaths`, stable `path`, and `sessionIds`. New sessions must use the default directory; old sessions retain immutable cwd and membership. Directory mutation/create/delete must be serialized and collisions with other workspace histories rejected.
6. Client list/root slot `sidebar.workspaces.workspace.menu.item`, before Rename, owner `{ workspaceId, path, displayTitle }` and `useMenuOpenState()`.
7. Client services `configForms` (describe/get), `locale`, `slots`, and the core `directoryBrowser` Service. Its render props are `open`, `busy`, `initialPath?`, `title?`, `confirmLabel?`, `onPicked`, and `onCancel`. The plugin reuses this picker when adding a directory rather than implementing its own browser. `shell.overlay` hosts the dialog. The module table needs `react` only; UI primitives are no longer required.
8. The core picker supports Host Home and location selection backed by the real Windows Host `GetLogicalDrives`, not probing all 26 drive letters. Directory browsing is on the Host, not the browser machine.

The v0.2.0 UI uses one directory list and radio selection for exactly one primary. Changing the primary retains the former primary as a reference; the current primary cannot be removed until another directory is made primary.

The package checks missing sandbox methods and refuses activation rather than disabling the sandbox. Some contracts (for example menu placement and Settings restart semantics) cannot be verified merely by comparing method existence; the runtime integrator must verify them.

## Core source locations to integrate

- `packages/sandbox/{sandbox,sandbox-policy,sandbox-local,sandbox-windows-acl}`
- `packages/fs/{fs-sandbox,fs-local}`
- `packages/workspace/workspace`
- `packages/api/{session-controller,workspace-controller}`
- `packages/settings/settings`
- `packages/client/ui-workspace` and the core directory picker / Host location integration

The v0.2.0 complete runtime patch at `patches/harness-trusted-paths.patch` contains 47 files (the existing 37 plus 10 picker files), still based on upstream commit `1f81c047fc48fa190a683e469daa699857e9afe8`. A checkout already carrying the v0.1.1 patch must instead use `patches/harness-trusted-paths-0.1.1-to-0.2.0.patch`; do not apply the new complete patch again over the old patch. Follow [INSTALL-CORE.md](./INSTALL-CORE.md) for fresh installation and incremental upgrade, including stopping tasks, backups, `--check`/apply, rebuilding Host/Client/Web, restarting the original service and refreshing the page. Patches ship in the npm tarball and GitHub Release; plugin installation does not apply them automatically.

v0.2.0 validation: 25 plugin tests (16 UI, 9 Host), 111 core picker tests, and Host/Client/Web builds passed. The user confirmed all three UI changes in actual use. This is targeted validation, not a claim that the full suite passed. The earlier 634-pass / 1-skip / 1-EPERM result remains a historical record (see the installation guide).

These changes have not been claimed as accepted upstream or included in an official release. Do not enable on an unverified runtime or bypass version/compatibility checks to force activation.
