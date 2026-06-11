const fs = require('fs');
const os = require('os');
const path = require('path');

const backendDir = __dirname;
const projectRoot = path.resolve(backendDir, '..');

function color(code, text) {
    return process.env.NO_COLOR ? text : `\x1b[${code}m${text}\x1b[0m`;
}

function formatList(items) {
    return items.map(item => `  - ${item}`).join('\n');
}

function huaweiNpmRegistryCommands() {
    return [
        '  npm config rm proxy',
        '  npm config rm http-proxy',
        '  npm config rm https-proxy',
        '  npm config set no-proxy .huawei.com',
        '  npm config set registry http://cmc-cd-mirror.rnd.huawei.com/npm'
    ];
}

function ensureDirWritable(dir, label, errors) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        const testFile = path.join(dir, `.write-test-${process.pid}.tmp`);
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
    } catch (err) {
        errors.push(`${label} 不可写：${dir}\n    ${err.message}`);
    }
}

function checkDependency(dep, errors) {
    try {
        require.resolve(dep, { paths: [backendDir] });
    } catch (err) {
        errors.push(`缺少依赖 ${dep}。请在 backend 目录执行：npm install`);
    }
}

function checkSqlite(errors) {
    let sqlite3;
    try {
        sqlite3 = require('sqlite3');
    } catch (err) {
        const hints = [
            'sqlite3 原生包未就绪或编译失败。',
            '建议先确认 Node.js 使用 LTS 版本，推荐 Node.js 20。',
            '在 backend 目录执行：npm install',
            '华为内网环境如 npm install 下载失败，可先配置华为 npm 源，见下方提示。',
            '如果仍失败，执行：npm rebuild sqlite3',
            'Windows 如遇 node-gyp 编译错误，请安装 Visual Studio Build Tools 2022，并勾选 Desktop development with C++。'
        ];
        errors.push(`${hints.join('\n    ')}\n    原始错误：${err.message}`);
        return;
    }

    try {
        const db = new sqlite3.Database(':memory:');
        db.serialize(() => {
            db.run('CREATE TABLE preflight_check (id INTEGER PRIMARY KEY, name TEXT)');
            db.run('INSERT INTO preflight_check (name) VALUES (?)', ['ok']);
        });
        db.close();
    } catch (err) {
        errors.push(`sqlite3 已安装但无法创建内存数据库。\n    ${err.message}`);
    }
}

function runPreflight(options = {}) {
    const errors = [];
    const warnings = [];
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const isWindows = process.platform === 'win32';
    const port = options.port || process.env.PORT || 3030;

    if (nodeMajor < 18) {
        errors.push(`Node.js 版本过低：${process.version}。请升级到 Node.js 18+，推荐 Node.js 20 LTS。`);
    } else if (nodeMajor > 22) {
        warnings.push(`当前 Node.js 版本为 ${process.version}。如果 sqlite3 安装异常，建议切换到 Node.js 20 LTS。`);
    }

    if (/\s/.test(projectRoot) && isWindows) {
        warnings.push(`项目路径包含空格，Windows 下 node-gyp/原生包偶尔会受影响。当前路径：${projectRoot}`);
    }

    if (/[^\x00-\x7F]/.test(projectRoot) && isWindows) {
        warnings.push(`项目路径包含中文或非 ASCII 字符，Windows 下部分原生依赖可能不稳定。当前路径：${projectRoot}`);
    }

    const packageJson = path.join(backendDir, 'package.json');
    if (!fs.existsSync(packageJson)) {
        errors.push(`未找到 backend/package.json。请确认在完整项目目录中启动。`);
    }

    const frontendDir = path.join(projectRoot, 'frontend');
    if (!fs.existsSync(frontendDir)) {
        errors.push(`未找到 frontend 目录：${frontendDir}`);
    }

    const isElectron = !!(process.versions && process.versions.electron);

    if (!isElectron) {
        const nodeModulesDir = path.join(backendDir, 'node_modules');
        if (!fs.existsSync(nodeModulesDir)) {
            errors.push(`未找到 backend/node_modules。请先执行：\n    cd backend\n    npm install`);
        }
        ['express', 'cors', 'multer', 'exceljs', 'uuid', '@google/generative-ai'].forEach(dep => checkDependency(dep, errors));
        
        ensureDirWritable(path.join(backendDir, 'data'), 'backend/data', errors);
        ensureDirWritable(path.join(backendDir, 'backups'), 'backend/backups', errors);
        ensureDirWritable(path.join(backendDir, 'logs'), 'backend/logs', errors);
        ensureDirWritable(path.join(backendDir, 'tmp'), 'backend/tmp', errors);
        ensureDirWritable(path.join(projectRoot, 'data'), 'data', errors);
        ensureDirWritable(path.join(projectRoot, 'data', 'images'), 'data/images', errors);
        ensureDirWritable(path.join(projectRoot, 'outputs'), 'outputs', errors);
    } else {
        const dataDir = process.env.TOOLS_DATA_DIR || path.join(backendDir, 'data');
        ensureDirWritable(dataDir, 'app data directory', errors);
    }
    
    checkSqlite(errors);

    if (!process.env.GEMINI_API_KEY) {
        warnings.push('未检测到 GEMINI_API_KEY 环境变量。AI 助手仍可在页面“全局设置”里配置 Token。');
    }

    console.log(color(36, '\n[启动自检] Tools Platform environment preflight'));
    console.log(`  Node.js: ${process.version}`);
    console.log(`  OS: ${os.type()} ${os.release()} (${process.platform}/${process.arch})`);
    console.log(`  Backend: ${backendDir}`);
    console.log(`  Port: ${port}`);

    if (warnings.length) {
        console.log(color(33, '\n[启动自检提醒]'));
        console.log(formatList(warnings));
    }

    if (errors.length) {
        console.error(color(31, '\n[启动自检失败] 请先处理以下问题：'));
        console.error(formatList(errors));
        console.error(color(36, '\n常用修复命令：'));
        console.error([
            '  cd backend',
            '  npm install',
            '  npm rebuild sqlite3',
            '  npm start'
        ].join('\n'));
        console.error(color(36, '\n华为内网 npm 源配置（如 npm install 下载失败，先执行）：'));
        console.error(huaweiNpmRegistryCommands().join('\n'));
        if (isWindows) {
            console.error(color(36, '\nWindows sqlite3/node-gyp 提示：'));
            console.error([
                '  1. 安装 Node.js 20 LTS',
                '  2. 安装 Visual Studio Build Tools 2022',
                '  3. 安装时勾选 Desktop development with C++',
                '  4. 重新打开 PowerShell 后执行 npm install'
            ].join('\n'));
        }
        process.exitCode = 1;
        return false;
    }

    console.log(color(32, '\n[启动自检通过] 环境基础项正常。\n'));
    return true;
}

if (require.main === module) {
    const ok = runPreflight({ port: process.env.PORT || 3030 });
    process.exit(ok ? 0 : 1);
}

module.exports = { runPreflight };
