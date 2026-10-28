import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRegistry, rootsFor } from '../registry.js';

// Use workspace fixtures, not ambient temp: temp references are intentionally rejected.
const base = mkdtempSync(resolve('.trusted-paths-test-'));
const primary = join(base, 'primary');
const ref = join(base, 'ref');
const other = join(base, 'other');
for (const path of [primary, ref, other]) mkdirSync(path);
test.after(() => rmSync(base, { recursive: true, force: true }));
test('a primary folder is mandatory', () => {
  assert.throws(() => buildRegistry([]), /主文件夹/);
  assert.throws(() => buildRegistry([{ references: [] }]), /绝对路径/);
});
test('references are deduplicated and scoped to the exact primary folder', () => {
  const state = buildRegistry([{ primaryFolder: primary, references: [ref, ref] }]);
  assert.equal(rootsFor(state, primary).length, 1);
  assert.deepEqual(rootsFor(state, other), []);
  assert.deepEqual(rootsFor(state, ref), []);
});
test('removing references retains the primary folder', () => {
  const state = buildRegistry([{ primaryFolder: primary, references: [] }]);
  assert.deepEqual(rootsFor(state, primary), []);
  assert.equal(state.size, 1);
});
test('relative paths, duplicate primary and primary-as-reference are rejected', () => {
  assert.throws(() => buildRegistry([{ primaryFolder: '.' }]), /绝对路径/);
  assert.throws(() => buildRegistry([{ primaryFolder: primary }, { primaryFolder: primary }]), /重复/);
  assert.throws(() => buildRegistry([{ primaryFolder: primary, references: [primary] }]), /同时作为引用/);
});
