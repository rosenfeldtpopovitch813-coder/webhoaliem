(function(){
 const originalRender=window.renderDocs;
 function preview(url,title){
  const safe=HL.safeURL(url);if(!safe)return;
  let dialog=document.getElementById('hl-document-preview');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='hl-document-preview';dialog.className='hl-dialog';document.body.append(dialog);}
  dialog.replaceChildren();const heading=document.createElement('h2');heading.textContent=title;
  const close=document.createElement('button');close.textContent='Đóng';close.className='hl-button';close.onclick=()=>{dialog.close();dialog.replaceChildren();};
  const frame=document.createElement('iframe');frame.title=title;frame.src=getEmbedUrl(safe);frame.referrerPolicy='no-referrer';frame.style.cssText='width:100%;height:65dvh;border:0';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-forms');
  const original=document.createElement('a');original.textContent='Mở link gốc';original.href=safe;original.target='_blank';original.rel='noopener noreferrer';original.className='hl-button';
  dialog.append(heading,close,original,frame);dialog.showModal();dialog.addEventListener('close',()=>dialog.replaceChildren(),{once:true});
 }
 window.renderDocs=function(data){
  originalRender(data);const records=(data||[]).filter(d=>String(d.title||d.Title||d.Tên||'').trim());
  document.querySelectorAll('#document-grid article').forEach((article,i)=>{
   const d=records[i];if(!d)return;const title=d.title||d.Title||d.Tên,url=HL.safeURL(d.pdf_url||d.link||d.url);if(!url)return;
   article.querySelector('[class*="-right-12"]')?.remove();
   const meta=article.querySelector('.space-y-2.mt-auto');if(meta){meta.replaceChildren();for(const [label,value]of [['Nguồn',d.source||d.nguon||d['Nguồn']],['Năm',d.year||d.nam||d['Năm']],['Lớp',d.grade||d.lop||d['Lớp']]]){if(!value)continue;const p=document.createElement('p');p.textContent=label+': '+value;meta.append(p);}}
   const row=document.createElement('div');row.className='flex gap-2 mt-3';
   if(!isDriveFolderUrl(url)){const b=document.createElement('button');b.className='hl-button';b.textContent='Xem trước';b.onclick=()=>preview(url,title);row.append(b);}
   const save=document.createElement('button');save.className='hl-button';save.textContent='Lưu / bỏ lưu';save.onclick=()=>HLLearning.bookmark({id:url,type:'document',title,url,subtitle:d.chapter||d['Môn']||'Tài liệu'});row.append(save);article.append(row);
   article.querySelector('a')?.addEventListener('click',()=>{const uid=auth?.currentUser?.uid;if(!uid)return;const key='htvvm.documentsRecent.'+uid,items=HL.storage.get(key,[]);HL.storage.set(key,[{url,title,viewedAt:Date.now()},...items.filter(x=>x.url!==url)].slice(0,30));});
  });
 };
})();
