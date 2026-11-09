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

export type ExamHeaderConfig={
  department:string;
  school:string;
  examTitle:string;
  subject:string;
  duration:string;
  examCode:string;
  academicYear:string;
  showStudentInfo:boolean;
};

export type ExamFigureSource={
  id:string;
  kind:'board'|'3d'|'graph'|'molecule';
  label:string;
  src:string;
  aspectRatio:number;
  pointFontSize:number;
  strokeColor:string;
  // Source config so editing on the board live-updates the figure in the exam
  graphFormula?:string;
  graphXMin?:number;
  graphXMax?:number;
  graphYMin?:number;
  graphYMax?:number;
  solid3DConfig?: {
    solid:'pyramid3'|'pyramid4'|'prism3'|'cube'|'cylinder'|'cone';
    rx:number;
    ry:number;
    showMidpoints:boolean;
    showSection:boolean;
    faceColor:string;
    pointLabels:string[];
  };
  moleculeConfig?: {
    preset:string;
    atoms:Array<{id:string;el:string;x:number;y:number}>;
    bonds:Array<{from:string;to:string;order:1|2|3}>;
  };
  boardStrokes?:Array<{id:string;points:Array<{x:number;y:number}>;color:string;width:number;label?:string;lx?:number;ly?:number}>;
};

export type ExamInlineFigure={
  id:string;
  sourceId:string;
  src:string;
  width:number; // px on A4 page (e.g. 120..620)
  align:'left'|'center'|'right';
  caption?:string;
};

export type ExamStatementTF={
  id:string;
  label:'a'|'b'|'c'|'d';
  text:string;
  correct:boolean|null;
};

export type ExamBlock=
  | {
      id:string;
      type:'page-break';
    }
  | {
      id:string;
      type:'section';
      title:string;
      subtitle?:string;
      pageBreakBefore?:boolean;
    }
  | {
      id:string;
      type:'question';
      questionType:'mcq'|'tf'|'short'|'essay';
      points?:string; // e.g. "1 điểm", "0,25 điểm"
      prompt:string; // supports inline text, $latex$, \ce{...}
      align?:'left'|'center'|'right'|'justify';
      options?:[string,string,string,string];
      optionCols?:1|2|4; // 4 dòng (1 col), 2 dòng (2 cols), 1 dòng (4 cols)
      correctChoice?:'A'|'B'|'C'|'D'|'';
      statements?:ExamStatementTF[];
      shortAnswer?:string;
      solution?:string;
      figures?:ExamInlineFigure[];
      pageBreakBefore?:boolean;
    }
  | {
      id:string;
      type:'paragraph';
      text:string;
      align?:'left'|'center'|'right'|'justify';
      bold?:boolean;
      italic?:boolean;
      figures?:ExamInlineFigure[];
      pageBreakBefore?:boolean;
    };

export type ExamPaperDocument={
  fontFamily:string;
  fontSizePt:number;
  header:ExamHeaderConfig;
  blocks:ExamBlock[];
  figureSources:ExamFigureSource[];
  updatedAt:number;
};

export type BoardDocument={title:string;pages:BoardPage[];activeId:string;paperFormat?:'A4';examPaper?:ExamPaperDocument};
// A4 portrait at 96 CSS pixels per inch (210 × 297 mm).
export const W=794,H=1123;
export const createPage=(n:number):BoardPage=>({id:crypto.randomUUID(),name:`Trang ${n}`,items:[],background:'lined'});
export const initialDocument=():BoardDocument=>{const page=createPage(1);return {title:'Ghi chú mới',pages:[page],activeId:page.id,paperFormat:'A4'}};
