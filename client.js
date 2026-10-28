window.__ModuleLoader__.load({
  id: 'dsh-plugin-trusted-paths',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const {Modal, Button, MenuItemButton} = require('@deepseek-ai/dsh-client-ui-primitives');
    const dict = {
      zh: {
        menu:'目录设置', close:'关闭', cancel:'取消', save:'保存并授权', saving:'保存中…', loading:'正在读取配置…',
        unavailable:'配置暂不可用，请关闭浮层并刷新页面后重试。', primary:'主目录', refs:'引用目录',
        refused:'配置被拒绝，请检查路径或重新打开后重试',
        warning:'主目录用于此工作区以后新建的会话；已有会话保留原工作目录。新增引用即授权内部读写，移除不会删除文件。删除前请停止相关终端和任务。',
        choose:'选择文件夹', add:'添加引用目录', remove:'移除', emptyRefs:'尚无引用目录', browse:'选择目录',
        current:'当前路径', parent:'上级目录', home:'主文件夹', scanning:'正在读取目录…', select:'选择当前目录',
        retry:'重试', listError:'无法读取目录：', empty:'此目录下没有子目录', truncated:'子目录过多，仅显示部分结果。',
        duplicate:'此目录已是主目录或引用目录，请选择其他目录。'
      },
      en: {
        menu:'Folder settings', close:'Close', cancel:'Cancel', save:'Save and authorize', saving:'Saving…', loading:'Loading…',
        unavailable:'Configuration is unavailable. Close this dialog and refresh the page to retry.', primary:'Primary folder', refs:'References',
        refused:'Configuration refused. Check paths or reopen and retry.',
        warning:'The primary folder applies to new sessions. Existing sessions keep their working directories. Adding references authorizes reads and writes. Removing references never deletes files; stop related tasks first.',
        choose:'Choose folder', add:'Add reference folder', remove:'Remove', emptyRefs:'No reference folders', browse:'Choose directory',
        current:'Current path', parent:'Parent folder', home:'Home folder', scanning:'Loading directories…', select:'Select current folder',
        retry:'Retry', listError:'Cannot list directory: ', empty:'No subdirectories', truncated:'Only some subdirectories are shown because this directory is too large.',
        duplicate:'This folder is already the primary or a reference folder. Choose another folder.'
      }
    };
    // Windows paths compare case-insensitively; POSIX paths remain case-sensitive.
    const pathKey = path => {
      const value = path.trim();
      return /^[a-z]:[\\/]|^\\\\/i.test(value)
        ? value.replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase()
        : value.replace(/\/+$/,'') || '/';
    };
    const uniqueRefs = (paths, primary) => [...new Map(paths.filter(p=>p.trim()&&pathKey(p)!==pathKey(primary)).map(p=>[pathKey(p),p])).values()];
    return {
      inject:['slots','locale','configForms','uiWorkspace'],
      apply(ctx) {
        ctx.effect(()=>ctx.locale.register('trusted-paths','zh',dict.zh));
        ctx.effect(()=>ctx.locale.register('trusted-paths','en',dict.en));
        const t = ctx.locale.bind('trusted-paths');
        function useLocale() {
          React.useSyncExternalStore(ctx.locale.subscribe.bind(ctx.locale),ctx.locale.getSnapshot.bind(ctx.locale));
        }
        const mirror = ctx.configForms.describe();
        function resolveForm() {
          const views = mirror.getSnapshot().view?.namespaces ?? [];
          const entry = views.find(v => v.ns === 'local-trusted-paths') ?? views.find(v => v.ns === 'include:local-trusted-paths');
          return ctx.configForms.get(entry?.ns ?? 'local-trusted-paths');
        }
        let pending = null;
        const listeners = new Set();
        const publish = value => {pending=value; for(const listener of listeners) listener();};
        function MenuEntry({workspaceId,path,displayTitle,useMenuOpenState}) {
          useLocale();
          const [,setOpen] = useMenuOpenState();
          return h(MenuItemButton,{onSelect:()=>{publish({workspaceId,path,displayTitle});setOpen(false);}},t('menu'));
        }
        function Overlay() {
          const target = React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>pending);
          if (!target) return null;
          return h(WorkspaceDialog,{key:target.workspaceId,target});
        }
        function WorkspaceDialog({target}) {
          React.useSyncExternalStore(mirror.subscribe.bind(mirror),mirror.getSnapshot.bind(mirror));
          const form = resolveForm();
          const state = React.useSyncExternalStore(form.subscribe.bind(form),form.getSnapshot.bind(form));
          const [primary,setPrimary] = React.useState(null);
          const [refs,setRefs] = React.useState([]);
          const [busy,setBusy] = React.useState(false);
          const [error,setError] = React.useState('');
          const [browser,setBrowser] = React.useState(null);
          const [listing,setListing] = React.useState(null);
          const [scanning,setScanning] = React.useState(false);
          const [listError,setListError] = React.useState('');
          const scan = React.useRef(null);
          const revision = React.useRef();
          const original = React.useRef([]);
          useLocale();
          const editable = state.status==='ready' && state.writable && !busy;
          React.useEffect(()=>{
            if(state.status!=='ready'||primary!==null)return;
            original.current = state.value?.workspaces ?? [];
            const entry = original.current.find(w=>w.workspaceId===target.workspaceId) ?? original.current.find(w=>!w.workspaceId && w.primaryFolder.toLowerCase()===target.path.toLowerCase());
            const folder = entry?.primaryFolder ?? target.path;
            setPrimary(folder);
            setRefs(uniqueRefs(entry?.references ?? [],folder));
            revision.current = state.revision;
          },[state,primary,target]);
          React.useEffect(()=>{
            if(!browser)return;
            const controller = new AbortController();
            scan.current = controller;
            setScanning(true);setListing(null);setListError('');
            (async()=>{
              try {
                const result = await ctx.uiWorkspace.listDirectory(browser.path,controller.signal);
                if(!controller.signal.aborted)setListing(result);
              }catch(e){if(!controller.signal.aborted)setListError(String(e.message??e));}
              finally{if(!controller.signal.aborted)setScanning(false);}
            })();
            return ()=>{controller.abort();if(scan.current===controller)scan.current=null;};
          },[browser]);
          function cancelBrowser() {
            scan.current?.abort();setBrowser(null);setListing(null);setScanning(false);setListError('');
          }
          function browse(kind) {
            if(!editable||primary===null)return;
            setError('');setBrowser({kind,path:primary||undefined});
          }
          function navigate(path) {
            if(!editable)return;
            scan.current?.abort();setListing(null);setScanning(true);setListError('');
            setBrowser({...browser,path});
          }
          function selectDirectory() {
            if(!editable||scanning||!listing||!browser)return;
            const path=listing.path;
            if(browser.kind==='primary' ? refs.some(p=>pathKey(p)===pathKey(path)) : pathKey(primary)===pathKey(path)||refs.some(p=>pathKey(p)===pathKey(path))) {
              setError(t('duplicate'));return;
            }
            if(browser.kind==='primary')setPrimary(path);else setRefs([...refs,path]);
            setError('');cancelBrowser();
          }
          async function save() {
            if(!editable||browser||scanning||!primary?.trim())return;
            setBusy(true);setError('');
            try {
              const entry={workspaceId:target.workspaceId,primaryFolder:primary.trim(),references:uniqueRefs(refs,primary)};
              const rest=original.current.filter(w=>w.workspaceId!==target.workspaceId && !( !w.workspaceId && w.primaryFolder.toLowerCase()===target.path.toLowerCase()));
              const ok=await form.mutate([{op:'set',path:['workspaces'],value:[...rest,entry]}],revision.current);
              if(!ok)throw new Error(t('refused'));
              publish(null);
            }catch(e){setError(String(e.message??e));}finally{setBusy(false);}
          }
          const close=()=>{if(!busy){if(browser){setError('');cancelBrowser();}else publish(null);}};
          const inputStyle={width:'100%',boxSizing:'border-box',padding:10,borderRadius:8,border:'1px solid var(--dsw-alias-border-l2)',background:'var(--dsw-alias-bg-base)',color:'var(--dsw-alias-label-primary)',font:'inherit'};
          const parent=listing?.crumbs[listing.crumbs.length-2];
          const footer=browser
            ? h(React.Fragment,null,h(Button,{variant:'outline',onClick:close},t('cancel')),h(Button,{variant:'primary',disabled:!editable||scanning||!listing,onClick:selectDirectory},t('select')))
            : h(React.Fragment,null,h(Button,{variant:'outline',disabled:busy,onClick:close},t('cancel')),h(Button,{variant:'primary',disabled:!editable||scanning||!primary?.trim(),onClick:save},t(busy?'saving':'save')));
          return h(Modal,{open:true,onClose:close,closeLabel:t('close'),title:t(browser?'browse':'menu')+' · '+target.displayTitle,footer},
            h('div',{style:{display:'grid',gap:16,color:'var(--dsw-alias-label-primary)'}},
              browser ? h(React.Fragment,null,
                h('label',{style:{display:'grid',gap:8}},t('current'),h('input',{value:listing?.path??browser.path??'',readOnly:true,style:inputStyle})),
                h('div',{style:{display:'flex',gap:8}},
                  h(Button,{variant:'outline',disabled:!editable||scanning||!parent,onClick:()=>navigate(parent.path)},t('parent')),
                  h(Button,{variant:'outline',disabled:!editable||scanning,onClick:()=>navigate(listing?.home)},t('home'))),
                scanning?h('p',{role:'status'},t('scanning')):null,
                listError?h('div',null,h('p',{role:'alert'},t('listError')+listError),h(Button,{variant:'outline',disabled:!editable,onClick:()=>navigate(browser.path)},t('retry'))):null,
                listing?h(React.Fragment,null,
                  h('ul',{style:{listStyle:'none',padding:0,margin:0,maxHeight:280,overflowY:'auto'}},listing.entries.map(entry=>h('li',{key:entry.path},h(Button,{variant:'outline',disabled:!editable,onClick:()=>{setError('');navigate(entry.path);},style:{width:'100%',textAlign:'left',overflowWrap:'anywhere'}},entry.name)))),
                  !listing.entries.length?h('p',null,t('empty')):null,
                  listing.truncated?h('p',{role:'status'},t('truncated')):null):null)
              : h(React.Fragment,null,h('p',null,t('warning')),
                primary===null?h('p',{role:'status'},t(state.status==='unavailable'?'unavailable':'loading')):h(React.Fragment,null,
                  h('label',{style:{display:'grid',gap:8}},t('primary'),h('input',{'data-modal-autofocus':true,value:primary,readOnly:true,disabled:busy,style:inputStyle})),
                  h(Button,{variant:'outline',disabled:!editable,onClick:()=>browse('primary')},t('choose')),
                  h('div',null,h('h3',null,t('refs')),
                    refs.length?h('ul',{style:{paddingLeft:20}},refs.map(path=>h('li',{key:path,style:{overflowWrap:'anywhere',marginBottom:8}},h('span',null,path),' ',h(Button,{variant:'outline',disabled:!editable,'aria-label':t('remove')+' '+path,onClick:()=>{if(editable)setRefs(refs.filter(p=>p!==path));}},t('remove'))))):h('p',null,t('emptyRefs')),
                    h(Button,{variant:'outline',disabled:!editable,onClick:()=>browse('reference')},t('add'))))),
              h('p',{role:'status','aria-live':'polite',style:{color:'var(--dsw-alias-state-error-primary)'}},error)));
        }
        ctx.slots.inject('sidebar.workspaces.workspace.menu.item',()=>ctx.slots.register({name:'sidebar.workspaces.workspace.menu.item',id:'trusted-paths',order:100},MenuEntry));
        ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'trusted-paths-dialog',order:100},Overlay));
      },
    };
  },
});
