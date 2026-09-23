(function(){
 'use strict';
 const map={
  'sec-dashboard':'nav-home',
  'sec-library':'nav-library',
  'sec-exam-list':'nav-exam',
  'sec-student-join':'nav-exam',
  'sec-taking-exam':'nav-exam',
  'sec-leaderboard':'nav-exam',
  'sec-teacher-config':'nav-teacher',
  'sec-teacher-key':'nav-teacher',
  'sec-chemmaker':'nav-chemmaker',
  'sec-toolkit':'nav-toolkit',
  'sec-study':'nav-study',
  'sec-stats':'nav-stats',
  'sec-community':'nav-community',
  'sec-arena':'nav-arena',
  'sec-arena-creator':'nav-arena',
  'sec-arena-live':'nav-arena',
  'sec-learning':'nav-learning',
  'sec-theme-store':'nav-theme',
  'sec-admin-center':'nav-admin'
 };

 function validSection(id){ return !!map[id] && !!document.getElementById(id); }

 function sectionFromLocation(){
  const hash=String(location.hash||'').replace(/^#/,'').trim();
  if(validSection(hash)) return hash;

  // Also support direct paths such as /sec-dashboard so the deployed domain
  // behaves as an SPA even when the user types the section path manually.
  const path=String(location.pathname||'').replace(/\/+$/,'').split('/').pop();
  if(validSection(path)) return path;

  return 'sec-dashboard';
 }

 function setUrlForSection(id, replace){
  const url=new URL(location.href);
  url.hash=id;
  // Keep a clean SPA URL: /#sec-dashboard rather than /sec-dashboard.
  const method=replace?'replaceState':'pushState';
  if(location.href!==url.href){
   history[method]({section:id},'',url.href);
  }
 }

 window.switchSection=function(id,options={}){
  if(!validSection(id)) id='sec-dashboard';

  // Protected UI is only rendered once Firebase Auth has a user.
  // Queue navigation requests that happen before auth hydration completes.
  if(!window.auth?.currentUser){
   window.__pendingSection=id;
   return false;
  }

  if(id==='sec-taking-exam'&&!window.HLExam?.active) id='sec-exam-list';
  if(!validSection(id)) id='sec-dashboard';

  document.querySelectorAll('.app-section').forEach(el=>{
   const active=el.id===id;
   el.classList.toggle('active',active);
   el.classList.toggle('hidden',!active);
   el.setAttribute('aria-hidden',String(!active));
  });

  window.setActiveNav?.(map[id]);
  document.querySelectorAll('.nav-btn').forEach(el=>{
   if(el.id===map[id]) el.setAttribute('aria-current','page');
   else el.removeAttribute('aria-current');
  });

  setUrlForSection(id, options.replace!==false);
  document.dispatchEvent(new CustomEvent('hl:navigate',{detail:{id,restored:!!options.replace}}));
  if(id!=='sec-arena-live') window.scrollTo({top:0});
  return true;
 };

 window.showSection=(id)=>window.switchSection(id);
 window.__getInitialSection=sectionFromLocation;

 function restoreRoute(){
  if(window.auth?.currentUser){
   const queued=window.__pendingSection;
   window.__pendingSection=null;
   window.switchSection(queued||sectionFromLocation(),{replace:true});
  } else {
   window.__pendingSection=sectionFromLocation();
  }
 }

 window.addEventListener('popstate',restoreRoute);
 window.addEventListener('hashchange',restoreRoute);
 document.addEventListener('DOMContentLoaded',restoreRoute);

 // Keep supported formatting and structures; remove executable HTML and unsafe URLs.
 HL.sanitizeChem=function(text){
  const doc=new DOMParser().parseFromString(String(text).replace(/\n/g,'<br>'),'text/html');
  const allowed=new Set(['P','BR','DIV','SPAN','B','STRONG','I','EM','U','SUB','SUP','H1','H2','H3','H4','UL','OL','LI','TABLE','THEAD','TBODY','TR','TH','TD','IMG','HR']);
  for(const el of [...doc.body.querySelectorAll('*')]){
   if(!allowed.has(el.tagName)){
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH'].includes(el.tagName)) el.remove();
    else el.replaceWith(...el.childNodes);
    continue;
   }
   for(const attr of [...el.attributes]){
    if(!['src','alt','colspan','rowspan'].includes(attr.name)||attr.name==='src'&&el.tagName!=='IMG') el.removeAttribute(attr.name);
   }
   if(el.tagName==='IMG'){
    const src=el.getAttribute('src')||'';
    if(!HL.safeURL(src)&&!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) el.remove();
    else {el.style.maxWidth='100%';el.style.maxHeight='300px';}
   }
  }
  const fragment=document.createDocumentFragment();
  fragment.append(...doc.body.childNodes);
  return fragment;
 };
})();
