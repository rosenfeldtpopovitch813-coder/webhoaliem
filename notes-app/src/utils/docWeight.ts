import {BoardDocument} from '../types/board';
// Ước lượng nhanh dung lượng ảnh nhúng (nền PDF, hình chèn) mà KHÔNG phải JSON.stringify cả tài liệu.
export function docImageWeight(doc:BoardDocument):number{
  let total=0;
  for(const page of doc.pages){
    if(page.backgroundImage)total+=page.backgroundImage.length;
    for(const item of page.items)if(item.kind==='image')total+=item.src.length;
  }
  return total;
}
