'use strict';
const $ = id => document.getElementById(id);
const nativeBridge = Boolean(window.dava);
const bridge = window.dava || {
  call: async action => {
    if (action === 'state') return { expanded: true, tab: 'home', taskBusy: false, settings: { workspace: '~/DavaDesk-work', sandbox: 'read-only', pinned: true, autostart: false }, login: { authenticated: false, installed: false }, messages: [], hasAnswer: false, shortcutReady: false };
    if (action === 'browser') { window.open('https://chatgpt.com/', '_blank', 'noopener'); return; }
    throw new Error('Bu interfeys ko‘rinishi. Dastur uchun launch.sh ni ishga tushiring.');
  },
  onEvent: () => () => {}
};
let state = null, pending = false, toastTimer = null;
function toast(text) {
  $('toast').textContent = String(text).slice(0, 1200); $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 7000);
}
async function call(action, payload) {
  try { const result = await bridge.call(action, payload); if (result?.settings) applyState(result); return result; }
  catch (error) { toast(error.message || 'Amal bajarilmadi.'); return null; }
}
function applyState(next) {
  const wasBusy = state?.taskBusy;
  const tabChanged = state?.tab !== next.tab;
  state = next;
  const name=next.settings.displayName||'';
  $('greeting').textContent=name ? 'Salom, '+name+'.' : 'Salom!';
  $('welcome-form').hidden=Boolean(name);
  // Status updates must never erase a name the user is currently typing.
  if(document.activeElement!==$('profile-name')) $('profile-name').value=name;
  $('platform-label').textContent=(next.platform==='win32'?'Windows':next.platform==='linux'?'Linux':'Ish stoli')+' uchun · API kalitisiz';
  $('app-version').textContent='v'+(next.version||'1.5.0');
  const providers=next.providers||[];
  if($('provider').options.length!==providers.length) {
    $('provider').replaceChildren(...providers.map(p=>new Option(p.name,p.id)));
  }
  $('provider').value=next.settings.provider||'chatgpt';
  const upload=next.upload;
  $('upload-banner').hidden=!upload;
  $('upload-names').textContent=upload ? (providers.find(p=>p.id===upload.providerId)?.name||'AI')+' · '+upload.names.join(', ') : '';
  $('upload-message').textContent=upload?.message||'';
  $('upload-retry').hidden=!upload || upload.phase!=='blocked';
  $('upload-cancel').hidden=!next.uploadBusy;
  $('upload-dismiss').hidden=!!next.uploadBusy;
  for(const id of ['provider','new-chat','reload-chat','pick-ai-files']) $(id).disabled=!!next.uploadBusy;
  const files=$('attachments'); files.replaceChildren();
  for(const file of next.attachments||[]) {
    const row=document.createElement('div'); row.className='attachment';
    const name=document.createElement('span');name.textContent=file.name;
    const copy=document.createElement('button');copy.className='small-button';copy.textContent='Yo‘lini nusxalash';
    copy.onclick=()=>call('copy-file-path',file.path);
    const remove=document.createElement('button');remove.className='small-button';remove.textContent='×';remove.setAttribute('aria-label','Biriktirishni bekor qilish');
    remove.onclick=()=>call('remove-file',file.path);
    row.append(name,copy,remove);files.append(row);
  }
  document.body.dataset.expanded = String(next.expanded);
  document.body.dataset.busy = String(next.taskBusy);
  for (const page of document.querySelectorAll('.page')) page.hidden = page.id !== 'page-' + next.tab;
  for (const button of document.querySelectorAll('[data-tab]')) button.classList.toggle('active', button.dataset.tab === next.tab);
  $('dock-status').textContent = next.taskBusy ? (next.activeKind === 'login' ? 'Akkauntga kirilmoqda…' : 'Vazifa bajarilmoqda…') : 'AI yordamchi yoningizda';
  $('footer-state').textContent = next.taskBusy ? 'Vazifangiz bilan ishlayapman…' : 'Yordamchingiz shu yerda.';
  $('task-dot').hidden = !next.taskBusy;
  $('workspace-path').textContent = next.settings.workspace;
  $('workspace-path').title = next.settings.workspace;
  $('permission').value = next.settings.sandbox;
  $('permission').disabled = next.taskBusy;
  $('choose-folder').disabled = next.taskBusy;
  $('pin').checked = next.settings.pinned;
  $('workspace-status').textContent=next.workspaceStatus||'';
  $('autostart').checked = next.settings.autostart;
  $('shortcut-info').textContent = next.shortcutReady ? 'Ctrl + Alt + Space' : 'Dock ustiga bosing. Tizim tezkor tugmani band qilgan bo‘lishi mumkin.';
  const connected = next.login.authenticated;
  $('connection-card').dataset.connected = String(connected);
  $('connection-title').textContent = connected ? 'ChatGPT akkaunti ulangan' : 'ChatGPT bilan kirish';
  $('connection-detail').textContent = connected ? 'Tanlangan papkada vazifa topshirishingiz mumkin.' : next.login.installed ? 'Kirish brauzerda ochiladi. API kaliti kerak emas.' : 'Codex topilmadi. DavaDesk arxivini to‘liq oching yoki qayta o‘rnating.';
  $('login').textContent = connected ? 'Qayta kirish ↗' : 'ChatGPT bilan kirish ↗';
  $('login').disabled = next.taskBusy || !next.login.installed;
  $('home-auth').textContent = connected ? 'Vazifalar uchun ChatGPT akkauntingiz ulangan.' : 'Suhbat yoki vazifa bilan boshlang.';
  $('home-connect').textContent = connected ? 'Vazifa →' : 'Ulash →';
  $('run').disabled = next.taskBusy || pending || !$('prompt').value.trim();
  $('stop').hidden = !next.taskBusy;
  $('run').hidden = next.taskBusy;
  $('copy-answer').hidden = !next.hasAnswer || next.taskBusy;
  $('check-login').disabled = next.taskBusy;
  $('task-status').textContent = next.taskBusy ? 'Jarayonni pastda ko‘rishingiz mumkin.' : 'Har bir vazifa alohida boshlanadi.';
  const statusText = { 'not-loaded': 'O‘z akkauntingiz bilan suhbat.', loading: 'Sayt yuklanmoqda…', ready: (providers.find(p=>p.id===next.settings.provider)?.name||'AI')+' · o‘z akkauntingiz', failed: 'Sayt ochilmadi. Brauzerda davom eting.' };
  $('web-status').textContent = statusText[next.webStatus] || statusText['not-loaded'];
  renderLog(next.messages || []);
  requestAnimationFrame(reportBounds);
  if (tabChanged && next.tab === 'tasks' && next.expanded) $('prompt').focus();
  if (wasBusy && !next.taskBusy && next.hasAnswer) {
    document.querySelectorAll('.pet-caption').forEach(el => { el.textContent = 'Vazifangiz tayyor!'; });
    setTimeout(() => document.querySelectorAll('.pet-caption').forEach(el => { el.textContent = 'Dava sizni kutyapti'; }), 6000);
  }
}
function renderLog(messages) {
  const log = $('task-log');
  if (!messages.length) { if (!log.querySelector('.empty-log')) { log.replaceChildren(); const empty = document.createElement('div'); empty.className = 'empty-log'; empty.textContent = 'Birinchi vazifangizni yozing. Masalan: “Shu papkadagi loyihani tekshir.”'; log.append(empty); } return; }
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const labels = { user: 'SIZ', answer: 'YORDAMCHI', error: 'XATO', success: 'TAYYOR', login: 'AKKAUNTGA KIRISH', status: 'JARAYON' };
  const fragment = document.createDocumentFragment();
  for (const message of messages) {
    const node = document.createElement('div');
    const kind = Object.hasOwn(labels, message.kind) || message.kind === 'activity' ? message.kind : 'status';
    node.className = 'log-message ' + kind;
    if (labels[kind]) { const label = document.createElement('span'); label.className = 'message-label'; label.textContent = labels[kind]; node.append(label); }
    const text = document.createElement('span'); text.textContent = String(message.text || ''); node.append(text);
    fragment.append(node);
  }
  log.replaceChildren(fragment);
  if (atBottom) log.scrollTop = log.scrollHeight;
}
function reportBounds() {
  if (!nativeBridge || !state?.expanded || state.tab !== 'chat') return;
  const rect = $('web-container').getBoundingClientRect();
  // One pixel inset leaves the local frame visible around the native view.
  bridge.call('web-bounds', { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 }).catch(() => {});
}
function bind(id, action, payload) { $(id).addEventListener('click', () => call(action, payload)); }
let petDrag=null, dragFrame=0;
$('dock').addEventListener('pointerdown', e=>{
 if(e.button!==0) return;
 petDrag={x:e.screenX,y:e.screenY,moved:false};
 $('dock').setPointerCapture(e.pointerId); call('drag-start');
});
$('dock').addEventListener('pointermove', e=>{
 if(!petDrag) return;
 if(Math.hypot(e.screenX-petDrag.x,e.screenY-petDrag.y)>5) petDrag.moved=true;
 if(petDrag.moved&&!dragFrame) dragFrame=requestAnimationFrame(()=>{dragFrame=0;call('drag-move');});
});
async function finishPet(e) {
 if(!petDrag) return;
 const click=!petDrag.moved && e.type==='pointerup';
 petDrag=null;cancelAnimationFrame(dragFrame);dragFrame=0;
 await call('drag-end'); if(click) call('toggle');
}
$('dock').addEventListener('pointerup',finishPet);
$('dock').addEventListener('pointercancel',finishPet);
document.documentElement.addEventListener('pointerleave',()=>call('pointer-outside'));
document.documentElement.addEventListener('pointerenter',()=>call('pointer-inside'));
$('provider').addEventListener('change',()=>call('provider',$('provider').value));
bind('pick-files','pick-files');
for(const id of ['pick-ai-files','upload-retry','upload-cancel','upload-dismiss']) bind(id,id);
document.addEventListener('dragover',e=>{
 e.preventDefault(); e.dataTransfer.dropEffect='copy';document.body.classList.add('file-over');
});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('file-over');});
document.addEventListener('drop',async e=>{
 e.preventDefault(); document.body.classList.remove('file-over');
 if(!nativeBridge) return toast('Fayl uchun DavaDesk ilovasini oching.');
 const paths=Array.from(e.dataTransfer.files).map(f=>window.dava.filePath(f)).filter(Boolean);
 if(paths.length) await call('files',paths);
});
$('dock').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); call('toggle'); } });
for(const formId of ['welcome-form','profile-form']) {
 $(formId).addEventListener('submit',async event=>{
  event.preventDefault();
  const input=$(formId==='welcome-form'?'welcome-name':'profile-name');
  const result=await call('set-name',input.value);
  if(result) { $('profile-feedback').textContent='Ismingiz saqlandi.';toast('Ismingiz saqlandi.'); }
 });
}
bind('minimize', 'toggle'); bind('close', 'toggle');
for (const el of document.querySelectorAll('[data-tab]')) el.addEventListener('click', () => call('tab', el.dataset.tab));
bind('start-chat', 'tab', 'chat'); bind('start-task', 'tab', 'tasks'); bind('home-connect', 'tab', 'tasks');
for (const id of ['header-browser', 'chat-browser', 'browser-fallback']) bind(id, 'browser');
bind('new-chat', 'new-chat'); bind('reload-chat', 'reload'); bind('choose-folder', 'workspace'); bind('open-folder', 'open-workspace');
bind('login', 'login'); bind('check-login', 'login-status'); bind('stop', 'stop');
bind('copy-answer', 'copy-answer'); bind('official-app', 'official-app'); bind('clear-session', 'clear-session'); bind('quit', 'quit');
for (const id of ['pin', 'autostart']) $(id).addEventListener('change', () => call(id, $(id).checked));
$('permission').addEventListener('change', () => call('sandbox', $('permission').value));
$('prompt').addEventListener('input', () => { if (state) $('run').disabled = pending || state.taskBusy || !$('prompt').value.trim(); });
async function runTask() {
  if (pending || state?.taskBusy || !$('prompt').value.trim()) return;
  const prompt = $('prompt').value;
  pending = true; $('run').disabled = true;
  const result = await call('task', prompt);
  pending = false;
  if (result) $('prompt').value = '';
  if (state) applyState(state);
}
$('run').addEventListener('click', runTask);
$('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); runTask(); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state?.expanded && !event.defaultPrevented) call('toggle'); });
document.addEventListener('pointermove', event => {
  const pet = event.target.closest('.mascot');
  if (pet) { const rect = pet.getBoundingClientRect(); pet.style.transform = `rotate(${Math.max(-4, Math.min(4, (event.clientX - rect.x - rect.width / 2) / 12))}deg)`; }
});
document.querySelectorAll('.mascot').forEach(pet => pet.addEventListener('pointerleave', () => { pet.style.transform = ''; }));
new ResizeObserver(reportBounds).observe($('web-container'));
bridge.onEvent(event => {
  if (event.type === 'state') applyState(event.state);
  else if (event.type === 'message' && state) {
    state.messages = [...(state.messages || []), event.message].slice(-120);
    renderLog(state.messages);
  } else if (event.type === 'layout') requestAnimationFrame(reportBounds);
  else if (event.type === 'notice') toast(event.text);
});
call('state');
