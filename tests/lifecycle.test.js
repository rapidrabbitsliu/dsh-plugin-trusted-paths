import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Run the actual plugin lifecycle without installing a second schema runtime.
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  .replace("import Schema from '@deepseek-ai/schemastery';", 'const chain = new Proxy(() => chain, {get: () => chain}); const Schema = chain;')
  .replace("from './registry.js'", `from ${JSON.stringify(new URL('../registry.js', import.meta.url).href)}`);
const { apply } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const base = mkdtempSync(resolve('.trusted-lifecycle-'));
const primary = join(base, 'primary');
const ref = join(base, 'ref');
mkdirSync(primary); mkdirSync(ref);
test.after(() => rmSync(base, {recursive: true, force: true}));
const config = {workspaces: [{primaryFolder: primary, references: [ref]}]};
test('old runtimes fail closed instead of disabling sandbox', async () => {
  await assert.rejects(apply({sandboxPolicy: {}, sandbox: {}}, config), /核心/);
});
test('activation reconciles before registration; unload unregisters before revocation', async () => {
  const order = [];
  let provider, cleanup;
  const ctx = {
    sandboxPolicy: {registerWritableRoots(fn) {order.push('register'); provider = fn; return () => order.push('unregister');}},
    sandbox: {
      async reconcileWritableRoots(root, roots) {assert.equal(root, primary); assert.deepEqual(roots, [ref]); order.push('reconcile');},
      async revokeWritableRoots() {order.push('revoke');},
    },
    effect(fn) {cleanup = fn();},
  };
  await apply(ctx, config);
  assert.deepEqual(order, ['reconcile', 'register']);
  assert.deepEqual(provider({session: {header: {cwd: primary}}}), [ref]);
  assert.deepEqual(provider({}), []);
  await cleanup();
  assert.deepEqual(order, ['reconcile', 'register', 'unregister', 'revoke']);
});
test('path validation rejects invalid owner config before it is accepted', async () => {
  let validate;
  const fiber = {};
  await apply({
    fiber,
    on(event, fn) { assert.equal(event, 'internal/config'); validate = fn; },
    sandboxPolicy: {registerWritableRoots() {return () => {};}},
    sandbox: {async reconcileWritableRoots() {}, async revokeWritableRoots() {}},
    effect(fn) {fn();},
  }, config);
  assert.throws(() => validate.call(fiber, {}, () => ({workspaces: [{primaryFolder: '.'}]})), /绝对路径/);
  const foreign = {workspaces: [{primaryFolder: '.'}]};
  assert.equal(validate.call({}, {}, () => foreign), foreign);
});
test('reconciliation failure never registers authority', async () => {
  let registered = false;
  await assert.rejects(apply({
    sandboxPolicy: {registerWritableRoots() {registered = true;}},
    sandbox: {revokeWritableRoots() {}, reconcileWritableRoots() {throw new Error('busy');}},
  }, config), /busy/);
  assert.equal(registered, false);
});
