import assert from 'node:assert/strict';
import { after, afterEach, test, mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Resolve test dependencies from this package, with no external checkout required.
const packageRequire = createRequire(new URL('../package.json', import.meta.url));
const { JSDOM } = packageRequire('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const React = packageRequire('react');
const { render, screen, fireEvent, cleanup, act } = packageRequire('@testing-library/react');
const h = React.createElement;
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
afterEach(cleanup);
after(() => dom.window.close());

function setup({ workspaces = [], revision = 17, writable = true, status = 'ready', locale = 'en', target = {}, mutate, listDirectory = async path => listing(path ?? 'D:\\home'), namespace = 'local-trusted-paths' } = {}) {
  const uiWorkspace = { listDirectory: mock.fn(listDirectory) };
  let snapshot = { status, writable, revision, value: { workspaces } };
  const subscribers = new Set();
  const form = {
    getSnapshot: () => snapshot,
    subscribe: fn => { subscribers.add(fn); return () => subscribers.delete(fn); },
    mutate: mock.fn(mutate ?? (async () => true)),
  };
  const components = new Map();
  const setMenuOpen = mock.fn();
  let localeSnapshot = { active: locale, revision: 0 };
  const localeSubscribers = new Set();
  const dictionaries = new Map();
  const registerLocale = mock.fn((namespace, language, dictionary) => { dictionaries.set(`${namespace}:${language}`, dictionary); return () => {}; });
  const mirrorSnapshot = {view:{namespaces:[{ns:namespace}]}};
  const getForm = mock.fn(ns => {assert.equal(ns,namespace);return form;});
  const primitives = {
    MenuItemButton: ({ onSelect, children }) => h('button', { role: 'menuitem', onClick: onSelect }, children),
    Button: ({ variant, ...props }) => h('button', props),
    Modal: ({ open, title, children, footer, onClose, closeLabel }) => open ? h('section', { role: 'dialog', 'aria-label': title },
      h('button', { 'aria-label': closeLabel, onClick: onClose }, '×'), children, footer) : null,
  };
  window.__ModuleLoader__ = {
    load({ id, factory }) {
      assert.equal(id, 'dsh-plugin-trusted-paths');
      const plugin = factory(name => {
        if (name === 'react') return React;
        if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
        throw new Error(`Unexpected loader dependency: ${name}`);
      });
      assert.ok(plugin.inject.includes('uiWorkspace'));
      plugin.apply({
        uiWorkspace,
        effect: fn => fn(),
        locale: {
          register: registerLocale,
          getSnapshot: () => localeSnapshot,
          subscribe: fn => { localeSubscribers.add(fn); return () => localeSubscribers.delete(fn); },
          bind: namespace => key => dictionaries.get(`${namespace}:${localeSnapshot.active.startsWith('zh') ? 'zh' : 'en'}`)?.[key] ?? key,
        },
        configForms: { get: getForm, describe: () => ({getSnapshot: () => mirrorSnapshot, subscribe: () => () => {}}) },
        slots: {
          inject: (name, fn) => fn(),
          register: (options, Component) => { components.set(options.name, Component); return () => components.delete(options.name); },
        },
      });
    },
  };
  // Execute the actual unmodified client module and render its registered slots.
  new Function('window', source)(window);
  assert.equal(getForm.mock.callCount(), 0); // Namespace resolves from the Host describe mirror when opened.
  assert.equal(registerLocale.mock.callCount(), 2);
  const MenuEntry = components.get('sidebar.workspaces.workspace.menu.item');
  const Overlay = components.get('shell.overlay');
  assert.equal(typeof MenuEntry, 'function');
  assert.equal(typeof Overlay, 'function');
  function Harness() {
    const [open, setOpen] = React.useState(true);
    function useMenuOpenState() {
      return [open, value => { setMenuOpen(value); setOpen(value); }];
    }
    return h(React.Fragment, null,
      h('button', { onClick: () => setOpen(true) }, 'Open workspace menu'),
      open ? h(MenuEntry, { workspaceId: 'workspace-a', path: 'D:\\projects\\alpha', displayTitle: 'Alpha', ...target, useMenuOpenState }) : null,
      h(Overlay));
  }
  render(h(Harness));
  function open() {
    fireEvent.click(screen.getByRole('menuitem', { name: locale.startsWith('zh') ? '目录设置' : 'Folder settings' }));
    assert.equal(setMenuOpen.mock.calls.at(-1).arguments[0], false);
    assert.equal(screen.queryByRole('menuitem'), null, 'selection closes the workspace menu');
    return screen.getByRole('dialog');
  }
  function updateState(patch) {
    act(() => { snapshot = { ...snapshot, ...patch }; for (const listener of subscribers) listener(); });
  }
  function setLocale(active) {
    act(() => { localeSnapshot = { active, revision: localeSnapshot.revision + 1 }; for (const listener of localeSubscribers) listener(); });
  }
  return { form, open, updateState, setMenuOpen, setLocale, uiWorkspace };
}
const primary = () => screen.getByRole('textbox', { name: /Primary folder/ });
const save = () => screen.getByRole('button', { name: 'Save and authorize' });
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
function listing(path, children = []) {
  const pieces = path.split('\\').filter(Boolean);
  const crumbs = pieces.map((name, index) => ({ name, path: pieces.slice(0,index+1).join('\\') + (index===0?'\\':''), hidden:false }));
  return { path, home:'C:\\Users\\test', crumbs, entries:children.map(([name,path])=>({name,path,hidden:false})), truncated:false };
}
async function browse(kind = 'primary') {
  await act(async()=>click(kind==='primary'?'Choose folder':'Add reference folder'));
}
async function select(path, kind = 'primary') {
  await browse(kind);
  // The mock backend returns the selected absolute path, as the real service does.
  assert.equal(screen.getByRole('textbox',{name:'Current path'}).value,path);
  click('Select current folder');
}

test('menu opens readonly path and reference list without mutating', () => {
  const app=setup();app.open();
  assert.equal(primary().value,'D:\\projects\\alpha');
  assert.equal(primary().readOnly,true);
  assert.equal(screen.queryByRole('textbox',{name:/References/}),null);
  assert.ok(screen.getByText('No reference folders'));
  assert.equal(save().disabled,false);
  assert.equal(app.form.mutate.mock.callCount(),0);
});

test('workspaceId takes priority; legacy defaults match case insensitively', () => {
  setup({workspaces:[{primaryFolder:'D:\\projects\\alpha',references:['D:\\legacy']},{workspaceId:'workspace-a',primaryFolder:'D:\\moved',references:['D:\\one','D:\\two']}]}).open();
  assert.equal(primary().value,'D:\\moved');assert.ok(screen.getByText('D:\\one'));assert.ok(screen.getByText('D:\\two'));
  cleanup();
  setup({workspaces:[{primaryFolder:'d:\\PROJECTS\\ALPHA',references:['D:\\legacy']}]}).open();
  assert.equal(primary().value,'d:\\PROJECTS\\ALPHA');assert.ok(screen.getByText('D:\\legacy'));
});

test('browse navigates child, parent and home using exact host paths in one Modal', async()=>{
  const root='D:\\projects\\alpha', child=root+'\\child';
  const app=setup({listDirectory:async path=>listing(path, path===root?[['child',child]]:[])});app.open();
  await browse();assert.equal(screen.getAllByRole('dialog').length,1);
  assert.equal(screen.queryByRole('button',{name:'Save and authorize'}),null);
  await act(async()=>click('child'));
  assert.equal(screen.getByRole('textbox',{name:'Current path'}).value,child);
  await act(async()=>click('Parent folder'));
  assert.equal(screen.getByRole('textbox',{name:'Current path'}).value,root);
  await act(async()=>click('Home folder'));
  assert.equal(screen.getByRole('textbox',{name:'Current path'}).value,'C:\\Users\\test');
  click('Select current folder');assert.equal(primary().value,'C:\\Users\\test');
  assert.equal(app.form.mutate.mock.callCount(),0);
  assert.ok(app.uiWorkspace.listDirectory.mock.calls.every(call=>call.arguments[1] instanceof AbortSignal));
});

test('save retains Host payload, opening revision, other rows and dynamic mirror namespace', async()=>{
  const other={workspaceId:'workspace-b',primaryFolder:'D:\\beta',references:['D:\\shared'],extra:{keep:true}};
  let chosen='D:\\new-primary';
  const app=setup({namespace:'include:local-trusted-paths',revision:'revision-42',workspaces:[{workspaceId:'workspace-a',primaryFolder:'D:\\old',references:[]},other],listDirectory:async()=>listing(chosen)});
  app.open();await select(chosen);chosen='D:\\new-ref';await select(chosen,'reference');
  assert.equal(app.form.mutate.mock.callCount(),0);
  app.updateState({revision:'revision-43'});
  await act(async()=>click('Save and authorize'));
  assert.equal(screen.queryByRole('dialog'),null);
  assert.deepEqual(app.form.mutate.mock.calls[0].arguments,[[{op:'set',path:['workspaces'],value:[other,{workspaceId:'workspace-a',primaryFolder:'D:\\new-primary',references:['D:\\new-ref']}]}],'revision-42']);
  assert.equal(app.form.mutate.mock.calls[0].arguments[0][0].value[0],other);
});

test('reference remove stays draft and legacy save migrates without duplicate',async()=>{
  const app=setup({workspaces:[{primaryFolder:'d:\\PROJECTS\\ALPHA',references:['D:\\legacy']}]});app.open();
  click('Remove D:\\legacy');assert.equal(app.form.mutate.mock.callCount(),0);
  await act(async()=>click('Save and authorize'));
  assert.deepEqual(app.form.mutate.mock.calls[0].arguments[0][0].value,[{workspaceId:'workspace-a',primaryFolder:'d:\\PROJECTS\\ALPHA',references:[]}]);
});

test('browser cancellation and close do not change draft; main Cancel discards draft',async()=>{
  const app=setup({listDirectory:async()=>listing('D:\\discard')});app.open();
  await browse();click('Cancel');assert.equal(primary().value,'D:\\projects\\alpha');
  await browse('reference');click('Close');assert.ok(screen.getByText('No reference folders'));
  await select('D:\\discard');click('Cancel');
  assert.equal(screen.queryByRole('dialog'),null);assert.equal(app.form.mutate.mock.callCount(),0);
  click('Open workspace menu');app.open();assert.equal(primary().value,'D:\\projects\\alpha');
});

test('main modal close dismisses without saving',()=>{
  const app=setup();app.open();click('Close');assert.equal(screen.queryByRole('dialog'),null);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('blank primary, readonly and loading config cannot save or pick',()=>{
  const app=setup({status:'loading'});app.open();assert.ok(screen.getByText('Loading…'));assert.equal(save().disabled,true);
  app.updateState({status:'ready',writable:false,value:{workspaces:[{workspaceId:'workspace-a',primaryFolder:'',references:[]}]}});
  assert.equal(save().disabled,true);assert.equal(screen.getByRole('button',{name:'Choose folder'}).disabled,true);
  assert.equal(screen.getByRole('button',{name:'Add reference folder'}).disabled,true);
  click('Choose folder');click('Save and authorize');assert.equal(app.uiWorkspace.listDirectory.mock.callCount(),0);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('loading config initializes when ready',()=>{
  const app=setup({status:'loading'});app.open();
  app.updateState({status:'ready',value:{workspaces:[{workspaceId:'workspace-a',primaryFolder:'D:\\ready',references:[]}]}});
  assert.equal(primary().value,'D:\\ready');assert.equal(save().disabled,false);
});

test('pending save disables picking, removal, repeat save and cancellation',async()=>{
  let resolveSave;
  const app=setup({workspaces:[{workspaceId:'workspace-a',primaryFolder:'D:\\main',references:['D:\\ref']}],mutate:()=>new Promise(resolve=>{resolveSave=resolve;})});app.open();click('Save and authorize');
  for(const name of ['Choose folder','Add reference folder','Remove D:\\ref','Saving…','Cancel'])assert.equal(screen.getByRole('button',{name}).disabled,true);
  click('Close');assert.ok(screen.getByRole('dialog'));assert.equal(app.form.mutate.mock.callCount(),1);
  await act(async()=>resolveSave(true));assert.equal(screen.queryByRole('dialog'),null);
});

test('refused mutation keeps selected reference draft',async()=>{
  const app=setup({mutate:async()=>false,listDirectory:async()=>listing('D:\\draft')});app.open();await select('D:\\draft','reference');
  await act(async()=>click('Save and authorize'));
  assert.match(screen.getByRole('status').textContent,/Configuration refused/);assert.ok(screen.getByText('D:\\draft'));assert.equal(save().disabled,false);
});

test('directory list failure offers retry without changing draft or saving',async()=>{
  let fail=true;
  const app=setup({listDirectory:async()=>{if(fail)throw new Error('Permission denied');return listing('D:\\retry');}});app.open();await browse();
  assert.match(screen.getByRole('alert').textContent,/Permission denied/);assert.equal(screen.getByRole('button',{name:'Select current folder'}).disabled,true);
  fail=false;await act(async()=>click('Retry'));click('Select current folder');assert.equal(primary().value,'D:\\retry');assert.equal(app.form.mutate.mock.callCount(),0);
});

test('scan busy blocks selection/save; cancellation aborts and ignores stale completion',async()=>{
  let finish;
  const app=setup({listDirectory:()=>new Promise(resolve=>{finish=resolve;})});app.open();await browse();
  const signal=app.uiWorkspace.listDirectory.mock.calls[0].arguments[1];
  assert.equal(screen.getByRole('button',{name:'Select current folder'}).disabled,true);assert.equal(screen.queryByRole('button',{name:'Save and authorize'}),null);
  click('Cancel');assert.equal(signal.aborted,true);
  await act(async()=>finish(listing('D:\\stale')));
  assert.equal(primary().value,'D:\\projects\\alpha');assert.equal(app.form.mutate.mock.callCount(),0);
});

test('failed starting path can recover by browsing Host home without input',async()=>{
  const app=setup({listDirectory:async path=>{if(path)throw new Error('Missing folder');return listing('C:\\Users\\test');}});app.open();await browse();
  assert.ok(screen.getByRole('alert'));await act(async()=>click('Home folder'));
  assert.equal(app.uiWorkspace.listDirectory.mock.calls.at(-1).arguments[0],undefined);
  click('Select current folder');assert.equal(primary().value,'C:\\Users\\test');
});

test('a cancelled scan cannot overwrite a newer browser result',async()=>{
  let finishOld, calls=0;
  const app=setup({listDirectory:()=>++calls===1?new Promise(resolve=>{finishOld=resolve;}):Promise.resolve(listing('D:\\fresh'))});app.open();await browse();
  const oldSignal=app.uiWorkspace.listDirectory.mock.calls[0].arguments[1];click('Cancel');await browse('reference');
  assert.equal(oldSignal.aborted,true);await act(async()=>finishOld(listing('D:\\stale')));
  assert.equal(screen.getByRole('textbox',{name:'Current path'}).value,'D:\\fresh');click('Select current folder');assert.ok(screen.getByText('D:\\fresh'));assert.equal(app.form.mutate.mock.callCount(),0);
});

test('unmount aborts a pending scan',async()=>{
  const app=setup({listDirectory:()=>new Promise(()=>{})});app.open();await browse();
  const signal=app.uiWorkspace.listDirectory.mock.calls[0].arguments[1];cleanup();assert.equal(signal.aborted,true);
});

test('case and slash-equivalent primary/ref duplicates are rejected and initial refs deduped',async()=>{
  let chosen='d:/REF/';
  const app=setup({workspaces:[{workspaceId:'workspace-a',primaryFolder:'D:\\main',references:['D:\\ref','d:/REF/','D:\\main']}],listDirectory:async()=>listing(chosen)});app.open();
  assert.equal(screen.getAllByRole('button',{name:/^Remove /}).length,1);
  await browse();click('Select current folder');assert.match(screen.getByRole('status').textContent,/already the primary or a reference/);click('Cancel');assert.equal(primary().value,'D:\\main');
  chosen='d:/MAIN/';await browse('reference');click('Select current folder');assert.match(screen.getByRole('status').textContent,/already the primary or a reference/);click('Cancel');
  chosen='D:\\new';await select(chosen,'reference');await browse('reference');click('Select current folder');assert.match(screen.getByRole('status').textContent,/already the primary or a reference/);
  assert.equal(app.form.mutate.mock.callCount(),0);
});

test('readonly transition while browser open prevents accepting selection',async()=>{
  const app=setup({listDirectory:async()=>listing('D:\\picked')});app.open();await browse();app.updateState({writable:false});
  assert.equal(screen.getByRole('button',{name:'Select current folder'}).disabled,true);click('Select current folder');click('Cancel');assert.equal(primary().value,'D:\\projects\\alpha');
});

test('live locale switches main and browser labels without losing draft',async()=>{
  const app=setup({listDirectory:async()=>listing('D:\\draft')});app.open();await select('D:\\draft','reference');app.setLocale('zh-CN');
  assert.equal(screen.getByRole('dialog').getAttribute('aria-label'),'目录设置 · Alpha');assert.ok(screen.getByText('D:\\draft'));assert.ok(screen.getByRole('button',{name:'保存并授权'}));
  await act(async()=>click('选择文件夹'));assert.equal(screen.getByRole('dialog').getAttribute('aria-label'),'选择目录 · Alpha');
  assert.ok(screen.getByRole('button',{name:'选择当前目录'}));click('取消');assert.ok(screen.getByText('D:\\draft'));
});

test('Chinese menu, readonly label and cancellation are localized',()=>{
  const app=setup({locale:'zh-CN'});app.open();assert.equal(screen.getByRole('textbox',{name:'主目录'}).readOnly,true);click('取消');assert.equal(app.form.mutate.mock.callCount(),0);assert.equal(screen.queryByRole('dialog'),null);
});