'use strict';
// A service picker, not a ranking. Each service controls login and upload support.
const providers = [
 ['chatgpt','ChatGPT','https://chatgpt.com/'],
 ['claude','Claude','https://claude.ai/'],
 ['gemini','Gemini','https://gemini.google.com/'],
 ['copilot','Copilot','https://copilot.microsoft.com/'],
 ['perplexity','Perplexity','https://www.perplexity.ai/'],
 ['deepseek','DeepSeek','https://chat.deepseek.com/'],
 ['grok','Grok','https://grok.com/'],
 ['mistral','Le Chat','https://chat.mistral.ai/'],
 ['qwen','Qwen','https://chat.qwen.ai/'],
 ['kimi','Kimi','https://www.kimi.com/'],
 ['poe','Poe','https://poe.com/']
].map(([id,name,url])=>({id,name,url}));
const get=id=>providers.find(p=>p.id===id)||providers[0];
function serviceURL(value,id) {
 try {const u=new URL(value), host=new URL(get(id).url).hostname;
 return u.protocol==='https:'&&!u.username&&!u.password&&
 (u.hostname===host||u.hostname.endsWith('.'+host)||
 (id==='perplexity'&&u.hostname==='perplexity.ai'));}catch{return false;}
}
module.exports={providers,get,serviceURL};
