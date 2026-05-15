/**
 * sla/config.js - SLA 全局配置持久化模块
 * 负责：全量配置（偏好+目标）的导出、导入（与服务端交互）
 */

async function exportConfig() {
    try {
        const data = await API.get('/api/sla/config');
        const keysCount = Object.keys(data.prefs || {}).length + (data.targets ? 1 : 0);
        if (keysCount === 0) { alert('当前服务器没有可导出的记忆配置！请先导入表格使用后再试。'); return; }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SLA_Monitor_Config_${new Date().getTime()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        showToast('✅ 配置已导出');
        API.logHistory('sla', '导出全量配置');
    } catch (e) {
        showToast('❌ 导出失败', 'error');
    }
}

async function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 步骤1：读取文件
    let rawText;
    try {
        rawText = await file.text();
    } catch (readErr) {
        alert(`❌ 文件读取失败：\n${readErr.message}`);
        event.target.value = '';
        return;
    }

    // 步骤2：JSON 解析
    let config;
    try {
        config = JSON.parse(rawText);
    } catch (parseErr) {
        alert(`❌ JSON 格式错误，无法解析配置文件：\n${parseErr.message}\n\n请检查文件是否是通过"导出配置"下载的原始文件。`);
        event.target.value = '';
        return;
    }

    if (typeof config !== 'object' || config === null) {
        alert('❌ 配置文件格式不正确：根节点必须是对象。');
        event.target.value = '';
        return;
    }

    // 步骤3：自动识别格式并统一转换
    // 新格式：{ targets: {}, prefs: {} }
    // 旧格式：{ "sla_global_targets": "...", "sla_prefs_xxx": "..." }
    let normalized = { targets: null, prefs: null };
    const keys = Object.keys(config);
    const isOldFormat = keys.some(k => k.startsWith('sla_'));

    if (isOldFormat) {
        // 旧版 localStorage 格式 → 转换
        console.log('[importConfig] 检测到旧版 localStorage 格式，自动转换中...');
        try {
            normalized.targets = config['sla_global_targets']
                ? JSON.parse(config['sla_global_targets']) : {};
        } catch (e) { normalized.targets = {}; }

        normalized.prefs = {};
        Object.keys(config).forEach(k => {
            if (k.startsWith('sla_prefs_')) {
                try { normalized.prefs[k] = JSON.parse(config[k]); }
                catch (e) { normalized.prefs[k] = config[k]; }
            }
        });
    } else if (config.targets !== undefined || config.prefs !== undefined) {
        // 新版平台格式
        normalized = config;
    } else {
        // 无法识别的格式，打印出字段帮助诊断
        alert(`❌ 无法识别配置文件格式。\n\n文件包含的字段：\n${keys.slice(0, 10).join('\n')}${keys.length > 10 ? '\n...' : ''}\n\n支持的格式：\n① 新版平台导出的 {targets, prefs}\n② 旧版 Task SLA Killer 导出的 {sla_global_targets, sla_prefs_...}`);
        event.target.value = '';
        return;
    }

    // 步骤4：发送到服务端
    try {
        await API.post('/api/sla/config', normalized);
        if (normalized.targets) window.GlobalTargets = normalized.targets;
        const prefsCount = Object.keys(normalized.prefs || {}).length;
        const targetsCount = Object.keys(normalized.targets || {}).length;
        const formatTip = isOldFormat ? '（已从旧版格式自动转换）' : '';
        alert(`✅ 配置导入成功！${formatTip}\n\n• 预警目标规则：${targetsCount} 条\n• 表格偏好记录：${prefsCount} 张\n\n请重新导入表格文件，新的设置会自动生效。`);
        API.logHistory('sla', '导入全量配置', `format:${isOldFormat ? 'legacy' : 'new'} targets:${targetsCount} prefs:${prefsCount}`);
    } catch (apiErr) {
        alert(`❌ 配置上传到服务端失败：\n${apiErr.message}\n\n请确认服务已启动（http://localhost:3030/api/health）。`);
        console.error('[importConfig] 上传失败:', apiErr);
    }

    event.target.value = '';
}

window.SLAConfig = { exportConfig, importConfig };
