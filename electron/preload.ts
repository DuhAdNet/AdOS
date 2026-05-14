import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ados', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  llm: {
    chat: (messages: Array<{ role: string; content: string }>, model: string) =>
      ipcRenderer.invoke('llm:chat', messages, model),
    stream: (messages: Array<{ role: string; content: string }>, model: string) =>
      ipcRenderer.invoke('llm:stream', messages, model),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  },
  browser: {
    open: (url: string) => ipcRenderer.invoke('browser:open', url),
    navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
    back: () => ipcRenderer.invoke('browser:back'),
    forward: () => ipcRenderer.invoke('browser:forward'),
    reload: () => ipcRenderer.invoke('browser:reload'),
    screenshot: () => ipcRenderer.invoke('browser:screenshot'),
    getUrl: () => ipcRenderer.invoke('browser:get-url'),
    getTitle: () => ipcRenderer.invoke('browser:get-title'),
    executeJs: (code: string) => ipcRenderer.invoke('browser:execute-js', code),
    close: () => ipcRenderer.invoke('browser:close'),
    resize: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('browser:resize', bounds),
  },
});
