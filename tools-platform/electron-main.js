const { app, BrowserWindow, dialog, ipcMain, session, shell, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// IMPORTANT: Set the data directory to the OS's native user data path BEFORE requiring server.js
const userDataPath = app.getPath('userData');
process.env.TOOLS_DATA_DIR = path.join(userDataPath, 'data');
console.log('[Electron] User Data Path:', process.env.TOOLS_DATA_DIR);

const net = require('net');
const launchStatePath = path.join(userDataPath, 'launch-state.json');

function getFreePort(startingPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startingPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(getFreePort(0)); // Let the OS assign a random free port
            } else {
                reject(err);
            }
        });
    });
}

let mainWindow;
let tray = null;
let isQuitting = false;
let isFirstClose = true;
let downloadHandlerRegistered = false;
let updateInfo = null;
let updateDownloaded = false;
let updateStatus = {
    state: 'idle',
    version: app.getVersion(),
    message: '等待检查更新',
    progress: 0
};

function readLaunchState() {
    try {
        if (!fs.existsSync(launchStatePath)) return {};
        return JSON.parse(fs.readFileSync(launchStatePath, 'utf-8'));
    } catch (err) {
        console.warn('[Electron] Failed to read launch state:', err.message);
        return {};
    }
}

function writeLaunchState(state) {
    try {
        fs.mkdirSync(path.dirname(launchStatePath), { recursive: true });
        fs.writeFileSync(launchStatePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
        console.warn('[Electron] Failed to write launch state:', err.message);
    }
}

function prepareLaunchExperience() {
    const state = readLaunchState();
    const currentVersion = app.getVersion();
    const previousVersion = state.lastSeenVersion || '';
    const launchKind = previousVersion
        ? (previousVersion === currentVersion ? 'normal' : 'updated')
        : 'first';

    const nextState = {
        ...state,
        lastSeenVersion: currentVersion,
        lastLaunchAt: new Date().toISOString(),
        openInternalBrowser: state.openInternalBrowser !== false,
        openSystemBrowserOnSpecialLaunch: state.openSystemBrowserOnSpecialLaunch !== false
    };
    writeLaunchState(nextState);

    return {
        kind: launchKind,
        previousVersion,
        currentVersion,
        shouldShowWelcome: launchKind !== 'normal',
        shouldOpenSystemBrowser: true // 每次启动都强制调用系统默认浏览器打开
    };
}

function buildLaunchUrl(port, launchExperience) {
    const url = new URL(`http://localhost:${port}/`);
    if (launchExperience.shouldShowWelcome) {
        url.searchParams.set('welcome', launchExperience.kind);
        url.searchParams.set('version', launchExperience.currentVersion);
        if (launchExperience.previousVersion) {
            url.searchParams.set('from', launchExperience.previousVersion);
        }
    }
    return url.toString();
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function broadcastUpdateStatus(patch = {}) {
    updateStatus = {
        ...updateStatus,
        ...patch,
        version: app.getVersion(),
        updatedAt: new Date().toISOString()
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', updateStatus);
    }

    return updateStatus;
}

function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        broadcastUpdateStatus({
            state: 'checking',
            message: '正在检查更新...',
            progress: 0
        });
    });

    autoUpdater.on('update-available', (info) => {
        updateInfo = info;
        updateDownloaded = false;
        broadcastUpdateStatus({
            state: 'available',
            latestVersion: info.version,
            message: `发现新版本 ${info.version}`,
            progress: 0
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        updateInfo = info;
        updateDownloaded = false;
        broadcastUpdateStatus({
            state: 'not-available',
            latestVersion: info.version,
            message: '当前已是最新版本',
            progress: 0
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        broadcastUpdateStatus({
            state: 'downloading',
            message: `正在下载更新 ${Math.round(progress.percent || 0)}%`,
            progress: Math.round(progress.percent || 0),
            bytesPerSecond: progress.bytesPerSecond,
            transferred: progress.transferred,
            total: progress.total
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        updateInfo = info;
        updateDownloaded = true;
        broadcastUpdateStatus({
            state: 'downloaded',
            latestVersion: info.version,
            message: '更新已下载，重启后生效',
            progress: 100
        });
    });

    autoUpdater.on('error', (err) => {
        broadcastUpdateStatus({
            state: 'error',
            message: err && err.message ? err.message : String(err),
            progress: 0
        });
    });
}

function registerUpdaterIpcHandlers() {
    ipcMain.handle('updater:get-version', () => ({
        version: app.getVersion(),
        packaged: app.isPackaged
    }));

    ipcMain.handle('updater:get-status', () => updateStatus);

    ipcMain.handle('updater:check', async () => {
        if (!app.isPackaged) {
            return broadcastUpdateStatus({
                state: 'dev-unavailable',
                message: '开发模式不支持自动更新',
                progress: 0
            });
        }

        try {
            await autoUpdater.checkForUpdates();
            return updateStatus;
        } catch (err) {
            return broadcastUpdateStatus({
                state: 'error',
                message: err && err.message ? err.message : String(err),
                progress: 0
            });
        }
    });

    ipcMain.handle('updater:download', async () => {
        if (!app.isPackaged) {
            return broadcastUpdateStatus({
                state: 'dev-unavailable',
                message: '开发模式不支持自动更新',
                progress: 0
            });
        }
        if (!updateInfo || updateStatus.state !== 'available') {
            return broadcastUpdateStatus({
                message: '请先检查并确认有可用更新'
            });
        }

        try {
            broadcastUpdateStatus({
                state: 'downloading',
                message: '正在准备下载更新...',
                progress: 0
            });
            await autoUpdater.downloadUpdate();
            return updateStatus;
        } catch (err) {
            return broadcastUpdateStatus({
                state: 'error',
                message: err && err.message ? err.message : String(err),
                progress: 0
            });
        }
    });

    ipcMain.handle('updater:install', () => {
        if (!updateDownloaded) {
            return broadcastUpdateStatus({
                message: '更新尚未下载完成'
            });
        }

        broadcastUpdateStatus({
            state: 'installing',
            message: '正在重启并安装更新...',
            progress: 100
        });
        setImmediate(() => autoUpdater.quitAndInstall(false, true));
        return updateStatus;
    });
}

function scheduleStartupUpdateCheck() {
    if (!app.isPackaged) return;
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
            broadcastUpdateStatus({
                state: 'error',
                message: err && err.message ? err.message : String(err),
                progress: 0
            });
        });
    }, 3500);
}

function registerDownloadHandler() {
    if (downloadHandlerRegistered) return;
    downloadHandlerRegistered = true;

    session.defaultSession.on('will-download', (event, item, webContents) => {
        const ownerWindow = BrowserWindow.fromWebContents(webContents) || mainWindow;
        const filename = item.getFilename();
        const savePath = dialog.showSaveDialogSync(ownerWindow, {
            title: '保存文件',
            defaultPath: path.join(app.getPath('downloads'), filename),
            buttonLabel: '保存'
        });

        if (!savePath) {
            event.preventDefault();
            return;
        }

        item.setSavePath(savePath);
        item.once('done', async (_event, state) => {
            if (state === 'completed') {
                const result = await dialog.showMessageBox(ownerWindow, {
                    type: 'info',
                    title: '下载完成',
                    message: '文件已保存',
                    detail: savePath,
                    buttons: ['打开所在文件夹', '确定'],
                    defaultId: 0,
                    cancelId: 1
                });

                if (result.response === 0) {
                    shell.showItemInFolder(savePath);
                }
                return;
            }

            if (state === 'interrupted') {
                dialog.showErrorBox('下载失败', `文件下载中断：${filename}`);
            }
        });
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'frontend/assets/icon.ico');
    // Fallback to native if icon is missing, but usually electron builder packages the icon
    try {
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            { label: '显示主窗口', click: () => { if (mainWindow) mainWindow.show(); } },
            { type: 'separator' },
            { label: '完全退出程序', click: () => {
                isQuitting = true;
                app.quit();
            }}
        ]);
        tray.setToolTip('数据抓取引擎');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });
    } catch (e) {
        console.warn('[Electron] Failed to create Tray:', e);
    }
}

async function createWindow() {
    const launchExperience = prepareLaunchExperience();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'electron-preload.js')
        },
        autoHideMenuBar: true, // Hide menu bar for a cleaner look
        icon: path.join(__dirname, 'frontend/assets/icon.ico') // Assume icon exists or fallback
    });

    registerDownloadHandler();

    try {
        // Start the Express server on a dynamically assigned free port
        const PORT = await getFreePort(3030);
        process.env.PORT = PORT;
        
        require('./backend/server.js');
        
        // Wait a brief moment for the server to bind the port
        setTimeout(() => {
            const launchUrl = buildLaunchUrl(PORT, launchExperience);
            mainWindow.loadURL(launchUrl);
            if (launchExperience.shouldOpenSystemBrowser) {
                shell.openExternal(launchUrl).catch((err) => {
                    console.warn('[Electron] Failed to open system browser:', err.message);
                });
            }
            mainWindow.webContents.once('did-finish-load', scheduleStartupUpdateCheck);
        }, 1000);
    } catch (err) {
        dialog.showErrorBox('Server Startup Failed', `Failed to start the local server: ${err.message}`);
    }

    if (!tray) {
        createTray();
    }

    mainWindow.on('close', function (event) {
        if (!isQuitting) {
            event.preventDefault();
            
            const state = readLaunchState();
            if (state.closeBehavior === 'minimize') {
                mainWindow.hide();
                return;
            } else if (state.closeBehavior === 'quit') {
                isQuitting = true;
                app.quit();
                return;
            }

            dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['最小化到后台托盘 (推荐)', '完全退出程序'],
                defaultId: 0,
                cancelId: 0,
                title: '关闭窗口',
                message: '您希望如何处理程序？',
                detail: '最小化到后台托盘可以保持服务运行，随时通过右下角托盘快速打开主窗口。',
                checkboxLabel: '记住我的选择，以后不再提示',
                checkboxChecked: true
            }).then(({ response, checkboxChecked }) => {
                if (checkboxChecked) {
                    state.closeBehavior = response === 1 ? 'quit' : 'minimize';
                    writeLaunchState(state);
                }

                if (response === 1) {
                    isQuitting = true;
                    app.quit();
                } else {
                    mainWindow.hide();
                    if (isFirstClose && tray) {
                        tray.displayBalloon({
                            title: '工具已隐藏至后台托盘',
                            content: '程序仍在后台稳定运行中，点击托盘图标可重新打开主窗口。',
                            iconType: 'info'
                        });
                        isFirstClose = false;
                    }
                }
            });
        }
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('ready', createWindow);
app.whenReady().then(() => {
    setupAutoUpdater();
    registerUpdaterIpcHandlers();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
