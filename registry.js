import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, parse, relative, sep, join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

export function identity(path) {
  const canonical = realpathSync.native(path);
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}
function contains(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
export function validateDirectory(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('文件夹必须使用绝对路径');
  const canonical = realpathSync.native(path);
  if (!statSync(canonical).isDirectory()) throw new Error(`不是文件夹：${path}`);
  const key = identity(canonical);
  if (key === identity(parse(canonical).root)) throw new Error('不能信任整个磁盘或文件系统根目录');
  const control = join(realpathSync.native(homedir()), '.dsh-trusted-paths-control');
  const controlKey = process.platform === 'win32' ? control.toLowerCase() : control;
  if (contains(key, controlKey) || contains(controlKey, key)) throw new Error('文件夹不能与沙箱授权控制目录重叠');
  const temp = identity(tmpdir());
  if (contains(key, temp) || contains(temp, key)) throw new Error('引用目录不能与系统临时目录重叠');
  return { path: canonical, key };
}

/** Immutable snapshot. References never become primary folders implicitly. */
export function buildRegistry(workspaces) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) throw new Error('必须至少设置一个主文件夹');
  const registry = new Map();
  for (const workspace of workspaces) {
    const primary = validateDirectory(workspace.primaryFolder);
    if (registry.has(primary.key)) throw new Error('主文件夹重复');
    const refs = new Map();
    for (const path of workspace.references ?? []) {
      const ref = validateDirectory(path);
      if (ref.key === primary.key) throw new Error('主文件夹不能同时作为引用');
      refs.set(ref.key, ref.path);
    }
    registry.set(primary.key, { primaryFolder: primary.path, references: [...refs.values()] });
  }
  return registry;
}

/** Recheck identity on every call: retargeted junctions fail closed. */
export function rootsFor(registry, cwd) {
  if (!cwd) return [];
  const workspace = registry.get(identity(cwd));
  if (!workspace) return [];
  for (const path of [workspace.primaryFolder, ...workspace.references]) {
    const checked = validateDirectory(path);
    if (checked.path !== path) throw new Error('可信文件夹身份发生变化，请重新设置');
  }
  return [...workspace.references];
}
