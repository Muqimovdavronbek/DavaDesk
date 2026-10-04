'use strict';
function clamp(b,a) {
  const width=Math.min(b.width,a.width), height=Math.min(b.height,a.height);
  return {x:Math.round(Math.max(a.x,Math.min(b.x,a.x+a.width-width))),
    y:Math.round(Math.max(a.y,Math.min(b.y,a.y+a.height-height))),width,height};
}
function compact(b,a) {
  let r=clamp({...b,width:88,height:96},a);
  if(r.x-a.x<48) r.x=a.x;
  if(a.x+a.width-r.x-r.width<48) r.x=a.x+a.width-r.width;
  if(r.y-a.y<48) r.y=a.y;
  if(a.y+a.height-r.y-r.height<48) r.y=a.y+a.height-r.height;
  return r;
}
module.exports={clamp,compact};
