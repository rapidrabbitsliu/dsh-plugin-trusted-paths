import Schema from '@deepseek-ai/schemastery';
import { buildRegistry, rootsFor } from './registry.js';

export const name = 'trusted-paths';
export const inject = ['sandboxPolicy', 'sandbox', 'workspaceRegistry', 'settings'];
export const Config = Schema.object({
  workspaces: Schema.array(Schema.object({
    workspaceId: Schema.string().description('所属侧边栏工作区的稳定标识；未设置时兼容按主目录匹配'),
    primaryFolder: Schema.string().required().description('主文件夹（必填，绝对路径）'),
    references: Schema.array(Schema.string()).default([]).description('可信引用文件夹：添加即授权其内部读写，无需逐次审批；移除不会删除文件'),
  })).default([]).description('按工作区隔离的引用配置；每项必须有主目录，空列表表示尚未授权任何工作区'),
});

export async function apply(ctx, config) {
  if (ctx.settings) ctx.effect(() => ctx.settings.configure({ restart: true, auto: false }));
  if (typeof ctx.sandboxPolicy.registerWritableRoots !== 'function'
      || typeof ctx.sandbox.revokeWritableRoots !== 'function') {
    throw new Error('可信文件夹引用需要多目录权限扩展。请先构建并重启配套 Harness 核心；插件不会关闭或绕过沙箱。');
  }
  ctx.on?.('internal/config', function (_raw, next) {
    const raw = next();
    if (this === ctx.fiber && raw.workspaces?.length) buildRegistry(raw.workspaces);
    return raw;
  });
  const registry = config.workspaces.length ? buildRegistry(config.workspaces) : new Map();
  const bindings = [];
  const workspaceIds = new Set();
  for (const entry of config.workspaces) {
    if (!entry.workspaceId) continue;
    if (workspaceIds.has(entry.workspaceId)) throw new Error('工作区配置重复');
    workspaceIds.add(entry.workspaceId);
    const workspace = ctx.workspaceRegistry.get(entry.workspaceId);
    if (!workspace) throw new Error(`工作区不存在：${entry.workspaceId}`);
    if (typeof workspace.setDefaultDirectory !== 'function') throw new Error('请构建并重启支持工作区主目录设置的核心');
    const roots = rootsFor(registry, entry.primaryFolder);
    bindings.push({ workspace, primaryFolder: entry.primaryFolder, roots });
  }
  if (typeof ctx.sandbox.reconcileWritableRoots !== 'function') {
    throw new Error('当前沙箱缺少可信目录授权生命周期接口');
  }
  for (const workspace of registry.values()) {
    await ctx.sandbox.reconcileWritableRoots(workspace.primaryFolder, workspace.references);
  }
  const leases = new Map();
  for (const binding of bindings) {
    for (const cwd of binding.workspace.sessionDirectoryPaths ?? [binding.workspace.path]) {
      await ctx.sandbox.reconcileWritableRoots(cwd, [binding.primaryFolder, ...binding.roots]);
      leases.set(cwd, [binding.primaryFolder, ...binding.roots]);
    }
    await binding.workspace.setDefaultDirectory(binding.primaryFolder);
    leases.set(binding.primaryFolder, [binding.primaryFolder, ...binding.roots]);
  }
  ctx.effect(() => {
    const dispose = ctx.sandboxPolicy.registerWritableRoots(({ session }) => {
      if (!session) return [];
      const binding = bindings.find(b => b.workspace.sessionIds.includes(session.id));
      if (!binding) {
        const legacy = config.workspaces.filter(w => !w.workspaceId);
        return legacy.length ? rootsFor(buildRegistry(legacy), session.header.cwd) : [];
      }
      const roots = [binding.primaryFolder, ...rootsFor(registry, binding.primaryFolder)];
      if (session.header.cwd) leases.set(session.header.cwd, roots);
      return roots;
    });
    return async () => {
      dispose();
      for (const [cwd, roots] of leases) await ctx.sandbox.revokeWritableRoots(cwd, roots);
      for (const workspace of registry.values()) {
        await ctx.sandbox.revokeWritableRoots(workspace.primaryFolder, workspace.references);
      }
    };
  });
}
