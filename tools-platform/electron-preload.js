const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ToolsUpdater', {
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback) => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('updater:status', listener);
        return () => ipcRenderer.removeListener('updater:status', listener);
    }
});
