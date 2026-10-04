'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const allowed = new Set([
  'set-name','upload-retry','upload-cancel','upload-dismiss','pick-ai-files','provider', 'pointer-inside', 'pointer-outside', 'drag-start', 'drag-move', 'drag-end', 'files', 'pick-files', 'remove-file', 'copy-file-path', 'state', 'toggle', 'tab', 'web-bounds', 'browser', 'new-chat', 'reload',
  'workspace', 'sandbox', 'autostart', 'pin', 'login', 'login-status',
  'task', 'stop', 'copy-answer', 'open-workspace', 'official-app', 'clear-session', 'quit'
]);
contextBridge.exposeInMainWorld('dava', {
  filePath: file => webUtils.getPathForFile(file),
  call: (action, payload) => {
    if (!allowed.has(action)) return Promise.reject(new Error('Noma’lum amal.'));
    return ipcRenderer.invoke('dava:call', action, payload);
  },
  onEvent: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('dava:event', listener);
    return () => ipcRenderer.removeListener('dava:event', listener);
  }
});
