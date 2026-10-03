const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'backend', 'builtin-tools', 'f12-to-extension', 'exam-question-bank-assistant.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function createImportPersistence(initial = {}, failOnceOn = '') {
    const start = source.indexOf('function persistQuestionBanksAtomically(');
    const end = source.indexOf('\nconst mapSavedAnswersToOptions', start);
    assert.ok(start >= 0 && end > start, 'multi-bank persistence helper must exist');
    const values = new Map(Object.entries(initial));
    const cache = new Map(Object.keys(initial).map(key => [key, true]));
    let failed = false;
    const localStorage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem(key, value) {
            if (key === failOnceOn && !failed) {
                failed = true;
                throw new Error('simulated storage failure');
            }
            values.set(key, value);
        },
        removeItem: key => values.delete(key)
    };
    const persist = new Function('examStorage', 'storageScanCache', 'isStorageQuotaError', 'pauseForStorageQuota', 'getStorageKey', 'console',
        `${source.slice(start, end)}\nreturn persistQuestionBanksAtomically;`)(
        localStorage, cache, () => false, () => {}, () => 'ScraperData_A', { warn() {}, error() {} }
    );
    return { persist, values, cache };
}

test('multi-bank import saves every bank and restores prior data if a later write fails', () => {
    const entries = [
        { storageKey: 'ScraperData_A', questions: [{ id: 1 }] },
        { storageKey: 'ScraperData_B', questions: [{ id: 2 }] },
        { storageKey: 'ScraperData_C', questions: [{ id: 3 }] }
    ];
    const success = createImportPersistence({ ScraperData_A: '[{"id":0}]' });
    assert.equal(success.persist(entries), true);
    for (const entry of entries) assert.deepEqual(JSON.parse(success.values.get(entry.storageKey)), entry.questions);
    assert.equal(success.cache.has('ScraperData_A'), false);

    const failure = createImportPersistence({ ScraperData_A: '[{"id":0}]' }, 'ScraperData_C');
    assert.equal(failure.persist(entries), false);
    assert.deepEqual([...failure.values.entries()], [['ScraperData_A', '[{"id":0}]']]);
});

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
    assert.match(source, /downloadQuestionBankBackup\(selectedBanks\);[\s\S]*examStorage\.removeItem\(bank\.storageKey\)/);
    assert.match(source, /storageCleaned[\s\S]*formatStorageBytes\(after\.availableBytes\)/);
});
