(function(){'use strict';
  const FALLBACK_THEMES = [
    {id:'classic',name:'Classic Blue',slug:'classic',category:'FREE',description:'Giao diện mặc định của HTVVM Studio: sạch, xanh, hiện đại và dễ học dài giờ.',premium:false,price:0,accent:'#2563eb',preview:'classic',icon:'◆',dark:false},
    {id:'anime',name:'Anime',slug:'anime',category:'PREMIUM',description:'Hồng tím năng lượng, mềm và rực rỡ; phong cách minh họa trừu tượng.',premium:true,price:2500,accent:'#ec4899',preview:'anime',icon:'✦',dark:true},
    {id:'football',name:'Bóng đá',slug:'football',category:'PREMIUM',description:'Cỏ sân, bảng điện tử và ánh đèn sân vận động.',premium:true,price:2500,accent:'#16a34a',preview:'football',icon:'◉',dark:true},
    {id:'volleyball',name:'Bóng chuyền',slug:'volleyball',category:'PREMIUM',description:'Cam vàng thể thao, sáng và giàu năng lượng.',premium:true,price:2500,accent:'#f97316',preview:'volleyball',icon:'◌',dark:false},
    {id:'magic',name:'Phép thuật',slug:'magic',category:'PREMIUM',description:'Tím/cyan, rune và ánh sáng ma thuật trừu tượng.',premium:true,price:2500,accent:'#8b5cf6',preview:'magic',icon:'✧',dark:true},
    {id:'ice',name:'Băng tuyết',slug:'ice',category:'PREMIUM',description:'Kính mờ, xanh băng và các đường tinh thể.',premium:true,price:2500,accent:'#0ea5e9',preview:'ice',icon:'✣',dark:false},
    {id:'fire',name:'Lửa',slug:'fire',category:'PREMIUM',description:'Đỏ cam mạnh, điểm sáng như than hồng.',premium:true,price:2500,accent:'#ef4444',preview:'fire',icon:'▲',dark:true},
    {id:'space',name:'Không gian',slug:'space',category:'PREMIUM',description:'Nền đêm sâu, quỹ đạo và ánh sáng neon tiết chế.',premium:true,price:2500,accent:'#6366f1',preview:'space',icon:'✦',dark:true},
    {id:'cyber',name:'Cyber Grid',slug:'cyber',category:'PREMIUM',description:'Lưới điện tử, cyan neon và đường quét kỹ thuật số.',premium:true,price:2500,accent:'#06b6d4',preview:'cyber',icon:'⌘',dark:true},
    {id:'chemistry',name:'Hóa học',slug:'chemistry',category:'PREMIUM',description:'Molecule glow, glass lab và cyan/emerald.',premium:true,price:2500,accent:'#14b8a6',preview:'chemistry',icon:'⚗',dark:true},
    {id:'aurora',name:'Aurora',slug:'aurora',category:'PREMIUM',description:'Dải cực quang chuyển động dịu, dành cho học dài giờ.',premium:true,price:2500,accent:'#22c55e',preview:'aurora',icon:'≈',dark:true},
    {id:'fantasy',name:'Fantasy',slug:'fantasy',category:'PREMIUM',description:'Rune, tinh thể và ánh tím cổ tích trừu tượng.',premium:true,price:2500,accent:'#a855f7',preview:'fantasy',icon:'◇',dark:true},
    {id:'minimal-dark',name:'Minimal Dark',slug:'minimal-dark',category:'PREMIUM',description:'Dark tối giản, tương phản cao, không làm xao nhãng.',premium:true,price:2500,accent:'#64748b',preview:'minimal-dark',icon:'●',dark:true}
  ];

  const state={catalog:[],owned:new Set(),wallet:{balance:0},accent:localStorage.getItem('htvvm_accent')||'#2563eb',theme:localStorage.getItem('htvvm_theme_id')||'classic',previewTheme:null,previewTimer:null,previewReturn:null};
  const $=id=>document.getElementById(id);
  const safeCatalog=()=>state.catalog.length?state.catalog:FALLBACK_THEMES;

  function normalizeTheme(t){
    return {
      id:String(t.id||'classic'),name:t.name||'Theme',slug:t.slug||t.id||'classic',category:t.category||((t.premium)?'PREMIUM':'FREE'),
      description:t.description||'Giao diện HTVVM Studio.',premium:!!t.premium,price:Number(t.price||2500),accent:t.accent||'#2563eb',
      preview:t.preview||t.id||'classic',icon:t.icon||'✦',dark:!!t.dark || ['minimal-dark','space','cyber','magic','fire','chemistry','aurora','fantasy','anime','football'].includes(t.id)
    };
  }

  function hexToRgb(hex){const m=String(hex).replace('#','').match(/^([0-9a-f]{6})$/i);if(!m)return null;const n=parseInt(m[1],16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function luminance(hex){const c=hexToRgb(hex);if(!c)return .5;const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);}
  function mix(hex,target,amount){const c=hexToRgb(hex);if(!c)return hex;const t=target==='white'?255:0;const a=Math.min(1,Math.max(0,amount));return '#'+[c.r,c.g,c.b].map(v=>Math.round(v+(t-v)*a).toString(16).padStart(2,'0')).join('');}

  function applyAccent(hex,{persist=true}={}){
    if(!/^#[0-9a-f]{6}$/i.test(hex))return false;
    state.accent=hex;
    const root=document.documentElement;
    const text=luminance(hex)>.56?'#0f172a':'#ffffff';
    root.style.setProperty('--accent',hex);
    root.style.setProperty('--accent-soft',mix(hex,'white',.88));
    root.style.setProperty('--accent-strong',mix(hex,'black',.18));
    root.style.setProperty('--accent-text',text);
    root.style.setProperty('--accent-border',mix(hex,'white',.5));
    root.style.setProperty('--accent-glow',`rgba(${hexToRgb(hex).r},${hexToRgb(hex).g},${hexToRgb(hex).b},.24)`);
    document.body?.classList.add('accent-enabled');
    if(persist)localStorage.setItem('htvvm_accent',hex);
    return true;
  }

  function themeVars(theme){
    const a=theme.accent;
    const palettes={
      classic:{bg:'#f5f9ff',surface:'#ffffff',surface2:'#eff6ff',text:'#0f172a',muted:'#64748b',border:'#dbeafe'},
      anime:{bg:'#100a19',surface:'#171024',surface2:'#25143a',text:'#fdf4ff',muted:'#d8b4fe',border:'#6b21a8'},
      football:{bg:'#07140c',surface:'#0d2114',surface2:'#12341f',text:'#f0fdf4',muted:'#a7f3d0',border:'#166534'},
      volleyball:{bg:'#fffaf3',surface:'#ffffff',surface2:'#fff1dc',text:'#431407',muted:'#9a3412',border:'#fed7aa'},
      magic:{bg:'#0d0a1b',surface:'#151029',surface2:'#21183f',text:'#f5f3ff',muted:'#c4b5fd',border:'#6d28d9'},
      ice:{bg:'#edf8ff',surface:'#ffffff',surface2:'#e0f2fe',text:'#082f49',muted:'#0369a1',border:'#bae6fd'},
      fire:{bg:'#160907',surface:'#24100d',surface2:'#3a1710',text:'#fff7ed',muted:'#fdba74',border:'#9a3412'},
      space:{bg:'#060915',surface:'#0d1224',surface2:'#141b36',text:'#eef2ff',muted:'#a5b4fc',border:'#312e81'},
      cyber:{bg:'#041014',surface:'#081c22',surface2:'#0d2b34',text:'#ecfeff',muted:'#67e8f9',border:'#0e7490'},
      chemistry:{bg:'#04130f',surface:'#081f19',surface2:'#0d3026',text:'#ecfdf5',muted:'#6ee7b7',border:'#0f766e'},
      aurora:{bg:'#06110f',surface:'#0b201b',surface2:'#0f3428',text:'#f0fdf4',muted:'#86efac',border:'#15803d'},
      fantasy:{bg:'#11091a',surface:'#1a1028',surface2:'#29143b',text:'#faf5ff',muted:'#d8b4fe',border:'#7e22ce'},
      'minimal-dark':{bg:'#0b0e13',surface:'#121720',surface2:'#1a2230',text:'#f8fafc',muted:'#cbd5e1',border:'#334155'}
    };
    return palettes[theme.id]||palettes.classic;
  }

  function setThemeVars(theme,{persist=true,force=false}={}){
    const t=normalizeTheme(theme);
    if(t.premium&&!state.owned.has(t.id)&&!force)return false;
    state.theme=t.id;
    const root=document.documentElement, p=themeVars(t);
    root.style.setProperty('--theme-bg',p.bg);root.style.setProperty('--theme-surface',p.surface);root.style.setProperty('--theme-surface-2',p.surface2);
    root.style.setProperty('--theme-text',p.text);root.style.setProperty('--theme-muted',p.muted);root.style.setProperty('--theme-border',p.border);
    document.body.dataset.theme=t.slug; document.body.classList.toggle('theme-dark',!!t.dark);
    root.style.setProperty('--theme-accent',t.accent);
    applyAccent(t.accent,{persist:false});
    if(persist)localStorage.setItem('htvvm_theme_id',t.id);
    return true;
  }

  function applyTheme(id,opts={}){const t=safeCatalog().map(normalizeTheme).find(x=>x.id===id)||normalizeTheme(FALLBACK_THEMES[0]);return setThemeVars(t,opts);}

  function iconSvg(theme){
    const id=theme.id;
    const symbols={classic:'M12 2l8 6-3 10H7L4 8z',anime:'M5 19l7-14 7 14-7-3z',football:'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4l2 2-1 3h-2l-1-3 2-2z',volleyball:'M6 6c3-2 8-1 11 3l-4 2-4-2z',magic:'M12 2l2.2 6.2L21 10l-5 4.2L17.3 21 12 17.5 6.7 21 8 14.2 3 10l6.8-1.8z',ice:'M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1',fire:'M12 2c2 5-2 6-2 10 0 2.2 1.5 4 3.4 4 2.2 0 3.6-2 3.6-4 1 1 2 2.6 2 5a7 7 0 11-14 0c0-4 2.5-7 4-9 1.4-1.9 1.6-3.6 1-6z',space:'M12 2a10 10 0 100 20 10 10 0 000-20zm-8 10h16M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',cyber:'M4 4h16v16H4zM8 8h8v8H8zM2 9h2m16 0h2M9 2v2m0 16v2m6-20v2m0 16v2',chemistry:'M9 3h6m-4 0v5l-6 9a2 2 0 002 3h10a2 2 0 002-3l-6-9V3',aurora:'M2 16c4-6 8 6 12 0s8-6 8 0M2 11c4-6 8 6 12 0s8-6 8 0',fantasy:'M12 2l2.3 6.1L21 11l-5.2 3.8L17.5 21 12 17.2 6.5 21l1.7-6.2L3 11l6.7-2.9z', 'minimal-dark':'M5 5h14v14H5z'};
    const path=symbols[id]||symbols.classic;
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function previewMarkup(theme){
    const p=themeVars(theme); const a=theme.accent; const second=mix(a,'white',.2);
    return `<div class="theme-shot theme-shot--${theme.preview}" style="--shot-a:${a};--shot-b:${second};--shot-bg:${p.bg};--shot-surface:${p.surface};--shot-surface-2:${p.surface2};--shot-text:${p.text};--shot-muted:${p.muted};--shot-border:${p.border}">
      <div class="shot-ambience"></div>
      <div class="shot-top"><div class="shot-brand"><span class="shot-icon">${iconSvg(theme)}</span><span>HTVVM</span></div><div class="shot-dots"><i></i><i></i><i></i></div></div>
      <div class="shot-body">
        <aside class="shot-side"><b></b><b></b><b></b><b></b><b></b></aside>
        <main class="shot-main"><div class="shot-stats"><span>2h 35m</span><span>12 🪙</span><span>5 ngày</span></div><div class="shot-content"><div class="shot-timer"><div class="shot-ring"><strong>25:00</strong></div><div class="shot-pills"><em></em><em class="active"></em><em></em></div></div><div class="shot-board"><div class="shot-line w1"></div><div class="shot-line w2"></div><div class="shot-line w3"></div><div class="shot-users"><i></i><i></i><i></i></div></div></div></main>
      </div>
    </div>`;
  }

  function previewStyle(theme){return previewMarkup(theme);}

  function previewModal(theme){
    closePreview();
    const overlay=document.createElement('div'); overlay.id='hl-theme-preview-modal';overlay.className='hl-theme-preview-modal';
    overlay.innerHTML=`<div class="hl-theme-preview-backdrop"></div><div class="hl-theme-preview-dialog" role="dialog" aria-modal="true"><div class="hl-theme-preview-head"><div class="flex items-center gap-3"><span class="hl-theme-icon-lg">${iconSvg(theme)}</span><div><h2 class="text-2xl font-black">${theme.name}</h2><p class="text-sm opacity-70">${theme.description}</p></div></div><button class="hl-theme-close" type="button">×</button></div><div class="hl-theme-preview-large">${previewMarkup(theme)}</div><div class="hl-theme-preview-info"><span class="theme-price">${theme.premium?'2.500 token':'FREE'}</span><span>${theme.premium?'Theme premium':'Theme miễn phí'} · Preview không trừ token</span></div><div class="hl-theme-preview-actions"><button class="hl-btn-secondary" data-action="try">▶ Dùng thử 12 giây</button><button class="hl-btn-primary" data-action="use">${state.theme===theme.id?'Đang dùng':theme.premium?(state.owned.has(theme.id)?'Dùng theme':'Mua 2.500 token'):'Dùng theme'}</button></div></div>`;
    document.body.append(overlay);
    overlay.querySelector('.hl-theme-close')?.addEventListener('click',closePreview);
    overlay.querySelector('.hl-theme-preview-backdrop')?.addEventListener('click',closePreview);
    overlay.querySelector('[data-action="try"]')?.addEventListener('click',()=>temporaryPreview(theme.id));
    overlay.querySelector('[data-action="use"]')?.addEventListener('click',async()=>{
      if(theme.premium&&!state.owned.has(theme.id)){await purchase(theme.id);}else{applyTheme(theme.id);render();closePreview();}
    });
  }

  function closePreview(){document.getElementById('hl-theme-preview-modal')?.remove();}
  function openPreview(id){const t=safeCatalog().map(normalizeTheme).find(x=>x.id===id)||normalizeTheme(FALLBACK_THEMES[0]);previewModal(t);}

  function temporaryPreview(id){
    const t=safeCatalog().map(normalizeTheme).find(x=>x.id===id);if(!t)return;
    if(!state.previewReturn)state.previewReturn={theme:state.theme,accent:state.accent};
    setThemeVars(t,{persist:false,force:true});
    document.body.classList.add('hl-theme-preview-active');
    closePreview();
    clearTimeout(state.previewTimer);
    let remaining=12; window.toast?.(`👀 Đang xem thử ${t.name} · ${remaining}s`);
    state.previewTimer=setInterval(()=>{remaining--;window.toast?.(`👀 Preview ${t.name} · ${remaining}s`);if(remaining<=0)endTemporaryPreview();},1000);
  }
  function endTemporaryPreview(){clearInterval(state.previewTimer);state.previewTimer=null;if(state.previewReturn){const old=state.previewReturn;state.previewReturn=null;applyTheme(old.theme,{persist:false,force:true});applyAccent(old.accent,{persist:false});}document.body.classList.remove('hl-theme-preview-active');window.toast?.('Đã trả lại giao diện trước đó.');render();}

  async function api(method,body){
    const user=window.auth?.currentUser;if(!user)throw Object.assign(new Error('AUTH'),{status:401});
    const token=await user.getIdToken();
    const r=await fetch('/api/themes',{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Object.assign(new Error(d.error||'Theme API error'),{status:r.status,data:d});
    return d;
  }

  async function purchase(id){
    try{const data=await api('POST',{themeId:id});state.wallet=data.wallet||state.wallet;state.owned=new Set(data.owned||[...state.owned,id]);applyTheme(id);render();closePreview();window.toast?.(data.alreadyOwned?'Theme đã sở hữu.':'✅ Mua theme thành công.');}
    catch(e){window.toast?.(e.data?.error||'Không thể mua theme.');}
  }

  function render(){
    const host=$('sec-theme-store');if(!host)return;
    const themes=safeCatalog().map(normalizeTheme);
    host.innerHTML='';
    const shell=document.createElement('div');shell.className='theme-shell';
    const head=document.createElement('div');head.className='hl-card p-6';head.innerHTML='<p class="text-xs font-black tracking-[.2em] text-blue-600 uppercase">THEME SYSTEM</p><h1 class="text-3xl font-black mt-1">Theme Store</h1><p class="text-sm text-slate-500 mt-2">Xem trước toàn bộ giao diện trước khi mua. Premium chỉ tốn token khi bạn xác nhận mua.</p>';
    const wallet=document.createElement('div');wallet.className='mt-4 flex flex-wrap items-center gap-2';wallet.innerHTML=`<span class="hl-theme-nav">🪙 Số dư: ${state.wallet.balance.toLocaleString('vi-VN')} token</span><button id="theme-support" class="px-3 py-2 rounded-xl bg-cyan-50 text-cyan-700 font-black">Nạp token qua Zalo</button>`;head.append(wallet);shell.append(head);
    const accent=document.createElement('section');accent.className='hl-card p-6';accent.innerHTML='<div class="flex items-center justify-between gap-3"><div><h2 class="font-black text-xl mb-1">FREE · Accent Color</h2><p class="text-sm text-slate-500">Màu xanh mặc định. Đổi accent sẽ đổi đồng bộ các điểm nhấn, nút, trạng thái, progress và glow.</p></div><span class="theme-badge-free">FREE</span></div>';
    const pal=document.createElement('div');pal.className='accent-palette mt-4';for(const c of ['#2563eb','#7c3aed','#dc2626','#ea580c','#eab308','#16a34a','#ec4899','#06b6d4','#14b8a6']){const b=document.createElement('button');b.className='accent-chip';b.style.background=c;b.title=c;b.setAttribute('aria-label',`Accent ${c}`);b.onclick=()=>{applyAccent(c);render();};pal.append(b);}accent.append(pal);
    const custom=document.createElement('div');custom.className='accent-custom mt-4';custom.innerHTML='<span class="text-sm font-bold">Màu tùy chỉnh</span>';const input=document.createElement('input');input.type='color';input.value=state.accent;input.oninput=e=>{applyAccent(e.target.value);render();};custom.append(input);accent.append(custom);shell.append(accent);

    const intro=document.createElement('div');intro.className='theme-catalog-intro';intro.innerHTML=`<div><span class="text-xs font-black uppercase tracking-[.18em]">13 GIAO DIỆN</span><h2 class="text-2xl font-black mt-1">Mỗi theme là một trải nghiệm riêng</h2><p class="text-sm opacity-70 mt-1">Bấm <b>Xem preview</b> để xem giao diện mô phỏng trước khi mua hoặc dùng.</p></div><span class="text-sm font-black">${themes.filter(t=>t.premium).length} Premium · ${themes.filter(t=>!t.premium).length} Free</span>`;shell.append(intro);

    const grid=document.createElement('div');grid.className='theme-grid';
    for(const theme of themes){
      const card=document.createElement('article');card.className='theme-card theme-card--'+theme.id;card.innerHTML=`<div class="theme-preview-wrap">${previewStyle(theme)}<div class="theme-preview-badges"><span class="theme-badge">${theme.premium?'PREMIUM':'FREE'}</span><span class="theme-price">${theme.premium?'2.500 token':'FREE'}</span></div></div><div class="theme-meta"><div class="theme-icon-row"><span class="theme-icon">${iconSvg(theme)}</span><div><h3 class="font-black text-lg">${theme.name}</h3><p class="text-xs text-slate-500 mt-1 leading-relaxed">${theme.description}</p></div></div></div>`;
      const actions=document.createElement('div');actions.className='theme-actions';
      const preview=document.createElement('button');preview.className='theme-preview-btn';preview.textContent='👁 Xem preview';preview.onclick=()=>openPreview(theme.id);actions.append(preview);
      if(state.theme===theme.id&&(!theme.premium||state.owned.has(theme.id))){const active=document.createElement('button');active.className='theme-apply';active.textContent='✓ Đang dùng';active.disabled=true;actions.append(active);}
      else if(theme.premium&&!state.owned.has(theme.id)){const buy=document.createElement('button');buy.className='theme-buy';buy.textContent=state.wallet.balance>=theme.price?'Mua '+theme.price.toLocaleString('vi-VN')+' token':'Cần thêm token';buy.disabled=state.wallet.balance<theme.price;buy.onclick=()=>purchase(theme.id);actions.append(buy);}
      else{const use=document.createElement('button');use.className='theme-apply';use.textContent='Dùng theme';use.onclick=()=>{applyTheme(theme.id);render();};actions.append(use);}
      card.append(actions);grid.append(card);
    }
    shell.append(grid);host.append(shell);$('theme-support')?.addEventListener('click',()=>showSupport());
  }

  async function showSupport(){try{const d=await api('GET');const s=d.support;if(s?.url)window.open(s.url,'_blank','noopener,noreferrer');else window.toast?.('Admin chưa cấu hình kênh Zalo hỗ trợ trong Vercel Environment Variables.');}catch{window.toast?.('Chưa thể tải thông tin hỗ trợ.');}}

  async function load(){
    try{const d=await api('GET');state.catalog=(d.themes||FALLBACK_THEMES).map(normalizeTheme);state.owned=new Set(d.owned||[]);state.wallet=d.wallet||{balance:0};if(!applyTheme(state.theme,{persist:false}))applyTheme('classic',{persist:false});applyAccent(state.accent,{persist:false});render();}
    catch(e){console.warn('theme system',e);state.catalog=FALLBACK_THEMES.map(normalizeTheme);if(!safeCatalog().some(t=>t.id===state.theme))state.theme='classic';applyTheme(state.theme,{persist:false,force:true});applyAccent(state.accent,{persist:false});render();}
  }

  window.HLTheme={load,render,applyAccent,applyTheme,open:()=>{switchSection('sec-theme-store');load();},openPreview,get state(){return state;},stopPreview:endTemporaryPreview};
  document.addEventListener('DOMContentLoaded',()=>{applyAccent(state.accent,{persist:false});const nav=$('#main-nav .nav-btn')?.parentElement;if(nav&&!$('#nav-theme-store')){const b=document.createElement('button');b.id='nav-theme-store';b.className='nav-btn text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all hover:bg-white';b.textContent='🎨 Giao diện';b.onclick=()=>window.HLTheme.open();nav.append(b);}if(window.auth?.currentUser)load();});
  window.addEventListener('firebase:user-ready',()=>load());
})();
