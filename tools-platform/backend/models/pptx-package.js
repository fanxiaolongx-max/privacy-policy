const path = require('path');
const JSZip = require('jszip');

function relationshipPartName(partName) {
    const directory = path.posix.dirname(partName);
    return path.posix.join(directory, '_rels', `${path.posix.basename(partName)}.rels`);
}

function resolveRelationshipTarget(partName, target) {
    const clean = String(target || '').replace(/^\//, '');
    return path.posix.normalize(path.posix.join(path.posix.dirname(partName), clean));
}

function relativeRelationshipTarget(fromPart, toPart) {
    return path.posix.relative(path.posix.dirname(fromPart), toPart);
}

function uniquePartName(zip, originalName, token) {
    const parsed = path.posix.parse(originalName);
    let candidate = path.posix.join(parsed.dir, `${parsed.name}_${token}${parsed.ext}`);
    let counter = 2;
    while (zip.file(candidate)) {
        candidate = path.posix.join(parsed.dir, `${parsed.name}_${token}_${counter}${parsed.ext}`);
        counter += 1;
    }
    return candidate;
}

async function findOnlySlide(zip) {
    const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
    if (slides.length !== 1) throw new Error('素材包必须只包含一页胶片');
    return slides[0];
}

function relationshipTags(xml) {
    return Array.from(String(xml || '').matchAll(/<Relationship\b[^>]*\/?\s*>/gi)).map(match => match[0]);
}

async function copyPartGraph(sourceZip, targetZip, sourceRoot, targetRoot, token) {
    const mapping = new Map();

    async function copyPart(sourcePart, preferredTarget) {
        if (mapping.has(sourcePart)) return mapping.get(sourcePart);
        const sourceFile = sourceZip.file(sourcePart);
        if (!sourceFile) return null;
        const targetPart = preferredTarget || uniquePartName(targetZip, sourcePart, token);
        mapping.set(sourcePart, targetPart);
        targetZip.file(targetPart, await sourceFile.async('nodebuffer'));

        const sourceRelsName = relationshipPartName(sourcePart);
        const sourceRelsFile = sourceZip.file(sourceRelsName);
        if (!sourceRelsFile) return targetPart;
        let relsXml = await sourceRelsFile.async('string');
        for (const tag of relationshipTags(relsXml)) {
            if (/\bTargetMode="External"/i.test(tag)) continue;
            const target = tag.match(/\bTarget="([^"]+)"/i)?.[1];
            if (!target) continue;
            const dependency = resolveRelationshipTarget(sourcePart, target);
            if (!sourceZip.file(dependency)) continue;
            const copiedDependency = await copyPart(dependency);
            if (!copiedDependency) continue;
            const rewrittenTarget = relativeRelationshipTarget(targetPart, copiedDependency);
            const rewrittenTag = tag.replace(/\bTarget="[^"]+"/i, `Target="${rewrittenTarget}"`);
            relsXml = relsXml.replace(tag, rewrittenTag);
        }
        targetZip.file(relationshipPartName(targetPart), relsXml);
        return targetPart;
    }

    await copyPart(sourceRoot, targetRoot);
    return mapping;
}

async function mergeContentTypes(sourceZip, targetZip, mapping) {
    const [sourceXml, targetXml] = await Promise.all([
        sourceZip.file('[Content_Types].xml').async('string'),
        targetZip.file('[Content_Types].xml').async('string')
    ]);
    let nextXml = targetXml;
    const existingDefaults = new Set(Array.from(nextXml.matchAll(/<Default\b[^>]*\bExtension="([^"]+)"[^>]*\/>/gi)).map(match => match[1].toLowerCase()));
    for (const match of sourceXml.matchAll(/<Default\b[^>]*\bExtension="([^"]+)"[^>]*\/>/gi)) {
        if (!existingDefaults.has(match[1].toLowerCase())) {
            nextXml = nextXml.replace('</Types>', `${match[0]}</Types>`);
            existingDefaults.add(match[1].toLowerCase());
        }
    }
    const overrides = new Map();
    for (const match of sourceXml.matchAll(/<Override\b[^>]*\bPartName="([^"]+)"[^>]*\/>/gi)) {
        overrides.set(match[1].replace(/^\//, ''), match[0]);
    }
    for (const [sourcePart, targetPart] of mapping.entries()) {
        const override = overrides.get(sourcePart);
        if (!override || nextXml.includes(`PartName="/${targetPart}"`)) continue;
        nextXml = nextXml.replace('</Types>', `${override.replace(/PartName="[^"]+"/, `PartName="/${targetPart}"`)}</Types>`);
    }
    targetZip.file('[Content_Types].xml', nextXml);
}

function nextRelationshipId(xml) {
    const used = new Set(Array.from(String(xml).matchAll(/\bId="([^"]+)"/g)).map(match => match[1]));
    let counter = 1;
    while (used.has(`rId${counter}`)) counter += 1;
    return `rId${counter}`;
}

function nextSlideId(xml) {
    const ids = Array.from(String(xml).matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/gi)).map(match => Number(match[1]));
    return Math.max(255, ...ids) + 1;
}

async function appendSlideToPresentation(zip, slidePart) {
    const relsName = 'ppt/_rels/presentation.xml.rels';
    const presentationName = 'ppt/presentation.xml';
    let [relsXml, presentationXml] = await Promise.all([
        zip.file(relsName).async('string'),
        zip.file(presentationName).async('string')
    ]);
    const relId = nextRelationshipId(relsXml);
    const slideId = nextSlideId(presentationXml);
    const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${relativeRelationshipTarget(presentationName, slidePart)}"/>`;
    relsXml = relsXml.replace('</Relationships>', `${rel}</Relationships>`);
    if (/<p:sldIdLst\b[^>]*>/i.test(presentationXml)) {
        presentationXml = presentationXml.replace('</p:sldIdLst>', `<p:sldId id="${slideId}" r:id="${relId}"/></p:sldIdLst>`);
    } else {
        presentationXml = presentationXml.replace(/<p:presentation\b[^>]*>/i, match => `${match}<p:sldIdLst><p:sldId id="${slideId}" r:id="${relId}"/></p:sldIdLst>`);
    }
    zip.file(relsName, relsXml);
    zip.file(presentationName, presentationXml);
}

async function combineSingleSlidePptx(buffers) {
    if (!Array.isArray(buffers) || !buffers.length) throw new Error('至少选择一页素材');
    const outputZip = await JSZip.loadAsync(buffers[0]);
    for (let index = 1; index < buffers.length; index += 1) {
        const sourceZip = await JSZip.loadAsync(buffers[index]);
        const sourceSlide = await findOnlySlide(sourceZip);
        const nextSlideNumber = Math.max(0, ...Object.keys(outputZip.files)
            .map(name => Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/i)?.[1] || 0))) + 1;
        const targetSlide = `ppt/slides/slide${nextSlideNumber}.xml`;
        const mapping = await copyPartGraph(sourceZip, outputZip, sourceSlide, targetSlide, `m${index + 1}`);
        await mergeContentTypes(sourceZip, outputZip, mapping);
        await appendSlideToPresentation(outputZip, targetSlide);
    }
    const appFile = outputZip.file('docProps/app.xml');
    if (appFile) {
        const appXml = await appFile.async('string');
        outputZip.file('docProps/app.xml', appXml.replace(/<Slides>\d+<\/Slides>/i, `<Slides>${buffers.length}</Slides>`));
    }
    return outputZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

module.exports = { combineSingleSlidePptx };
