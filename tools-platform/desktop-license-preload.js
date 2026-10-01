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
    },
    onProgress: (callback) => {
        if (typeof callback !== 'function') return () => {};
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('desktop-license:progress', handler);
        return () => {
            try {
                ipcRenderer.removeListener('desktop-license:progress', handler);
            } catch (_) {}
        };
    }
});
