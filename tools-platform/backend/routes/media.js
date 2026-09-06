const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { checkAuth, requireAdmin } = require('../middleware/auth');

const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const VIDEOS_DIR = path.join(FRONTEND_DIR, 'assets/videos');
const MANIFEST_PATH = path.join(VIDEOS_DIR, 'media-manifest.json');
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.m4v']);
const multer = require('multer');
const os = require('os');
const mediaUpload = multer({ dest: os.tmpdir(), limits: { fileSize: 8 * 1024 ** 3, files: 1 } });

function validMediaFolder(name) {
    return typeof name === 'string' && name.trim() && name !== '.' && name !== '..' && !/[\\/\x00-\x1f]/.test(name) && !name.startsWith('.');
}
const DEFAULT_MEDIA_ORDER = 1000;

// 确保主目录存在
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

/**
 * 读取或初始化媒体清单元数据
 */
function readManifest() {
    try {
        if (fs.existsSync(MANIFEST_PATH)) {
            const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[Media] 读取 media-manifest.json 异常，使用默认结构:', e.message);
    }
    return {
        categories: [
            { id: 'all', name: '全部', icon: '🎬', folder: '' },
            { id: 'film', name: '独家电影', icon: '🌟', folder: '' },
            { id: 'ay-daily', name: '阿语日常', icon: '🗣️', folder: '阿语日常' },
            { id: 'ay-letters', name: '阿语字母', icon: '🔤', folder: '阿语字母' }
        ],
        videos: {}
    };
}

/**
 * 保存媒体清单
 */
function writeManifest(manifest) {
    try {
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    } catch (e) {
        console.error('[Media] 保存 media-manifest.json 失败:', e);
    }
}

/**
 * 获取磁盘空间信息
 */
function getDiskSpace() {
    try {
        const out = execSync('df -k "' + FRONTEND_DIR + '"', { encoding: 'utf8' });
        const lines = out.trim().split('\n');
        if (lines.length >= 2) {
            const parts = lines[1].replace(/\s+/g, ' ').split(' ');
            const totalKb = parseInt(parts[1], 10);
            const availKb = parseInt(parts[3], 10);
            const usedKb = parseInt(parts[2], 10);
            return {
                totalGb: (totalKb / (1024 * 1024)).toFixed(1),
                freeGb: (availKb / (1024 * 1024)).toFixed(1),
                usedGb: (usedKb / (1024 * 1024)).toFixed(1)
            };
        }
    } catch (e) {
        // fallback
    }
    return { totalGb: '512.0', freeGb: '10.0', usedGb: '400.0' };
}

function normalizeMediaOrder(savedOrder, isDragonRestaurant = false) {
    const parsed = Number(savedOrder);
    if (Number.isSafeInteger(parsed)) return parsed;
    return isDragonRestaurant ? 0 : DEFAULT_MEDIA_ORDER;
}

function compareMediaOrder(a, b) {
    if (a.order !== b.order) return a.order - b.order;
    return a.fileName.localeCompare(b.fileName, 'zh-CN', { numeric: true });
}

/**
 * 递归扫描磁盘视频并与清单元数据融合
 */
function scanMediaList() {
    const manifest = readManifest();
    const categoriesMap = new Map();
    (manifest.categories || []).forEach(cat => categoriesMap.set(cat.folder || '', cat));

    const videos = [];
    const scannedFolders = new Set(['']);

    function scanDir(currentDir, relativeFolder) {
        if (!fs.existsSync(currentDir)) return;
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        // 收集文件夹
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.')) continue;
                const subRel = relativeFolder ? `${relativeFolder}/${entry.name}` : entry.name;
                scannedFolders.add(subRel);
                scanDir(path.join(currentDir, entry.name), subRel);
            }
        }

        // 收集视频文件
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (entry.name.startsWith('.')) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!VIDEO_EXTS.has(ext)) continue;

            const baseName = path.basename(entry.name, ext);
            const relFilePath = relativeFolder ? `${relativeFolder}/${entry.name}` : entry.name;
            const fullPath = path.join(currentDir, entry.name);
            let stat = { size: 0, mtimeMs: Date.now() };
            try {
                stat = fs.statSync(fullPath);
            } catch (e) {}

            const videoId = encodeURIComponent(relFilePath.replace(/\//g, '___'));

            // 检查是否有对应的同名封面图片
            const possiblePosterRel = relativeFolder ? `${relativeFolder}/${baseName}_poster.jpg` : `${baseName}_poster.jpg`;
            const possibleThumbRel = relativeFolder ? `${relativeFolder}/${baseName}.jpg` : `${baseName}.jpg`;
            let posterUrl = '/assets/videos/龙餐馆_poster.jpg';
            if (fs.existsSync(path.join(VIDEOS_DIR, possiblePosterRel))) {
                posterUrl = `/assets/videos/${encodeURI(possiblePosterRel)}`;
            } else if (fs.existsSync(path.join(VIDEOS_DIR, possibleThumbRel))) {
                posterUrl = `/assets/videos/${encodeURI(possibleThumbRel)}`;
            }

            // 元数据融合
            const savedMeta = (manifest.videos && (manifest.videos[videoId] || manifest.videos[relFilePath] || manifest.videos[baseName])) || {};
            const catObj = categoriesMap.get(relativeFolder) || { id: relativeFolder || 'film', name: relativeFolder || '独家影音' };
            const isDragonRestaurant = baseName.includes('龙餐馆');
            const defaultTitle = isDragonRestaurant ? '龙餐馆' : baseName;

            videos.push({
                id: videoId,
                title: savedMeta.title || defaultTitle,
                fileName: entry.name,
                relPath: relFilePath,
                folder: relativeFolder,
                category: savedMeta.category || catObj.id || 'default',
                categoryName: savedMeta.categoryName || catObj.name || (relativeFolder || '默认分类'),
                fileSize: stat.size,
                fileSizeFormatted: (stat.size / (1024 * 1024)).toFixed(1) + ' MB',
                format: ext.replace('.', '').toUpperCase(),
                src: `/assets/videos/${encodeURI(relFilePath)}`,
                poster: savedMeta.poster || posterUrl,
                durationFormatted: savedMeta.durationFormatted || '点播',
                resolution: savedMeta.resolution || (entry.name.includes('1334x720') ? '720P HD' : 'HD'),
                tags: savedMeta.tags || [relativeFolder ? relativeFolder : '独家', '高清'],
                description: savedMeta.description || `${catObj.name || '本地媒体'}：${baseName}`,
                order: normalizeMediaOrder(savedMeta.order, isDragonRestaurant),
                mtime: stat.mtimeMs
            });
        }
    }

    scanDir(VIDEOS_DIR, '');

    // 自动补齐清单中可能新增的物理文件夹分类
    let manifestChanged = false;
    for (const f of scannedFolders) {
        if (f && !categoriesMap.has(f)) {
            const newCat = {
                id: `folder-${Buffer.from(f).toString('hex').slice(0, 8)}`,
                name: f,
                icon: '📁',
                folder: f
            };
            manifest.categories.push(newCat);
            categoriesMap.set(f, newCat);
            manifestChanged = true;
        }
    }
    if (manifestChanged) {
        writeManifest(manifest);
    }

    // 默认排序：有指定 order 的优先，否则按文件名自然升序（适合 01_, 02_ 连载剧集）
    videos.sort(compareMediaOrder);

    return {
        categories: manifest.categories,
        videos
    };
}

// ============================================================
// 公开点播 API (无需鉴权)
// ============================================================
router.get('/public/list', (req, res) => {
    try {
        const { categories, videos } = scanMediaList();
        const { category, q } = req.query;

        let filtered = videos;
        if (category && category !== 'all') {
            filtered = filtered.filter(v => v.category === category || v.folder === category);
        }
        if (q) {
            const query = q.trim().toLowerCase();
            filtered = filtered.filter(v => 
                v.title.toLowerCase().includes(query) ||
                v.fileName.toLowerCase().includes(query) ||
                (v.tags && v.tags.some(t => t.toLowerCase().includes(query)))
            );
        }

        res.setHeader('Cache-Control', 'no-cache');
        res.json({
            success: true,
            count: filtered.length,
            total: videos.length,
            categories,
            data: filtered
        });
    } catch (err) {
        console.error('[Media API] /public/list error:', err);
        res.status(500).json({ error: '获取媒体列表失败' });
    }
});

// ============================================================
// 管理员媒体管理 API (需要超级管理员权限)
// ============================================================
router.use('/admin', checkAuth, requireAdmin);

/**
 * 仪表盘总体概况
 */
router.get('/admin/overview', (req, res) => {
    try {
        const { categories, videos } = scanMediaList();
        const disk = getDiskSpace();
        const totalBytes = videos.reduce((acc, v) => acc + (v.fileSize || 0), 0);
        const folderCounts = {};
        videos.forEach(v => {
            const f = v.folder || '独家影院';
            folderCounts[f] = (folderCounts[f] || 0) + 1;
        });

        res.json({
            success: true,
            totalVideos: videos.length,
            totalCategories: categories.filter(category => category.id !== 'all').length,
            totalSizeFormatted: (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            disk,
            folderCounts
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 获取分类/文件夹列表
 */
router.get('/admin/folders', (req, res) => {
    try {
        const { categories, videos } = scanMediaList();
        const foldersWithStats = categories.filter(category => category.id !== 'all').map(cat => {
            const matching = videos.filter(v => v.category === cat.id || v.folder === cat.folder);
            const sizeBytes = matching.reduce((acc, v) => acc + (v.fileSize || 0), 0);
            return {
                ...cat,
                count: matching.length,
                sizeFormatted: (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB'
            };
        });
        res.json({ success: true, data: foldersWithStats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 创建新分类/文件夹
 */
router.post('/admin/folders', (req, res) => {
    try {
        const { name, icon } = req.body || {};
        if (!name || !name.trim()) return res.status(400).json({ error: '分类名称不能为空' });
        const cleanName = name.trim();
        if (!validMediaFolder(cleanName)) return res.status(400).json({ error: '分类名称不能包含路径分隔符或特殊目录名称' });

        // 实体目录创建
        const targetDir = path.join(VIDEOS_DIR, cleanName);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const manifest = readManifest();
        const exists = manifest.categories.some(c => c.name === cleanName || c.folder === cleanName);
        if (!exists) {
            manifest.categories.push({
                id: `cat-${Date.now()}`,
                name: cleanName,
                icon: icon || '📁',
                folder: cleanName
            });
            writeManifest(manifest);
        }

        res.json({ success: true, message: `成功创建分类“${cleanName}”` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 重命名分类
 */
router.put('/admin/folders/:oldName', (req, res) => {
    try {
        const { oldName } = req.params;
        const { newName, icon } = req.body || {};
        if (!newName || !newName.trim()) return res.status(400).json({ error: '新名称不能为空' });

        const manifest = readManifest();
        const cat = manifest.categories.find(c => c.name === oldName || c.folder === oldName);
        if (!cat) return res.status(404).json({ error: '未找到指定分类' });

        // 如果对应磁盘目录存在，执行目录重命名
        const oldDir = path.join(VIDEOS_DIR, cat.folder || oldName);
        const newDir = path.join(VIDEOS_DIR, newName.trim());
        if (fs.existsSync(oldDir) && oldDir !== newDir && cat.folder) {
            fs.renameSync(oldDir, newDir);
        }

        cat.name = newName.trim();
        if (cat.folder) cat.folder = newName.trim();
        if (icon) cat.icon = icon;
        writeManifest(manifest);

        res.json({ success: true, message: '重命名分类成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 删除分类/文件夹
 */
router.delete('/admin/folders/:folderName', (req, res) => {
    try {
        const { folderName } = req.params;
        if (!folderName || folderName === 'all') return res.status(400).json({ error: '系统默认分类不可删除' });

        const manifest = readManifest();
        const catIndex = manifest.categories.findIndex(c => c.name === folderName || c.folder === folderName);
        if (catIndex !== -1) {
            manifest.categories.splice(catIndex, 1);
            writeManifest(manifest);
        }

        const targetDir = path.join(VIDEOS_DIR, folderName);
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
        }

        res.json({ success: true, message: `已彻底删除分类与目录“${folderName}”` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 获取完整视频列表（管理端视图）
 */
router.get('/admin/videos', (req, res) => {
    try {
        const { categories, videos } = scanMediaList();
        res.json({ success: true, count: videos.length, categories, data: videos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 编辑单个视频元数据
 */
router.put('/admin/videos/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, tags, description, order } = req.body || {};
        const parsedOrder = Number(order);
        if (order !== undefined && !Number.isSafeInteger(parsedOrder)) {
            return res.status(400).json({ error: '优先级必须是整数' });
        }

        const manifest = readManifest();
        if (!manifest.videos) manifest.videos = {};
        const decodedPath = decodeURIComponent(id).replace(/___/g, '/');
        const baseName = path.basename(decodedPath, path.extname(decodedPath));
        const manifestKey = [id, decodedPath, baseName].find(key => manifest.videos[key]) || id;
        manifest.videos[manifestKey] = {
            ...(manifest.videos[manifestKey] || {}),
            ...(title !== undefined && { title: title.trim() }),
            ...(category !== undefined && { category }),
            ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean) }),
            ...(description !== undefined && { description: description.trim() }),
            ...(order !== undefined && { order: parsedOrder })
        };
        writeManifest(manifest);

        res.json({ success: true, message: '更新视频元数据成功', order: order !== undefined ? parsedOrder : undefined });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 删除单个视频
 */
router.delete('/admin/videos/:id', (req, res) => {
    try {
        const { id } = req.params;
        const decodedPath = decodeURIComponent(id).replace(/___/g, '/');
        const fullPath = path.join(VIDEOS_DIR, decodedPath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        // 同时尝试清理海报
        const ext = path.extname(fullPath);
        const posterPath = fullPath.replace(ext, '_poster.jpg');
        if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);

        const manifest = readManifest();
        if (manifest.videos && manifest.videos[id]) {
            delete manifest.videos[id];
            writeManifest(manifest);
        }

        res.json({ success: true, message: '视频已成功删除' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 一键从本地目录导入视频资源
 */
router.post('/admin/upload', (req, res) => {
    mediaUpload.single('video')(req, res, async error => {
        const temporary = req.file?.path;
        try {
            if (error) return res.status(400).json({ error: error.message });
            const folder = String(req.body.folder || '').trim();
            const name = String(req.body.fileName || '').trim();
            if (!temporary || !validMediaFolder(folder) || !validMediaFolder(name) || !VIDEO_EXTS.has(path.extname(name).toLowerCase())) {
                return res.status(400).json({ error: '请选择有效的视频文件和分类名称' });
            }
            const destination = path.join(VIDEOS_DIR, folder);
            await fs.promises.mkdir(destination, { recursive: true });
            const real = await fs.promises.realpath(destination);
            const root = await fs.promises.realpath(VIDEOS_DIR);
            if (!real.startsWith(root + path.sep)) return res.status(400).json({ error: '无效的目标目录' });
            const ext = path.extname(name);
            let storedName = name;
            for (let index = 0; ; index++) {
                storedName = index ? `${path.basename(name, ext)} (${index})${ext}` : name;
                try {
                    await fs.promises.copyFile(temporary, path.join(real, storedName), fs.constants.COPYFILE_EXCL);
                    break;
                } catch (copyError) {
                    if (copyError.code !== 'EEXIST') throw copyError;
                }
            }
            res.json({ success: true, fileName: storedName });
        } catch (uploadError) {
            res.status(500).json({ error: uploadError.message });
        } finally {
            if (temporary) await fs.promises.unlink(temporary).catch(() => {});
        }
    });
});

router.post('/admin/import-local', async (req, res) => {
    try {
        const { sourcePath, targetFolder, mode } = req.body || {};
        if (!sourcePath || !fs.existsSync(sourcePath)) {
            return res.status(400).json({ error: `源目录不存在或无法访问：${sourcePath}` });
        }

        const folderName = (targetFolder || path.basename(sourcePath)).trim();
        const destDir = path.join(VIDEOS_DIR, folderName);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // 异步后台拷贝/同步
        const isCopy = mode !== 'link';
        const cmd = isCopy 
            ? `cp -r "${sourcePath}/"* "${destDir}/"`
            : `ln -s "${sourcePath}/"* "${destDir}/"`;

        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error('[Media Import] 后台导入错误:', err);
            } else {
                console.log(`[Media Import] 目录 ${sourcePath} 成功导入至 ${destDir}`);
            }
        });

        // 登记分类
        const manifest = readManifest();
        if (!manifest.categories.some(c => c.folder === folderName)) {
            manifest.categories.push({
                id: `cat-${Date.now()}`,
                name: folderName,
                icon: '📁',
                folder: folderName
            });
            writeManifest(manifest);
        }

        res.json({
            success: true,
            message: `已开始从 ${sourcePath} 导入资源至分类“${folderName}”，后台正在传输文件...`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 重新抽取封面帧
 */
router.post('/admin/extract-poster/:id', (req, res) => {
    try {
        const { id } = req.params;
        const timeOffset = req.body.timeOffset || '00:00:15';
        const decodedPath = decodeURIComponent(id).replace(/___/g, '/');
        const videoFullPath = path.join(VIDEOS_DIR, decodedPath);

        if (!fs.existsSync(videoFullPath)) {
            return res.status(404).json({ error: '视频文件不存在' });
        }

        const ext = path.extname(videoFullPath);
        const posterFullPath = videoFullPath.replace(ext, '_poster.jpg');
        const ffmpegCmd = `/opt/homebrew/bin/ffmpeg -y -ss ${timeOffset} -i "${videoFullPath}" -vframes 1 -q:v 2 "${posterFullPath}"`;

        exec(ffmpegCmd, (err) => {
            if (err) {
                return res.status(500).json({ error: '抽帧失败: ' + err.message });
            }
            res.json({ success: true, message: '封面重绘成功' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router,
    scanMediaList,
    VIDEOS_DIR,
    DEFAULT_MEDIA_ORDER,
    normalizeMediaOrder,
    compareMediaOrder
};
