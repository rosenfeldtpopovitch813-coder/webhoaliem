function extractText(data){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 return (Array.isArray(data?.output)?data.output:[]).flatMap(item=>Array.isArray(item.content)?item.content:[]).filter(item=>item.type==='output_text'&&typeof item.text==='string').map(item=>item.text).join('\n').trim();
}
module.exports={extractText};
