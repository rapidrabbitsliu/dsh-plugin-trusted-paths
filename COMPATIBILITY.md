# Required Harness integration

This release requires a custom DeepSeek Harness runtime. It does not patch the runtime during installation. A stock runtime with the same version string is not necessarily compatible. No official minimum compatible release is known.

Required contracts:

1. Host `sandboxPolicy.registerWritableRoots(provider)` returning an effect disposer. Additional roots must only extend `workspace-write`, never `read-only`.
2. Host sandbox `reconcileWritableRoots(workspaceRoot, roots)` and `revokeWritableRoots(workspaceRoot, roots)`, plus confined filesystem and subprocess enforcement of the same additional roots.
3. Windows ephemeral per-invocation extra-root SIDs, durable pending/running leases, tombstoned revocation, process/job exit before ACL cleanup, protected control records, and fail-closed path canonicalization.
4. Host `settings.configure({ restart: true, auto: false })` exposing ordinary Config through Settings and awaiting async unload/remount/rollback when saving. Volatile-only settings are not sufficient.
5. Workspace `setDefaultDirectory(path)`, `defaultDirectory`, `sessionDirectoryPaths`, stable `path`, and `sessionIds`. New sessions must use the default directory; old sessions retain immutable cwd and membership. Directory mutation/create/delete must be serialized and collisions with other workspace histories rejected.
6. Client list/root slot `sidebar.workspaces.workspace.menu.item`, before Rename, owner `{ workspaceId, path, displayTitle }` and `useMenuOpenState()`.
7. Client services `configForms` (describe/get), `locale`, `slots`, and `uiWorkspace.listDirectory(path?, signal?)`. `shell.overlay` hosts the dialog. The module table must expose React and UI primitives.

The package checks missing sandbox methods and refuses activation rather than disabling the sandbox. Some contracts (for example menu placement and Settings restart semantics) cannot be verified merely by comparing method existence; the runtime integrator must verify them.

## Core source locations to integrate

- `packages/sandbox/{sandbox,sandbox-policy,sandbox-local,sandbox-windows-acl}`
- `packages/fs/{fs-sandbox,fs-local}`
- `packages/workspace/workspace`
- `packages/api/{session-controller,workspace-controller}`
- `packages/settings/settings`
- `packages/client/ui-workspace`

The runtime changes are separate from this plugin repository. This release does not claim those changes have been accepted upstream or included in an official release. Do not enable on an unverified runtime or bypass version/compatibility checks to force activation.
