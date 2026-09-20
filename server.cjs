// Local development server. No fixture data or production credentials are embedded.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
for(const file of ['.env','.env.local'])if(fs.existsSync(path.join(__dirname,file)))process.loadEnvFile(path.join(__dirname,file));
const api=new Set(['time','rooms','leaderboards','study-time','exam','gemini','token','themes','admin-token','admin-users','admissions']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  if(url.pathname.startsWith('/api/')){
   const name=url.pathname.slice(5);if(!api.has(name))return res.status(404).json({error:'Không tìm thấy API.'});
   let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>3500000)return res.status(413).json({error:'Dữ liệu quá lớn.'});body+=chunk;}
   try{req.body=body?JSON.parse(body):{};}catch{return res.status(400).json({error:'Dữ liệu không hợp lệ.'});}
   req.query=Object.fromEntries(url.searchParams);await require('./api/'+name+'.js')(req,res);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(__dirname,'.'+relative),extension=path.extname(file);
  if(!file.startsWith(__dirname+path.sep)||!mime[extension]||/^\/(lib|tests|node_modules)\//.test(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
  res.setHeader('Content-Type',mime[extension]);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=()');res.setHeader('Cache-Control','no-cache');if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(error){console.error('Local server',error);if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Không thể xử lý yêu cầu.');}
});
const port=Number(process.env.PORT)||3000;server.listen(port,'127.0.0.1',()=>console.log(`WEBHOALIEM: http://localhost:${port}`));
