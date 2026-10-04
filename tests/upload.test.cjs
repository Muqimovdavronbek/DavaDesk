'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const vm=require('node:vm');
const {attachFiles}=require('../lib/upload.cjs');

function fixture({accept='',multiple=true,existing=0,url='https://chatgpt.com/',menu=false,failSet=false}={}) {
  const calls=[];let hasInput=!menu,clicks=0;
  const form={contains:el=>el===input};
  const input={id:'chat-file',name:'',disabled:false,webkitdirectory:false,multiple,accept,files:Array(existing),
    getAttribute:()=>'',closest:selector=>selector==='form'?form:null};
  const editor={getAttribute:()=>null,disabled:false,getClientRects:()=>[{}],closest:selector=>selector==='form'?form:null};
  const button={disabled:false,getClientRects:()=>[{}],getAttribute:name=>name==='aria-label'?'Upload files':null,
    click:()=>{clicks++;hasInput=true;}};
  const document={
    querySelector:()=>null,
    querySelectorAll:selector=>selector==='input[type="file"]'?(hasInput?[input]:[])
      :selector.startsWith('textarea')?[editor]:[button]
  };
  const dbg=new EventEmitter();dbg.attached=false;
  dbg.isAttached=()=>dbg.attached;dbg.attach=()=>{dbg.attached=true;};
  dbg.detach=()=>{dbg.attached=false;};
  dbg.sendCommand=async(method,params={})=>{
    calls.push({method,params});
    if(method==='Page.getFrameTree')return {frameTree:{frame:{id:'main'}}};
    if(method==='Runtime.evaluate') {
      const value=vm.runInNewContext(params.expression,{document});
      return {result:value===input?{objectId:'file-input'}:{value}};
    }
    if(method==='DOM.setFileInputFiles'&&failSet) throw new Error('navigation interrupted');
    return {};
  };
  const contents={debugger:dbg,isDestroyed:()=>false,getURL:()=>url,isLoadingMainFrame:()=>false};
  return {contents,calls,dbg,get clicks(){return clicks;}};
}
const file=name=>({name,path:'/fixtures/'+name});
test('a mixed image/ZIP batch reaches the native input exactly once without submitting chat',async()=>{
  const f=fixture();
  const result=await attachFiles(f.contents,[file('image.png'),file('project.zip')],'chatgpt',{timeoutMs:50,pollMs:1});
  assert.equal(result.phase,'handed-off');
  const sets=f.calls.filter(c=>c.method==='DOM.setFileInputFiles');
  assert.equal(sets.length,1);assert.deepEqual(sets[0].params.files,['/fixtures/image.png','/fixtures/project.zip']);
  assert.equal(f.clicks,0);assert.equal(f.dbg.isAttached(),false);
  assert.equal(f.dbg.listenerCount('message'),0);
});
test('only the upload menu is clicked when it must reveal the file input',async()=>{
  const f=fixture({menu:true});
  assert.equal((await attachFiles(f.contents,[file('photo.png')],'chatgpt',{timeoutMs:100,pollMs:1})).phase,'handed-off');
  assert.equal(f.clicks,1);
});
test('ZIP is not forced into an image-only upload control',async()=>{
  const f=fixture({accept:'image/*'});
  assert.equal((await attachFiles(f.contents,[file('a.zip')],'chatgpt',{timeoutMs:12,pollMs:1})).phase,'blocked');
  assert.equal(f.calls.some(c=>c.method==='DOM.setFileInputFiles'),false);
});
test('existing file inputs and single-file inputs are not overwritten with a batch',async()=>{
  for(const opts of [{existing:1},{multiple:false}]) {
    const f=fixture(opts);
    await attachFiles(f.contents,[file('a.png'),file('b.png')],'chatgpt',{timeoutMs:12,pollMs:1});
    assert.equal(f.calls.some(c=>c.method==='DOM.setFileInputFiles'),false);
  }
});
test('authentication and foreign origins never receive local files or injected scripts',async()=>{
  for(const url of ['https://accounts.google.com/','https://evil.test/','https://chatgpt.com/settings']) {
    const f=fixture({url});
    const result=await attachFiles(f.contents,[file('a.png')],'chatgpt',{timeoutMs:8,pollMs:1});
    assert.equal(result.phase,'blocked');assert.equal(f.calls.length,0);
  }
});
test('a cancelled wait does not hand files to a later page',async()=>{
  const f=fixture({url:'https://accounts.google.com/'});
  const controller=new AbortController();
  const operation=attachFiles(f.contents,[file('a.png')],'chatgpt',{signal:controller.signal,timeoutMs:100,pollMs:1});
  controller.abort();
  assert.equal((await operation).phase,'cancelled');
  assert.equal(f.calls.length,0);
});
test('an uncertain native upload is not retried or falsely reported successful',async()=>{
  const f=fixture({failSet:true});
  const result=await attachFiles(f.contents,[file('a.png')],'chatgpt',{timeoutMs:100,pollMs:1});
  assert.equal(result.phase,'uncertain');
  assert.equal(f.calls.filter(c=>c.method==='DOM.setFileInputFiles').length,1);
  assert.equal(f.dbg.isAttached(),false);
});
