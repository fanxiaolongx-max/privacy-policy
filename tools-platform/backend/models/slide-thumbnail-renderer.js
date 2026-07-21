const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const PREVIEW_CJK_FONT = process.platform === 'darwin' ? 'Heiti SC' : 'Noto Sans CJK SC';

const PREVIEW_FONT_SUBSTITUTIONS = new Map([
    ['Huawei Sans', PREVIEW_CJK_FONT],
    ['HuaweiSans', PREVIEW_CJK_FONT],
    ['方正兰亭黑简体', PREVIEW_CJK_FONT],
    ['方正兰亭黑', PREVIEW_CJK_FONT],
    ['FZLTHJW--GB1-0', PREVIEW_CJK_FONT]
]);

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

/**
 * Render every single-slide PPTX independently. Rendering the original deck in
 * one pass is unsafe because LibreOffice omits hidden slides and shifts all
 * following preview page numbers.
 */
async function renderSingleSlideThumbnails(entries) {
    const renderDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-preview-'));
    try {
        const fontConfigPath = createFontConfig(renderDir);
        const sources = [];
        for (let index = 0; index < entries.length; index += 1) {
            const source = path.join(renderDir, `slide-${String(index + 1).padStart(4, '0')}.pptx`);
            await copyPreviewSource(entries[index], source);
            sources.push(source);
        }

        // Large decks can exceed LibreOffice's practical multi-file command
        // limit, so convert in moderate sequential batches.
        for (let offset = 0; offset < sources.length; offset += 12) {
            await execFileAsync(
                'soffice',
                ['--headless', '--convert-to', 'pdf', '--outdir', renderDir, ...sources.slice(offset, offset + 12)],
                {
                    timeout: 120000,
                    maxBuffer: 4 * 1024 * 1024,
                    env: { ...process.env, FONTCONFIG_FILE: fontConfigPath }
                }
            );
        }

        const files = await mapWithConcurrency(sources, 4, async source => {
            const stem = path.basename(source, '.pptx');
            const pdfPath = path.join(renderDir, `${stem}.pdf`);
            if (!fs.existsSync(pdfPath)) return null;
            const pngPath = path.join(renderDir, `${stem}.png`);
            try {
                await execFileAsync(
                    'pdftoppm',
                    ['-png', '-singlefile', '-r', '110', pdfPath, path.join(renderDir, stem)],
                    { timeout: 60000, maxBuffer: 2 * 1024 * 1024 }
                );
                return fs.existsSync(pngPath) ? pngPath : null;
            } catch (error) {
                console.warn(`[slide-design] thumbnail page fallback (${stem}):`, error.message);
                return null;
            }
        });
        return { renderDir, files };
    } catch (error) {
        fs.rmSync(renderDir, { recursive: true, force: true });
        throw error;
    }
}

module.exports = { renderSingleSlideThumbnails };
