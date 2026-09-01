const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-chat-history-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const repo = require('../backend/models/chat-history-repository');
const tenantPool = require('../backend/models/tenant-sqlite-pool');
const { getDataDir, runWithTenant } = require('../backend/models/tenant-context');

function writeChat(name, content) {
    const filePath = path.join(sandbox, name);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

test('chat parser recognizes exported headers and nested conversation categories', () => {
    assert.deepEqual(repo.parseHeader('张三(zhang001) 2026-08-01 09:10:11'), {
        senderName: '张三',
        senderId: 'zhang001',
        messageTime: '2026-08-01 09:10:11'
    });
    assert.equal(repo.parseHeader('这是正文'), null);
    assert.equal(repo.classifyConversation('聊天记录/单聊/华北/张三.txt'), 'single');
    assert.equal(repo.classifyConversation('聊天记录/群组/项目群.txt'), 'group');
    assert.equal(repo.classifyConversation('聊天记录/讨论组/故障讨论.txt'), 'discussion');
    assert.equal(repo.normalizeRelativePath('../聊天记录/单聊/张三.txt'), '聊天记录/单聊/张三.txt');
});

test('chat history imports, searches, preserves personal state and isolates tenants', async t => {
    t.after(async () => {
        await tenantPool.closeAll();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const filePath = writeChat('zhangsan.txt', [
        '\uFEFF张三(zhang001) 2026-08-01 09:10:11',
        '你好，这是第一条',
        '这是第二行',
        '我(my001) 2026-08-01 09:12:00',
        '收到，稍后处理',
        '张三(zhang001) 2026-08-02 10:00:00',
        '项目已经完成'
    ].join('\n'));

    const imported = await repo.importTxtFile({
        filePath,
        relativePath: '聊天记录/单聊/华北/张三.txt',
        modifiedAt: Date.now()
    });
    assert.equal(imported.messageCount, 3);
    assert.equal(imported.conversationType, 'single');
    assert.equal(fs.existsSync(path.join(getDataDir(), 'chat-history.db')), true);

    await repo.saveUserSettings('alice', { mySenderId: 'my001' });
    const conversations = await repo.listConversations('alice');
    assert.equal(conversations.total, 1);
    assert.equal(conversations.items[0].unread_count, 2);
    assert.equal(conversations.items[0].conversation_type, 'single');

    const messages = await repo.listMessages(imported.conversationId, 'alice', { limit: 20 });
    assert.equal(messages.items.length, 3);
    assert.equal(messages.items[0].content, '你好，这是第一条\n这是第二行');
    const favoriteKey = messages.items[0].stable_key;
    await repo.setFavorite('alice', favoriteKey, true);
    await repo.setPinned('alice', imported.conversationId, true);
    await repo.markRead('alice', imported.conversationId);
    assert.equal((await repo.listConversations('alice')).items[0].unread_count, 0);
    assert.equal((await repo.listConversations('alice')).items[0].pinned, 1);

    const search = await repo.searchMessages('alice', { keyword: '项目已经', favorites: '' });
    assert.equal(search.total, 1);
    assert.equal(search.items[0].sender_id, 'zhang001');
    const favoriteSearch = await repo.searchMessages('alice', { favorites: '1' });
    assert.equal(favoriteSearch.total, 1);

    fs.appendFileSync(filePath, '\n我(my001) 2026-08-03 11:00:00\n谢谢');
    const updated = await repo.importTxtFile({
        filePath,
        relativePath: '聊天记录/单聊/华北/张三.txt',
        modifiedAt: Date.now()
    });
    assert.equal(updated.messageCount, 4);
    assert.equal((await repo.searchMessages('alice', { favorites: '1' })).total, 1);
    const skipped = await repo.importTxtFile({ filePath, relativePath: '聊天记录/单聊/华北/张三.txt' });
    assert.equal(skipped.skipped, true);

    const overview = await repo.getOverviewStats('alice');
    assert.equal(overview.summary.message_count, 4);
    assert.equal(overview.summary.identified_messages, 4);
    assert.equal(overview.summary.unidentified_messages, 0);
    assert.equal(overview.summary.recognition_rate, '100.0%');

    const directory = await repo.listPersonDirectory();
    assert.equal(directory.total, 2);
    assert.deepEqual(directory.items.map(d => d.sender_id).sort(), ['my001', 'zhang001']);
    assert.equal(directory.items.find(d => d.sender_id === 'zhang001').sender_name, '张三');

    await repo.updatePersonDirectory('zhang001', { senderName: '张三丰', aliasNames: '三丰' });
    const updatedDir = await repo.listPersonDirectory({ q: '三丰' });
    assert.equal(updatedDir.total, 1);
    assert.equal(updatedDir.items[0].sender_name, '张三丰');
    const updatedMessages = await repo.listMessages(imported.conversationId, 'alice');
    assert.equal(updatedMessages.items.find(m => m.sender_id === 'zhang001').sender_name, '张三丰');

    // Test unidentified messages and recognition rate
    const unidentPath = writeChat('unident.txt', [
        '系统通知 2026-08-04 15:00:00',
        '服务重启完成',
        '王工(wang001) 2026-08-04 15:01:00',
        '已确认恢复正常'
    ].join('\n'));
    await repo.importTxtFile({ filePath: unidentPath, relativePath: '聊天记录/群组/报警通知.txt' });
    const unidentStats = await repo.getUnidentifiedMessages();
    assert.equal(unidentStats.total, 1);
    assert.equal(unidentStats.items[0].sender_name, '系统通知');
    assert.equal(unidentStats.items[0].issue_type, '缺失工号（仅有昵称）');

    const overviewAfterUnident = await repo.getOverviewStats('alice');
    assert.equal(overviewAfterUnident.summary.unidentified_messages, 1);
    assert.equal(overviewAfterUnident.summary.identified_messages, 5);

    // Test data isolation & cleanup test
    const testDataPath = writeChat('test_data.txt', '测试小李(test001) 2026-08-05 10:00:00\n这是模拟测试消息');
    await repo.importTxtFile({ filePath: testDataPath, relativePath: '测试数据/01-架构组/模拟.txt' });
    assert.equal((await repo.listConversations('alice')).total, 3);
    const deleteTestResult = await repo.deleteTestDataSources();
    assert.equal(deleteTestResult.deletedCount, 1);
    assert.equal((await repo.listConversations('alice')).total, 2);
    // Real conversations remain intact
    assert.equal((await repo.listConversations('alice')).items.some(c => c.display_name === '张三'), true);

    // Test paginated listSources
    const sourcesPaged = await repo.listSources({ limit: 1, page: 1 });
    assert.equal(sourcesPaged.total, 2);
    assert.equal(sourcesPaged.totalPages, 2);
    assert.equal(sourcesPaged.items.length, 1);
    const sourcesSearch = await repo.listSources({ q: '张三' });
    assert.equal(sourcesSearch.total, 1);
    assert.equal(sourcesSearch.items[0].display_name, '张三');
    const sourcesType = await repo.listSources({ type: 'group' });
    assert.equal(sourcesType.total, 1);
    assert.equal(sourcesType.items[0].conversation_type, 'group');

    const people = await repo.getPeopleStats('alice');
    assert.deepEqual(people.items.map(item => item.sender_id).filter(Boolean).sort(), ['my001', 'wang001', 'zhang001']);

    await runWithTenant('tenant-b', async () => {
        assert.equal((await repo.listConversations('alice')).total, 0);
        const groupPath = writeChat('group.txt', '李四(li001) 2026-08-04 12:00:00\n群消息');
        await repo.importTxtFile({ filePath: groupPath, relativePath: '聊天记录/群组/交付群.txt' });
        assert.equal((await repo.listConversations('alice')).items[0].conversation_type, 'group');
        assert.equal(fs.existsSync(path.join(getDataDir(), 'chat-history.db')), true);
    });

    assert.equal((await repo.listConversations('alice')).total, 2);
});
