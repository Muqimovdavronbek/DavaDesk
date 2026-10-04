'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {AutoCollapse,pinLinuxWindow}=require('../lib/window-behavior.cjs');
const base={expanded:true,visible:true,blocked:false,bounds:{x:100,y:100,width:800,height:600},point:{x:950,y:200}};
test('cursor outside a remote AI area collapses after 600ms, including during uploads',()=>{
 const tracker=new AutoCollapse();
 assert.equal(tracker.update({...base,uploadBusy:true},0),false);
 assert.equal(tracker.update({...base,uploadBusy:true},599),false);
 assert.equal(tracker.update({...base,uploadBusy:true},600),true);
});
test('re-entry resets the delay and only the popup area protects a popup',()=>{
 const tracker=new AutoCollapse();
 tracker.update(base,0);
 assert.equal(tracker.update({...base,point:{x:200,y:200}},500),false);
 assert.equal(tracker.update(base,600),false);
 assert.equal(tracker.update(base,1199),false);
 const children=[{x:900,y:100,width:200,height:300}];
 assert.equal(tracker.update({...base,children},1200),false);
 const outside={...base,point:{x:1200,y:200},children};
 assert.equal(tracker.update(outside,1300),false);
 assert.equal(tracker.update(outside,1900),true);
});
test('native dialogs and dragging pause collapse and start a fresh delay afterward',()=>{
 const tracker=new AutoCollapse();
 tracker.update(base,0);
 assert.equal(tracker.update({...base,blocked:true},900),false);
 assert.equal(tracker.update(base,1000),false);
 assert.equal(tracker.update(base,1600),true);
});
test('Linux uses exact native window id for all desktops, sticky and above',async()=>{
 const calls=[];const buffer=Buffer.alloc(8);buffer.writeUInt32LE(0x123456,0);
 await pinLinuxWindow({getNativeWindowHandle:()=>buffer},true,(exe,args,opts,done)=>{
  calls.push({exe,args,opts});done(null);
 });
 assert.deepEqual(calls.map(c=>c.args),[
 ['-i','-r','0x123456','-t','-1'],
 ['-i','-r','0x123456','-b','add,sticky'],
 ['-i','-r','0x123456','-b','add,above']]);
 assert(calls.every(c=>c.exe==='wmctrl'&&!c.opts.shell));
});
test('turning pin off removes above without removing all-workspace visibility',async()=>{
 const calls=[];const b=Buffer.alloc(4);b.writeUInt32LE(42);
 await pinLinuxWindow({getNativeWindowHandle:()=>b},false,(_exe,args,_opts,done)=>{calls.push(args);done(null);});
 assert.equal(calls[0].at(-1),'-1');
 assert.equal(calls[2].at(-1),'remove,above');
});
test('missing wmctrl is reported rather than silently treated as success',async()=>{
 const b=Buffer.alloc(4);b.writeUInt32LE(42);
 await assert.rejects(pinLinuxWindow({getNativeWindowHandle:()=>b},true,(_exe,_args,_opts,done)=>{
  const error=new Error('missing');error.code='ENOENT';done(error);
 }),{code:'ENOENT'});
});
