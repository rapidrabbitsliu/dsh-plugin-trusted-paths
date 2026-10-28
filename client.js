window.__ModuleLoader__.load({
  id: 'dsh-plugin-trusted-paths',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // Local controls mirror the native markup/token families, without Harness imports.
    const css = `
.trusted-paths-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:0;border-radius:var(--dsw-radius-md);cursor:pointer;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px;min-height:36px}
.trusted-paths-button:disabled{cursor:not-allowed;opacity:.4}
.trusted-paths-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.trusted-paths-button-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.trusted-paths-button-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.trusted-paths-button-outline{border:.5px solid var(--dsw-alias-border-l3)}
.trusted-paths-menu{width:100%;justify-content:flex-start;text-align:left;padding:6px 12px;min-height:32px;border-radius:var(--dsw-radius-sm)}
.trusted-paths-layer{pointer-events:auto;box-sizing:border-box;position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:max(24px,var(--dsh-frame-overlay-top,24px)) 24px}
.trusted-paths-mask{position:absolute;inset:var(--dsh-frame-chrome-top,0px) 0 0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.trusted-paths-dialog{box-sizing:border-box;position:relative;z-index:1;display:flex;flex-direction:column;gap:20px;width:min(560px,100%);max-height:100%;overflow:auto;padding:0 0 24px;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent)}
.trusted-paths-dialog:focus{outline:none}
.trusted-paths-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 0 24px}
.trusted-paths-title{margin:0;font-size:16px;line-height:24px;font-weight:500}
.trusted-paths-body{padding:0 24px;min-width:0}
.trusted-paths-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 24px}
`;
    function Button({variant='ghost',className='',...props}) {
      return h('button',{type:'button',className:'trusted-paths-button trusted-paths-button-'+variant+' '+className,...props});
    }
    function MenuItemButton({onSelect,children}) {
      return h(React.Fragment,null,h('style',null,css),h(Button,{role:'menuitem',className:'trusted-paths-menu',onClick:onSelect},children));
    }
    function Modal({open,onClose,title,closeLabel,children,footer}) {
      const dialog=React.useRef(null);
      const close=React.useRef(onClose);close.current=onClose;
      React.useLayoutEffect(()=>{
        const element=dialog.current;if(!open||!element)return;
        const doc=element.ownerDocument,previous=doc.activeElement;
        const selector='button,input,textarea,select,a[href],[tabindex="0"]';
        const controls=()=>[...element.querySelectorAll(selector)].filter(item=>!item.disabled&&!item.closest('[hidden],[inert]'));
        (element.querySelector('[data-modal-autofocus]')??controls()[0]??element).focus({preventScroll:true});
        let composing=false;
        const start=()=>{composing=true;},end=()=>{composing=false;};
        const keydown=event=>{
          if(event.defaultPrevented||event.isComposing||composing||event.keyCode===229||event.ctrlKey||event.altKey||event.metaKey)return;
          const foreground=[...doc.querySelectorAll('[role="dialog"][aria-modal="true"],[role="menu"]')].at(-1);
          if(foreground!==element)return;
          if(event.key==='Escape'&&!event.shiftKey){event.preventDefault();event.stopPropagation();if(!event.repeat)close.current();return;}
          if(event.key!=='Tab')return;
          const items=controls(),first=items[0]??element,last=items.at(-1)??element;
          if(!element.contains(doc.activeElement)||doc.activeElement===element||doc.activeElement===(event.shiftKey?first:last)){
            event.preventDefault();(event.shiftKey?last:first).focus();
          }
        };
        doc.addEventListener('keydown',keydown);doc.addEventListener('compositionstart',start);doc.addEventListener('compositionend',end);
        return ()=>{
          doc.removeEventListener('keydown',keydown);doc.removeEventListener('compositionstart',start);doc.removeEventListener('compositionend',end);
          if(previous?.isConnected)previous.focus({preventScroll:true});
        };
      },[open]);
      if(!open)return null;
      return h('div',{className:'trusted-paths-layer',role:'presentation'},h('style',null,css),
        h('div',{className:'trusted-paths-mask','aria-hidden':true,onClick:onClose}),
        h('section',{ref:dialog,tabIndex:-1,className:'trusted-paths-dialog',role:'dialog','aria-modal':true,'aria-label':title,'data-shortcut-modal':'trusted-paths'},
          h('header',{className:'trusted-paths-header'},h('h2',{className:'trusted-paths-title'},title),h(Button,{'aria-label':closeLabel,onClick:onClose},'×')),
          h('div',{className:'trusted-paths-body'},children),h('footer',{className:'trusted-paths-footer'},footer)));
    }
    const dict = {
      zh: {
        menu:'目录设置', close:'关闭', cancel:'取消', save:'保存并授权', saving:'保存中…', loading:'正在读取配置…',
        unavailable:'配置暂不可用，请关闭浮层并刷新页面后重试。', primary:'主目录', folders:'目录',
        refused:'配置被拒绝，请检查路径或重新打开后重试',
        warning:'主目录用于此工作区以后新建的会话；已有会话保留原工作目录。保存后新增目录才获内部读写授权。移除不会删除文件，请先停止相关终端和任务。',
        add:'添加目录', remove:'移除', browse:'选择目录',
        primaryHint:'主目录不可移除；请先将其他目录设为主目录。至少保留一个目录。',
        duplicate:'此目录已在列表中，无需重复添加。'
      },
      en: {
        menu:'Folder settings', close:'Close', cancel:'Cancel', save:'Save and authorize', saving:'Saving…', loading:'Loading…',
        unavailable:'Configuration is unavailable. Close this dialog and refresh the page to retry.', primary:'Primary folder', folders:'Folders',
        refused:'Configuration refused. Check paths or reopen and retry.',
        warning:'The primary folder applies to new sessions. Existing sessions keep their working directories. Added folders receive read/write authorization only after saving. Removal never deletes files; stop related tasks first.',
        add:'Add folder', remove:'Remove', browse:'Choose directory',
        primaryHint:'To remove the primary folder, first make another folder primary. At least one folder must remain.',
        duplicate:'This folder is already in the list. No need to add it again.'
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
      inject:['slots','locale','configForms','directoryBrowser'],
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
          const [browser,setBrowser] = React.useState(false);
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
          function selectDirectory(path) {
            if(!editable||!path?.trim())return;
            setBrowser(false);
            if(pathKey(primary)===pathKey(path)||refs.some(p=>pathKey(p)===pathKey(path))) {
              setError(t('duplicate'));return;
            }
            setRefs([...refs,path]);setError('');
          }
          function makePrimary(path) {
            if(!editable||path===primary)return;
            setRefs(uniqueRefs([primary,...refs],path));setPrimary(path);setError('');
          }
          async function save() {
            if(!editable||browser||!primary?.trim())return;
            setBusy(true);setError('');
            try {
              const entry={workspaceId:target.workspaceId,primaryFolder:primary.trim(),references:uniqueRefs(refs,primary)};
              const rest=original.current.filter(w=>w.workspaceId!==target.workspaceId && !( !w.workspaceId && w.primaryFolder.toLowerCase()===target.path.toLowerCase()));
              const ok=await form.mutate([{op:'set',path:['workspaces'],value:[...rest,entry]}],revision.current);
              if(!ok)throw new Error(t('refused'));
              publish(null);
            }catch(e){setError(String(e.message??e));}finally{setBusy(false);}
          }
          const close=()=>{if(!busy)publish(null);};
          // Keep this component mounted (and its draft intact), but never nest two Modals.
          if(browser)return ctx.directoryBrowser.render({
            open:true,busy:!editable,initialPath:primary,title:t('browse'),confirmLabel:t('add'),
            onPicked:selectDirectory,onCancel:()=>{if(!busy)setBrowser(false);}
          });
          const footer=h(React.Fragment,null,
            h(Button,{variant:'outline',disabled:busy,onClick:close},t('cancel')),
            h(Button,{variant:'primary',disabled:!editable||!primary?.trim(),onClick:save},t(busy?'saving':'save')));
          return h(Modal,{open:true,onClose:close,closeLabel:t('close'),title:t('menu')+' · '+target.displayTitle,footer},
            h('div',{style:{display:'grid',gap:16,color:'var(--dsw-alias-label-primary)'}},
              h('p',null,t('warning')),
              primary===null?h('p',{role:'status'},t(state.status==='unavailable'?'unavailable':'loading')):h(React.Fragment,null,
                h('div',null,h('h3',null,t('folders')),
                  h('ul',{'aria-label':t('folders'),style:{listStyle:'none',padding:0,margin:0}},[primary,...refs].map(path=>{
                    const isPrimary=path===primary;
                    return h('li',{key:path,style:{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,overflowWrap:'anywhere',marginBottom:12}},
                      h('label',{style:{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}},
                        h('input',{type:'radio',name:'trusted-paths-primary',checked:isPrimary,disabled:!editable,'aria-label':t('primary')+' '+path,onChange:()=>makePrimary(path)}),
                        h('span',null,path)),
                      isPrimary?h('span',{'data-primary-badge':true,style:{fontSize:12,fontWeight:600}},t('primary')):null,
                      h(Button,{variant:'outline',disabled:!editable||isPrimary,'aria-label':t('remove')+' '+path,'aria-describedby':isPrimary?'trusted-paths-primary-hint':undefined,onClick:()=>{if(editable&&!isPrimary)setRefs(refs.filter(p=>p!==path));}},t('remove')));
                  })),
                  h('p',{id:'trusted-paths-primary-hint'},t('primaryHint')),
                  h(Button,{variant:'outline',disabled:!editable,onClick:()=>{if(editable){setError('');setBrowser(true);}}},t('add')))),
              h('p',{role:'status','aria-live':'polite',style:{color:'var(--dsw-alias-state-error-primary)'}},error)));
        }
        ctx.slots.inject('sidebar.workspaces.workspace.menu.item',()=>ctx.slots.register({name:'sidebar.workspaces.workspace.menu.item',id:'trusted-paths',order:100},MenuEntry));
        ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'trusted-paths-dialog',order:100},Overlay));
      },
    };
  },
});
