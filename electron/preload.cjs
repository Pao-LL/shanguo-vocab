const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vocabStore', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  loadDict: () => ipcRenderer.invoke('dict:load'),
})