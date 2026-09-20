/* HTVVM Studio — original 24px SVG icon system and application shell. */
(function(){
 'use strict';
 const paths={
  home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z M8 7h8',
  library:'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3Z M12 6v16 M6 8h3 M15 8h3 M6 12h3 M15 12h3',
  exam:'M6 3h12v18H6Z M9 7h6 M9 11h6 M9 15l2 2 4-4',
  study:'M9 2h6 M12 2v3 M18 6l2-2 M12 9v5l3 2 M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  community:'M3 3h15v12H8l-5 4Z M18 8h3v13l-5-3h-5',
  learning:'M5 3h14v18H5Z M3 7h4 M3 12h4 M3 17h4 M10 8h5 M10 12h5 M10 16h3',
  arena:'M4 3l8 8-2 2-8-8Z M20 3l-8 8 2 2 8-8Z M8 14l-5 5 M16 14l5 5 M2 16l6 6 M16 22l6-6',
  teacher:'M3 3h18v13H3Z M12 16v5 M7 22l5-3 5 3 M7 10l3-3 4 5 3-4',
  chemmaker:'M8 3h8 M10 3v7L4 19v2h16v-2l-6-9V3 M7 16h10 M10 13h1',
  toolkit:'M9 3h6l2 4h4v14H3V7h4Z M3 12h18 M10 12v3h4v-3',
  stats:'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
  arrow:'M4 12h15 M13 6l6 6-6 6',
  calendar:'M3 5h18v16H3Z M7 2v6 M17 2v6 M3 10h18 M7 14h2 M15 14h2 M7 18h2',
  compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 8l-3 5-5 3 3-5Z',
  search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
  bell:'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Z M10 21h4',
  moon:'M19 15A9 9 0 0 1 9 3a9 9 0 1 0 10 12',
  heart:'M12 21 3 12C-1 6 7 1 12 7c5-6 13-1 9 5Z',
  user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 22v-3a8 8 0 0 1 16 0v3',
  menu:'M4 6h16 M4 12h16 M4 18h16',
  leaf:'M20 3C4 2 1 12 8 18c6 5 14-2 12-15Z M5 22 16 9',
  trophy:'M7 3h10v8a5 5 0 0 1-10 0Z M7 5H3v4a4 4 0 0 0 4 4 M17 5h4v4a4 4 0 0 1-4 4 M12 16v5 M8 21h8',
  close:'M5 5l14 14 M19 5 5 19',
  download:'M12 3v12 M7 10l5 5 5-5 M3 16v5h18v-5'
 };
 function icon(name){return `<svg class="st-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.leaf}"/></svg>`;}
 window.HLIcons={icon,paths};
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;}
 function action(label,name,fn,cls='st-button'){const b=node('button',cls);b.type='button';b.innerHTML=icon(name);b.append(document.createTextNode(label));b.onclick=fn;return b;}
 function panel(title,ids,name){const p=node('article','st-panel');const h=node('h2','st-panel-title');h.innerHTML=icon(name);h.append(document.createTextNode(title));p.append(h);for(const id of ids){const el=document.getElementById(id);if(el)p.append(el);}return p;}
 function mount(){
  document.body.classList.add('studio');
  const nav=document.getElementById('main-nav');if(!nav)return;
  const buttons=[...nav.querySelectorAll('.nav-btn')],topbar=document.getElementById('hl-topbar'),profile=document.getElementById('nav-avatar')?.closest('button'),status=document.getElementById('firebase-status'),counter=document.getElementById('web-time-counter');
  const brand=action('', 'chemmaker',()=>switchSection('sec-dashboard'),'st-brand');brand.id='studio-brand';brand.setAttribute('aria-label','HTVVM × Hoá Liems — Trang chủ');const title=node('span','');title.innerHTML='<strong>HTVVM<span> × </span>Hoá Liems</strong><small>Hành trình vượt vũ môn</small>';brand.append(title);
  const links=node('div','st-nav-links');links.id='studio-menu';
  const names={home:'Trang chủ',library:'Thư viện',exam:'Luyện thi',study:'Góc tập trung',community:'Cộng đồng',learning:'Kế hoạch & Sổ tay',arena:'Đấu trường',teacher:'Dành cho giáo viên',chemmaker:'Soạn đề',toolkit:'Công cụ học tập',stats:'Tiến độ'};
  for(const b of buttons){const key=b.id.replace('nav-','');b.className='nav-btn';b.innerHTML=icon(key);b.append(document.createTextNode(names[key]||key));links.append(b);}
  const controls=node('div','st-nav-controls');controls.append(action('Giao diện','moon',()=>toggleTheme()),action('Ủng hộ','heart',()=>openDonateModal()));
  if(profile){profile.className='st-profile';controls.append(profile);}if(status){status.className='st-connection';controls.append(status);}if(counter){counter.className='st-session';counter.title='Thời gian truy cập, không phải thời gian học';controls.append(counter);}
  const menu=action('Menu','menu',()=>{const on=nav.classList.toggle('st-menu-open');menu.setAttribute('aria-expanded',String(on));},'st-mobile-toggle');menu.setAttribute('aria-controls','studio-menu');menu.setAttribute('aria-expanded','false');
  nav.replaceChildren(brand,menu,links,controls);nav.className='st-nav';
  // Keep the existing topbar buttons/listeners, but move them into a separate workspace header.
  if(topbar){topbar.className='st-topbar';[...topbar.children].forEach((b,i)=>{b.innerHTML=icon(['search','calendar','bell'][i])+['Tìm kiếm <kbd>Ctrl K</kbd>','Kế hoạch','Thông báo'][i];});nav.after(topbar);}
  const dash=document.getElementById('sec-dashboard');
  const ranks=panel('Cùng nhau tiến bộ',['dashboard-top-study','dashboard-top-streak'],'trophy');
  // Both containers remain live targets of the existing realtime/API code.
  const studyLabel=node('h3','st-caption','Thời gian học hôm nay'),streakLabel=node('h3','st-caption','Chuỗi ngày học');ranks.insertBefore(studyLabel,ranks.children[1]);ranks.insertBefore(streakLabel,document.getElementById('dashboard-top-streak'));
  const calendar=panel('Lịch sắp tới',['dashboard-upcoming-event-body'],'calendar');calendar.id='dashboard-upcoming-events';calendar.append(action('Mở lịch của tôi','arrow',()=>openCalendar()));
  const presence=panel('Không gian chung',['dashboard-online-count','dashboard-online-status','dashboard-web-time'],'community');presence.append(node('small','st-muted','Đồng hồ trên là thời gian truy cập của phiên này.'));
  const quote=panel('Một ý nghĩ cho hôm nay',['daily-motivation-text','daily-motivation-author','daily-motivation-date','daily-motivation-source'],'leaf');quote.classList.add('st-quote');
  const header=node('header','st-heading');header.innerHTML='<p class="st-eyebrow">KHÔNG GIAN HỌC TẬP CỦA BẠN</p><h1>Mỗi ngày, một bước tiến.</h1><p>Chọn một mục tiêu nhỏ. Dành thời gian cho điều quan trọng.</p>';
  const hero=node('div','st-focus');hero.innerHTML='<div><span class="st-pill">HỌC THEO NHỊP CỦA BẠN</span><h2>Gác lại xao nhãng.<br>Bắt đầu một phiên học.</h2><p>Một khoảng tập trung hôm nay là nền tảng cho ngày mai.</p></div><div class="st-orbit" aria-hidden="true"><svg viewBox="0 0 240 200" fill="none"><ellipse cx="120" cy="100" rx="98" ry="53" stroke="currentColor"/><ellipse cx="120" cy="100" rx="98" ry="53" transform="rotate(60 120 100)" stroke="currentColor"/><ellipse cx="120" cy="100" rx="98" ry="53" transform="rotate(120 120 100)" stroke="currentColor"/><circle cx="120" cy="100" r="12" fill="currentColor"/><circle cx="215" cy="87" r="6" fill="currentColor"/></svg></div>';
  hero.firstElementChild.append(action('Vào góc tập trung','study',()=>switchSection('sec-study'),'st-button st-primary'));
  const grid=node('div','st-workspace');const main=node('div','st-main'),aside=node('aside','st-aside');
  const shortcuts=node('div','st-shortcuts');for(const [label,desc,key,fn] of [['Luyện một đề','Kiểm tra điều đã học','exam',()=>loadExamList()],['Mở thư viện','Tìm tài liệu bạn cần','library',()=>switchSection('sec-library')],['Kế hoạch nguyện vọng','Chọn hướng đi tiếp theo','compass',()=>{if(window.HLAuthz?.teacher||window.HLAuthz?.admin){window.toast?.('Kế hoạch nguyện vọng dành cho học sinh.');return;}HLLearning.open('plan')}]] ){const b=action(label,key,fn,'st-shortcut');if(label==='Kế hoạch nguyện vọng')b.dataset.studentOnly='true';b.append(node('small','',desc));shortcuts.append(b);}
  main.append(hero,shortcuts,calendar,quote);aside.append(ranks,presence);grid.append(main,aside);dash.replaceChildren(header,grid);
  document.addEventListener('hl:navigate',()=>{nav.classList.remove('st-menu-open');menu.setAttribute('aria-expanded','false');});
  // Convert decorative emoji in existing and dynamically rendered UI to our own SVG set.
  // Editable chemistry content, answer sheets and user posts are excluded.
  const map={'📚':'library','📝':'exam','🚀':'study','💬':'community','⚔':'arena','⚙':'teacher','✍':'chemmaker','🧰':'toolkit','📊':'stats','📅':'calendar','💖':'heart','☀':'moon','🌙':'moon','🔥':'leaf','🏆':'trophy','🧪':'chemmaker','⏱':'study','🎯':'compass','👤':'user','👥':'community','💡':'leaf','⚡':'arrow','⏳':'study','🕒':'study'};
  function convert(root){if(!(root instanceof Element)||root.closest('svg,script,style,textarea,input,[contenteditable],#chem-pdf-content,#student-sheet,#community-posts'))return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const texts=[];while(walker.nextNode())texts.push(walker.currentNode);for(const t of texts){if(!t.parentElement?.closest('button,h1,h2,h3,label,.st-panel'))continue;if(t.parentElement.closest('svg,textarea,script,style,[contenteditable]'))continue;const match=t.textContent.match(/[📚📝🚀💬⚔⚙✍🧰📊📅💖☀🌙🔥🏆🧪⏱🎯👤👥💡⚡⏳🕒]/u);if(!match||!map[match[0]])continue;const parts=t.textContent.split(match[0]);const fragment=document.createDocumentFragment();fragment.append(document.createTextNode(parts.shift()));const span=node('span','st-inline-icon');span.innerHTML=icon(map[match[0]]);fragment.append(span,document.createTextNode(parts.join(match[0]).replace(/^\uFE0F/,'')));t.replaceWith(fragment);}}
  convert(document.body);new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes){if(n.nodeType===1)convert(n);else if(n.nodeType===3&&n.parentElement)convert(n.parentElement);}}).observe(document.body,{childList:true,subtree:true});
 }
 document.addEventListener('DOMContentLoaded',mount);
})();
