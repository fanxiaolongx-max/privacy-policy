const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'backend', 'builtin-tools', 'f12-to-extension', 'exam-question-bank-assistant.js');
const source = fs.readFileSync(scriptPath, 'utf8');

test('question-bank writes use the quota-aware persistence guard', () => {
    assert.match(source, /function persistQuestionBank\(/);
    assert.match(source, /function pauseForStorageQuota\(/);
    assert.match(source, /error\.name === 'QuotaExceededError'/);
    assert.match(source, /restoreCurrentBankFromStorage\(storageKey\)/);
    assert.match(source, /if \(!persistQuestionBank\(\)\) break;/);
    assert.match(source, /if \(!persistQuestionBanksAtomically\(importEntries\)\) return;/);

    const directQuestionBankWrites = [...source.matchAll(/localStorage\.setItem\(([^\n]+ScraperData_|getStorageKey\(\))/g)];
    assert.equal(directQuestionBankWrites.length, 0, 'runtime question-bank writes must not bypass the persistence guard');
});

test('storage manager supports multi-select backup, cleanup, capacity refresh, and redundancy scanning', () => {
    for (const requiredId of [
        'bank-storage-dialog',
        'bank-storage-select-all',
        'bank-storage-export',
        'bank-storage-export-clean',
        'bank-storage-scan',
        'bank-storage-clean-redundant'
    ]) {
        assert.ok(
            source.includes(`id="${requiredId}"`) || source.includes(`.id = '${requiredId}'`),
            `missing storage manager control: ${requiredId}`
        );
    }

    assert.match(source, /const calculateLocalStorageUsage = \(\) =>/);
    assert.match(source, /availableBytes: Math\.max\(0, CONSERVATIVE_LOCAL_STORAGE_QUOTA_BYTES - totalBytes\)/);
    assert.match(source, /const compactQuestionBankSafely = questions =>/);
    assert.match(source, /comboKeys\.has\(key\)/);
    assert.match(source, /downloadQuestionBankBackup\(selectedBanks\);[\s\S]*localStorage\.removeItem\(bank\.storageKey\)/);
    assert.match(source, /storageCleaned[\s\S]*formatStorageBytes\(after\.availableBytes\)/);
});
