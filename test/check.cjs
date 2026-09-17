const fs=require('fs'),path=require('path'),cp=require('child_process');let count=0;
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules')continue;const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(/\.(js|cjs)$/.test(p)){cp.execFileSync(process.execPath,['--check',p]);count++;}}}scan('.');
const html=fs.readFileSync('index.html','utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]),duplicate=ids.filter((id,i)=>ids.indexOf(id)!==i);if(duplicate.length)throw Error('Duplicate DOM IDs: '+duplicate.join(','));
for(const [,url]of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)){if(url==='/'||!/[.](js|css|png)$/.test(url))continue;if(!fs.existsSync('.'+url))throw Error('Missing local asset: '+url);}
console.log(`${count} JavaScript files parsed; ${ids.length} unique DOM IDs; local assets present.`);
