'use strict';
const path = require('node:path');

const CHAT_URL = 'https://chatgpt.com/';
const AUTH_HOSTS = new Set([
  'auth.openai.com', 'auth0.openai.com', 'accounts.google.com',
  'login.microsoftonline.com', 'login.live.com', 'appleid.apple.com',
  'account.apple.com'
]);
function httpsURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch { return null; }
}
function chatURL(value) {
  const url = httpsURL(value);
  return Boolean(url && (url.hostname === 'chatgpt.com' || url.hostname.endsWith('.chatgpt.com')));
}
function internalURL(value) {
  const url = httpsURL(value);
  return Boolean(url && (chatURL(value) || AUTH_HOSTS.has(url.hostname)));
}
function displayName(value) {
 if(typeof value!=='string') return '';
 return value.replace(/[\u0000-\u001f\u007f]/g,'').trim().replace(/\s+/g,' ').slice(0,60);
}
function normalizeSettings(raw, home) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    displayName:displayName(value.displayName),
    workspace: typeof value.workspace === 'string' && path.isAbsolute(value.workspace)
      ? value.workspace : path.join(home, 'DavaDesk-work'),
    sandbox: value.sandbox === 'workspace-write' ? 'workspace-write' : 'read-only',
    pinned: value.pinned !== false,
    autostart: value.autostart === true,
    chatURL: chatURL(value.chatURL) ? value.chatURL : CHAT_URL
  };
}
function windowBounds(workArea, expanded) {
  const width = Math.min(expanded ? 980 : 244, workArea.width);
  const height = Math.min(expanded ? 746 : 62, workArea.height);
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: workArea.y + Math.min(8, Math.max(0, workArea.height - height)),
    width, height
  };
}
function viewBounds(rect, size) {
  if (!rect || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k]))) return null;
  const x = Math.max(0, Math.min(Math.round(rect.x), size.width - 1));
  const y = Math.max(0, Math.min(Math.round(rect.y), size.height - 1));
  return {
    x, y,
    width: Math.max(1, Math.min(Math.round(rect.width), size.width - x)),
    height: Math.max(1, Math.min(Math.round(rect.height), size.height - y))
  };
}
function validatePrompt(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Vazifani yozing.');
  if (value.length > 24000) throw new Error('Vazifa 24 000 belgidan oshmasin.');
  return value.trim();
}
function codexArgs(workspace, sandbox) {
  if (!path.isAbsolute(workspace)) throw new Error('Ish papkasi to‘liq yo‘l bo‘lishi kerak.');
  if (!['read-only', 'workspace-write'].includes(sandbox)) throw new Error('Noto‘g‘ri ruxsat.');
  return [
    '-c', 'forced_login_method="chatgpt"',
    'exec', '--json', '--sandbox', sandbox,
    '-c', 'approval_policy="never"',
    '--cd', workspace, '--skip-git-repo-check', '-'
  ];
}
function codexEnvironment(env) {
  const clean = { ...env, NO_COLOR: '1' };
  // Subscription authentication only; do not accidentally use a user's API key.
  for (const name of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN', 'OPENAI_ACCESS_TOKEN']) delete clean[name];
  return clean;
}
function eventSummary(event) {
  if (!event || typeof event !== 'object') return null;
  const type = event.type;
  if (type === 'thread.started') return { kind: 'status', text: 'Vazifa boshlandi.' };
  if (type === 'turn.completed') return { kind: 'done', text: 'Vazifa tugadi.' };
  if (type === 'turn.failed' || type === 'error') return {
    kind: 'error', text: String(event.error?.message || event.message || 'Vazifada xato yuz berdi.').slice(0, 8000)
  };
  const item = event.item;
  if (!item || typeof item !== 'object') return null;
  if (item.type === 'agent_message' && type === 'item.completed') return {
    kind: 'answer', text: String(item.text || '').slice(0, 120000)
  };
  if (item.type === 'command_execution' && type === 'item.started') return {
    kind: 'activity', text: String(item.command || 'Buyruq bajarilmoqda.').slice(0, 1600)
  };
  if (item.type === 'file_change' && type === 'item.completed') return {
    kind: 'activity', text: 'Fayllar: ' + (Array.isArray(item.changes)
      ? item.changes.map(x => String(x.path || '')).join(', ').slice(0, 1600) : 'tahrirlandi')
  };
  if (item.type === 'web_search' && type === 'item.started') return { kind: 'activity', text: 'Ma’lumot qidirilmoqda.' };
  if (item.type === 'mcp_tool_call' && type === 'item.started') return { kind: 'activity', text: 'Ulangan vosita bilan ishlanmoqda.' };
  return null;
}
function desktopQuote(value) {
  // Desktop Entry string escaping is decoded before its Exec quoting layer.
  return '"' + value.replace(/[\\"`$]/g, m => m === '\\' ? '\\\\\\\\' : '\\\\' + m).replace(/\n|\r/g, '') + '"';
}
module.exports = {
  displayName, CHAT_URL, httpsURL, chatURL, internalURL, normalizeSettings, windowBounds,
  viewBounds, validatePrompt, codexArgs, codexEnvironment, eventSummary, desktopQuote
};
