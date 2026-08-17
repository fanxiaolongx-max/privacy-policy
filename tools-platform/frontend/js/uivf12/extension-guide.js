/**
 * uivf12/extension-guide.js - UI.Vision RPA 扩展下载与图文安装指南控制器
 */
(function () {
    const EXTENSION_ZIP_URL = '/downloads/uivision-extension-9.6.1.zip';
    const EXTENSION_API_DOWNLOAD_URL = '/api/uiv/extension-download';
    const EXTENSION_VERSION = '9.6.1';

    let overlayEl = null;
    let keyHandlerAttached = false;

    function getOverlay() {
        if (!overlayEl) {
            overlayEl = document.getElementById('uivExtensionGuideOverlay');
        }
        return overlayEl;
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            close();
        }
    }

    function open(autoDownload = false) {
        const overlay = getOverlay();
        if (!overlay) return;

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('uiv-modal-open');

        if (!keyHandlerAttached) {
            document.addEventListener('keydown', onKeyDown);
            keyHandlerAttached = true;
        }

        // 聚焦首个核心按钮
        const firstFocus = overlay.querySelector('#uivExtDownloadDirectBtn') || overlay.querySelector('.uiv-extension-close');
        if (firstFocus) {
            setTimeout(() => firstFocus.focus(), 50);
        }

        if (autoDownload) {
            download();
        }
    }

    function close() {
        const overlay = getOverlay();
        if (!overlay) return;

        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('uiv-modal-open');

        if (keyHandlerAttached) {
            document.removeEventListener('keydown', onKeyDown);
            keyHandlerAttached = false;
        }
    }

    function download() {
        const link = document.createElement('a');
        link.href = EXTENSION_ZIP_URL;
        link.download = `uivision-extension-${EXTENSION_VERSION}.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 200);

        const t = window.UIVT || (k => k);
        if (window.showToast) {
            showToast(t('uiv.extension.toastDownloading') || `⚡ UI.Vision v${EXTENSION_VERSION} 插件包下载已触发！`, 'info');
        }

        const btn = document.getElementById('uivExtDownloadDirectBtn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = `<span>⏳ 正在启动下载...</span>`;
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 1800);
        }
    }

    async function copyUrl(urlText, btn) {
        const t = window.UIVT || (k => k);
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(urlText);
            } else {
                const input = document.createElement('input');
                input.value = urlText;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                input.remove();
            }
            if (window.showToast) {
                showToast(t('uiv.extension.copySuccess') || `✅ 已复制地址: ${urlText}`, 'success');
            }
            if (btn) {
                const prev = btn.textContent;
                btn.textContent = '✅ 已复制';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = prev;
                    btn.classList.remove('copied');
                }, 1500);
            }
        } catch (err) {
            console.warn('复制地址失败:', err);
            if (window.showToast) {
                showToast(`请手动复制: ${urlText}`, 'warning');
            }
        }
    }

    async function copyAllSteps(btn) {
        const t = window.UIVT || (k => k);
        const stepsText = [
            `【UI.Vision RPA 扩展简易安装指南 (v${EXTENSION_VERSION})】`,
            `----------------------------------------------------`,
            `步骤 1: 下载插件压缩包 (uivision-extension-${EXTENSION_VERSION}.zip)`,
            `步骤 2: 将 .zip 压缩包解压到本地固定文件夹（例如 D:\\Extensions\\uivision-extension-${EXTENSION_VERSION} 或 ~/Documents/uivision-extension-${EXTENSION_VERSION}）`,
            `  * 提示：解压后请保留该文件夹，不要删除或随意移动！`,
            `步骤 3: 打开浏览器扩展管理页面，右上角开启【开发者模式】开关：`,
            `  - Chrome 浏览器：chrome://extensions/`,
            `  - Edge 浏览器：edge://extensions/`,
            `步骤 4: 点击左上角【加载已解压的扩展程序】（Edge 显示为【加载解压缩的扩展】），选中刚才解压出的插件根目录（包含 manifest.json 的文件夹）。`,
            `步骤 5: 点击浏览器右上角拼图图标 🧩 将 UI.Vision RPA 钉选到工具栏。进入插件详情页开启「允许访问文件网址」即可。`,
            `----------------------------------------------------`,
            `完成以上步骤后，回到数据抓取工作台，点击左侧智能调度仓库底部的【🚀 运行批脚本】（或【🚀 运行测试批脚本】），即可直接调用 UI.Vision 插件自动抓取与全流程执行！`
        ].join('\n');

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(stepsText);
            } else {
                const input = document.createElement('textarea');
                input.value = stepsText;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                input.remove();
            }
            if (window.showToast) {
                showToast(t('uiv.extension.stepsCopied') || '✅ 完整安装指引已复制到剪贴板！', 'success');
            }
            if (btn) {
                const prev = btn.textContent;
                btn.textContent = '✅ 已复制指引';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = prev;
                    btn.classList.remove('copied');
                }, 1800);
            }
        } catch (err) {
            console.warn('复制指引失败:', err);
            if (window.showToast) {
                showToast('复制失败，请手动选择复制', 'error');
            }
        }
    }

    function refreshI18n() {
        const t = window.UIVT || (k => k);
        const overlay = getOverlay();
        if (!overlay) return;

        const setText = (sel, val) => {
            const el = overlay.querySelector(sel);
            if (el && val) el.textContent = val;
        };

        const setHtml = (sel, val) => {
            const el = overlay.querySelector(sel);
            if (el && val) el.innerHTML = val;
        };

        setText('.uiv-extension-eyebrow', t('uiv.extension.modalEyebrow'));
        setText('#uivExtensionModalTitle', t('uiv.extension.modalTitle'));
        setText('#uivExtensionModalSubtitle', t('uiv.extension.modalSubtitle'));
        setText('#uivExtDownloadCardTitle', t('uiv.extension.downloadCardTitle'));
        setText('#uivExtDownloadCardMeta', t('uiv.extension.downloadCardMeta'));
        setText('#uivExtDownloadDirectBtn span', t('uiv.extension.downloadBtn'));
        setText('#uivExtDownloadFallbackBtn', t('uiv.extension.downloadFallbackBtn'));
        setText('#uivExtStepsHeading', t('uiv.extension.stepsHeading'));
        setText('#uivExtStep1Title', t('uiv.extension.step1Title'));
        setText('#uivExtStep1Desc', t('uiv.extension.step1Desc'));
        setText('#uivExtStep2Title', t('uiv.extension.step2Title'));
        setText('#uivExtStep2Desc', t('uiv.extension.step2Desc'));
        setText('#uivExtStep2Warning', t('uiv.extension.step2Warning'));
        setText('#uivExtStep3Title', t('uiv.extension.step3Title'));
        setText('#uivExtStep3Desc', t('uiv.extension.step3Desc'));
        setText('#uivExtCopyChromeBtn', t('uiv.extension.copyChrome'));
        setText('#uivExtCopyEdgeBtn', t('uiv.extension.copyEdge'));
        setText('#uivExtStep4Title', t('uiv.extension.step4Title'));
        setText('#uivExtStep4Desc', t('uiv.extension.step4Desc'));
        setText('#uivExtStep5Title', t('uiv.extension.step5Title'));
        setText('#uivExtStep5Desc', t('uiv.extension.step5Desc'));
        setHtml('#uivExtTipBox', t('uiv.extension.tip'));
        setText('#uivExtCopyGuideBtn', t('uiv.extension.copyGuideBtn'));
        setText('#uivExtDoneBtn', t('uiv.extension.doneBtn'));

        // 更新页面主按钮
        const mainBtnText = document.querySelector('#btnDownloadUivExtension .btn-text');
        if (mainBtnText) mainBtnText.textContent = t('uiv.extension.btnText');
        const mainBtn = document.getElementById('btnDownloadUivExtension');
        if (mainBtn) mainBtn.title = t('uiv.extension.btnTitle');
    }

    window.UIVExtensionGuide = {
        open,
        close,
        download,
        copyUrl,
        copyAllSteps,
        refreshI18n,
        zipUrl: EXTENSION_ZIP_URL,
        apiUrl: EXTENSION_API_DOWNLOAD_URL,
        version: EXTENSION_VERSION
    };
})();
