#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const { ensureDataDir, DATA_DIR } = require('../models/store');

const SUBMITTED_STATUS = '提交';
const STATE_VERSION = 1;
const dbPath = process.env.REQUIREMENTS_DB_PATH || path.join(DATA_DIR, 'requirements.db');
const statePath = process.env.REQUIREMENTS_MONITOR_STATE_PATH
    || path.join(DATA_DIR, 'requirements-monitor-state.json');

function parseCommand(argv) {
    const command = argv[2] || 'check';
    if (!['check', 'init', 'ack'].includes(command)) {
        throw new Error(`不支持的命令: ${command}`);
    }

    if (command !== 'ack') return { command, ids: [] };

    const ids = argv.slice(3)
        .flatMap(value => String(value).split(','))
        .map(value => Number.parseInt(value.trim(), 10))
        .filter(Number.isInteger);

    if (ids.length === 0) {
        throw new Error('ack 命令至少需要一个需求 ID');
    }

    return { command, ids: [...new Set(ids)] };
}

function openDatabase(filename) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, err => {
            if (err) reject(err);
            else resolve(database);
        });
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function readState() {
    if (!fs.existsSync(statePath)) return null;

    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (parsed.version !== STATE_VERSION
        || !Number.isInteger(parsed.lastScannedId)
        || !Array.isArray(parsed.pendingIds)) {
        throw new Error(`监控状态文件格式无效: ${statePath}`);
    }

    return {
        version: STATE_VERSION,
        lastScannedId: parsed.lastScannedId,
        pendingIds: parsed.pendingIds.filter(Number.isInteger),
        updatedAt: parsed.updatedAt || null
    };
}

function writeState(state) {
    ensureDataDir();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });

    const nextState = {
        version: STATE_VERSION,
        lastScannedId: state.lastScannedId,
        pendingIds: [...new Set(state.pendingIds)].sort((a, b) => a - b),
        updatedAt: new Date().toISOString()
    };
    const temporaryPath = `${statePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, statePath);
    return nextState;
}

function printResult(result) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function initialize(database) {
    const row = await get(database, 'SELECT COALESCE(MAX(id), 0) AS maxId FROM Requirements');
    const state = writeState({
        lastScannedId: Number(row?.maxId || 0),
        pendingIds: []
    });

    printResult({
        ok: true,
        action: 'initialized',
        hasNew: false,
        lastScannedId: state.lastScannedId,
        pendingCount: 0
    });
}

async function acknowledge(ids) {
    const state = readState();
    if (!state) {
        throw new Error('监控尚未初始化，请先运行 init 或 check');
    }

    const acknowledged = new Set(ids);
    const nextState = writeState({
        ...state,
        pendingIds: state.pendingIds.filter(id => !acknowledged.has(id))
    });

    printResult({
        ok: true,
        action: 'acknowledged',
        acknowledgedIds: ids,
        pendingCount: nextState.pendingIds.length
    });
}

async function check(database) {
    let state = readState();
    if (!state) {
        await initialize(database);
        return;
    }

    const discovered = await all(
        database,
        `SELECT id, title, description, category, status, creator, assignee, urgent, created_at, updated_at
         FROM Requirements
         WHERE id > ?
         ORDER BY id ASC`,
        [state.lastScannedId]
    );

    const maxDiscoveredId = discovered.reduce(
        (maximum, requirement) => Math.max(maximum, requirement.id),
        state.lastScannedId
    );
    const submittedIds = discovered
        .filter(requirement => requirement.status === SUBMITTED_STATUS)
        .map(requirement => requirement.id);
    const candidateIds = [...new Set([...state.pendingIds, ...submittedIds])];

    let requirements = [];
    if (candidateIds.length > 0) {
        const placeholders = candidateIds.map(() => '?').join(', ');
        requirements = await all(
            database,
            `SELECT id, title, description, category, status, creator, assignee, urgent, created_at, updated_at
             FROM Requirements
             WHERE id IN (${placeholders}) AND status = ?
             ORDER BY id ASC`,
            [...candidateIds, SUBMITTED_STATUS]
        );
    }

    state = writeState({
        lastScannedId: maxDiscoveredId,
        pendingIds: requirements.map(requirement => requirement.id)
    });

    printResult({
        ok: true,
        action: requirements.length > 0 ? 'analyze' : 'none',
        hasNew: requirements.length > 0,
        discoveredCount: discovered.length,
        pendingCount: requirements.length,
        lastScannedId: state.lastScannedId,
        requirements
    });
}

async function main() {
    const { command, ids } = parseCommand(process.argv);

    if (command === 'ack') {
        await acknowledge(ids);
        return;
    }

    if (!fs.existsSync(dbPath)) {
        throw new Error(`需求数据库不存在: ${dbPath}`);
    }

    const database = await openDatabase(dbPath);
    try {
        if (command === 'init') await initialize(database);
        else await check(database);
    } finally {
        await closeDatabase(database);
    }
}

main().catch(err => {
    process.stderr.write(`[requirements-monitor] ${err.message}\n`);
    process.exitCode = 1;
});
