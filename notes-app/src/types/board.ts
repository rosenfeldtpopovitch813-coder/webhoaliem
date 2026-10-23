export type Point={x:number;y:number;p:number;t?:number;tiltX?:number;tiltY?:number};
export type LinePattern='solid'|'dashed'|'dotted';
export type Stroke={id:string;kind:'stroke';points:Point[];color:string;width:number;opacity:number;style:string;dash?:LinePattern;ignorePressure?:boolean};
export type Shape={id:string;kind:'shape';shape:string;x:number;y:number;w:number;h:number;color:string;width:number;fill:string;opacity:number;dash?:LinePattern;rotation?:number;flipX?:boolean;flipY?:boolean};
export type TextItem={id:string;kind:'text';x:number;y:number;text:string;color:string;fontSize:number;bold?:boolean;italic?:boolean;math?:boolean;rotation?:number;flipX?:boolean;flipY?:boolean};
export type GeometryPoint3DConstraint={type:'segment'|'midpoint';from:string;to:string;t?:number};
export type GeometryPoint3D={id:string;name:string;p:[number,number,number];constraint?:GeometryPoint3DConstraint};
export type GeometrySegment3D={id:string;from:string;to:string;kind:'segment'|'line'|'vector'};
export type GeometryPlane3D={id:string;name:string;a:number;b:number;c:number;d:number};
export type GeometryObjectConfig={solid:string;view:'solid'|'net';rx:number;ry:number;labels:boolean;vertices:boolean;hidden:boolean;section:boolean;background:boolean;surfaceMode:'solid'|'outline'|'lateral-transparent';inkColor:string;inkWidth:number;inkStyle:string;scaleX?:number;scaleY?:number;scaleZ?:number;cameraZoom?:number;showAxes?:boolean;showGrid?:boolean;showLengths?:boolean;sectionOffset?:number;sectionMode?:'horizontal'|'three-points';sectionPointIds?:[string,string,string];foldProgress?:number;cutEdges?:string[];fixedFaceIndex?:number;constructionPoints?:GeometryPoint3D[];constructionSegments?:GeometrySegment3D[];constructionPlanes?:GeometryPlane3D[];vertexOverrides?:Record<string,[number,number,number]>};
export type ImageItem={id:string;kind:'image';x:number;y:number;w:number;h:number;src:string;rotation?:number;flipX?:boolean;flipY?:boolean;geometry?:GeometryObjectConfig};
export type BoardItem=Stroke|Shape|TextItem|ImageItem;
export type Background='white'|'black'|'grid'|'dots'|'lined'|'graph'|'chemistry'|'physics'|'notebook';
export type BoardPage={id:string;name:string;items:BoardItem[];background:Background;backgroundImage?:string;paperColor?:string;lineColor?:string;spacing?:number;border?:boolean;margins?:boolean};
export type BoardDocument={title:string;pages:BoardPage[];activeId:string;paperFormat?:'A4'};
// A4 portrait at 96 CSS pixels per inch (210 × 297 mm).
export const W=794,H=1123;
export const createPage=(n:number):BoardPage=>({id:crypto.randomUUID(),name:`Trang ${n}`,items:[],background:'lined'});
export const initialDocument=():BoardDocument=>{const page=createPage(1);return {title:'Ghi chú mới',pages:[page],activeId:page.id,paperFormat:'A4'}};
