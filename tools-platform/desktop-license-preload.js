const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('DesktopLicense', {
    getState: () => ipcRenderer.invoke('desktop-license:get-state'),
    activate: token => ipcRenderer.invoke('desktop-license:activate', token),
    quit: () => ipcRenderer.invoke('desktop-license:quit'),
    readClipboard: () => {
        try {
            if (clipboard && typeof clipboard.readText === 'function') {
                return clipboard.readText();
            }
        } catch (_) {}
        return '';
    }
});
