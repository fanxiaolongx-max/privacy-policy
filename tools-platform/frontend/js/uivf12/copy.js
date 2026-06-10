/**
 * uivf12/copy.js - 复制功能模块
 * 负责：代码复制到剪贴板、批量阵列打包生成
 */

function copyCodeText(textAreaId, btnId, typeName) {
    const codeEl = document.getElementById(textAreaId);
    if (!codeEl || !codeEl.value) { alert(UIVT('uiv.copy.noCode')); return; }
    codeEl.select();
    document.execCommand('copy');
    const btn = document.getElementById(btnId);
    const oldText = btn.innerText;
    btn.innerText = UIVT('uiv.copy.successButton');
    setTimeout(() => btn.innerText = oldText, 2000);
    showToast(UIVT('uiv.copy.toast', { type: typeName }));
}

function copyFromMemory(codeStr, typeName) {
    const t = document.createElement('textarea');
    t.value = codeStr;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    showToast(UIVT('uiv.copy.memoryToast', { type: typeName }));
}

async function copyAllConsoleScripts() {
    try {
        const { scripts } = await API.get('/api/uiv/scripts');
        buildAndCopyMasterScript(scripts, UIVT('uiv.copy.allGroup'));
    } catch (e) {
        showToast(UIVT('uiv.copy.fetchFail'), 'error');
    }
}

function buildAndCopyMasterScript(scriptsToRun, groupName) {
    if (scriptsToRun.length === 0) { alert(UIVT('uiv.copy.emptyGroup')); return; }

    let masterCode = `(async function() {\n    const totalTasks = ${scriptsToRun.length};\n    console.log("%c🚀 [批量调度·${groupName}] 阵列启动！共有 " + totalTasks + " 个任务排队执行中...", "font-size: 16px; font-weight: bold; color: #00d2d3; background: #222f3e; padding: 8px 12px; border-radius: 6px; border-left: 5px solid #00d2d3;");\n\n`;

    scriptsToRun.forEach((script, index) => {
        const safeName = script.name.replace(/"/g, '\\"');
        masterCode += `    // ========================================================\n    // 📦 队列 [${index + 1}/${scriptsToRun.length}]: ${script.name}\n    // ========================================================\n    console.log("%c\\n▶️ [调度进度: ${index + 1}/${scriptsToRun.length}] 开始注入执行: ${safeName}", "font-size: 14px; font-weight: bold; color: #feca57; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);")\n\n`;

        let cCode = script.consoleCode || '';
        if (!cCode) masterCode += `    console.error("⚠️ [警告] 该脚本缺少控制台版本的代码，自动跳过！");\n`;
        else {
            cCode = cCode.trim();
            masterCode += (cCode.startsWith('(async') ? `    await ${cCode}\n` : `    ${cCode}\n`);
        }

        if (index < scriptsToRun.length - 1) {
            masterCode += `\n    let delay_${index} = Math.floor(Math.random() * 3000) + 3000;\n    console.log("%c⏳ [调度防刷机制] 正在执行系统冷却... 随机阻断 " + (delay_${index}/1000).toFixed(1) + " 秒...", "color: #95a5a6; font-style: italic; font-size: 12px;");\n    await new Promise(r => setTimeout(r, delay_${index}));\n\n`;
        }
    });

    masterCode += `\n    console.log("%c\\n🎉 [批量调度·${groupName}] 任务列车抵达终点！所有 " + totalTasks + " 个核心任务全部执行完毕！", "font-size: 16px; font-weight: bold; color: #1dd1a1; background: #222f3e; padding: 8px 12px; border-radius: 6px; border-left: 5px solid #1dd1a1;");\n})();`;

    copyFromMemory(masterCode, UIVT('uiv.copy.batchType', { group: groupName }));
}

window.UIVCopy = { copyCodeText, copyFromMemory, copyAllConsoleScripts, buildAndCopyMasterScript };
window.UIVBatch = window.UIVCopy; // alias
