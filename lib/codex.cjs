'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { codexArgs, codexEnvironment, validatePrompt, eventSummary } = require('./core.cjs');

function findCodex(appDir, env = process.env, platform=process.platform, arch=process.arch) {
  const candidates=[];
  const windows=platform==='win32';
  const triple=arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
  if(windows) {
    // Portable builds include the official native executable and its companion tools.
    const roots=[
      path.join(appDir,'tools','vendor',triple),
      path.join(appDir,'node_modules','@openai','codex-win32-'+arch,'vendor',triple),
      path.join(appDir,'node_modules','@openai','codex','node_modules','@openai','codex-win32-'+arch,'vendor',triple),
      path.join(appDir,'node_modules','@openai','codex','vendor',triple)
    ];
    for(const root of roots)for(const folder of ['bin','codex'])candidates.push(path.join(root,folder,'codex.exe'));
    candidates.push(path.join(appDir,'tools','codex.exe'));
  } else candidates.push(path.join(appDir,'node_modules','.bin','codex'));
  for(const dir of (env.PATH||'').split(windows?';':path.delimiter))if(dir)candidates.push(path.join(dir,windows?'codex.exe':'codex'));
  if(!windows)candidates.push(path.join(os.homedir(),'.local','bin','codex'));
  return candidates.find(file=>{
    try {fs.accessSync(file,fs.constants.X_OK);return fs.statSync(file).isFile();}catch{return false;}
  })||null;
}
function runnerEnvironment(binary) {
  const env=codexEnvironment(process.env);
  if(process.platform==='win32'&&binary){
    const tools=path.join(path.dirname(path.dirname(binary)),'codex-path');
    if(fs.existsSync(tools))env.PATH=tools+path.delimiter+(env.PATH||'');
  }
  return env;
}
function killTree(child,signal) {
  if(process.platform==='win32' && child.pid){
    const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe');
    execFile(exe,['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:5000},error=>{
      if(error)try{child.kill();}catch{}
    });
  } else {
    try{if(child.pid)process.kill(-child.pid,signal);else child.kill(signal);}
    catch{try{child.kill(signal);}catch{}}
  }
}
function loginStatus(binary) {
  if (!binary) return Promise.resolve({ installed: false, authenticated: false });
  return new Promise(resolve => {
    let output = '', settled = false;
    const child = spawn(binary, ['-c', 'forced_login_method="chatgpt"', 'login', 'status'], {
      env: runnerEnvironment(binary), windowsHide:true, stdio: ['ignore', 'pipe', 'pipe']
    });
    const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => { if(process.platform==='win32')killTree(child,'SIGTERM');else child.kill(); finish({ installed: true, authenticated: false, message: 'Tekshirish vaqti tugadi.' }); }, 15000);
    child.stdout.on('data', b => { output = (output + b.toString()).slice(-8000); });
    child.stderr.on('data', b => { output = (output + b.toString()).slice(-8000); });
    child.on('error', () => finish({ installed: false, authenticated: false }));
    child.on('close', code => finish({
      installed: true, authenticated: code === 0 && /chatgpt/i.test(output),
      message: code === 0 && /chatgpt/i.test(output) ? 'ChatGPT akkaunti ulangan.' : 'ChatGPT akkaunti bilan kiring.'
    }));
  });
}

class CodexRunner extends EventEmitter {
  constructor(binary) { super(); this.binary = binary; this.child = null; this.killTimer = null; this.cancelled = false; }
  start(prompt, workspace, sandbox) {
    prompt = validatePrompt(prompt);
    if (this.child) throw new Error('Bitta vazifa allaqachon ishlayapti.');
    if (!this.binary) throw new Error('Codex topilmadi. DavaDesk fayllarini to‘liq oching yoki qayta o‘rnating.');
    if (!fs.statSync(workspace).isDirectory()) throw new Error('Ish papkasi topilmadi.');
    this.cancelled = false;
    const child = spawn(this.binary, codexArgs(workspace, sandbox), {
      env: runnerEnvironment(this.binary), windowsHide:true, cwd: workspace, detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child = child;
    let buffer = '', stderr = '', sawDone = false, sawError = false, settled = false;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    const line = value => {
      if (!value.trim()) return;
      try {
        const summary = eventSummary(JSON.parse(value));
        if (summary) {
          if (summary.kind === 'done') sawDone = true;
          if (summary.kind === 'error') sawError = true;
          this.emit('event', summary);
        }
      } catch { /* Non-JSON diagnostics are never executed. */ }
    };
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) { line(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
      if (buffer.length > 2000000) { buffer = ''; sawError = true; this.emit('event', { kind: 'error', text: 'Vazifa chiqishi juda katta.' }); this.stop(); }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
    const finish = (code, spawnError) => {
      if (settled) return; settled = true;
      if (buffer) line(buffer);
      clearTimeout(this.killTimer); this.killTimer = null; this.child = null;
      const success = !this.cancelled && code === 0 && sawDone && !sawError;
      this.emit('finish', {
        success, cancelled: this.cancelled,
        message: this.cancelled ? 'Vazifa to‘xtatildi. Oldingi o‘zgarishlar saqlangan bo‘lishi mumkin.'
          : success ? 'Tayyor.' : (spawnError?.message || stderr.trim() || 'Vazifa tugamadi. Akkaunt, limit va Codex sozlamalarini tekshiring.').slice(-8000)
      });
    };
    child.on('error', error => finish(-1, error));
    child.on('close', code => finish(code));
    child.stdin.on('error', () => {});
    child.stdin.end('Javobni foydalanuvchi tilida, odatda o‘zbek tilida bering. ' +
      'Foydalanuvchi tanlagan papkada berilgan vazifani bajaring. Natijani va tekshiruvni aniq ayting.\n\n' + prompt);
  }
  login() {
    if (this.child) throw new Error('Joriy vazifani tugating yoki to‘xtating.');
    if (!this.binary) throw new Error('Codex topilmadi. DavaDesk fayllarini to‘liq oching yoki qayta o‘rnating.');
    this.cancelled = false;
    const child = spawn(this.binary, ['-c', 'forced_login_method="chatgpt"', 'login'], {
      env: runnerEnvironment(this.binary), windowsHide:true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']
    });
    this.child = child;
    for (const pipe of [child.stdout, child.stderr]) {
      pipe.setEncoding('utf8');
      pipe.on('data', text => this.emit('event', { kind: 'login', text: text.slice(0, 8000) }));
    }
    let settled = false;
    const finish = (code, error) => {
      if (settled) return; settled = true;
      clearTimeout(this.killTimer); this.child = null;
      this.emit('finish', { login: true, success: code === 0 && !this.cancelled, cancelled: this.cancelled,
        message: this.cancelled ? 'Kirish to‘xtatildi.' : code === 0 ? 'ChatGPT akkaunti ulandi.' : error?.message || 'Kirish yakunlanmadi. Yana urinib ko‘ring.' });
    };
    child.on('error', error => finish(-1, error)); child.on('close', code => finish(code));
  }
  stop() {
    if (!this.child) return false;
    this.cancelled = true;
    const child = this.child;
    const terminate = signal => killTree(child,signal);
    terminate('SIGTERM');
    this.killTimer = setTimeout(() => { if (this.child === child) terminate('SIGKILL'); }, 2500);
    this.killTimer.unref();
    return true;
  }
}
module.exports = { findCodex, loginStatus, CodexRunner };
