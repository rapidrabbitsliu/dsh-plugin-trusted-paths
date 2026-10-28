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

function setup({ workspaces = [], revision = 17, writable = true, status = 'ready', locale = 'en', target = {}, mutate, namespace = 'local-trusted-paths' } = {}) {
  const pickerProps = [];
  // This is a contract mock, not a second implementation of the core browser.
  // Navigation, cross-drive paths and request cancellation belong to core tests.
  function DirectoryBrowser(props) {
    pickerProps.push(props);
    const {open,busy,initialPath,onPicked,onCancel,title,confirmLabel} = props;
    assert.deepEqual(Object.keys(props).sort(),['open','busy','initialPath','title','confirmLabel','onPicked','onCancel'].sort());
    assert.equal(typeof open,'boolean');assert.equal(typeof busy,'boolean');
    assert.equal(typeof onPicked,'function');assert.equal(typeof onCancel,'function');
    return open ? h('section',{role:'dialog','aria-label':title},
      h('div',{'data-testid':'picker-initial-path'},initialPath),
      h('input',{'aria-label':'Mock selected path',defaultValue:'D:\\picked'}),
      h('button',{disabled:busy,onClick:()=>onPicked(screen.getByRole('textbox',{name:'Mock selected path'}).value)},confirmLabel),
      h('button',{onClick:onCancel},localeSnapshot.active.startsWith('zh')?'取消':'Cancel')) : null;
  }
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
  window.__ModuleLoader__ = {
    load({ id, factory }) {
      assert.equal(id, 'dsh-plugin-trusted-paths');
      const plugin = factory(name => {
        if (name === 'react') return React;
        throw new Error(`Unexpected loader dependency: ${name}`);
      });
      assert.ok(plugin.inject.includes('directoryBrowser'));
      plugin.apply({
        directoryBrowser: {render: props => h(DirectoryBrowser,props)},
        effect: fn => fn(),
        locale: {
          register: registerLocale,
          getSnapshot: () => localeSnapshot,
          subscribe: fn => { localeSubscribers.add(fn); return () => localeSubscribers.delete(fn); },
          bind: namespace => key => {
            const zh = localeSnapshot.active.startsWith('zh');
            return dictionaries.get(`${namespace}:${zh?'zh':'en'}`)?.[key] ?? key;
          },
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
  return { form, open, updateState, setMenuOpen, setLocale, pickerProps };
}
const root = 'D:\\projects\\alpha';
const save = () => screen.getByRole('button', { name: 'Save and authorize', exact:true });
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const radios = () => screen.getAllByRole('radio');
const primary = () => radios().find(r=>r.checked);
const choosePrimary = path => fireEvent.click(screen.getByRole('radio',{name:'Primary folder '+path,exact:true}));
async function browse() { await act(async()=>click('Add folder')); }
async function select(path) {
  await browse();
  fireEvent.change(screen.getByRole('textbox',{name:'Mock selected path'}),{target:{value:path}});
  click('Add folder');
}
function entry(primaryFolder=root,references=[]) { return {workspaceId:'workspace-a',primaryFolder,references}; }

test('one unified list, unique primary badge and nonempty default; draft does not authorize',()=>{
  const app=setup();app.open();
  assert.equal(screen.getAllByRole('list').length,1);
  assert.equal(radios().length,1);assert.equal(primary().getAttribute('aria-label'),'Primary folder '+root);
  assert.ok(screen.getByText('Primary folder',{exact:true}));
  const remove=screen.getByRole('button',{name:'Remove '+root,exact:true});
  assert.equal(remove.disabled,true);
  assert.match(screen.getByText(/To remove the primary/).textContent,/At least one folder/);
  fireEvent.click(remove);assert.equal(radios().length,1);
  assert.equal(save().disabled,false);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('setting any folder primary preserves every other directory and disables only primary removal',async()=>{
  const app=setup({workspaces:[entry('D:\\main',['D:\\one','D:\\two'])]});app.open();
  choosePrimary('D:\\two');
  assert.equal(radios().filter(r=>r.checked).length,1);
  assert.equal(primary().getAttribute('aria-label'),'Primary folder D:\\two');
  for(const path of ['D:\\main','D:\\one','D:\\two'])assert.ok(screen.getByText(path,{exact:true}));
  assert.equal(screen.getByRole('button',{name:'Remove D:\\two',exact:true}).disabled,true);
  assert.equal(screen.getByRole('button',{name:'Remove D:\\main',exact:true}).disabled,false);
  assert.equal(app.form.mutate.mock.callCount(),0);
  await act(async()=>click('Save and authorize'));
  assert.deepEqual(app.form.mutate.mock.calls[0].arguments[0][0].value,[entry('D:\\two',['D:\\main','D:\\one'])]);
});

test('nonprimary removal stays draft; removing old primary after promotion is allowed',async()=>{
  const app=setup({workspaces:[entry('D:\\main',['D:\\one','D:\\two'])]});app.open();
  click('Remove D:\\one');choosePrimary('D:\\two');click('Remove D:\\main');
  assert.equal(radios().length,1);assert.equal(app.form.mutate.mock.callCount(),0);
  assert.equal(screen.getByRole('button',{name:'Remove D:\\two',exact:true}).disabled,true);
  await act(async()=>click('Save and authorize'));
  assert.deepEqual(app.form.mutate.mock.calls[0].arguments[0][0].value,[entry('D:\\two',[])]);
});

test('shared browser contract replaces main Modal without losing draft, cancel discards only picker',async()=>{
  const app=setup({workspaces:[entry(root,['D:\\existing'])]});app.open();choosePrimary('D:\\existing');
  await browse();assert.equal(screen.getAllByRole('dialog').length,1);
  assert.equal(screen.queryByRole('button',{name:'Save and authorize'}),null);
  assert.equal(screen.getByTestId('picker-initial-path').textContent,'D:\\existing');
  assert.equal(screen.getByRole('dialog').getAttribute('aria-label'),'Choose directory');
  click('Cancel');assert.equal(primary().getAttribute('aria-label'),'Primary folder D:\\existing');
  await select('E:\\new');assert.ok(screen.getByText('E:\\new'));
  assert.equal(primary().getAttribute('aria-label'),'Primary folder D:\\existing');
  assert.equal(app.form.mutate.mock.callCount(),0);
  click('Cancel');assert.equal(screen.queryByRole('dialog'),null);
  click('Open workspace menu');app.open();assert.equal(primary().getAttribute('aria-label'),'Primary folder '+root);
  assert.equal(screen.queryByText('E:\\new'),null);
});

test('duplicate normalized paths return to management with friendly message and no mutation',async()=>{
  const app=setup({workspaces:[entry('D:\\main',['D:\\ref','d:/REF/','D:\\main'])]});app.open();
  assert.equal(radios().length,2);
  await select('d:/MAIN/');assert.match(screen.getByRole('status').textContent,/already in the list/);
  assert.equal(radios().length,2);assert.equal(screen.getAllByRole('dialog').length,1);
  await select('d:/REF/');assert.equal(radios().length,2);
  await select('D:\\new');await select('d:/NEW/');assert.equal(radios().length,3);
  assert.equal(app.form.mutate.mock.callCount(),0);
});

test('save preserves revision fence, dynamic mirror namespace and untouched workspace rows',async()=>{
  const other={workspaceId:'workspace-b',primaryFolder:'D:\\beta',references:['D:\\shared'],extra:{keep:true}};
  const app=setup({namespace:'include:local-trusted-paths',revision:'revision-42',workspaces:[entry('D:\\old'),other]});
  app.open();await select('D:\\new');choosePrimary('D:\\new');
  app.updateState({revision:'revision-43',value:{workspaces:[]}});
  await act(async()=>click('Save and authorize'));
  assert.equal(screen.queryByRole('dialog'),null);
  assert.deepEqual(app.form.mutate.mock.calls[0].arguments,[[{op:'set',path:['workspaces'],value:[other,entry('D:\\new',['D:\\old'])]}],'revision-42']);
  assert.equal(app.form.mutate.mock.calls[0].arguments[0][0].value[0],other);
});

test('workspaceId takes precedence and legacy case-insensitive row migrates without duplicate',async()=>{
  setup({workspaces:[{primaryFolder:root,references:['D:\\legacy']},entry('D:\\moved',['D:\\one'])]}).open();
  assert.equal(primary().getAttribute('aria-label'),'Primary folder D:\\moved');cleanup();
  const app=setup({workspaces:[{primaryFolder:'d:\\PROJECTS\\ALPHA',references:['D:\\legacy']}]});app.open();
  assert.equal(primary().getAttribute('aria-label'),'Primary folder d:\\PROJECTS\\ALPHA');click('Remove D:\\legacy');
  await act(async()=>click('Save and authorize'));
  assert.deepEqual(app.form.mutate.mock.calls[0].arguments[0][0].value,[entry('d:\\PROJECTS\\ALPHA')]);
});

test('readonly disables add, primary change, remove and save',()=>{
  const app=setup({writable:false,workspaces:[entry(root,['D:\\ref'])]});app.open();
  for(const radio of radios())assert.equal(radio.disabled,true);
  for(const name of ['Add folder','Remove '+root,'Remove D:\\ref','Save and authorize'])assert.equal(screen.getByRole('button',{name,exact:true}).disabled,true);
  choosePrimary('D:\\ref');click('Add folder');click('Remove D:\\ref');click('Save and authorize');
  assert.equal(app.pickerProps.length,0);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('readonly transition while picker open blocks accepting selection but permits cancel',async()=>{
  const app=setup();app.open();await browse();app.updateState({writable:false});
  assert.equal(screen.getByRole('button',{name:'Add folder'}).disabled,true);
  click('Add folder');click('Cancel');assert.equal(radios().length,1);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('loading/unavailable config cannot save; ready initializes default; blank primary cannot save',()=>{
  const app=setup({status:'loading'});app.open();assert.ok(screen.getByText('Loading…'));assert.equal(save().disabled,true);
  app.updateState({status:'unavailable'});assert.ok(screen.getByText(/Configuration is unavailable/));
  app.updateState({status:'ready',value:{workspaces:[entry('D:\\ready')]}});
  assert.equal(primary().getAttribute('aria-label'),'Primary folder D:\\ready');assert.equal(save().disabled,false);
  cleanup();setup({workspaces:[entry('')]}).open();assert.equal(save().disabled,true);
});

test('pending save disables edits, repeat save and dismissal',async()=>{
  let resolveSave;
  const app=setup({workspaces:[entry(root,['D:\\ref'])],mutate:()=>new Promise(resolve=>{resolveSave=resolve;})});app.open();click('Save and authorize');
  for(const name of ['Add folder','Remove D:\\ref','Saving…','Cancel'])assert.equal(screen.getByRole('button',{name,exact:true}).disabled,true);
  for(const radio of radios())assert.equal(radio.disabled,true);
  click('Close');assert.ok(screen.getByRole('dialog'));assert.equal(app.form.mutate.mock.callCount(),1);
  await act(async()=>resolveSave(true));assert.equal(screen.queryByRole('dialog'),null);
});

test('refused save retains draft and allows retry',async()=>{
  const app=setup({mutate:async()=>false});app.open();await select('D:\\draft');choosePrimary('D:\\draft');
  await act(async()=>click('Save and authorize'));
  assert.match(screen.getByRole('status').textContent,/Configuration refused/);
  assert.equal(primary().getAttribute('aria-label'),'Primary folder D:\\draft');assert.equal(save().disabled,false);
});

test('live locale changes manager and shared picker text without losing draft',async()=>{
  const app=setup();app.open();await select('D:\\draft');app.setLocale('zh-CN');
  assert.equal(screen.getByRole('dialog').getAttribute('aria-label'),'目录设置 · Alpha');assert.ok(screen.getByText('D:\\draft'));
  click('添加目录');assert.equal(screen.getByRole('dialog').getAttribute('aria-label'),'选择目录');
  assert.ok(screen.getByRole('button',{name:'添加目录'}));assert.ok(screen.getByRole('button',{name:'取消'}));
  app.setLocale('en');assert.equal(screen.getByRole('dialog').getAttribute('aria-label'),'Choose directory');
  click('Cancel');assert.ok(screen.getByText('D:\\draft'));assert.equal(app.form.mutate.mock.callCount(),0);
});

test('Chinese primary constraint visible; main close does not save',()=>{
  const app=setup({locale:'zh-CN'});app.open();assert.ok(screen.getByText(/主目录不可移除/));
  assert.equal(screen.getByRole('button',{name:'移除 '+root}).disabled,true);
  click('关闭');assert.equal(screen.queryByRole('dialog'),null);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('local modal autofocus, Tab containment, Escape and focus restoration use real implementation',()=>{
  const app=setup();const trigger=screen.getByRole('button',{name:'Open workspace menu'});trigger.focus();app.open();
  const closeButton=screen.getByRole('button',{name:'Close',exact:true});
  assert.ok(document.activeElement===closeButton);
  fireEvent.keyDown(closeButton,{key:'Tab',shiftKey:true});assert.ok(document.activeElement===save(),document.activeElement.outerHTML);
  fireEvent.keyDown(save(),{key:'Tab'});assert.ok(document.activeElement===closeButton);
  fireEvent.keyDown(document,{key:'Escape',isComposing:true});assert.ok(screen.getByRole('dialog'));
  fireEvent.keyDown(document,{key:'Escape'});assert.equal(screen.queryByRole('dialog'),null);
  assert.ok(document.activeElement===trigger);assert.equal(app.form.mutate.mock.callCount(),0);
});

test('Escape cannot dismiss while saving; backdrop dismisses only when idle',async()=>{
  let finish;
  const app=setup({mutate:()=>new Promise(resolve=>{finish=resolve;})});app.open();click('Save and authorize');
  fireEvent.keyDown(document,{key:'Escape'});assert.ok(screen.getByRole('dialog'));
  fireEvent.click(document.querySelector('.trusted-paths-mask'));assert.ok(screen.getByRole('dialog'));
  await act(async()=>finish(false));
  fireEvent.click(document.querySelector('.trusted-paths-mask'));assert.equal(screen.queryByRole('dialog'),null);
});
