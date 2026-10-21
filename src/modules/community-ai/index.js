import { element, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function renderCommunityAI() {
  const root = element('section', 'ai-root');
  const hero = element('section','hero ai-hero'); hero.append(element('div','eyebrow','HTVVM STUDIO • AI TUTOR'),element('h2','hero-title','Học cùng một trợ giảng biết giải thích.'),element('p','hero-subtitle','Đặt câu hỏi bằng văn bản hoặc gửi ảnh bài tập. AI ưu tiên hướng dẫn từng bước, công thức và cách tự kiểm tra kết quả.')); root.append(hero);
  const panel = element('section','exam-panel ai-panel');
  panel.append(element('h3','exam-heading','Bạn đang cần trợ giúp điều gì?'));
  const prompts = element('div','ai-prompts');
  const examples = ['Giải thích cơ chế phản ứng este hóa và cách nhận biết sản phẩm.','Hướng dẫn từng bước bài tập điện phân này.','Giải thích vì sao cần dùng định luật bảo toàn electron.'];
  for (const prompt of examples) prompts.append(button(prompt,'ai-prompt',()=>{question.value=prompt;question.focus();})); panel.append(prompts);
  const form = document.createElement('form'); form.className='ai-form';
  const questionLabel = element('label','exam-label','Câu hỏi');
  const question = document.createElement('textarea'); question.className='exam-input ai-question'; question.maxLength=8000; question.placeholder='Nhập câu hỏi, dữ kiện, hoặc điều bạn chưa hiểu…'; question.rows=5; questionLabel.append(question);
  const imageLabel = element('label','exam-label','Ảnh bài tập (không bắt buộc)');
  const imageInput = document.createElement('input'); imageInput.type='file'; imageInput.accept='image/png,image/jpeg,image/webp'; imageInput.className='exam-input'; imageLabel.append(imageInput);
  const imageNote = element('p','exam-message','Chỉ nhận JPG, PNG hoặc WebP, tối đa 2 MB. Ảnh sẽ được gửi đến dịch vụ AI để phân tích khi bạn nhấn Gửi.'); imageLabel.append(imageNote);
  const controls=element('div','maker-actions');const send=button('Gửi câu hỏi','primary-btn',()=>{});send.type='submit'; const clear=button('Xóa','focus-btn',()=>{question.value='';imageInput.value='';clearImagePreview();answer.replaceChildren();status.textContent='';});controls.append(send,clear);
  form.append(questionLabel,imageLabel,controls);panel.append(form);
  const preview=element('div','ai-image-preview'); const previewImg=document.createElement('img');previewImg.alt='Ảnh bài tập được chọn';previewImg.hidden=true;preview.append(previewImg);panel.append(preview);
  const status=element('p','exam-message ai-status','Đăng nhập Google để sử dụng AI. API key chỉ được lưu phía Server.');panel.append(status);
  const responsePanel=element('section','exam-panel ai-answer-panel');responsePanel.append(element('h3','exam-heading','Lời giải / giải thích'));const answer=element('pre','ai-answer','Câu trả lời sẽ xuất hiện ở đây.');responsePanel.append(answer);root.append(panel,responsePanel);
  let previewURL='';
  function clearImagePreview(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL='';previewImg.removeAttribute('src');previewImg.hidden=true;}
  imageInput.addEventListener('change',()=>{clearImagePreview();const file=imageInput.files?.[0];if(!file)return;if(!ALLOWED_TYPES.has(file.type)||file.size>MAX_IMAGE_BYTES){imageInput.value='';status.textContent='Ảnh không hợp lệ. Chỉ nhận JPG/PNG/WebP tối đa 2 MB.';return;}previewURL=URL.createObjectURL(file);previewImg.src=previewURL;previewImg.hidden=false;status.textContent=`Đã chọn ${file.name} (${(file.size/1024).toFixed(0)} KB).`});
  function toBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Không đọc được ảnh.'));reader.onload=()=>{const value=String(reader.result||'');const split=value.indexOf(',');if(split<0)return reject(new Error('Dữ liệu ảnh không hợp lệ.'));resolve(value.slice(split+1));};reader.readAsDataURL(file);});}
  form.addEventListener('submit',async(event)=>{event.preventDefault();const text=question.value.trim();const file=imageInput.files?.[0];if(!text&&!file){status.textContent='Hãy nhập câu hỏi hoặc chọn ảnh bài tập.';return;}const user=auth?.currentUser;if(!user){status.textContent='Bạn cần đăng nhập Google trước khi dùng AI.';return;}send.disabled=true;send.textContent='Đang phân tích…';status.textContent='Đang gửi yêu cầu tới trợ giảng AI…';answer.textContent='';
    try{let image;if(file){if(!ALLOWED_TYPES.has(file.type)||file.size>MAX_IMAGE_BYTES)throw new Error('Ảnh không hợp lệ hoặc vượt quá 2 MB.');image={mimeType:file.type,data:await toBase64(file)};}const token=await user.getIdToken();const res=await fetch('/api/ai-tutor',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({question:text,image}),cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Không thể gọi AI (${res.status}).`);answer.textContent=data.answer;status.textContent=`Đã trả lời bằng ${data.model||'HTVVM AI Tutor'}. Hãy đối chiếu kết quả với sách giáo khoa/giáo viên, nhất là các phép tính quan trọng.`;
    }catch(error){status.textContent=error.message||'Không thể kết nối tới AI.';answer.textContent='';}finally{send.disabled=false;send.textContent='Gửi câu hỏi';}});
  const watcher=new MutationObserver(()=>{if(!root.isConnected){clearImagePreview();watcher.disconnect();}});watcher.observe(document.getElementById('main-content')||document.body,{childList:true});
  return root;
}
