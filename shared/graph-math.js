// Small expression parser: no eval, Function or global access.
const FUNCTIONS={sin:Math.sin,cos:Math.cos,tan:Math.tan,abs:Math.abs,sqrt:Math.sqrt,ln:Math.log,log:Math.log10,exp:Math.exp,asin:Math.asin,acos:Math.acos,atan:Math.atan};
export function compileExpression(source){
  if(typeof source!=='string'||source.length>240)throw Error('Biểu thức quá dài hoặc không hợp lệ.');
  const tokens=source.replace(/π/g,'pi').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z]+|[+*/^(),-]/g)||[];
  if(tokens.join('').toLowerCase()!==source.replace(/\s+/g,'').replace(/π/g,'pi').toLowerCase())throw Error('Ký tự không hợp lệ.');
  let i=0,depth=0;
  const peek=()=>tokens[i];
  const take=x=>{if(peek()===x){i++;return true}return false};
  const expr=()=>{let a=term();while(peek()==='+'||peek()==='-'){const op=tokens[i++],b=term(),old=a;a=x=>op==='+'?old(x)+b(x):old(x)-b(x)}return a};
  const term=()=>{let a=unary();while(peek()==='*'||peek()==='/'){const op=tokens[i++],b=unary(),old=a;a=x=>op==='*'?old(x)*b(x):old(x)/b(x)}return a};
  const unary=()=>{if(take('+'))return unary();if(take('-')){const a=unary();return x=>-a(x)}return power()};
  const power=()=>{let a=primary();if(take('^')){const b=unary(),old=a;a=x=>Math.pow(old(x),b(x))}return a};
  const primary=()=>{
    if(++depth>90)throw Error('Biểu thức quá phức tạp.');
    try{
      if(take('(')){const a=expr();if(!take(')'))throw Error('Thiếu dấu đóng ngoặc.');return a}
      const t=tokens[i++];if(t===undefined)throw Error('Thiếu toán hạng.');
      if(/^\d|^\.\d/.test(t)){const value=Number(t);return ()=>value}
      const name=t.toLowerCase();if(name==='x')return x=>x;if(name==='pi')return ()=>Math.PI;if(name==='e')return ()=>Math.E;
      if(Object.hasOwn(FUNCTIONS,name)){if(!take('('))throw Error('Hàm phải có ngoặc.');const arg=expr();if(!take(')'))throw Error('Thiếu dấu đóng ngoặc.');return x=>FUNCTIONS[name](arg(x))}
      throw Error('Không hỗ trợ: '+t);
    }finally{depth--}
  };
  const result=expr();if(i!==tokens.length)throw Error('Biểu thức chưa hoàn chỉnh.');return result;
}
// Split segments on non-finite values and extreme screen-space jumps; this is a plotting heuristic.
export function sampleGraph(fn,{minX=-10,maxX=10,minY=-10,maxY=10,width=800,height=420,steps=1600}={}){
  if(!(maxX>minX&&maxY>minY))throw Error('Giới hạn trục không hợp lệ.');
  steps=Math.max(32,Math.min(4000,Math.round(steps)));const paths=[];let path=[],prev=null;
  for(let i=0;i<=steps;i++){
    const x=minX+(maxX-minX)*i/steps;let y;try{y=fn(x)}catch{y=NaN}
    const px=width*i/steps,py=(maxY-y)*height/(maxY-minY),valid=Number.isFinite(y)&&Number.isFinite(py)&&Math.abs(py)<height*10;
    const jump=prev&&valid&&Math.abs(py-prev.py)>height*.75;
    if(!valid||jump){if(path.length>1)paths.push(path);path=[]}
    if(valid){path.push([px,py]);prev={px,py}}else prev=null;
  }
  if(path.length>1)paths.push(path);return paths;
}
