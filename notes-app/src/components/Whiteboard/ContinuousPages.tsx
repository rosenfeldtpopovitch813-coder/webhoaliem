import {RefObject,useEffect,useRef} from 'react';
import {BoardItem,BoardPage,H,W} from '../../types/board';
import Whiteboard,{ActiveTool,BoardSettings} from './Whiteboard';

type Props={
  pages:BoardPage[];activeId:string;zoom:number;tool:ActiveTool;settings:BoardSettings;
  selected:string|null;selectedIds?:string[];areaRef:RefObject<HTMLDivElement|null>;
  onActivate:(id:string)=>void;onSelect:(id:string|null)=>void;onSelectMany?:(ids:string[])=>void;
  onCommit:(pageId:string,items:BoardItem[],overflow?:BoardItem|BoardItem[],nearBottom?:boolean)=>void;
  onInsertText:(pageId:string,x:number,y:number,math:boolean)=>void;onEditText:(pageId:string,id:string)=>void;
  onPan:(dx:number,dy:number)=>void;onZoomDrag:(delta:number,clientX?:number,clientY?:number)=>void;
  onInteracting:()=>void;
};

export default function ContinuousPages({pages,activeId,zoom,tool,settings,selected,selectedIds=[],areaRef,onActivate,onSelect,onSelectMany,onCommit,onInsertText,onEditText,onPan,onZoomDrag,onInteracting}:Props){
  // Ctrl + lăn chuột: zoom quanh con trỏ, bắt ở toàn vùng cuộn (kể cả lề ngoài giấy) và chặn zoom của trình duyệt.
  const zoomRef=useRef(onZoomDrag);zoomRef.current=onZoomDrag;
  useEffect(()=>{
    const el=areaRef.current;if(!el)return;
    const wheel=(e:WheelEvent)=>{if(!e.ctrlKey)return;e.preventDefault();zoomRef.current(-e.deltaY*(e.deltaMode===1?8:1)*.22,e.clientX,e.clientY)};
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[areaRef]);
  return <div className="board-area interactive-board-area" ref={areaRef}>
    <div className="continuous-stack" style={{width:W*zoom}}>
      {pages.map((page,index)=><div key={page.id} id={`sheet-${page.id}`} className={'paper-stage continuous-sheet '+(page.id===activeId?'active-sheet':'')}
        data-page-id={page.id} style={{width:W*zoom,height:H*zoom}} aria-label={`Trang ${index+1}: ${page.name}`}
        onPointerDown={()=>{onActivate(page.id);onInteracting()}}>
        <div className="board interactive-board" style={{transform:`scale(${zoom})`}}>
          <Whiteboard page={page} tool={tool} settings={settings} selected={page.id===activeId?selected:null} selectedIds={page.id===activeId?selectedIds:[]} isActive={page.id===activeId}
            onSelect={id=>{onActivate(page.id);onSelect(id)}} onSelectMany={ids=>{onActivate(page.id);onSelectMany?.(ids)}}
            onCommit={(items,overflow,nearBottom)=>onCommit(page.id,items,overflow,nearBottom)}
            onInsertText={(x,y,math)=>onInsertText(page.id,x,y,math)} onEditText={id=>onEditText(page.id,id)}
            onPan={onPan} onZoomDrag={onZoomDrag} zoom={zoom}/>
        </div>
      </div>)}
    </div>
  </div>;
}
