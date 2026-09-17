const express = require('express');
const router = express.Router();

router.post('/export', async (req, res) => {
    const subject = String(req.body?.subject || '').trim();
    const html = String(req.body?.html || '');
    const text = String(req.body?.text || '').trim();
    const attachment = req.body?.attachment;
    if (!subject || subject.length > 200 || !html || html.length > 2_000_000) {
        return res.status(400).json({ error: 'INVALID_REPORT', message: '月报内容无效或过大' });
    }
    if (attachment && (!/^.{1,160}\.xlsx$/i.test(String(attachment.filename || '')) ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(String(attachment.data || '')) ||
        String(attachment.data).length > 40_000_000)) {
        return res.status(400).json({ error: 'INVALID_ATTACHMENT', message: '月报附件无效或过大' });
    }
    try {
        const { Email, Attachment, MessageEditorFormat, CFB } = await import('@tutao/oxmsg');
        const message = new Email();
        message.subject(subject);
        message.bodyHtml(html);
        // Some Outlook versions fall back to PR_BODY when opening a standalone MSG.
        message.bodyText((text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 500_000));
        message.bodyFormat(MessageEditorFormat.EDITOR_FORMAT_HTML);
        if (attachment) message.attach(new Attachment(Buffer.from(attachment.data, 'base64'), attachment.filename));
        const compound = CFB.read(Buffer.from(message.msg()), { type: 'buffer' });
        if (!CFB.find(compound, '/__substg1.0_10130102')) throw new Error('MSG HTML body missing');
        if (!CFB.find(compound, '/__substg1.0_1000001F')) throw new Error('MSG fallback body missing');
        const propertyEntry = CFB.find(compound, '/__properties_version1.0');
        const properties = propertyEntry?.content;
        if (!properties) throw new Error('MSG properties missing');
        // Mark the HTML message as unsent so Outlook opens it for further editing.
        // oxmsg's draft mode omits PR_HTML, so set MSGFLAG_UNSENT on the HTML message.
        let foundFlags = false;
        for (let offset = 32; offset + 16 <= properties.length; offset += 16) {
            if (properties.readUInt32LE(offset) !== 0x0e070003) continue;
            properties.writeUInt32LE(properties.readUInt32LE(offset + 8) | 0x8, offset + 8);
            foundFlags = true;
            break;
        }
        if (!foundFlags) throw new Error('MSG flags missing');
        // Outlook needs the native body hint to choose the HTML body over PR_BODY.
        // PidTagNativeBody (0x1016) value 3 means HTML.
        const nativeBody = Buffer.alloc(16);
        nativeBody.writeUInt32LE(0x10160003, 0);
        nativeBody.writeUInt32LE(0x6, 4);
        nativeBody.writeUInt32LE(3, 8);
        // The library leaves four trailing padding bytes after the property records.
        if ((properties.length - 32) % 16 !== 4) throw new Error('Unexpected MSG property layout');
        propertyEntry.content = Buffer.concat([properties.subarray(0, -4), nativeBody, properties.subarray(-4)]);
        propertyEntry.size = propertyEntry.content.length;
        CFB.utils.cfb_gc(compound);
        const buffer = Buffer.from(CFB.write(compound, { type: 'buffer' }));
        res.setHeader('Content-Type', 'application/vnd.ms-outlook');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('[report-msg] export failed:', error);
        res.status(500).json({ error: 'REPORT_MSG_EXPORT_FAILED', message: '邮件文件生成失败' });
    }
});

module.exports = router;
