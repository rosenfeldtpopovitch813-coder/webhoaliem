(function(){'use strict';
  const TAB_LABELS={
    home:'Trang chủ',study:'Học tập',library:'Thư viện',exam:'Thi Online',community:'Cộng đồng',ai:'AI',teacher:'Giáo viên',theme:'Giao diện'
  };
  const TAB_IDS={home:'nav-home',study:'nav-study',library:'nav-library',exam:'nav-exam',community:'nav-community',theme:'nav-theme'};

  const FALLBACK_THEMES=[
    {id:'classic',name:'Classic Blue',category:'FREE',description:'Bộ giao diện mặc định với icon nét gọn, xanh chủ đạo và độ đọc cao.',premium:false,price:0,accent:'#2563eb',dark:false,icon:'classic'},
    {id:'anime',name:'Anime',category:'PREMIUM',description:'Icon mềm, bo tròn, sao lấp lánh và neon hồng-tím theo phong cách minh họa trừu tượng.',premium:true,price:2500,accent:'#ec4899',dark:true,icon:'anime'},
    {id:'football',name:'Bóng đá',category:'PREMIUM',description:'Icon thể thao, bảng điện tử, sân cỏ và hiệu ứng đèn sân vận động.',premium:true,price:2500,accent:'#16a34a',dark:true,icon:'football'},
    {id:'volleyball',name:'Bóng chuyền',category:'PREMIUM',description:'Icon chuyển động, đường cong quả bóng và palette cam-vàng giàu năng lượng.',premium:true,price:2500,accent:'#f97316',dark:false,icon:'volleyball'},
    {id:'magic',name:'Phép thuật',category:'PREMIUM',description:'Bộ rune, tinh thể và biểu tượng ma pháp phát sáng riêng cho từng tab.',premium:true,price:2500,accent:'#8b5cf6',dark:true,icon:'magic'},
    {id:'ice',name:'Băng tuyết',category:'PREMIUM',description:'Icon tinh thể sắc cạnh, kính băng và hiệu ứng frost-glow.',premium:true,price:2500,accent:'#0ea5e9',dark:false,icon:'ice'},
    {id:'fire',name:'Lửa',category:'PREMIUM',description:'Icon ngọn lửa, than hồng, đường nét mạnh và animation ember.',premium:true,price:2500,accent:'#ef4444',dark:true,icon:'fire'},
    {id:'space',name:'Không gian',category:'PREMIUM',description:'Icon hành tinh-quỹ đạo, starfield và hiệu ứng chuyển động vũ trụ.',premium:true,price:2500,accent:'#6366f1',dark:true,icon:'space'},
    {id:'cyber',name:'Cyber Grid',category:'PREMIUM',description:'Icon dạng circuit, node và pixel; sidebar phản hồi như một HUD.',premium:true,price:2500,accent:'#06b6d4',dark:true,icon:'cyber'},
    {id:'chemistry',name:'Hóa học',category:'PREMIUM',description:'Icon phân tử, bình nghiệm và bond-node; nền lab kính mờ.',premium:true,price:2500,accent:'#14b8a6',dark:true,icon:'chemistry'},
    {id:'aurora',name:'Aurora',category:'PREMIUM',description:'Icon dải sáng, gradient cực quang và chuyển động dịu cho học dài giờ.',premium:true,price:2500,accent:'#22c55e',dark:true,icon:'aurora'},
    {id:'fantasy',name:'Fantasy',category:'PREMIUM',description:'Icon kiếm, rune, sao và tinh thể; hiệu ứng phép thuật nhẹ.',premium:true,price:2500,accent:'#a855f7',dark:true,icon:'fantasy'},
    {id:'minimal-dark',name:'Minimal Dark',category:'PREMIUM',description:'Icon hình học đơn nét, tương phản cao và gần như không có animation.',premium:true,price:2500,accent:'#64748b',dark:true,icon:'minimal-dark'}
  ];

  const state={catalog:[],owned:new Set(),wallet:{balance:0},accent:localStorage.getItem('htvvm_accent')||'#2563eb',theme:localStorage.getItem('htvvm_theme_id')||'classic',previewTheme:null,previewTimer:null,previewReturn:null};
  const $=id=>document.getElementById(id);
  const safeCatalog=()=>state.catalog.length?state.catalog:FALLBACK_THEMES;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function normalizeTheme(t){
    return {id:String(t.id||'classic'),name:t.name||'Theme',category:t.category||((t.premium)?'PREMIUM':'FREE'),description:t.description||'Giao diện HTVVM Studio.',premium:!!t.premium,price:Number(t.price||2500),accent:t.accent||'#2563eb',dark:!!t.dark,icon:t.icon||t.id||'classic'};
  }
  function hexToRgb(hex){const m=String(hex).replace('#','').match(/^([0-9a-f]{6})$/i);if(!m)return null;const n=parseInt(m[1],16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function luminance(hex){const c=hexToRgb(hex);if(!c)return .5;const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);}
  function mix(hex,target,amount){const c=hexToRgb(hex);if(!c)return hex;const t=target==='white'?255:0,a=Math.min(1,Math.max(0,amount));return '#'+[c.r,c.g,c.b].map(v=>Math.round(v+(t-v)*a).toString(16).padStart(2,'0')).join('');}

  function applyAccent(hex,{persist=true}={}){
    if(!/^#[0-9a-f]{6}$/i.test(hex))return false;
    state.accent=hex;
    const rgb=hexToRgb(hex), root=document.documentElement;
    root.style.setProperty('--accent',hex); root.style.setProperty('--accent-soft',mix(hex,'white',.88));
    root.style.setProperty('--accent-strong',mix(hex,'black',.18));
    root.style.setProperty('--accent-text',luminance(hex)>.56?'#0f172a':'#ffffff');
    root.style.setProperty('--accent-border',mix(hex,'white',.5));
    root.style.setProperty('--accent-glow',`rgba(${rgb.r},${rgb.g},${rgb.b},.24)`);
    document.body?.classList.add('accent-enabled');
    if(persist)localStorage.setItem('htvvm_accent',hex);
    return true;
  }

  const PALETTES={
    classic:{bg:'#f5f9ff',surface:'#fff',surface2:'#eff6ff',text:'#0f172a',muted:'#64748b',border:'#dbeafe'},
    anime:{bg:'#100a19',surface:'#171024',surface2:'#25143a',text:'#fdf4ff',muted:'#d8b4fe',border:'#6b21a8'},
    football:{bg:'#07140c',surface:'#0d2114',surface2:'#12341f',text:'#f0fdf4',muted:'#a7f3d0',border:'#166534'},
    volleyball:{bg:'#fffaf3',surface:'#fff',surface2:'#fff1dc',text:'#431407',muted:'#9a3412',border:'#fed7aa'},
    magic:{bg:'#0d0a1b',surface:'#151029',surface2:'#21183f',text:'#f5f3ff',muted:'#c4b5fd',border:'#6d28d9'},
    ice:{bg:'#edf8ff',surface:'#fff',surface2:'#e0f2fe',text:'#082f49',muted:'#0369a1',border:'#bae6fd'},
    fire:{bg:'#160907',surface:'#24100d',surface2:'#3a1710',text:'#fff7ed',muted:'#fdba74',border:'#9a3412'},
    space:{bg:'#060915',surface:'#0d1224',surface2:'#141b36',text:'#eef2ff',muted:'#a5b4fc',border:'#312e81'},
    cyber:{bg:'#041014',surface:'#081c22',surface2:'#0d2b34',text:'#ecfeff',muted:'#67e8f9',border:'#0e7490'},
    chemistry:{bg:'#04130f',surface:'#081f19',surface2:'#0d3026',text:'#ecfdf5',muted:'#6ee7b7',border:'#0f766e'},
    aurora:{bg:'#06110f',surface:'#0b201b',surface2:'#0f3428',text:'#f0fdf4',muted:'#86efac',border:'#15803d'},
    fantasy:{bg:'#11091a',surface:'#1a1028',surface2:'#29143b',text:'#faf5ff',muted:'#d8b4fe',border:'#7e22ce'},
    'minimal-dark':{bg:'#0b0e13',surface:'#121720',surface2:'#1a2230',text:'#f8fafc',muted:'#cbd5e1',border:'#334155'}
  };

  const TAB_PATHS={
    home:'M4 12l8-8 8 8v8H4zM9 20v-6h6v6',
    study:'M4 5h16v14H4zM8 9h8M8 13h5M8 17h3',
    library:'M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2zM7 4v16M10 8h6M10 12h6',
    exam:'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4M9 18h5',
    community:'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
    ai:'M5 5h14v10H9l-4 4zM9 9h6M9 12h3',
    teacher:'M4 8l8-4 8 4-8 4zM7 11v5c2 2 8 2 10 0v-5M12 8v9',
    theme:'M12 3l2.4 5.1L20 10l-5 3.8L16.4 20 12 16.8 7.6 20 9 13.8 4 10l5.6-1.9z'
  };

  const ICON_STYLE={
    classic:'outline',anime:'spark',football:'sport',volleyball:'sport',magic:'rune',ice:'crystal',fire:'ember',space:'orbit',cyber:'circuit',chemistry:'molecule',aurora:'wave',fantasy:'rune', 'minimal-dark':'outline'
  };

  // Mỗi theme có một "icon family" riêng. Path của từng tab vẫn khác nhau,
  // còn family thêm ngôn ngữ thị giác riêng (rune/crystal/circuit/ember...).
  // Như vậy premium theme không chỉ thay màu mà thực sự đổi bộ nhận diện icon.
  const ICON_FAMILY={
    classic:'hex', anime:'spark', football:'ball', volleyball:'ball', magic:'rune',
    ice:'crystal', fire:'ember', space:'orbit', cyber:'circuit', chemistry:'molecule',
    aurora:'wave', fantasy:'rune', 'minimal-dark':'frame'
  };

  function familyFrame(theme,id){
    const f=ICON_FAMILY[theme.id]||'frame';
    const common='fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
    if(f==='hex') return `<path d="M12 1.8l8.7 5v10.4l-8.7 5-8.7-5V6.8z" ${common} stroke-width=".8" opacity=".28"/>`;
    if(f==='spark') return `<path d="M12 1.8l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6zM19 14l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" ${common} stroke-width=".85" opacity=".52"/>`;
    if(f==='ball') return `<path d="M12 1.8a10.2 10.2 0 110 20.4 10.2 10.2 0 010-20.4z" ${common} stroke-width=".8" opacity=".35"/><path d="M7 5l5 3 5-3M5.3 14l4.7-1.7 4.7 1.7M14 18l-2-3-2 3" ${common} stroke-width=".7" opacity=".45"/>`;
    if(f==='rune') return `<circle cx="12" cy="12" r="9.7" ${common} stroke-width=".8" opacity=".38" stroke-dasharray="1.5 2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" ${common} stroke-width=".75" opacity=".4"/>`;
    if(f==='crystal') return `<path d="M12 1.8l7.5 5.4-2.8 10.6L12 22.2 7.3 17.8 4.5 7.2z" ${common} stroke-width=".75" opacity=".4"/><path d="M12 2.4v19.1M4.9 7.6l14.2 9.1M19.1 7.6L4.9 16.7" ${common} stroke-width=".55" opacity=".35"/>`;
    if(f==='ember') return `<path d="M12 2.2c2.3 2.8 4.4 5 4.4 8.6 0 3.4-2.5 6.2-4.4 6.2s-4.4-2.2-4.4-5.4c0-2.2 1.1-4 2.4-5.2-.2 2.2 1 3.4 2 4 1.2-1.6.7-4.5 0-8.2z" fill="currentColor" opacity=".17"/>`;
    if(f==='orbit') return `<ellipse cx="12" cy="12" rx="10" ry="4.4" ${common} stroke-width=".8" opacity=".36" transform="rotate(-24 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.4" ${common} stroke-width=".6" opacity=".24" transform="rotate(58 12 12)"/>`;
    if(f==='circuit') return `<path d="M3 6h4V3M17 3v3h4M3 18h4v3M17 21v-3h4" ${common} stroke-width="1" opacity=".42"/><circle cx="7" cy="6" r="1.15" fill="currentColor" opacity=".48"/><circle cx="17" cy="18" r="1.15" fill="currentColor" opacity=".48"/>`;
    if(f==='molecule') return `<circle cx="12" cy="12" r="9.5" ${common} stroke-width=".65" opacity=".22" stroke-dasharray="1.2 2.2"/>`;
    if(f==='wave') return `<path d="M1.8 14c3-5 6-5 9 0s6 5 11-1" ${common} stroke-width="1" opacity=".46"/><path d="M2.6 8c2.8-3 5.8-3 8.6 0s5.8 3 10.2-.5" ${common} stroke-width=".7" opacity=".28"/>`;
    return `<rect x="3" y="3" width="18" height="18" rx="5" ${common} stroke-width=".75" opacity=".24"/>`;
  }

  function styleIconSvg(key,theme,cls=''){
    const path=TAB_PATHS[key]||TAB_PATHS.theme, style=ICON_STYLE[theme.id]||'outline';
    const common=`viewBox="0 0 24 24" class="${cls}" aria-hidden="true"`;
    const frame=familyFrame(theme,key);
    if(style==='spark') return `<svg ${common}>${frame}<path d="${path}" fill="currentColor" opacity=".95"/><path d="M19 3l.7 1.7L21.4 5l-1.7.7L19 7.4l-.7-1.7L16.6 5l1.7-.7z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
    if(style==='sport') return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.5" cy="5.5" r="1.4" fill="currentColor"/></svg>`;
    if(style==='rune') return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 2" opacity=".55"/></svg>`;
    if(style==='crystal') return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2v20M3 7l18 10M21 7L3 17" stroke="currentColor" stroke-width=".8" opacity=".45"/></svg>`;
    if(style==='ember') return `<svg ${common}>${frame}<path d="${path}" fill="currentColor" opacity=".92"/><path d="M12 4c2 2 2 3 1 5 2-1 4 1 4 4a5 5 0 11-10 0c0-2 1-4 3-5" fill="none" stroke="#fff" stroke-width="1" opacity=".5"/></svg>`;
    if(style==='orbit') return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="10" ry="4.5" fill="none" stroke="currentColor" stroke-width="1" opacity=".55" transform="rotate(-22 12 12)"/><circle cx="17" cy="7" r="1.4" fill="currentColor"/></svg>`;
    if(style==='circuit') return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 6h4M18 18h4M7 2v4M17 18v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="6" cy="6" r="1.2" fill="currentColor"/><circle cx="18" cy="18" r="1.2" fill="currentColor"/></svg>`;
    if(style==='molecule') return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="7" r="2" fill="currentColor"/><circle cx="17" cy="18" r="2" fill="currentColor"/><path d="M7 11l10-3M7 13l8 4" stroke="currentColor" stroke-width="1" opacity=".55"/></svg>`;
    if(style==='wave') return `<svg ${common}>${frame}<path d="M2 16c3-5 6-5 9 0s6 5 11-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 10c3-4 6-4 9 0s6 4 9 0" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/></svg>`;
    return `<svg ${common}>${frame}<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconSvg(theme){return styleIconSvg('theme',theme);}
  function updateRealNav(theme){
    const navMap={home:'nav-home',library:'nav-library',exam:'nav-exam',study:'nav-study',community:'nav-community',theme:'nav-theme'};
    Object.entries(navMap).forEach(([key,id])=>{
      const b=$(id);if(!b)return;
      b.dataset.themeTab=key;
      b.dataset.themeIconFamily=ICON_FAMILY[theme.id]||'frame';
      b.classList.toggle('theme-icon-premium',theme.id!=='classic');
      b.title=`${TAB_LABELS[key]} · ${theme.name}`;
      b.innerHTML=`<span class="theme-nav-icon theme-nav-icon--${theme.id}" aria-hidden="true">${styleIconSvg(key,theme)}</span><span class="theme-nav-label">${TAB_LABELS[key]}</span>`;
    });
  }

  function themeVars(theme){return PALETTES[theme.id]||PALETTES.classic;}
  function setThemeVars(theme,{persist=true,force=false}={}){
    const t=normalizeTheme(theme);if(t.premium&&!state.owned.has(t.id)&&!force)return false;
    state.theme=t.id;const root=document.documentElement,p=themeVars(t);
    root.style.setProperty('--theme-bg',p.bg);root.style.setProperty('--theme-surface',p.surface);root.style.setProperty('--theme-surface-2',p.surface2);root.style.setProperty('--theme-text',p.text);root.style.setProperty('--theme-muted',p.muted);root.style.setProperty('--theme-border',p.border);root.style.setProperty('--theme-accent',t.accent);
    document.body.dataset.theme=t.id;document.body.classList.toggle('theme-dark',!!t.dark);document.body.dataset.themeIcon=ICON_STYLE[t.id]||'outline';
    applyAccent(t.accent,{persist:false});updateRealNav(t);
    if(persist)localStorage.setItem('htvvm_theme_id',t.id);return true;
  }
  function applyTheme(id,opts={}){const t=safeCatalog().map(normalizeTheme).find(x=>x.id===id)||normalizeTheme(FALLBACK_THEMES[0]);return setThemeVars(t,opts);}

  function iconTabStrip(theme){
    const items=['home','study','library','exam','community','ai','teacher','theme'];
    return `<div class="shot-tabs">${items.map((k,i)=>`<div class="shot-tab ${i===0?'is-active':''}"><span>${styleIconSvg(k,theme)}</span><em>${TAB_LABELS[k]}</em></div>`).join('')}</div>`;
  }
  function previewMarkup(theme){
    const p=themeVars(theme),a=theme.accent,second=mix(a,'white',.2);
    return `<div class="theme-shot theme-shot--${theme.id}" style="--shot-a:${a};--shot-b:${second};--shot-bg:${p.bg};--shot-surface:${p.surface};--shot-surface-2:${p.surface2};--shot-text:${p.text};--shot-muted:${p.muted};--shot-border:${p.border}">
      <div class="shot-ambience"></div>
      <div class="shot-top"><div class="shot-brand"><span class="shot-icon">${iconSvg(theme)}</span><span>HTVVM STUDIO</span></div><div class="shot-dots"><i></i><i></i><i></i></div></div>
      <div class="shot-body"><aside class="shot-side"><b></b><b></b><b></b><b></b><b></b><b></b></aside><main class="shot-main"><div class="shot-stats"><span>2h 35m</span><span>12 🪙</span><span>5 ngày</span></div><div class="shot-content"><div class="shot-timer"><div class="shot-ring"><strong>25:00</strong></div><div class="shot-pills"><em></em><em class="active"></em><em></em></div><small>Đang tập trung</small></div><div class="shot-board"><div class="shot-line w1"></div><div class="shot-line w2"></div><div class="shot-line w3"></div><div class="shot-users"><i></i><i></i><i></i><i></i></div><div class="shot-mini-card"><b>VINH DANH</b><span>Top học đều tuần này</span></div></div></div></main></div>
      ${iconTabStrip(theme)}
    </div>`;
  }
  const previewStyle=previewMarkup;

  function previewModal(theme){
    document.getElementById('hl-theme-preview-modal')?.remove();
    const overlay=document.createElement('div');overlay.id='hl-theme-preview-modal';overlay.className='hl-theme-preview-modal';
    overlay.innerHTML=`<div class="hl-theme-preview-backdrop"></div><div class="hl-theme-preview-dialog" role="dialog" aria-modal="true"><div class="hl-theme-preview-head"><div class="flex items-center gap-3"><span class="hl-theme-icon-lg">${iconSvg(theme)}</span><div><h2 class="text-2xl font-black">${esc(theme.name)}</h2><p class="text-sm opacity-70">${esc(theme.description)}</p></div></div><button class="hl-theme-close" type="button">×</button></div><div class="hl-theme-preview-large">${previewMarkup(theme)}</div><div class="hl-theme-preview-feature-grid"><div><b>🎨 Visual</b><span>Nền · card · accent · typography</span></div><div><b>🧩 Icon pack</b><span>8 icon tab riêng theo theme</span></div><div><b>✨ Effects</b><span>Hiệu ứng riêng, tắt khi reduced-motion</span></div><div><b>🖥 Full UI</b><span>Preview cả dashboard thay vì chỉ đổi nền</span></div></div><div class="hl-theme-preview-info"><span class="theme-price">${theme.premium?'2.500 token':'FREE'}</span><span>${theme.premium?'Theme premium':'Theme miễn phí'} · Preview không trừ token</span></div><div class="hl-theme-preview-actions"><button class="hl-btn-secondary" data-action="try">▶ Dùng thử 12 giây</button><button class="hl-btn-primary" data-action="use">${state.theme===theme.id?'Đang dùng':theme.premium?(state.owned.has(theme.id)?'Dùng theme':'Mua 2.500 token'):'Dùng theme'}</button></div></div>`;
    document.body.append(overlay);
    overlay.querySelector('.hl-theme-close')?.addEventListener('click',closePreview);overlay.querySelector('.hl-theme-preview-backdrop')?.addEventListener('click',closePreview);
    overlay.querySelector('[data-action="try"]')?.addEventListener('click',()=>temporaryPreview(theme.id));
    overlay.querySelector('[data-action="use"]')?.addEventListener('click',async()=>{if(theme.premium&&!state.owned.has(theme.id))await purchase(theme.id);else{applyTheme(theme.id);render();closePreview();}});
  }
  function closePreview(){document.getElementById('hl-theme-preview-modal')?.remove();}
  function openPreview(id){const t=safeCatalog().map(normalizeTheme).find(x=>x.id===id)||normalizeTheme(FALLBACK_THEMES[0]);previewModal(t);}
  function temporaryPreview(id){
    const t=safeCatalog().map(normalizeTheme).find(x=>x.id===id);if(!t)return;if(!state.previewReturn)state.previewReturn={theme:state.theme,accent:state.accent};
    setThemeVars(t,{persist:false,force:true});document.body.classList.add('hl-theme-preview-active');closePreview();clearInterval(state.previewTimer);let remain=12;
    window.toast?.(`👀 Đang xem thử ${t.name} · ${remain}s`);state.previewTimer=setInterval(()=>{remain--;window.toast?.(`👀 Preview ${t.name} · ${remain}s`);if(remain<=0)endTemporaryPreview();},1000);
  }
  function endTemporaryPreview(){clearInterval(state.previewTimer);state.previewTimer=null;if(state.previewReturn){const old=state.previewReturn;state.previewReturn=null;applyTheme(old.theme,{persist:false,force:true});applyAccent(old.accent,{persist:false});}document.body.classList.remove('hl-theme-preview-active');window.toast?.('Đã trả lại giao diện trước đó.');render();}

  async function api(method,body){const user=window.auth?.currentUser;if(!user)throw Object.assign(new Error('AUTH'),{status:401});const token=await user.getIdToken();const r=await fetch('/api/themes',{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined,cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(d.error||'Theme API error'),{status:r.status,data:d});return d;}
  async function purchase(id){try{const data=await api('POST',{themeId:id});state.wallet=data.wallet||state.wallet;state.owned=new Set(data.owned||[...state.owned,id]);applyTheme(id);render();closePreview();window.toast?.(data.alreadyOwned?'Theme đã sở hữu.':'✅ Mua theme thành công.');}catch(e){window.toast?.(e.data?.error||'Không thể mua theme.');}}

  function render(){
    const host=$('sec-theme-store');if(!host)return;const themes=safeCatalog().map(normalizeTheme);host.innerHTML='';
    const shell=document.createElement('div');shell.className='theme-shell';
    const head=document.createElement('div');head.className='hl-card p-6';head.innerHTML='<p class="text-xs font-black tracking-[.2em] text-blue-600 uppercase">THEME SYSTEM</p><h1 class="text-3xl font-black mt-1">Theme Store</h1><p class="text-sm text-slate-500 mt-2">Premium không chỉ đổi nền: mỗi theme có bộ icon tab, surface, typography và hiệu ứng riêng. Xem toàn bộ trước khi mua.</p>';head.insertAdjacentHTML('beforeend',`<div class="mt-4 flex flex-wrap items-center gap-2"><span class="hl-theme-nav">🪙 Số dư: ${state.wallet.balance.toLocaleString('vi-VN')} token</span><button id="theme-support" class="px-3 py-2 rounded-xl bg-cyan-50 text-cyan-700 font-black">Nạp token qua Zalo</button></div>`);shell.append(head);
    const accent=document.createElement('section');accent.className='hl-card p-6';accent.innerHTML='<div class="flex items-center justify-between gap-3"><div><h2 class="font-black text-xl mb-1">FREE · Accent Color</h2><p class="text-sm text-slate-500">Màu xanh mặc định. Đổi accent sẽ đồng bộ các nút, progress, active tab, badge và glow.</p></div><span class="theme-badge-free">FREE</span></div>';
    const pal=document.createElement('div');pal.className='accent-palette mt-4';for(const c of ['#2563eb','#7c3aed','#dc2626','#ea580c','#eab308','#16a34a','#ec4899','#06b6d4','#14b8a6']){const b=document.createElement('button');b.className='accent-chip';b.style.background=c;b.title=c;b.setAttribute('aria-label',`Accent ${c}`);b.onclick=()=>{applyAccent(c);render();};pal.append(b);}accent.append(pal);const custom=document.createElement('div');custom.className='accent-custom mt-4';custom.innerHTML='<span class="text-sm font-bold">Màu tùy chỉnh</span>';const input=document.createElement('input');input.type='color';input.value=state.accent;input.oninput=e=>{applyAccent(e.target.value);render();};custom.append(input);accent.append(custom);shell.append(accent);
    const intro=document.createElement('div');intro.className='theme-catalog-intro';intro.innerHTML=`<div><span class="text-xs font-black uppercase tracking-[.18em]">13 GIAO DIỆN</span><h2 class="text-2xl font-black mt-1">Mỗi theme có một bộ nhận diện riêng</h2><p class="text-sm opacity-70 mt-1">Preview hiển thị dashboard, icon tab, timer, leaderboard và hiệu ứng của theme.</p></div><span class="text-sm font-black">${themes.filter(t=>t.premium).length} Premium · ${themes.filter(t=>!t.premium).length} Free</span>`;shell.append(intro);
    const grid=document.createElement('div');grid.className='theme-grid';
    for(const theme of themes){
      const card=document.createElement('article');card.className='theme-card theme-card--'+theme.id;
      card.innerHTML=`<div class="theme-preview-wrap">${previewStyle(theme)}<div class="theme-preview-badges"><span class="theme-badge">${theme.premium?'PREMIUM':'FREE'}</span><span class="theme-price">${theme.premium?'2.500 token':'FREE'}</span></div></div><div class="theme-meta"><div class="theme-icon-row"><span class="theme-icon">${iconSvg(theme)}</span><div><h3 class="font-black text-lg">${esc(theme.name)}</h3><p class="text-xs text-slate-500 mt-1 leading-relaxed">${esc(theme.description)}</p></div></div><div class="theme-icon-pack">${['home','study','library','exam','community','ai','teacher','theme'].map(k=>`<span title="${TAB_LABELS[k]}">${styleIconSvg(k,theme)}</span>`).join('')}</div></div>`;
      const actions=document.createElement('div');actions.className='theme-actions';const preview=document.createElement('button');preview.className='theme-preview-btn';preview.textContent='👁 Xem preview';preview.onclick=()=>openPreview(theme.id);actions.append(preview);
      if(state.theme===theme.id&&(!theme.premium||state.owned.has(theme.id))){const active=document.createElement('button');active.className='theme-apply';active.textContent='✓ Đang dùng';active.disabled=true;actions.append(active);}else if(theme.premium&&!state.owned.has(theme.id)){const buy=document.createElement('button');buy.className='theme-buy';buy.textContent=state.wallet.balance>=theme.price?'Mua '+theme.price.toLocaleString('vi-VN')+' token':'Cần thêm token';buy.disabled=state.wallet.balance<theme.price;buy.onclick=()=>purchase(theme.id);actions.append(buy);}else{const use=document.createElement('button');use.className='theme-apply';use.textContent='Dùng theme';use.onclick=()=>{applyTheme(theme.id);render();};actions.append(use);}card.append(actions);grid.append(card);
    }
    shell.append(grid);host.append(shell);$('theme-support')?.addEventListener('click',showSupport);
  }
  async function showSupport(){try{const d=await api('GET');const s=d.support;if(s?.url)window.open(s.url,'_blank','noopener,noreferrer');else window.toast?.('Admin chưa cấu hình kênh Zalo hỗ trợ trong Vercel Environment Variables.');}catch{window.toast?.('Chưa thể tải thông tin hỗ trợ.');}}
  async function load(){try{const d=await api('GET');state.catalog=(d.themes||FALLBACK_THEMES).map(normalizeTheme);state.owned=new Set(d.owned||[]);state.wallet=d.wallet||{balance:0};if(!applyTheme(state.theme,{persist:false}))applyTheme('classic',{persist:false});applyAccent(state.accent,{persist:false});render();}catch(e){console.warn('theme system',e);state.catalog=FALLBACK_THEMES.map(normalizeTheme);if(!safeCatalog().some(t=>t.id===state.theme))state.theme='classic';applyTheme(state.theme,{persist:false,force:true});applyAccent(state.accent,{persist:false});render();}}

  window.HLTheme={load,render,applyAccent,applyTheme,open:()=>{switchSection('sec-theme-store');load();},openPreview,get state(){return state;},stopPreview:endTemporaryPreview,previewMarkup};
  document.addEventListener('DOMContentLoaded',()=>{applyAccent(state.accent,{persist:false});if(!window.auth?.currentUser){applyTheme(state.theme,{persist:false,force:true});}window.addEventListener('keydown',e=>{if(e.key==='Escape')closePreview();});});
  window.addEventListener('firebase:user-ready',()=>load());
})();
