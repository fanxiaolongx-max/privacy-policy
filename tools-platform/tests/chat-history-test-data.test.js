const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-chat-test-data-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const repo = require('../backend/models/chat-history-repository');
const tenantPool = require('../backend/models/tenant-sqlite-pool');
const { getDataDir } = require('../backend/models/tenant-context');
const chatTestData = require('../backend/builtin-tools/chat-history-center/chat-test-data');

test('chat test data generator covers all code scenarios and imports cleanly', async t => {
    t.after(async () => {
        await tenantPool.closeAll();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const mySenderId = 'f84300033';
    await repo.saveUserSettings('test_user', { mySenderId });

    const dataset = chatTestData.generateTestDataset(mySenderId);
    assert.equal(dataset.length, 6, 'Should generate 6 distinct scenario files');

    const importedResults = [];
    for (const item of dataset) {
        const tempPath = path.join(sandbox, path.basename(item.relativePath));
        fs.writeFileSync(tempPath, item.content, 'utf8');
        const res = await repo.importTxtFile({
            filePath: tempPath,
            relativePath: item.relativePath,
            originalName: item.originalName,
            modifiedAt: item.modifiedAt
        });
        importedResults.push(res);
    }

    assert.equal(importedResults.length, 6);
    assert.equal(importedResults.every(item => !item.skipped), true);

    // Verify conversation classifications
    const types = importedResults.map(item => item.conversationType);
    assert.ok(types.includes('single'), 'Must include single chat');
    assert.ok(types.includes('group'), 'Must include group chat');
    assert.ok(types.includes('discussion'), 'Must include discussion chat');
    assert.ok(types.includes('other'), 'Must include other category');

    // Verify conversations listing
    const conversations = await repo.listConversations('test_user', { limit: 20 });
    assert.equal(conversations.total, 6);

    // Verify large group conversation pagination (microservice group has 90+ messages)
    const archGroup = conversations.items.find(c => c.display_name === '微服务核心架构攻坚群');
    assert.ok(archGroup, 'Microservice group must exist');
    assert.ok(archGroup.message_count >= 80, `Message count should exceed 80 (got ${archGroup.message_count})`);

    const paginated = await repo.listMessages(archGroup.id, 'test_user', { limit: 50 });
    assert.equal(paginated.items.length, 50);
    assert.equal(paginated.hasMore, true);
    assert.ok(paginated.nextBefore, 'Should have nextBefore cursor');

    const older = await repo.listMessages(archGroup.id, 'test_user', { limit: 50, before: paginated.nextBefore });
    assert.ok(older.items.length > 0, 'Should load older messages');

    // Verify FTS and search for keywords (e.g. 隐私政策, 数据库连接池, 504 Gateway Timeout)
    const ftsRes = await repo.searchMessages('test_user', { keyword: '隐私政策' });
    assert.ok(ftsRes.total >= 3, 'Should find 隐私政策 keyword in multiple messages');

    const errorSearch = await repo.searchMessages('test_user', { keyword: '504 Gateway Timeout' });
    assert.ok(errorSearch.total >= 1, 'Should find error log in discussion group');

    // Verify direction search
    const mineSearch = await repo.searchMessages('test_user', { direction: 'mine' });
    assert.ok(mineSearch.total > 0, 'Should find messages sent by me');

    const othersSearch = await repo.searchMessages('test_user', { direction: 'others' });
    assert.ok(othersSearch.total > 0, 'Should find messages sent by others');

    // Verify overview stats
    const overview = await repo.getOverviewStats('test_user');
    assert.equal(overview.summary.conversation_count, 6);
    assert.ok(overview.summary.message_count > 100);
    assert.ok(overview.months.length >= 4, 'Should span at least 4 months for trend chart');
    assert.ok(overview.hours.length >= 8, 'Should cover multiple hours for heatmap');

    // Verify people stats
    const people = await repo.getPeopleStats('test_user');
    assert.ok(people.items.length >= 6, 'Should have at least 6 distinct participants');
    const mePerson = people.items.find(p => p.is_me === 1);
    assert.ok(mePerson, 'Should identify current user in people stats');
});
