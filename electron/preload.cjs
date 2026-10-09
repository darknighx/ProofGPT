const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
  openDocumentation: () => ipcRenderer.invoke('help:openDocumentation'),
  analyze: (text) => ipcRenderer.invoke('detector:analyze', text),
  model: {
    status: () => ipcRenderer.invoke('model:status'),
    download: () => ipcRenderer.invoke('model:download'),
  },
  onModelState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('model:state', listener);
    return () => ipcRenderer.removeListener('model:state', listener);
  },
  exportReport: (format, data) => ipcRenderer.invoke('report:export', format, data),
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    remove: (id) => ipcRenderer.invoke('history:remove', id),
    clear: () => ipcRenderer.invoke('history:clear'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    restoreDefaults: () => ipcRenderer.invoke('settings:restoreDefaults'),
    resetData: () => ipcRenderer.invoke('settings:resetData'),
  },
  onDetectorStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('detector:status', listener);
    return () => ipcRenderer.removeListener('detector:status', listener);
  },
});
