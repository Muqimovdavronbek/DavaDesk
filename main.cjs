'use strict';
const {
  app, BrowserWindow, WebContentsView, ipcMain, screen, shell, dialog,
  session, Tray, Menu, globalShortcut, Notification, clipboard, nativeImage
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const core = require('./lib/core.cjs');
const desktop = require('./lib/desktop.cjs');
const {AutoCollapse,pinLinuxWindow}=require('./lib/window-behavior.cjs');
const ai = require('./lib/providers.cjs');
const { attachFiles } = require('./lib/upload.cjs');
const { findCodex, loginStatus, CodexRunner } = require('./lib/codex.cjs');

// Apply even when launched with npm start or an older desktop launcher.
if(process.platform==='linux' && process.env.DISPLAY) app.commandLine.appendSwitch('ozone-platform','x11');
app.setName('DavaDesk');
if(process.platform==='win32')app.setAppUserModelId('uz.davadesk.desktop');
app.setPath('userData', path.join(app.getPath('appData'), 'DavaDesk'));
if (process.env.DAVA_SOFTWARE_RENDERING === '1') app.disableHardwareAcceleration();
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let win, chat, tray, runner, settings, expanded = false, tab = 'home';
  let shortcutReady = false, quitting = false, taskBusy = false, activeKind = 'task';
  let messages = [], lastAnswer = '', login = { installed: false, authenticated: false };
  let webStatus = 'not-loaded', chatVisible = false;
  let compactBounds, panelBounds, dragStart, leaveTimer, hoverPoll, outsideSince=0, dialogDepth=0, attachments = [];
  async function nativeDialog(method, options) {
    dialogDepth++;
    try { return await dialog[method](win,options); }
    finally { dialogDepth--;outsideSince=0; }
  }
  const autoCollapse=new AutoCollapse(600);
  let pinTimer, pinRunning=false, workspaceStatus='Barcha ish stollariga biriktirish kutilmoqda.';
  let importing=false, upload=null, uploadController=null;
  const uploadBusy=()=>importing || Boolean(uploadController);
  function cancelUpload() { uploadController?.abort(); }
  async function startUpload(files,providerId) {
    if(uploadController) throw new Error('Oldingi fayl biriktirilmoqda. Tugashini kuting.');
    const controller=new AbortController();uploadController=controller;
    upload={providerId,names:files.map(f=>f.name),files,phase:'waiting',message:'AI ochilmoqda…'};
    announce();
    try {
      const result=await attachFiles(chats.get(providerId).webContents,files,providerId,{
        signal:controller.signal,
        onStatus:(phase,message)=>{upload.phase=phase;upload.message=message;announce();}
      });
      Object.assign(upload,result);
    } finally {uploadController=null;outsideSince=0;announce();}
  }
  const chats = new Map();
  const provider = () => ai.get(settings.provider);
  const activeURL = () => settings.provider === 'chatgpt' ? settings.chatURL : provider().url;
  const appDir = __dirname;
  const localPage = pathToFileURL(path.join(appDir, 'ui', 'index.html')).href;
  const configPath = path.join(app.getPath('userData'), 'settings.json');
  const autostartPath = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart', 'davadesk.desktop');

  function saveSettings() {
    fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(configPath + '.tmp', JSON.stringify(settings, null, 2), { mode: 0o600 });
    fs.renameSync(configPath + '.tmp', configPath);
  }
  function state() {
    return {
      expanded, tab, settings, workspaceStatus, providers: ai.providers, attachments, upload: upload ? {providerId:upload.providerId,names:upload.names,phase:upload.phase,message:upload.message} : null, uploadBusy:uploadBusy(), taskBusy, activeKind, login, webStatus,
      shortcutReady, messages: messages.slice(-80), hasAnswer: Boolean(lastAnswer), version: app.getVersion(), platform:process.platform
    };
  }
  function send(type, value) {
    if (win && !win.isDestroyed()) win.webContents.send('dava:event', { type, ...value });
  }
  function announce() { send('state', { state: state() }); }
  function addMessage(message) {
    messages.push({ ...message, time: Date.now() });
    if (messages.length > 120) messages.shift();
    send('message', { message: messages.at(-1) });
  }
  function displayArea() {
    const display = win ? screen.getDisplayMatching(win.getBounds()) : screen.getPrimaryDisplay();
    return display.workArea;
  }
  function showPanel(nextTab = tab) {
    clearTimeout(leaveTimer);
    const wasExpanded = expanded;
    if (!wasExpanded) compactBounds = win.getBounds();
    expanded = true; tab = nextTab; outsideSince=0; autoCollapse.reset();
    const area = displayArea();
    win.setResizable(true); win.setMinimumSize(Math.min(520, area.width), Math.min(420, area.height));
    if (!wasExpanded) {
      const base = panelBounds || {...core.windowBounds(area,true),x:compactBounds.x,y:compactBounds.y};
      win.setBounds(desktop.clamp(base,area));
    }
    win.show(); win.focus(); syncChat(); allDesktops(); announce();
  }
  function collapse() {
    clearTimeout(leaveTimer);
    if (expanded) panelBounds=win.getBounds();
    expanded = false; autoCollapse.reset(); syncChat();
    win.setMinimumSize(88, 96); win.setResizable(false);
    compactBounds=desktop.compact(compactBounds || win.getBounds(),displayArea());
    win.setBounds(compactBounds);
    settings.petBounds=compactBounds; saveSettings();
    allDesktops(); announce();
  }
  function allDesktops() {
    if(!win || win.isDestroyed()) return;
    win.setAlwaysOnTop(settings.pinned, 'floating');
    try { win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen:true}); } catch {}
    clearTimeout(pinTimer);
    if(process.platform==='win32') {
      workspaceStatus='Barcha virtual ish stollari: Win+Tab → DavaDesk ustida o‘ng tugma → Show this window on all desktops.';
      return;
    }
    if(process.platform!=='linux') return;
    if(!process.env.DISPLAY) {
      workspaceStatus='XWayland DISPLAY topilmadi. Barcha ish stollari rejimi uchun X11/XWayland kerak.';
      return;
    }
    // Window managers may replace desktop hints when a window is mapped/resized.
    pinTimer=setTimeout(async()=>{
      if(quitting || win.isDestroyed() || !win.isVisible() || pinRunning) return;
      pinRunning=true;
      try {
        await pinLinuxWindow(win,settings.pinned);
        workspaceStatus='Barcha ish stollarida ko‘rinish yoqilgan.';
      } catch(error) {
        workspaceStatus=error.code==='ENOENT'
          ? 'Barcha ish stollari uchun terminalda: sudo apt install wmctrl'
          : 'Ish stollariga biriktirish bajarilmadi. wmctrl va XWayland holatini tekshiring.';
      } finally {pinRunning=false;announce();}
    },150);
  }
  function pointerHint(inside) {
    autoCollapse.hint(inside,Date.now());
  }
  function watchPointer(contents,active) {
    contents.on('before-mouse-event',(_event,mouse)=>{
      if(!active())return;
      if(mouse.type==='mouseLeave')pointerHint(false);
      else if(['mouseEnter','mouseMove','mouseDown','mouseUp','mouseWheel'].includes(mouse.type))pointerHint(true);
    });
  }
  function pollPointer() {
    if(!win || win.isDestroyed()) return;
    const children=win.getChildWindows().filter(child=>!child.isDestroyed()&&child.isVisible()).map(child=>child.getBounds());
    // A popup only protects its own area; it no longer disables collapse everywhere.
    // Uploads continue in the background and never block this check.
    if(autoCollapse.update({
      expanded,visible:win.isVisible(),blocked:Boolean(dragStart||dialogDepth||(!settings.displayName && tab==='home')),
      point:screen.getCursorScreenPoint(),bounds:win.getBounds(),children
    },Date.now())) collapse();
  }
  async function importFiles(paths, destination='chat') {
    if(taskBusy) throw new Error('Vazifa tugagach fayl qo‘shing.');
    if(uploadBusy()) throw new Error('Oldingi fayllar biriktirilmoqda. Tugashini kuting yoki bekor qiling.');
    if(!Array.isArray(paths)||!paths.length||paths.length>20) throw new Error('Bir safar 1–20 ta fayl tanlang.');
    importing=true;
    const added=[];
    try {
      const sources=[];
      for(const source of paths) {
        if(typeof source!=='string'||!path.isAbsolute(source)) throw new Error('Fayl yo‘li noto‘g‘ri.');
        const stat=await fs.promises.stat(source);
        if(!stat.isFile()||stat.size>100*1024*1024) throw new Error('Faqat 100 MB gacha bo‘lgan fayllar qabul qilinadi.');
        sources.push({source,size:stat.size});
      }
      const directory=path.join(settings.workspace,'DavaDesk-imports');
      await fs.promises.mkdir(directory,{recursive:true});
      for(const {source,size} of sources) {
        // Preserve original filenames; isolate each import to prevent overwrites.
        const folder=await fs.promises.mkdtemp(path.join(directory,'batch-'));
        const dest=path.join(folder,path.basename(source));
        await fs.promises.copyFile(source,dest,fs.constants.COPYFILE_EXCL);
        added.push({name:path.basename(source),path:dest,size});
      }
      attachments=[...attachments,...added].slice(-20);
    } catch(error) {
      for(const file of added) await fs.promises.rm(path.dirname(file.path),{recursive:true,force:true});
      throw error;
    } finally {importing=false;}
    showPanel(destination);
    if(destination==='chat') {
      // The chosen service receives only this newly dropped batch, once.
      void startUpload(added,settings.provider).catch(error=>send('notice',{text:error.message}));
    } else send('notice',{text:'Fayllar mahalliy vazifaga biriktirildi.'});
  }
  function hideWindow() { if (chat) chat.setVisible(false); chatVisible = false; win.hide(); }
  function external(value) {
    if (!core.httpsURL(value)) throw new Error('Faqat HTTPS havolasi ochiladi.');
    return shell.openExternal(value);
  }
  function ensureChat() {
    if (chats.has(settings.provider)) { chat=chats.get(settings.provider); return; }
    const selected=provider();
    const isService=url=>ai.serviceURL(url,selected.id);
    const isInternal=url=>isService(url)||core.internalURL(url);
    const chatSession = session.fromPartition('persist:davadesk-'+settings.provider);
    chatSession.setPermissionCheckHandler((contents, permission, origin) =>
      isService(origin) && ['media', 'clipboard-sanitized-write', 'fullscreen'].includes(permission));
    chatSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      const origin = details.requestingOrigin || contents.getURL();
      if (!isService(origin)) { callback(false); return; }
      if (permission === 'clipboard-sanitized-write' || permission === 'fullscreen') { callback(true); return; }
      if (!['media', 'clipboard-read'].includes(permission)) { callback(false); return; }
      try {
        const answer = await nativeDialog('showMessageBox', {
          type: 'question', title: selected.name + ' ruxsati',
          message: permission === 'media' ? 'ChatGPT mikrofon yoki kameradan foydalansinmi?' : 'ChatGPT clipboard’ni o‘qisinmi?',
          buttons: ['Ruxsat bermaslik', 'Ruxsat berish'], defaultId: 0, cancelId: 0
        });
        callback(answer.response === 1);
      } catch { callback(false); }
    });
    // Electron's save dialog lets the user choose each download's location.
    chatSession.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ title: 'Faylni saqlash', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())) });
    });
    chat = new WebContentsView({ webPreferences: {
      session: chatSession, backgroundThrottling:false, nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true, allowRunningInsecureContent: false
    } });
    chat.setBackgroundColor('#212121');
    chat.webContents.setWindowOpenHandler(({ url }) => {
      if (isInternal(url)) return { action: 'allow', overrideBrowserWindowOptions: {
        width: 650, height: 740, parent: win, autoHideMenuBar: true,
        webPreferences: { session: chatSession, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
      } };
      if (core.httpsURL(url)) external(url).catch(() => {});
      return { action: 'deny' };
    });
    function secureNavigation(contents) {
      contents.on('will-navigate', (event, url) => {
        if (!isInternal(url)) { event.preventDefault(); if (core.httpsURL(url)) external(url).catch(() => {}); }
      });
      contents.on('will-redirect', (event, url) => { if (!isInternal(url)) event.preventDefault(); });
      contents.on('will-attach-webview', event => event.preventDefault());
    }
    secureNavigation(chat.webContents);
    const createdView=chat;
    watchPointer(chat.webContents,()=>expanded && chatVisible && chat===createdView);
    chat.webContents.on('did-create-window', popup => {
      secureNavigation(popup.webContents);
      watchPointer(popup.webContents,()=>expanded && popup.isVisible());
    });
    chat.webContents.on('did-start-loading', () => { webStatus = 'loading'; announce(); });
    chat.webContents.on('did-stop-loading', () => { if (webStatus !== 'failed') webStatus = 'ready'; announce(); });
    chat.webContents.on('did-fail-load', (_event, code, _desc, _url, mainFrame) => {
      if (mainFrame && code !== -3) { webStatus = 'failed'; announce(); }
    });
    const remember = (_event, url) => {
      if (selected.id === 'chatgpt' && core.chatURL(url)) { settings.chatURL = url; saveSettings(); }
    };
    chat.webContents.on('did-navigate', remember);
    chat.webContents.on('did-navigate-in-page', remember);
    chat.webContents.on('render-process-gone', () => { webStatus = 'failed'; announce(); });
    chats.set(selected.id,chat);
    win.contentView.addChildView(chat);
    chat.setVisible(false);
    chat.webContents.loadURL(activeURL()).catch(() => { webStatus = 'failed'; announce(); });
  }
  function syncChat() {
    const visible = expanded && tab === 'chat' && win.isVisible();
    if (visible) ensureChat();
    for (const view of chats.values()) view.setVisible(visible && view === chat);
    chatVisible = visible;
  }
  async function refreshLogin() {
    login = await loginStatus(runner.binary); announce(); return login;
  }
  function setAutostart(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Noto‘g‘ri sozlama.');
    if(process.platform==='win32') {
      app.setLoginItemSettings({openAtLogin:enabled,path:process.execPath,args:app.isPackaged?[]:[appDir],name:'DavaDesk'});
      settings.autostart=enabled;saveSettings();return;
    }
    if (enabled) {
      fs.mkdirSync(path.dirname(autostartPath), { recursive: true });
      fs.writeFileSync(autostartPath, [
        '[Desktop Entry]', 'Type=Application', 'Name=DavaDesk',
        'Comment=ChatGPT desktop companion', 'Exec=' + core.desktopQuote(path.join(appDir, 'launch.sh')),
        'Icon=' + path.join(appDir, 'assets', 'icon.png'), 'Terminal=false',
        'X-GNOME-Autostart-enabled=true', ''
      ].join('\n'));
    } else if (fs.existsSync(autostartPath)) fs.unlinkSync(autostartPath);
    settings.autostart = enabled; saveSettings();
  }
  async function quitApp() {
    if (taskBusy) {
      const answer = await nativeDialog('showMessageBox', {
        type: 'question', message: 'Vazifa ishlayapti. To‘xtatib chiqilsinmi?',
        buttons: ['Davom ettirish', 'To‘xtatib chiqish'], defaultId: 0, cancelId: 0
      });
      if (answer.response !== 1) return;
      runner.stop();
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 3000);
        runner.once('finish', () => { clearTimeout(timer); resolve(); });
      });
    }
    quitting = true; app.quit();
  }
  function wireIPC() {
    ipcMain.handle('dava:call', async (event, action, payload) => {
      // Only our exact local renderer, never the ChatGPT/auth web contents.
      if (event.sender !== win.webContents || event.senderFrame?.url !== localPage) throw new Error('Ruxsat berilmagan so‘rov.');
      switch (action) {
        case 'state': return state();
        case 'set-name': {
          const name=core.displayName(payload);
          if(!name)throw new Error('Ismingizni kiriting.');
          settings.displayName=name;saveSettings();break;
        }
        case 'toggle': expanded ? collapse() : showPanel(); break;
        case 'tab':
          if (!['home', 'chat', 'tasks', 'settings'].includes(payload)) throw new Error('Sahifa topilmadi.');
          showPanel(payload); break;
        case 'web-bounds': {
          if (chat && chatVisible) {
            const [width, height] = win.getContentSize();
            const bounds = core.viewBounds(payload, { width, height });
            if (bounds) chat.setBounds(bounds);
          }
          break;
        }
        case 'provider':
          if(uploadBusy()) throw new Error('Avval biriktirishni tugating yoki bekor qiling.');
          if(!ai.providers.some(p=>p.id===payload)) throw new Error('AI topilmadi.');
          settings.provider=payload; saveSettings(); webStatus='not-loaded'; showPanel('chat'); break;
        case 'pointer-inside': pointerHint(true); break;
        case 'pointer-outside': pointerHint(false); pollPointer(); break;
        case 'drag-start':
          if(!expanded) dragStart={point:screen.getCursorScreenPoint(),bounds:win.getBounds()};
          break;
        case 'drag-move':
          if(dragStart) {
            const point=screen.getCursorScreenPoint();
            const b={...dragStart.bounds,x:dragStart.bounds.x+point.x-dragStart.point.x,
              y:dragStart.bounds.y+point.y-dragStart.point.y};
            const area=screen.getDisplayNearestPoint(point).workArea;
            win.setBounds(desktop.clamp(b,area));
          } break;
        case 'drag-end':
          if(dragStart) {
            dragStart=null; compactBounds=desktop.compact(win.getBounds(),displayArea());
            win.setBounds(compactBounds); settings.petBounds=compactBounds; saveSettings();
          } break;
        case 'files': await importFiles(payload); break;
        case 'upload-cancel': cancelUpload(); break;
        case 'upload-dismiss':
          if(!uploadBusy()) upload=null; break;
        case 'upload-retry':
          if(uploadBusy()) throw new Error('Fayl biriktirilmoqda.');
          if(!upload || upload.phase!=='blocked') throw new Error('Saytdagi biriktirilgan fayllarni tekshiring.');
          settings.provider=upload.providerId;saveSettings();showPanel('chat');
          void startUpload(upload.files,upload.providerId).catch(error=>send('notice',{text:error.message}));
          break;
        case 'pick-ai-files': {
          const result=await nativeDialog('showOpenDialog',{properties:['openFile','multiSelections']});
          if(!result.canceled) await importFiles(result.filePaths);break;
        }
        case 'pick-files': {
          const result=await nativeDialog('showOpenDialog',{properties:['openFile','multiSelections']});
          if(!result.canceled) await importFiles(result.filePaths,'tasks'); break;
        }
        case 'remove-file':
          attachments=attachments.filter(f=>f.path!==payload); break;
        case 'copy-file-path':
          if(attachments.some(f=>f.path===payload)) clipboard.writeText(payload); break;
        case 'browser': await external(activeURL()); break;
        case 'new-chat':
          if(uploadBusy()) throw new Error('Biriktirishni tugating yoki bekor qiling.');
          if(settings.provider==='chatgpt') settings.chatURL=core.CHAT_URL;
          saveSettings(); showPanel('chat');
          await chat.webContents.loadURL(provider().url); break;
        case 'reload': if(uploadBusy()) throw new Error('Biriktirishni tugating yoki bekor qiling.'); if (chat) chat.webContents.reload(); break;
        case 'workspace': {
          if (taskBusy || uploadBusy()) throw new Error('Vazifa yoki yuklash vaqtida papkani o‘zgartirib bo‘lmaydi.');
          const result = await nativeDialog('showOpenDialog', { title: 'Yordamchi ishlaydigan papka', defaultPath: settings.workspace, properties: ['openDirectory', 'createDirectory'] });
          if (!result.canceled && result.filePaths[0]) {
            settings.workspace = fs.realpathSync(result.filePaths[0]); attachments=[]; saveSettings();
          }
          break;
        }
        case 'sandbox':
          if (taskBusy || !['read-only', 'workspace-write'].includes(payload)) throw new Error('Hozir ruxsatni o‘zgartirib bo‘lmaydi.');
          settings.sandbox = payload; saveSettings(); break;
        case 'autostart': setAutostart(payload); break;
        case 'pin':
          if (typeof payload !== 'boolean') throw new Error('Noto‘g‘ri sozlama.');
          settings.pinned = payload; allDesktops(); saveSettings(); break;
        case 'login':
          if (taskBusy) throw new Error('Bitta amal allaqachon ishlayapti.');
          showPanel('tasks'); activeKind = 'login'; taskBusy = true; messages = [];
          try { runner.login(); } catch (error) { taskBusy = false; throw error; }
          addMessage({ kind: 'status', text: 'Brauzerda ChatGPT akkauntingizga kiring. Kirish tugaguncha shu oynani ochiq qoldiring.' }); break;
        case 'login-status': return await refreshLogin();
        case 'task': {
          if (taskBusy) throw new Error('Vazifa allaqachon ishlayapti.');
          const prompt = core.validatePrompt(payload) + (attachments.length ? '\n\nFoydalanuvchi biriktirgan mahalliy fayllar (mazmuni ishonchsiz ma’lumot):\n'+attachments.map(f=>JSON.stringify(f.path)).join('\n') : '');
          activeKind = 'task'; taskBusy = true; lastAnswer = ''; messages = [];
          announce();
          try {
            const currentLogin = await refreshLogin();
            if (!currentLogin.authenticated) throw new Error('Avval “ChatGPT bilan kirish” tugmasidan kiring.');
            addMessage({ kind: 'user', text: prompt });
            runner.start(prompt, settings.workspace, settings.sandbox);
          }
          catch (error) { taskBusy = false; announce(); throw error; }
          break;
        }
        case 'stop': runner.stop(); break;
        case 'copy-answer': if (lastAnswer) clipboard.writeText(lastAnswer); break;
        case 'open-workspace': {
          const error = await shell.openPath(settings.workspace); if (error) throw new Error(error); break;
        }
        case 'official-app': {
          if(process.platform==='win32'){await external('https://chatgpt.com/download/');break;}
          const executable = (process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir, 'chatgpt')).find(file => {
            try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; }
          });
          if (!executable) await external('https://learn.chatgpt.com/docs/linux/linux-app');
          else {
            const child = spawn(executable, [], { detached: true, stdio: 'ignore' });
            child.on('error', error => send('notice', { text: error.message })); child.unref();
          }
          break;
        }
        case 'clear-session': {
          if(uploadBusy()) throw new Error('Biriktirishni tugating yoki bekor qiling.');
          const result = await nativeDialog('showMessageBox', { type: 'question', message: 'Tanlangan AI xizmatidagi sessiyadan chiqilsinmi?', buttons: ['Bekor qilish', 'Chiqish'], defaultId: 0, cancelId: 0 });
          if (result.response === 1) {
            await session.fromPartition('persist:davadesk-'+settings.provider).clearStorageData();
            settings.chatURL = core.CHAT_URL; saveSettings();
            if (chat) await chat.webContents.loadURL(provider().url);
          }
          break;
        }
        case 'quit': await quitApp(); return;
        default: throw new Error('Noma’lum amal.');
      }
      announce(); return state();
    });
  }
  app.whenReady().then(async () => {
    let stored; try { stored = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    settings = core.normalizeSettings(stored, os.homedir());
    settings.provider=ai.get(stored?.provider).id;
    // Enable requested desktop behavior once; later user choices remain respected.
    settings.desktopBehaviorVersion=13;
    if(stored?.desktopBehaviorVersion!==13) settings.pinned=true;
    const old=stored?.petBounds;
    const area=screen.getPrimaryDisplay().workArea;
    compactBounds=desktop.compact(old && ['x','y','width','height'].every(k=>Number.isFinite(old[k])) ? old : {x:area.x+area.width-100,y:area.y+area.height-120},area);
    settings.petBounds=compactBounds;
    fs.mkdirSync(settings.workspace, { recursive: true }); saveSettings();
    runner = new CodexRunner(findCodex(appDir));
    runner.on('event', message => {
      if (message.kind === 'answer') lastAnswer = message.text;
      if (message.kind !== 'done') addMessage(message);
    });
    runner.on('finish', result => {
      taskBusy = false;
      addMessage({ kind: result.success ? 'success' : result.cancelled ? 'status' : 'error', text: result.message });
      if (result.login) refreshLogin();
      if (result.success && !result.login && Notification.isSupported()) new Notification({ title: 'DavaDesk', body: 'Vazifangiz tayyor.', icon: path.join(appDir, 'assets', 'icon.png') }).show();
      announce();
    });
    win = new BrowserWindow({
      ...compactBounds,
      title: 'DavaDesk', frame: false, transparent: true, resizable: false,
      alwaysOnTop: settings.pinned, skipTaskbar: false, show: false, backgroundColor: '#00000000',
      icon: path.join(appDir, 'assets', 'icon.png'),
      webPreferences: { preload: path.join(appDir, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
    });
    win.setMenu(null);
    watchPointer(win.webContents,()=>expanded);
    win.on('blur',()=>{if(expanded)pointerHint(false);});
    allDesktops();
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.on('close', event => { if (!quitting) { event.preventDefault(); collapse(); } });
    win.on('closed', () => { for(const view of chats.values()) if(!view.webContents.isDestroyed()) view.webContents.close(); });
    win.on('resize', () => { send('layout', {}); allDesktops(); });
    win.on('show', () => { syncChat(); allDesktops(); announce(); });
    win.on('restore',allDesktops);
    wireIPC();
    await win.loadFile(path.join(appDir, 'ui', 'index.html'));
    win.show();
    if(!settings.displayName)showPanel('home');
    // Poll the OS cursor, including while it is over a remote AI view.
    hoverPoll=setInterval(pollPointer,100);
    try {
      tray = new Tray(nativeImage.createFromPath(path.join(appDir, 'assets', 'icon.png')));
      tray.setToolTip('DavaDesk — ChatGPT yoningizda');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'DavaDesk ochish', click: () => showPanel('home') },
        { label: 'ChatGPT', click: () => showPanel('chat') },
        { label: 'Vazifalar', click: () => showPanel('tasks') },
        { type: 'separator' },
        { label: 'Yashirish', click: hideWindow },
        { label: 'Chiqish', click: () => quitApp() }
      ]));
      tray.on('click', () => { if (win.isVisible() && expanded) collapse(); else showPanel(); });
    } catch { /* The dock and applications-menu launcher remain available. */ }
    shortcutReady = globalShortcut.register('CommandOrControl+Alt+Space', () => { expanded && win.isVisible() ? collapse() : showPanel(); });
    const fit=()=>{win.setBounds(desktop.clamp(win.getBounds(),displayArea()));allDesktops();};
    screen.on('display-metrics-changed',fit);
    screen.on('display-removed',fit);
    refreshLogin(); announce();
  }).catch(error => {
    dialog.showErrorBox('DavaDesk ishga tushmadi', error.message + '\n\nDavaDesk arxivini to‘liq oching va README_UZ.md ni o‘qing.');
    quitting = true; app.quit();
  });
  app.on('second-instance', () => { if (win) showPanel(); });
  app.on('before-quit', () => {
    quitting = true; cancelUpload(); clearInterval(hoverPoll); clearTimeout(pinTimer); clearTimeout(leaveTimer); runner?.stop();
    for(const view of chats.values()) if(!view.webContents.isDestroyed()) view.webContents.close();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
