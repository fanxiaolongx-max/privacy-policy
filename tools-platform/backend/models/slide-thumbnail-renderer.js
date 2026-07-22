const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');

const execFileAsync = promisify(execFile);

const PREVIEW_CJK_FONT = process.platform === 'darwin'
    ? 'Heiti SC'
    : process.platform === 'win32' ? 'Microsoft YaHei' : 'Noto Sans CJK SC';

const PREVIEW_FONT_SUBSTITUTIONS = new Map([
    ['Huawei Sans', PREVIEW_CJK_FONT],
    ['HuaweiSans', PREVIEW_CJK_FONT],
    ['方正兰亭黑简体', PREVIEW_CJK_FONT],
    ['方正兰亭黑', PREVIEW_CJK_FONT],
    ['FZLTHJW--GB1-0', PREVIEW_CJK_FONT]
]);

function emitProgress(onProgress, event) {
    if (typeof onProgress !== 'function') return;
    onProgress({ level: 'info', progress: 0, ...event });
}

function substitutePreviewFonts(xml) {
    return String(xml).replace(/typeface="([^"]+)"/g, (match, typeface) => {
        const replacement = PREVIEW_FONT_SUBSTITUTIONS.get(typeface);
        return replacement ? `typeface="${replacement}"` : match;
    });
}

async function copyPreviewSource(entry, targetPath) {
    const zip = await JSZip.loadAsync(fs.readFileSync(entry.sourcePath));
    const xmlNames = Object.keys(zip.files).filter(name => /^ppt\/(?:slides|slideLayouts|slideMasters|theme)\/[^/]+\.xml$/i.test(name));
    for (const name of xmlNames) {
        const xml = await zip.file(name).async('string');
        let nextXml = substitutePreviewFonts(xml);
        if (entry.hidden && /^ppt\/slides\/slide\d+\.xml$/i.test(name)) {
            nextXml = nextXml.replace(/(<p:sld\b[^>]*?)\s+show="(?:0|false)"/i, '$1');
        }
        if (nextXml !== xml) zip.file(name, nextXml);
    }
    const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
    fs.writeFileSync(targetPath, buffer);
}

async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function runWorker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
    return results;
}

function xmlEscape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createFontConfig(renderDir) {
    const cacheDir = path.join(renderDir, 'font-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const candidates = process.platform === 'darwin'
        ? ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', path.join(os.homedir(), 'Library', 'Fonts')]
        : process.platform === 'win32'
            ? [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')]
            : ['/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts')];
    const fontDirs = candidates.filter(candidate => fs.existsSync(candidate));
    const configPath = path.join(renderDir, 'fonts.conf');
    fs.writeFileSync(configPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
${fontDirs.map(dir => `  <dir>${xmlEscape(dir)}</dir>`).join('\n')}
  <cachedir>${xmlEscape(cacheDir)}</cachedir>
  <config><rescan><int>30</int></rescan></config>
</fontconfig>`);
    return configPath;
}

function firstExistingPath(candidates, fallback) {
    return candidates.filter(Boolean).find(candidate => path.isAbsolute(candidate) && fs.existsSync(candidate)) || fallback;
}

function resolveLibreOfficeCommand() {
    if (process.env.SOFFICE_PATH) return process.env.SOFFICE_PATH;
    if (process.platform === 'win32') {
        return firstExistingPath([
            process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'LibreOffice', 'program', 'soffice.exe'),
            process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'LibreOffice', 'program', 'soffice.exe')
        ], 'soffice.exe');
    }
    if (process.platform === 'darwin') {
        return firstExistingPath(['/Applications/LibreOffice.app/Contents/MacOS/soffice'], 'soffice');
    }
    return 'soffice';
}

function resolvePdfToPngCommand() {
    if (process.env.PDFTOPPM_PATH) return process.env.PDFTOPPM_PATH;
    if (process.platform === 'win32') {
        return firstExistingPath([
            process.env.POPPLER_HOME && path.join(process.env.POPPLER_HOME, 'Library', 'bin', 'pdftoppm.exe'),
            process.env.POPPLER_HOME && path.join(process.env.POPPLER_HOME, 'bin', 'pdftoppm.exe')
        ], 'pdftoppm.exe');
    }
    return 'pdftoppm';
}

function powershellCandidates() {
    if (process.env.POWERSHELL_PATH) return [process.env.POWERSHELL_PATH];
    return ['powershell.exe', 'pwsh.exe'];
}

async function renderWithPowerPoint(sources, renderDir, onProgress) {
    const manifestPath = path.join(renderDir, 'powerpoint-render-manifest.json');
    const scriptPath = path.join(renderDir, 'render-powerpoint.ps1');
    const manifest = sources.map(source => ({
        source,
        output: path.join(renderDir, `${path.basename(source, '.pptx')}.png`)
    }));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
    fs.writeFileSync(scriptPath, [
        "$ErrorActionPreference = 'Stop'",
        '$items = Get-Content -LiteralPath $args[0] -Raw | ConvertFrom-Json',
        '$powerPoint = $null',
        'try {',
        '  $powerPoint = New-Object -ComObject PowerPoint.Application',
        '  foreach ($item in $items) {',
        '    $presentation = $null',
        '    try {',
        '      $presentation = $powerPoint.Presentations.Open([string]$item.source, -1, -1, 0)',
        "      $presentation.Slides.Item(1).Export([string]$item.output, 'PNG', 1280, 720)",
        '    } catch {',
        "      Write-Output ('WARN|' + [string]$item.source + '|' + $_.Exception.Message)",
        '    } finally {',
        '      if ($presentation -ne $null) { $presentation.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }',
        '    }',
        '  }',
        '} finally {',
        '  if ($powerPoint -ne $null) { $powerPoint.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) }',
        '  [GC]::Collect(); [GC]::WaitForPendingFinalizers()',
        '}'
    ].join('\r\n'), 'utf8');

    let lastError = null;
    for (const command of powershellCandidates()) {
        try {
            emitProgress(onProgress, {
                progress: 0.05,
                message: `Windows 正在通过 ${command} 检测并启动 PowerPoint COM 导出引擎`,
                engine: 'powerpoint'
            });
            await execFileAsync(command, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, manifestPath], {
                timeout: Math.max(180000, sources.length * 30000),
                maxBuffer: 8 * 1024 * 1024,
                windowsHide: true
            });
            const files = manifest.map(item => fs.existsSync(item.output) ? item.output : null);
            if (!files.some(Boolean)) throw new Error('PowerPoint 已运行，但没有导出任何 PNG 文件');
            emitProgress(onProgress, {
                progress: 0.72,
                level: files.every(Boolean) ? 'success' : 'warning',
                message: `PowerPoint 导出完成：${files.filter(Boolean).length}/${files.length} 张缩略图`,
                engine: 'powerpoint'
            });
            return { files, engine: 'powerpoint' };
        } catch (error) {
            lastError = error;
            if (error && error.code === 'ENOENT') continue;
            break;
        }
    }
    throw new Error(`PowerPoint 缩略图导出不可用：${lastError?.message || '未找到 PowerShell 或 PowerPoint'}`);
}

async function renderWithLibreOffice(sources, renderDir, onProgress) {
    const soffice = resolveLibreOfficeCommand();
    const pdftoppm = resolvePdfToPngCommand();
    const fontConfigPath = createFontConfig(renderDir);
    const officeProfileDir = path.join(renderDir, 'libreoffice-profile');
    fs.mkdirSync(officeProfileDir, { recursive: true });
    const officeProfileArg = `-env:UserInstallation=${pathToFileURL(officeProfileDir).href}`;
    emitProgress(onProgress, {
        progress: 0.08,
        message: `正在使用 LibreOffice/Poppler 渲染（soffice: ${soffice}；pdftoppm: ${pdftoppm}）`,
        engine: 'libreoffice'
    });

    for (let offset = 0; offset < sources.length; offset += 12) {
        const batch = sources.slice(offset, offset + 12);
        const convert = inputs => execFileAsync(
            soffice,
            [officeProfileArg, '--headless', '--convert-to', 'pdf', '--outdir', renderDir, ...inputs],
            {
                timeout: 120000,
                maxBuffer: 4 * 1024 * 1024,
                windowsHide: true,
                env: { ...process.env, FONTCONFIG_FILE: fontConfigPath }
            }
        );
        try {
            await convert(batch);
        } catch (error) {
            emitProgress(onProgress, {
                level: 'warning',
                progress: 0.12,
                message: `LibreOffice 批量转换失败，正在逐页重试：${error.message}`,
                engine: 'libreoffice'
            });
            for (const source of batch) {
                try {
                    await convert([source]);
                } catch (pageError) {
                    emitProgress(onProgress, {
                        level: 'warning',
                        progress: 0.12,
                        message: `${path.basename(source)} 转 PDF 失败：${pageError.message}`,
                        engine: 'libreoffice'
                    });
                }
            }
        }
        emitProgress(onProgress, {
            progress: 0.12 + (Math.min(offset + batch.length, sources.length) / sources.length * 0.42),
            message: `LibreOffice 已转换 ${Math.min(offset + batch.length, sources.length)}/${sources.length} 页 PDF`,
            engine: 'libreoffice'
        });
    }

    const files = await mapWithConcurrency(sources, 4, async (source, index) => {
        const stem = path.basename(source, '.pptx');
        const pdfPath = path.join(renderDir, `${stem}.pdf`);
        if (!fs.existsSync(pdfPath)) {
            emitProgress(onProgress, { level: 'warning', progress: 0.56, message: `${stem} 未生成 PDF，跳过 PNG 转换`, engine: 'libreoffice' });
            return null;
        }
        const pngPath = path.join(renderDir, `${stem}.png`);
        try {
            await execFileAsync(
                pdftoppm,
                ['-png', '-singlefile', '-r', '110', pdfPath, path.join(renderDir, stem)],
                { timeout: 60000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }
            );
            emitProgress(onProgress, {
                progress: 0.56 + ((index + 1) / sources.length * 0.38),
                message: `${stem} 已完成 PNG 写入校验`,
                engine: 'libreoffice'
            });
            return fs.existsSync(pngPath) ? pngPath : null;
        } catch (error) {
            emitProgress(onProgress, { level: 'warning', progress: 0.56, message: `${stem} 转 PNG 失败：${error.message}`, engine: 'libreoffice' });
            return null;
        }
    });
    if (!files.some(Boolean)) throw new Error('LibreOffice/Poppler 已运行，但没有生成任何缩略图');
    return { files, engine: 'libreoffice' };
}

/**
 * Render every single-slide PPTX independently. Windows uses installed
 * PowerPoint first for best fidelity, then falls back to LibreOffice/Poppler.
 * macOS and Linux use LibreOffice/Poppler.
 */
async function renderSingleSlideThumbnails(entries, { onProgress } = {}) {
    const renderDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-preview-'));
    const diagnostics = [];
    try {
        const sources = [];
        for (let index = 0; index < entries.length; index += 1) {
            const source = path.join(renderDir, `slide-${String(index + 1).padStart(4, '0')}.pptx`);
            await copyPreviewSource(entries[index], source);
            sources.push(source);
        }
        emitProgress(onProgress, { progress: 0.02, message: `已准备 ${sources.length} 个跨平台渲染副本`, engine: 'prepare' });

        if (process.platform === 'win32') {
            try {
                const result = await renderWithPowerPoint(sources, renderDir, onProgress);
                if (result.files.every(Boolean)) {
                    return { renderDir, files: result.files, engine: result.engine, diagnostics };
                }
                const missingIndexes = result.files.map((file, index) => file ? -1 : index).filter(index => index >= 0);
                diagnostics.push(`PowerPoint 有 ${missingIndexes.length} 页未生成缩略图`);
                emitProgress(onProgress, {
                    level: 'warning',
                    progress: 0.74,
                    message: `PowerPoint 有 ${missingIndexes.length} 页未生成缩略图，正在尝试 LibreOffice/Poppler 补齐`,
                    engine: 'powerpoint'
                });
                try {
                    const fallback = await renderWithLibreOffice(missingIndexes.map(index => sources[index]), renderDir, onProgress);
                    missingIndexes.forEach((sourceIndex, fallbackIndex) => {
                        if (fallback.files[fallbackIndex]) result.files[sourceIndex] = fallback.files[fallbackIndex];
                    });
                    return { renderDir, files: result.files, engine: 'powerpoint+libreoffice', diagnostics };
                } catch (fallbackError) {
                    diagnostics.push(fallbackError.message);
                    return { renderDir, files: result.files, engine: 'powerpoint', diagnostics };
                }
            } catch (error) {
                diagnostics.push(error.message);
                emitProgress(onProgress, { level: 'warning', progress: 0.06, message: `${error.message}；尝试 LibreOffice/Poppler 回退`, engine: 'powerpoint' });
            }
        }

        try {
            const result = await renderWithLibreOffice(sources, renderDir, onProgress);
            return { renderDir, files: result.files, engine: result.engine, diagnostics };
        } catch (error) {
            diagnostics.push(error.message);
            throw new Error(`未找到可用的缩略图渲染引擎（${diagnostics.join('；')}）`);
        }
    } catch (error) {
        fs.rmSync(renderDir, { recursive: true, force: true });
        throw error;
    }
}

module.exports = {
    renderSingleSlideThumbnails,
    resolveLibreOfficeCommand,
    resolvePdfToPngCommand
};
