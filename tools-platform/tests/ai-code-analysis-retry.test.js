const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getAnalysisCode,
    runAnalysisWithSizeFallback
} = require('../backend/models/ai-code-analysis-retry');

const tooLarge = () => Object.assign(new Error('upstream rejected request'), { status: 413 });

test('knowledge file analysis retries 413 with 200k, 100k, then 50k characters', async () => {
    const prompt = `分析文件：\n\n${'x'.repeat(200 * 1024)}`;
    const code = getAnalysisCode(prompt, '分析文件：\n\n'.length);
    const lengths = [];
    const result = await runAnalysisWithSizeFallback(code, async content => {
        const included = content.match(/x+$/)[0].length;
        lengths.push(included);
        if (included > 50 * 1024) throw tooLarge();
        return { text: 'ok' };
    });
    assert.deepEqual(lengths, [200 * 1024, 100 * 1024, 50 * 1024]);
    assert.equal(result.attempts, 3);
    assert.equal(result.result.text, 'ok');
    assert.match(result.content, /前 51200 个字符/);
});

test('knowledge file analysis ends with a clear error after three 413 responses', async () => {
    const code = getAnalysisCode(`检查：${'x'.repeat(200 * 1024)}`, 3);
    let calls = 0;
    await assert.rejects(
        runAnalysisWithSizeFallback(code, async () => { calls += 1; throw tooLarge(); }),
        /已自动缩减代码并尝试 3 次/
    );
    assert.equal(calls, 3);
});

test('knowledge file analysis does not shrink code for unrelated provider errors', async () => {
    const code = getAnalysisCode(`检查：${'x'.repeat(200 * 1024)}`, 3);
    let calls = 0;
    await assert.rejects(
        runAnalysisWithSizeFallback(code, async () => {
            calls += 1;
            throw Object.assign(new Error('unauthorized'), { status: 401 });
        }),
        /unauthorized/
    );
    assert.equal(calls, 1);
});
