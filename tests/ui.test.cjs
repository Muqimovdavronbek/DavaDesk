'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the shipped renderer against its real element IDs and event bindings.
// Native window/authentication coverage is separate; this is not a screenshot test.
async function renderer() {
  const html=fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8');
  const all=[],ids=new Map(),calls=[];
  class Element {
    constructor(tag='div',attrs='') {
      this.tag=tag;this.listeners={};this.children=[];this._text='';this.dataset={};this.style={};this.value='';this.hidden=false;
      this.className=(attrs.match(/class="([^"]*)"/)||[])[1]||'';
      this.id=(attrs.match(/id="([^"]*)"/)||[])[1]||'';
      this.dataset.tab=(attrs.match(/data-tab="([^"]*)"/)||[])[1];
      this.classList={toggle:(name,enabled)=>{
        const items=new Set(this.className.split(' ').filter(Boolean));enabled?items.add(name):items.delete(name);this.className=[...items].join(' ');
      }};
      this.scrollTop=0;this.scrollHeight=100;this.clientHeight=100;
    }
    get options(){return this.children;}
    set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
    append(n){if(n.fragment)this.children.push(...n.children);else this.children.push(n);}
    replaceChildren(...nodes){this.children=[];this._text='';for(const node of nodes)this.append(node);}
    querySelector(selector){return this.children.find(x=>selector==='.empty-log'&&x.className==='empty-log')||null;}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
    async trigger(name,event={}){for(const fn of this.listeners[name]||[])await fn({target:this,preventDefault(){},...event});}
    focus(){this.focused=true;}closest(){return null;}getBoundingClientRect(){return{x:185,y:133,width:750,height:510};}
  }
  for(const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]+)>/gi)){
    const el=new Element(match[1],match[2]);all.push(el);if(el.id)ids.set(el.id,el);
  }
  const body=new Element('body');
  const document={body,documentElement:new Element('html'),getElementById:id=>{if(!ids.has(id))throw new Error('Unknown element: '+id);return ids.get(id);},
    querySelectorAll:selector=>all.filter(el=>selector==='[data-tab]'?Boolean(el.dataset.tab):el.className.split(' ').includes(selector.slice(1))),
    createElement:tag=>new Element(tag),createDocumentFragment:()=>{const el=new Element();el.fragment=true;return el;},addEventListener(){}};
  let eventListener;
  const initial={expanded:true,tab:'home',taskBusy:false,activeKind:'task',settings:{workspace:'/tmp/DavaDesk-work',sandbox:'read-only',pinned:true,autostart:false},login:{installed:true,authenticated:true},messages:[],hasAnswer:false,shortcutReady:true,webStatus:'not-loaded'};
  const fakeCall=async(action,payload)=>{
    calls.push({action,payload});
    if(action==='set-name')initial.settings.displayName=payload;
    if(action==='tab')initial.tab=payload;
    if(action==='toggle')initial.expanded=!initial.expanded;
    if(action==='task'){initial.taskBusy=true;initial.messages=[{kind:'user',text:payload}];}
    return {...initial,settings:{...initial.settings},messages:[...initial.messages]};
  };
  const context=vm.createContext({window:{dava:{call:fakeCall,onEvent:fn=>eventListener=fn}},document,
    Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){}},console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,ids,calls,initial,event:value=>eventListener(value)};
}
test('all renderer bindings refer to actual elements; dock expands and ChatGPT tab routes',async()=>{
  const ui=await renderer();assert.equal(ui.ids.get('workspace-path').textContent,'/tmp/DavaDesk-work');
  await ui.ids.get('start-chat').trigger('click');await new Promise(resolve=>setImmediate(resolve));
  assert(ui.calls.some(x=>x.action==='tab'&&x.payload==='chat'));
  assert.equal(ui.ids.get('page-chat').hidden,false);assert.equal(ui.ids.get('page-home').hidden,true);
  assert(ui.calls.some(x=>x.action==='web-bounds'));
  await ui.ids.get('minimize').trigger('click');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(vm.runInContext('document.body.dataset.expanded',ui.context),'false');
});
test('task input is sent once, then cleared and disabled while the task runs',async()=>{
  const ui=await renderer();
  ui.ids.get('prompt').value='Fayl yarating';await ui.ids.get('prompt').trigger('input');
  assert.equal(ui.ids.get('run').disabled,false);
  await ui.ids.get('run').trigger('click');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.calls.filter(x=>x.action==='task').length,1);
  assert.equal(ui.ids.get('prompt').value,'');assert.equal(ui.ids.get('run').hidden,true);
  assert.equal(ui.ids.get('stop').hidden,false);
  await ui.ids.get('run').trigger('click');
  assert.equal(ui.calls.filter(x=>x.action==='task').length,1);
});
test('assistant and command output remains literal text, never renderer HTML',async()=>{
  const ui=await renderer();
  ui.event({type:'message',message:{kind:'answer',text:'<img src=x onerror="evil()"><script>evil()</script>'}});
  const log=ui.ids.get('task-log');
  assert(log.textContent.includes('<script>evil()</script>'));
  assert.equal(log.children[0].children[1].tag,'span');
  assert.equal(log.children[0].children[1].children.length,0);
});

test('greeting and editable profile use the current name as literal text',async()=>{
 const ui=await renderer();
 assert.equal(ui.ids.get('welcome-form').hidden,false);
 ui.ids.get('welcome-name').value='Ali';
 await ui.ids.get('welcome-form').trigger('submit');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.ids.get('greeting').textContent,'Salom, Ali.');
 assert.equal(ui.ids.get('welcome-form').hidden,true);
 ui.ids.get('profile-name').value='<b>Nodira</b>';
 await ui.ids.get('profile-form').trigger('submit');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.ids.get('greeting').textContent,'Salom, <b>Nodira</b>.');
 assert.equal(ui.ids.get('greeting').children.length,0);
});
