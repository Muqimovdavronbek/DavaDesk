'use strict';
const {execFile}=require('node:child_process');
function contains(point,b) {
 return point.x>=b.x && point.y>=b.y && point.x<b.x+b.width && point.y<b.y+b.height;
}
class AutoCollapse {
 constructor(delay=600){this.delay=delay;this.outsideSince=null;this.pointerOutside=false;}
 reset(){this.outsideSince=null;this.pointerOutside=false;}
 hint(inside,now=Date.now()){
  this.pointerOutside=!inside;
  if(inside)this.outsideSince=null;
  else if(this.outsideSince===null)this.outsideSince=now;
 }
 update({expanded,visible,blocked,point,bounds,children=[]},now=Date.now()){
  if(!expanded || !visible){this.reset();return false;}
  if(blocked){this.outsideSince=null;return false;}
  // XWayland may retain the last inside coordinate on a Wayland surface.
  // A real leave event stays authoritative until another genuine entry/move.
  if(!this.pointerOutside && [bounds,...children].some(b=>contains(point,b))){
   this.outsideSince=null;return false;
  }
  if(this.outsideSince===null)this.outsideSince=now;
  return now-this.outsideSince>=this.delay;
 }
}
function nativeId(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length<4)throw new Error('X11 oyna ID topilmadi.');
 return '0x'+buffer.readUInt32LE(0).toString(16);
}
function pinLinuxWindow(win,pinned,run=execFile){
 const id=nativeId(win.getNativeWindowHandle());
 const commands=[
  ['-i','-r',id,'-t','-1'],
  ['-i','-r',id,'-b','add,sticky'],
  ['-i','-r',id,'-b',pinned?'add,above':'remove,above']
 ];
 // Exact native window ID; no title match and no shell.
 return commands.reduce((promise,args)=>promise.then(()=>new Promise((resolve,reject)=>{
  run('wmctrl',args,{timeout:1500,windowsHide:true},error=>error?reject(error):resolve());
 })),Promise.resolve());
}
module.exports={AutoCollapse,nativeId,pinLinuxWindow};
