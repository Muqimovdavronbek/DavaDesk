'use strict';
const path = require('node:path');
const ai = require('./providers.cjs');
const MIME = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
 '.svg':'image/svg+xml','.heic':'image/heic','.pdf':'application/pdf','.zip':'application/zip',
 '.txt':'text/plain','.md':'text/markdown','.csv':'text/csv','.json':'application/json',
 '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 '.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav'};

// Runs only in the chosen service. No file contents, paths or local bridge enter JS.
function findInput(files) {
  const editor=[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
    .find(el=>el.getClientRects().length && !el.disabled && !el.closest('[role="dialog"]'));
  if(!editor || document.querySelector('input[type="password"]')) return null;
  const form=editor.closest('form');
  const valid=[...document.querySelectorAll('input[type="file"]')].filter(el=>{
    if(el.disabled || el.webkitdirectory || el.files?.length || (files.length>1&&!el.multiple)) return false;
    if(/avatar|profile|cover|logo/i.test([el.id,el.name,el.getAttribute('aria-label'),el.getAttribute('data-testid')].join(' '))) return false;
    if(el.closest('[role="dialog"]') || (el.closest('form') && form && el.closest('form')!==form)) return false;
    const accept=el.accept.toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
    return !accept.length || files.every(f=>accept.some(a=>
      a==='*/*' || a===f.ext || a===f.type ||
      (a.endsWith('/*')&&f.type.startsWith(a.slice(0,-1))) ||
      (f.ext==='.zip'&&a==='application/x-zip-compressed')));
  });
  const near=valid.filter(el=>form&&form.contains(el));
  const candidates=near.length?near:valid;
  if(candidates.length===1) return candidates[0];
  // Prefer the general attachment field over a separate image-only field.
  const general=candidates.filter(el=>!el.accept.trim() || el.accept.trim()==='*/*');
  return general.length===1 ? general[0] : null;
}
function openAttachMenu(used) {
  const visible=el=>el.getClientRects().length && !el.disabled && el.getAttribute('aria-disabled')!=='true';
  if(![...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].some(visible)) return '';
  const candidates=[...document.querySelectorAll('button,[role="button"],[role="menuitem"]')];
  for(const el of candidates) {
    const label=(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').trim();
    if(!label || label.length>100 || used.includes(label) || !visible(el)) continue;
    if(/send|submit|delete|remove|profile|avatar|camera|record|yubor|отправ|удал/i.test(label)) continue;
    if(/attach|upload|add (photos|files)|fayl.*(qo.sh|yuk)|прикреп|загрузить (файл|фото)|上传(文件|图片)|添加文件/i.test(label)) {
      el.click();return label;
    }
  }
  return '';
}
const delay=(ms,signal)=>new Promise(resolve=>{
  const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};
  const timer=setTimeout(finish,ms);signal?.addEventListener('abort',finish,{once:true});
});
async function attachFiles(contents, files, providerId, options={}) {
  const {signal,onStatus=()=>{},timeoutMs=45000,pollMs=650}=options;
  const deadline=Date.now()+timeoutMs;
  const info=files.map(f=>({ext:path.extname(f.name).toLowerCase(),type:MIME[path.extname(f.name).toLowerCase()]||''}));
  let dbg, owned=false, intercepted=false, chooser=null, sent=false;
  let clicked=[], lastURL='', mainFrame='';
  const trusted=()=>{
    if(contents.isDestroyed() || signal?.aborted) return false;
    const url=contents.getURL();
    return ai.serviceURL(url,providerId) && !/\/(login|signin|auth|settings|profile|account)(\/|\?|$)/i.test(new URL(url).pathname);
  };
  const onMessage=(_event,method,params)=>{
    if(method==='Page.fileChooserOpened'&&params.frameId===mainFrame) chooser=params.backendNodeId;
  };
  const command=(method,params={})=>new Promise((resolve,reject)=>{
    let timer;
    const finish=(error,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
    const abort=()=>finish(new Error('Biriktirish to‘xtatildi.'));
    timer=setTimeout(()=>finish(new Error('Sayt javobini kutish vaqti tugadi.')),5000);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted) return abort();
    dbg.sendCommand(method,params).then(value=>finish(null,value),error=>finish(error));
  });
  const evaluate=async(expression,returnByValue=false)=>{
    const r=await command('Runtime.evaluate',{expression,returnByValue,userGesture:true});
    if(r.exceptionDetails) throw new Error('Saytning biriktirish maydoni o‘zgardi.');
    return r.result;
  };
  try {
    onStatus('waiting','AI ochilmoqda. Kerak bo‘lsa akkauntingizga kiring.');
    while(Date.now()<deadline && !signal?.aborted) {
      if(!trusted() || contents.isLoadingMainFrame?.()) {await delay(pollMs,signal);continue;}
      if(!owned) {
        dbg=contents.debugger;
        if(!dbg || dbg.isAttached()) throw new Error('Biriktirish uchun oynani qayta oching; DevTools ochiq bo‘lsa yoping.');
        dbg.attach('1.3');owned=true;
        dbg.on('message',onMessage);
        await command('Page.enable');
        await command('Page.setInterceptFileChooserDialog',{enabled:true});intercepted=true;
      }
      const current=contents.getURL();
      if(current!==lastURL) {lastURL=current;clicked=[];chooser=null;}
      const tree=await command('Page.getFrameTree');
      mainFrame=tree.frameTree.frame.id;
      let input=await evaluate('('+findInput.toString()+')('+JSON.stringify(info)+')');
      if(!input.objectId && chooser) {
        // The user or upload-menu click opened the site's native file picker.
        // Re-scan the live DOM so accept/multiple/old-file checks still apply.
        chooser=null;
        input=await evaluate('('+findInput.toString()+')('+JSON.stringify(info)+')');
      }
      if(input.objectId) {
        if(!trusted() || contents.getURL()!==current) continue;
        onStatus('attaching','Fayllar AI biriktirish maydoniga uzatilmoqda…');
        sent=true; // Never automatically retry a possibly delivered mutation.
        await command('DOM.setFileInputFiles',{objectId:input.objectId,files:files.map(f=>f.path)});
        return {phase:'handed-off',message:'Fayllar AI maydoniga berildi. Saytdagi yuklanish tugagach xabaringizni yozing.'};
      }
      if(clicked.length<2 && trusted()) {
        const r=await evaluate('('+openAttachMenu.toString()+')('+JSON.stringify(clicked)+')',true);
        if(r.value) clicked.push(r.value);
      }
      onStatus('waiting','Biriktirish maydoni kutilmoqda. Kirish kerak bo‘lsa kiring yoki saytning 📎 tugmasini bosing.');
      await delay(pollMs,signal);
    }
    return signal?.aborted
      ? {phase:'cancelled',message:'Kutilayotgan biriktirish to‘xtatildi.'}
      : {phase:'blocked',message:'Avtomatik biriktirilmadi. Saytga kiring, 📎 menyusini oching va “Qayta urinish”ni bosing. ZIP yoki bu fayl turi sayt tomonidan cheklangan bo‘lishi mumkin.'};
  } catch(error) {
    return {phase:sent?'uncertain':'blocked',message:sent
      ? 'Biriktirish natijasini saytda tekshiring. Takroriy yuklanmasligi uchun avtomatik qayta yuborilmadi.'
      : 'Biriktirish bajarilmadi: '+error.message};
  } finally {
    if(owned) {
      if(intercepted && !contents.isDestroyed()) {
        try {void dbg.sendCommand('Page.setInterceptFileChooserDialog',{enabled:false}).catch(()=>{});}catch{}
      }
      dbg.removeListener('message',onMessage);
      try {if(dbg.isAttached()) dbg.detach();}catch{}
    }
  }
}
module.exports={attachFiles,findInput,openAttachMenu};
