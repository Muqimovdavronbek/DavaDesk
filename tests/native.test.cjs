'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {EventEmitter}=require('node:events');
const {pathToFileURL}=require('node:url');
const core=require('../lib/core.cjs');

async function harness(t,{holdUpload=false,firstRun=false,platform='linux'}={}) {
  let now=0,completeUpload;const intervals=[];
  class Clock extends Date {static now(){return now;}}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'davadesk-native-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  if(!firstRun)fs.writeFileSync(path.join(root,'settings.json'),JSON.stringify({displayName:'Test User'}));
  let mainWindow, runner;const uploads=[];
  const views=[], handlers=new Map(), permissionSession=new EventEmitter();
  permissionSession.setPermissionCheckHandler=fn=>permissionSession.check=fn;
  permissionSession.setPermissionRequestHandler=fn=>permissionSession.request=fn;
  permissionSession.clearStorageData=async()=>{};
  class Contents extends EventEmitter {
    constructor(){super();this.closed=false;}
    send(){}setWindowOpenHandler(fn){this.open=fn;}isDestroyed(){return this.closed;}
    async loadURL(url){this.url=url;}getURL(){return this.url;}reload(){}close(){this.closed=true;}
  }
  class Window extends EventEmitter {
    constructor(opts){super();this.opts=opts;this.bounds=opts;this.webContents=new Contents();this.visible=false;this.contentView={addChildView:()=>{}};mainWindow=this;}
    getChildWindows(){return [];}
    setBounds(b){this.bounds=b;}getBounds(){return this.bounds;}setResizable(){}setMinimumSize(){}
    setAlwaysOnTop(){}setMenu(){}isDestroyed(){return false;}show(){this.visible=true;}hide(){this.visible=false;}
    isVisible(){return this.visible;}focus(){}async loadFile(){}getContentSize(){return [this.bounds.width,this.bounds.height];}
  }
  class View{constructor(opts){this.opts=opts;this.webContents=new Contents();views.push(this);}setBackgroundColor(){}setVisible(v){this.visible=v;}getChildWindows(){return [];}
    setBounds(b){this.bounds=b;}}
  class Runner extends EventEmitter{constructor(binary){super();this.binary=binary;runner=this;}start(){this.started=true;}login(){}stop(){return false;}}
  const app=new EventEmitter();
  Object.assign(app,{setName(){},setAppUserModelId(){},setLoginItemSettings(value){app.loginSettings=value;},isPackaged:true,setPath(){},getPath:()=>root,getVersion:()=> '1.0.0',requestSingleInstanceLock:()=>true,whenReady:async()=>{},quit(){},disableHardwareAcceleration(){}});
  let cursor={x:1100,y:750};
  const screen=new EventEmitter();Object.assign(screen,{getCursorScreenPoint:()=>cursor,getDisplayNearestPoint:()=>({workArea:{x:0,y:32,width:1280,height:868}}),getPrimaryDisplay:()=>({workArea:{x:0,y:32,width:1280,height:868}}),getDisplayMatching:()=>({workArea:{x:0,y:32,width:1280,height:868}})});
  const electron={app,BrowserWindow:Window,WebContentsView:View,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},screen,
    shell:{openExternal:async()=>{},openPath:async()=>''},dialog:{showMessageBox:async()=>({response:0}),showErrorBox:()=>{},showOpenDialog:async()=>({canceled:true})},
    session:{fromPartition:()=>permissionSession},Tray:class{setToolTip(){}setContextMenu(){}on(){}},Menu:{buildFromTemplate:()=>[]},
    globalShortcut:{register:()=>true,unregisterAll(){}},Notification:class{static isSupported(){return false;}},clipboard:{writeText(){}},nativeImage:{createFromPath:()=>({})}};
  const appDir=path.resolve(__dirname,'..');
  vm.runInNewContext(fs.readFileSync(path.join(appDir,'main.cjs'),'utf8'),{
    require(name){
      if(name==='electron')return electron;
      if(name==='node:os')return {homedir:()=>path.join(root,'home')};
      if(name==='./lib/core.cjs')return core;
      if(name==='./lib/window-behavior.cjs')return require('../lib/window-behavior.cjs');
      if(name==='./lib/desktop.cjs')return require('../lib/desktop.cjs');
      if(name==='./lib/upload.cjs')return {attachFiles:async(contents,files,providerId)=>{uploads.push({contents,files,providerId});if(holdUpload)await new Promise(resolve=>{completeUpload=resolve;});return {phase:'handed-off',message:'handed off'};}};
      if(name==='./lib/providers.cjs')return require('../lib/providers.cjs');
      if(name==='./lib/codex.cjs')return {findCodex:()=>'/fake/codex',loginStatus:async()=>({installed:true,authenticated:true}),CodexRunner:Runner};
      return require(name);
    },__dirname:appDir,AbortController,Date:Clock,process:{platform,execPath:'C:/DavaDesk/DavaDesk.exe',env:{PATH:''}},setTimeout,clearTimeout,setInterval:fn=>{intervals.push(fn);return 1;},clearInterval(){}
  });
  // Allow the actual async whenReady / loadFile / login-status path to complete.
  await new Promise(resolve=>setImmediate(resolve));
  const localEvent={sender:mainWindow.webContents,senderFrame:{url:pathToFileURL(path.join(appDir,'ui/index.html')).href}};
  const invoke=(action,payload,event=localEvent)=>handlers.get('dava:call')(event,action,payload);
  return {configPath:path.join(root,'settings.json'),tick:time=>{now=time;intervals.forEach(fn=>fn());},finishUpload:()=>completeUpload?.(),invoke,uploads,mainWindow,views,runner,permissionSession,app,setCursor:point=>{cursor=point;}};
}
test('native shell starts compact and ChatGPT loads in an isolated remote view',async t=>{
  const {invoke,mainWindow,views}=await harness(t);
  assert.equal((await invoke('state')).expanded,false);
  assert.equal(mainWindow.opts.webPreferences.nodeIntegration,false);
  await invoke('tab','chat');
  assert.equal(views.length,1);assert.equal(views[0].visible,true);
  assert.equal(views[0].opts.webPreferences.nodeIntegration,false);
  assert.equal(views[0].opts.webPreferences.sandbox,true);
  assert.equal(views[0].opts.webPreferences.preload,undefined);
  assert.equal(views[0].webContents.url,'https://chatgpt.com/');
  await invoke('toggle');assert.equal(views[0].visible,false);
  assert.equal((await invoke('state')).expanded,false);
});
test('remote ChatGPT cannot invoke local filesystem or execution controls',async t=>{
  const {invoke}=await harness(t);
  await assert.rejects(invoke('task','do work',{sender:{},senderFrame:{url:'https://chatgpt.com/'}}));
  await assert.rejects(invoke('sandbox','danger-full-access'));
});
test('an async authentication check reserves the task slot against simultaneous requests',async t=>{
  const {invoke,runner}=await harness(t);
  const first=invoke('task','create a file');
  await assert.rejects(invoke('task','another task'),/all.*ishlayapti/);
  await first;assert.equal(runner.started,true);
  assert.equal((await invoke('state')).taskBusy,true);
  runner.emit('finish',{success:false,cancelled:true,message:'To‘xtatildi'});
  assert.equal((await invoke('state')).taskBusy,false);
});
test('media permissions are rejected for untrusted origins',async t=>{
  const {invoke,permissionSession}=await harness(t);await invoke('tab','chat');
  let allowed;
  await permissionSession.request({getURL:()=> 'https://evil.test/'},'media',value=>allowed=value,{requestingOrigin:'https://evil.test/'});
  assert.equal(allowed,false);
  assert.equal(permissionSession.check({},'media','https://evil.test/'),false);
});

test('panel restores the exact pet anchor and tab changes preserve panel geometry',async t=>{
 const {invoke,mainWindow}=await harness(t);
 const anchor={...mainWindow.getBounds()};
 await invoke('tab','chat');
 mainWindow.setBounds({x:50,y:90,width:700,height:600});
 await invoke('tab','settings');
 assert.equal(mainWindow.getBounds().x,50);
 assert.equal(mainWindow.getBounds().width,700);
 await invoke('toggle');
 assert.equal(mainWindow.getBounds().x,anchor.x);
 assert.equal(mainWindow.getBounds().y,anchor.y);
 assert.equal(mainWindow.getBounds().width,88);
 await invoke('toggle');
 assert.equal(mainWindow.getBounds().x,50);
});
test('provider switching retains separate sandboxed views without exposing the local bridge',async t=>{
 const {invoke,views}=await harness(t);
 await invoke('tab','chat');await invoke('provider','claude');
 assert.equal(views.length,2);
 assert.equal(views[0].visible,false);assert.equal(views[1].visible,true);
 assert.equal(views[1].webContents.url,'https://claude.ai/');
 assert.equal(views[1].opts.webPreferences.preload,undefined);
 await invoke('provider','chatgpt');
 assert.equal(views.length,2);assert.equal(views[0].visible,true);
 await assert.rejects(invoke('provider','evil'));
});
test('dropped files are copied without overwriting originals and routed to AI',async t=>{
 const {invoke}=await harness(t);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dava-drop-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const original=path.join(dir,'lesson.txt');fs.writeFileSync(original,'hello');
 const state=await invoke('files',[original]);
 assert.equal(state.attachments.length,1);
 assert.notEqual(state.attachments[0].path,original);
 assert.equal(fs.readFileSync(state.attachments[0].path,'utf8'),'hello');
 assert.equal(state.tab,'chat');
 const second=await invoke('files',[original]);
 assert.notEqual(second.attachments[0].path,second.attachments[1].path);
 await assert.rejects(invoke('files',[dir]));
 await assert.rejects(invoke('files',['relative.txt']));
});
test('dragging clamps the mascot to the monitor and snaps it to an edge',async t=>{
 const {invoke,mainWindow,setCursor}=await harness(t);
 setCursor({x:1100,y:750});await invoke('drag-start');
 setCursor({x:-1000,y:-1000});await invoke('drag-move');await invoke('drag-end');
 assert.equal(mainWindow.getBounds().x,0);assert.equal(mainWindow.getBounds().y,32);
});

test('dropping an image/ZIP opens the chosen AI and hands off only the new batch',async t=>{
 const {invoke,uploads}=await harness(t);
 await invoke('provider','claude');await invoke('toggle');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dava-ai-drop-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const first=path.join(dir,'a.zip'),second=path.join(dir,'photo.png');
 fs.writeFileSync(first,'zip fixture');fs.writeFileSync(second,'image fixture');
 const state=await invoke('files',[first,second]);
 assert.equal(state.tab,'chat');assert.equal(state.expanded,true);
 assert.equal(uploads.length,1);assert.equal(uploads[0].providerId,'claude');
 assert.equal(uploads[0].files.length,2);
 assert.equal(path.basename(uploads[0].files[0].path),'a.zip');
 await invoke('files',[second]);
 assert.equal(uploads.length,2);assert.equal(uploads[1].files.length,1);
 assert.equal((await invoke('state')).upload.phase,'handed-off');
});

test('actual native polling collapses the AI window while file handoff is pending',async t=>{
 const {invoke,tick,setCursor,finishUpload}=await harness(t,{holdUpload:true});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dava-hover-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'photo.png');fs.writeFileSync(file,'fixture');
 await invoke('files',[file]);
 assert.equal((await invoke('state')).uploadBusy,true);
 setCursor({x:5000,y:5000});
 tick(0);tick(601);
 assert.equal((await invoke('state')).expanded,false);
 assert.equal((await invoke('state')).uploadBusy,true);
 finishUpload();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await invoke('state')).uploadBusy,false);
});

test('first launch requests a name and a later profile edit persists it',async t=>{
 const {invoke,configPath}=await harness(t,{firstRun:true});
 let state=await invoke('state');
 assert.equal(state.expanded,true);assert.equal(state.tab,'home');assert.equal(state.settings.displayName,'');
 state=await invoke('set-name','  Ali   Valiyev  ');
 assert.equal(state.settings.displayName,'Ali Valiyev');
 assert.equal(JSON.parse(fs.readFileSync(configPath,'utf8')).displayName,'Ali Valiyev');
 state=await invoke('set-name','Nodira');
 assert.equal(state.settings.displayName,'Nodira');
 await assert.rejects(invoke('set-name','   '));
});
test('native AI mouseLeave overrides a stale inside cursor coordinate',async t=>{
 const {invoke,views,setCursor,tick,mainWindow}=await harness(t);
 await invoke('tab','chat');
 const b=mainWindow.getBounds();setCursor({x:b.x+200,y:b.y+200});
 tick(0);
 views[0].webContents.emit('before-mouse-event',{}, {type:'mouseLeave'});
 tick(601);
 assert.equal((await invoke('state')).expanded,false);
});
test('moving from AI view into the local panel cancels pending collapse',async t=>{
 const {invoke,views,setCursor,tick,mainWindow}=await harness(t);
 await invoke('tab','chat');
 const b=mainWindow.getBounds();setCursor({x:b.x+100,y:b.y+100});
 tick(0);
 views[0].webContents.emit('before-mouse-event',{}, {type:'mouseLeave'});
 tick(300);
 mainWindow.webContents.emit('before-mouse-event',{}, {type:'mouseMove'});
 tick(1000);
 assert.equal((await invoke('state')).expanded,true);
});
test('local document leave also overrides stale native cursor',async t=>{
 const {invoke,setCursor,tick,mainWindow}=await harness(t);
 await invoke('tab','settings');
 const b=mainWindow.getBounds();setCursor({x:b.x+100,y:b.y+100});
 tick(0);await invoke('pointer-outside');tick(601);
 assert.equal((await invoke('state')).expanded,false);
});

test('Windows autostart targets the portable EXE and reports the native desktop setting',async t=>{
 const {invoke,app}=await harness(t,{platform:'win32'});
 const state=await invoke('autostart',true);
 assert.equal(state.settings.autostart,true);
 assert.equal(app.loginSettings.path,'C:/DavaDesk/DavaDesk.exe');
 assert.equal(app.loginSettings.args.length,0);
 assert.equal(app.loginSettings.openAtLogin,true);
 assert(state.workspaceStatus.includes('Win+Tab'));
 await invoke('autostart',false);
 assert.equal(app.loginSettings.openAtLogin,false);
});
