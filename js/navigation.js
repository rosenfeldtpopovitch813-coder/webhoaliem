(function(){
 'use strict';
 const map={'sec-dashboard':'nav-home','sec-library':'nav-library','sec-exam-list':'nav-exam','sec-student-join':'nav-exam','sec-taking-exam':'nav-exam','sec-leaderboard':'nav-exam','sec-teacher-config':'nav-teacher','sec-teacher-key':'nav-teacher','sec-chemmaker':'nav-chemmaker','sec-toolkit':'nav-toolkit','sec-study':'nav-study','sec-stats':'nav-stats','sec-community':'nav-community','sec-arena':'nav-arena','sec-arena-creator':'nav-arena','sec-arena-live':'nav-arena','sec-learning':'nav-learning','sec-theme-store':'nav-theme','sec-admin-center':'nav-admin'};
 window.switchSection=function(id,options={}){
  if(!window.auth?.currentUser)return false;
  if(!map[id]||!document.getElementById(id))id='sec-dashboard';
  if(id==='sec-taking-exam'&&!window.HLExam?.active)id='sec-exam-list';
  document.querySelectorAll('.app-section').forEach(el=>{const active=el.id===id;el.classList.toggle('active',active);el.classList.toggle('hidden',!active);el.setAttribute('aria-hidden',String(!active));});
  window.setActiveNav?.(map[id]);document.querySelectorAll('.nav-btn').forEach(el=>{if(el.id===map[id])el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const url=new URL(location.href);url.hash=id;
  if(location.hash!==url.hash)history[options.replace?'replaceState':'pushState']({section:id},'',url);
  document.dispatchEvent(new CustomEvent('hl:navigate',{detail:{id,restored:!!options.replace}}));
  if(id!=='sec-arena-live')window.scrollTo({top:0});
  return true;
 };
 window.showSection=(id)=>switchSection(id);
 window.addEventListener('popstate',()=>switchSection(location.hash.slice(1)||'sec-dashboard',{replace:true}));
 window.addEventListener('hashchange',()=>switchSection(location.hash.slice(1)||'sec-dashboard',{replace:true}));
 // Keep supported formatting and structures; remove executable HTML and unsafe URLs.
 HL.sanitizeChem=function(text){
  const doc=new DOMParser().parseFromString(String(text).replace(/\n/g,'<br>'),'text/html');
  const allowed=new Set(['P','BR','DIV','SPAN','B','STRONG','I','EM','U','SUB','SUP','H1','H2','H3','H4','UL','OL','LI','TABLE','THEAD','TBODY','TR','TH','TD','IMG','HR']);
  for(const el of [...doc.body.querySelectorAll('*')]){
   if(!allowed.has(el.tagName)){if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH'].includes(el.tagName))el.remove();else el.replaceWith(...el.childNodes);continue;}
   for(const attr of [...el.attributes])if(!['src','alt','colspan','rowspan'].includes(attr.name)||attr.name==='src'&&el.tagName!=='IMG')el.removeAttribute(attr.name);
   if(el.tagName==='IMG'){const src=el.getAttribute('src')||'';if(!HL.safeURL(src)&&!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src))el.remove();else{el.style.maxWidth='100%';el.style.maxHeight='300px';}}
  }
  const fragment=document.createDocumentFragment();fragment.append(...doc.body.childNodes);return fragment;
 };
})();
