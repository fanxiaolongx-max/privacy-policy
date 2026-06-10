const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// IMPORTANT: Set the data directory to the OS's native user data path BEFORE requiring server.js
const userDataPath = app.getPath('userData');
process.env.TOOLS_DATA_DIR = path.join(userDataPath, 'data');
console.log('[Electron] User Data Path:', process.env.TOOLS_DATA_DIR);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true, // Hide menu bar for a cleaner look
        icon: path.join(__dirname, 'frontend/assets/icon.png') // Assume icon exists or fallback
    });

    // Start the Express server
    const PORT = 3030; // Alternatively, find a dynamic free port
    process.env.PORT = PORT;
    
    try {
        require('./backend/server.js');
        
        // Wait a brief moment for the server to bind the port
        setTimeout(() => {
            mainWindow.loadURL(`http://localhost:${PORT}`);
        }, 1000);
    } catch (err) {
        dialog.showErrorBox('Server Startup Failed', `Failed to start the local server: ${err.message}`);
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

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
