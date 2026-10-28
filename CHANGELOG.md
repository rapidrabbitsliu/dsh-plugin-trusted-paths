# Changelog

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
