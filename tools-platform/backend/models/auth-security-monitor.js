const { run, all, get } = require('./app-db');
const alertCenterRepo = require('./alert-center-repository');
const securitySettingsRepo = require('./auth-security-settings-repository');

const WINDOW_MINUTES = 15;
const RETENTION_DAYS = 14;
const ALERT_COOLDOWN_MINUTES = 10;

const USER_FAIL_THRESHOLDS = [
    { count: 5, severity: 'warn' },
    { count: 10, severity: 'error' },
    { count: 20, severity: 'critical' }
];

const IP_FAIL_THRESHOLDS = [
    { count: 8, severity: 'warn' },
    { count: 15, severity: 'error' },
    { count: 30, severity: 'critical' }
];

const IP_MULTI_USER_THRESHOLDS = [
    { count: 3, severity: 'warn' },
    { count: 6, severity: 'error' },
    { count: 10, severity: 'critical' }
];

const SUCCESS_BURST_THRESHOLDS = [
    { count: 10, severity: 'info' },
    { count: 20, severity: 'warn' },
    { count: 40, severity: 'error' }
];

let initPromise = null;

function normalizeUsername(username) {
    return String(username || '').trim().slice(0, 120) || '(empty)';
}

function getClientIp(req) {
    const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req?.ip || req?.socket?.remoteAddress || '';
}

function getRequestSource(req) {
    return req?.get?.('referer') || req?.originalUrl || '';
}

function pickThreshold(count, thresholds) {
    return thresholds.slice().reverse().find(item => count >= item.count) || null;
}

async function pickLockPolicy(sql, params, policies) {
    const sortedPolicies = (policies || [])
        .filter(policy => policy?.enabled !== false)
        .slice()
        .sort((a, b) => Number(b.count) - Number(a.count));
    for (const policy of sortedPolicies) {
        const row = await get(sql, [...params, `-${policy.windowMinutes} minutes`]);
        const count = Number(row?.count) || 0;
        if (count >= policy.count) {
            return { ...policy, observedCount: count };
        }
    }
    return null;
}

function minutesFromNow(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19);
}

function secondsUntil(dateText) {
    const ts = Date.parse(String(dateText || '').replace(' ', 'T') + 'Z');
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, Math.ceil((ts - Date.now()) / 1000));
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS auth_login_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL DEFAULT '',
                    ip TEXT NOT NULL DEFAULT '',
                    success INTEGER NOT NULL DEFAULT 0,
                    reason TEXT DEFAULT '',
                    request_id TEXT DEFAULT '',
                    user_agent TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_time ON auth_login_attempts(ip, created_at DESC)`);
            await run(`CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_user_time ON auth_login_attempts(username, created_at DESC)`);
            await run(`
                CREATE TABLE IF NOT EXISTS auth_security_alert_state (
                    alert_key TEXT PRIMARY KEY,
                    last_count INTEGER NOT NULL DEFAULT 0,
                    severity TEXT NOT NULL DEFAULT 'info',
                    alerted_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`
                CREATE TABLE IF NOT EXISTS auth_security_locks (
                    lock_key TEXT PRIMARY KEY,
                    lock_type TEXT NOT NULL,
                    username TEXT NOT NULL DEFAULT '',
                    ip TEXT NOT NULL DEFAULT '',
                    reason TEXT NOT NULL DEFAULT '',
                    fail_count INTEGER NOT NULL DEFAULT 0,
                    locked_until DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`CREATE INDEX IF NOT EXISTS idx_auth_security_locks_until ON auth_security_locks(locked_until)`);
            await run(`CREATE INDEX IF NOT EXISTS idx_auth_security_locks_user_until ON auth_security_locks(username, locked_until)`);
            await run(`CREATE INDEX IF NOT EXISTS idx_auth_security_locks_ip_until ON auth_security_locks(ip, locked_until)`);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function trimOldAttempts() {
    await run(`DELETE FROM auth_login_attempts WHERE datetime(created_at) < datetime('now', ?)`, [`-${RETENTION_DAYS} days`]);
    await run(`DELETE FROM auth_security_locks WHERE datetime(locked_until) < datetime('now', '-1 day')`);
}

async function shouldAlert(alertKey, count, severity) {
    const row = await get(
        `SELECT last_count, severity, alerted_at
         FROM auth_security_alert_state
         WHERE alert_key = ?`,
        [alertKey]
    );
    if (row) {
        const lastCount = Number(row.last_count) || 0;
        const cooldownExpired = await get(
            `SELECT CASE WHEN datetime(?) < datetime('now', ?) THEN 1 ELSE 0 END AS expired`,
            [row.alerted_at, `-${ALERT_COOLDOWN_MINUTES} minutes`]
        );
        if (count <= lastCount && !cooldownExpired?.expired) return false;
    }
    await run(
        `INSERT INTO auth_security_alert_state (alert_key, last_count, severity, alerted_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(alert_key) DO UPDATE SET
            last_count = excluded.last_count,
            severity = excluded.severity,
            alerted_at = CURRENT_TIMESTAMP`,
        [alertKey, count, severity]
    );
    return true;
}

function buildCommonDetail(req, extra = {}) {
    return {
        request_id: req?.requestId || '',
        method: req?.method || '',
        path: req?.originalUrl || req?.path || '',
        referer: req?.get?.('referer') || '',
        user_agent: req?.get?.('user-agent') || '',
        window_minutes: WINDOW_MINUTES,
        ...extra
    };
}

async function addSecurityAlert({ req, severity, title, message, username, ip, objectType, objectId, detail }) {
    try {
        await alertCenterRepo.addEvent({
            eventType: 'security',
            severity,
            title,
            message,
            actor: normalizeUsername(username),
            source: getRequestSource(req),
            objectType,
            objectId,
            detail: buildCommonDetail(req, { username: normalizeUsername(username), ip, ...detail })
        });
    } catch (err) {
        console.error('[auth-security-monitor] alert write failed:', err.message);
    }
}

async function upsertLock({ req, lockType, username, ip, policy, reason, alertOnLock = true }) {
    const normalizedUser = normalizeUsername(username);
    const normalizedIp = ip || '(unknown)';
    const lockKey = lockType === 'account'
        ? `account:${normalizedUser}`
        : `ip:${normalizedIp}`;
    const lockedUntil = minutesFromNow(policy.lockMinutes);
    const existing = await get(
        `SELECT locked_until FROM auth_security_locks WHERE lock_key = ? AND datetime(locked_until) > datetime('now')`,
        [lockKey]
    );
    if (existing && secondsUntil(existing.locked_until) >= policy.lockMinutes * 60 - 5) {
        return;
    }

    await run(
        `INSERT INTO auth_security_locks
            (lock_key, lock_type, username, ip, reason, fail_count, locked_until, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(lock_key) DO UPDATE SET
            lock_type = excluded.lock_type,
            username = excluded.username,
            ip = excluded.ip,
            reason = excluded.reason,
            fail_count = excluded.fail_count,
            locked_until = excluded.locked_until,
            updated_at = CURRENT_TIMESTAMP`,
        [
            lockKey,
            lockType,
            normalizedUser,
            normalizedIp,
            reason,
            policy.observedCount,
            lockedUntil
        ]
    );

    if (alertOnLock) {
        const target = lockType === 'account' ? `账号 ${normalizedUser}` : `IP ${normalizedIp}`;
        await addSecurityAlert({
            req,
            severity: policy.severity,
            title: `${target} 已被临时锁定`,
            message: `${target} 登录失败达到 ${policy.observedCount} 次，已锁定 ${policy.lockMinutes} 分钟。`,
            username: normalizedUser,
            ip: normalizedIp,
            objectType: lockType === 'account' ? 'auth_account_lock' : 'auth_ip_lock',
            objectId: lockType === 'account' ? normalizedUser : normalizedIp,
            detail: {
                lock_type: lockType,
                reason,
                fail_count: policy.observedCount,
                threshold: policy.count,
                window_minutes: policy.windowMinutes,
                lock_minutes: policy.lockMinutes,
                locked_until: lockedUntil
            }
        });
    }
}

async function enforceFailedLoginLocks(req, username, ip) {
    const settings = await securitySettingsRepo.getSettings();
    if (!settings.enabled) return;
    const normalizedUser = normalizeUsername(username);
    const normalizedIp = ip || '(unknown)';
    const accountPolicy = await pickLockPolicy(
        `SELECT COUNT(*) AS count
         FROM auth_login_attempts
         WHERE success = 0 AND username = ? AND datetime(created_at) >= datetime('now', ?)`,
        [normalizedUser],
        settings.accountLockPolicies
    );
    if (accountPolicy) {
        await upsertLock({
            req,
            lockType: 'account',
            username: normalizedUser,
            ip: normalizedIp,
            policy: accountPolicy,
            reason: 'account_failed_login',
            alertOnLock: settings.alertOnLock
        });
    }

    const ipPolicy = await pickLockPolicy(
        `SELECT COUNT(*) AS count
         FROM auth_login_attempts
         WHERE success = 0 AND ip = ? AND datetime(created_at) >= datetime('now', ?)`,
        [normalizedIp],
        settings.ipLockPolicies
    );
    if (ipPolicy) {
        await upsertLock({
            req,
            lockType: 'ip',
            username: normalizedUser,
            ip: normalizedIp,
            policy: ipPolicy,
            reason: 'ip_failed_login',
            alertOnLock: settings.alertOnLock
        });
    }

    const multiUserPolicy = await pickLockPolicy(
        `SELECT COUNT(DISTINCT username) AS count
         FROM auth_login_attempts
         WHERE success = 0 AND ip = ? AND datetime(created_at) >= datetime('now', ?)`,
        [normalizedIp],
        settings.ipMultiUserPolicies
    );
    if (multiUserPolicy) {
        await upsertLock({
            req,
            lockType: 'ip',
            username: normalizedUser,
            ip: normalizedIp,
            policy: multiUserPolicy,
            reason: 'ip_multi_user_failed_login',
            alertOnLock: settings.alertOnLock
        });
    }
}

async function evaluateFailedLogin(req, username, ip) {
    const [userRow, ipRow, ipUsersRow] = await Promise.all([
        get(
            `SELECT COUNT(*) AS count
             FROM auth_login_attempts
             WHERE success = 0 AND username = ? AND datetime(created_at) >= datetime('now', ?)`,
            [normalizeUsername(username), `-${WINDOW_MINUTES} minutes`]
        ),
        get(
            `SELECT COUNT(*) AS count
             FROM auth_login_attempts
             WHERE success = 0 AND ip = ? AND datetime(created_at) >= datetime('now', ?)`,
            [ip, `-${WINDOW_MINUTES} minutes`]
        ),
        get(
            `SELECT COUNT(DISTINCT username) AS count
             FROM auth_login_attempts
             WHERE success = 0 AND ip = ? AND datetime(created_at) >= datetime('now', ?)`,
            [ip, `-${WINDOW_MINUTES} minutes`]
        )
    ]);

    const userCount = Number(userRow?.count) || 0;
    const ipCount = Number(ipRow?.count) || 0;
    const ipUserCount = Number(ipUsersRow?.count) || 0;
    const userThreshold = pickThreshold(userCount, USER_FAIL_THRESHOLDS);
    const ipThreshold = pickThreshold(ipCount, IP_FAIL_THRESHOLDS);
    const multiUserThreshold = pickThreshold(ipUserCount, IP_MULTI_USER_THRESHOLDS);

    if (userThreshold && await shouldAlert(`failed-user:${normalizeUsername(username)}:${userThreshold.count}`, userCount, userThreshold.severity)) {
        await addSecurityAlert({
            req,
            severity: userThreshold.severity,
            title: `账号登录失败次数异常：${normalizeUsername(username)} ${userCount} 次`,
            message: `账号在 ${WINDOW_MINUTES} 分钟内连续登录失败达到 ${userCount} 次。`,
            username,
            ip,
            objectType: 'auth_failed_login_user',
            objectId: normalizeUsername(username),
            detail: { count: userCount, threshold: userThreshold.count }
        });
    }

    if (ipThreshold && await shouldAlert(`failed-ip:${ip}:${ipThreshold.count}`, ipCount, ipThreshold.severity)) {
        await addSecurityAlert({
            req,
            severity: ipThreshold.severity,
            title: `固定 IP 登录失败异常：${ip || 'unknown'} ${ipCount} 次`,
            message: `同一 IP 在 ${WINDOW_MINUTES} 分钟内登录失败达到 ${ipCount} 次，疑似暴力破解。`,
            username,
            ip,
            objectType: 'auth_failed_login_ip',
            objectId: ip,
            detail: { count: ipCount, threshold: ipThreshold.count }
        });
    }

    if (multiUserThreshold && await shouldAlert(`failed-ip-users:${ip}:${multiUserThreshold.count}`, ipUserCount, multiUserThreshold.severity)) {
        const rows = await all(
            `SELECT DISTINCT username
             FROM auth_login_attempts
             WHERE success = 0 AND ip = ? AND datetime(created_at) >= datetime('now', ?)
             ORDER BY username ASC
             LIMIT 20`,
            [ip, `-${WINDOW_MINUTES} minutes`]
        );
        await addSecurityAlert({
            req,
            severity: multiUserThreshold.severity,
            title: `固定 IP 尝试多个账号：${ip || 'unknown'} ${ipUserCount} 个`,
            message: `同一 IP 在 ${WINDOW_MINUTES} 分钟内尝试登录多个账号，疑似账号枚举或暴力破解。`,
            username,
            ip,
            objectType: 'auth_bruteforce_ip_multi_user',
            objectId: ip,
            detail: {
                distinct_user_count: ipUserCount,
                threshold: multiUserThreshold.count,
                sampled_usernames: rows.map(row => row.username)
            }
        });
    }
}

async function evaluateSuccessfulLogin(req, username, ip) {
    const row = await get(
        `SELECT COUNT(*) AS count
         FROM auth_login_attempts
         WHERE success = 1 AND username = ? AND datetime(created_at) >= datetime('now', ?)`,
        [normalizeUsername(username), `-${WINDOW_MINUTES} minutes`]
    );
    const count = Number(row?.count) || 0;
    const threshold = pickThreshold(count, SUCCESS_BURST_THRESHOLDS);
    if (!threshold) return;
    if (!await shouldAlert(`success-user:${normalizeUsername(username)}:${threshold.count}`, count, threshold.severity)) return;
    await addSecurityAlert({
        req,
        severity: threshold.severity,
        title: `账号登录次数偏高：${normalizeUsername(username)} ${count} 次`,
        message: `账号在 ${WINDOW_MINUTES} 分钟内成功登录达到 ${count} 次。`,
        username,
        ip,
        objectType: 'auth_success_login_burst',
        objectId: normalizeUsername(username),
        detail: { count, threshold: threshold.count }
    });
}

async function recordLoginAttempt(req, { username, success, reason = '' }) {
    try {
        await ensureReady();
        const normalizedUser = normalizeUsername(username);
        const ip = getClientIp(req);
        await run(
            `INSERT INTO auth_login_attempts (username, ip, success, reason, request_id, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                normalizedUser,
                ip,
                success ? 1 : 0,
                String(reason || '').slice(0, 120),
                req?.requestId || '',
                req?.get?.('user-agent') || ''
            ]
        );
        trimOldAttempts().catch(err => console.error('[auth-security-monitor] trim failed:', err.message));
        if (success) await evaluateSuccessfulLogin(req, normalizedUser, ip);
        else {
            await evaluateFailedLogin(req, normalizedUser, ip);
            await enforceFailedLoginLocks(req, normalizedUser, ip);
        }
    } catch (err) {
        console.error('[auth-security-monitor] record failed:', err.message);
    }
}

async function getLoginBlock(req, username) {
    try {
        await ensureReady();
        const settings = await securitySettingsRepo.getSettings();
        if (!settings.enabled) return null;
        const normalizedUser = normalizeUsername(username);
        const ip = getClientIp(req) || '(unknown)';
        const rows = await all(
            `SELECT lock_key, lock_type, username, ip, reason, fail_count, locked_until
             FROM auth_security_locks
             WHERE datetime(locked_until) > datetime('now')
               AND (
                    (lock_type = 'account' AND username = ?)
                    OR (lock_type = 'ip' AND ip = ?)
               )
             ORDER BY datetime(locked_until) DESC
             LIMIT 1`,
            [normalizedUser, ip]
        );
        const lock = rows[0];
        if (!lock) return null;
        return {
            ...lock,
            retry_after_seconds: secondsUntil(lock.locked_until)
        };
    } catch (err) {
        console.error('[auth-security-monitor] block check failed:', err.message);
        return null;
    }
}

async function listActiveLocks() {
    await ensureReady();
    const rows = await all(
        `SELECT lock_key, lock_type, username, ip, reason, fail_count, locked_until, created_at, updated_at
         FROM auth_security_locks
         WHERE datetime(locked_until) > datetime('now')
         ORDER BY datetime(locked_until) DESC, updated_at DESC`
    );
    return rows.map(row => ({
        ...row,
        retry_after_seconds: secondsUntil(row.locked_until)
    }));
}

async function unlockLock(lockKey, req) {
    await ensureReady();
    const normalizedKey = String(lockKey || '').trim();
    const lock = await get(
        `SELECT lock_key, lock_type, username, ip, reason, fail_count, locked_until
         FROM auth_security_locks
         WHERE lock_key = ?`,
        [normalizedKey]
    );
    if (!lock) return null;
    await run(`DELETE FROM auth_security_locks WHERE lock_key = ?`, [normalizedKey]);
    await addSecurityAlert({
        req,
        severity: 'info',
        title: '安全锁定已解除',
        message: `${lock.lock_type === 'account' ? '账号' : 'IP'} ${lock.lock_type === 'account' ? lock.username : lock.ip} 的登录锁定已被管理员解除。`,
        username: req?.user?.username || lock.username,
        ip: getClientIp(req) || '',
        objectType: lock.lock_type === 'account' ? 'auth_account_lock' : 'auth_ip_lock',
        objectId: lock.lock_type === 'account' ? lock.username : lock.ip,
        detail: {
            lock_key: lock.lock_key,
            lock_type: lock.lock_type,
            locked_username: lock.username,
            locked_ip: lock.ip,
            reason: lock.reason,
            fail_count: lock.fail_count,
            locked_until: lock.locked_until,
            action: 'unlock'
        }
    });
    return lock;
}

async function clearSuccessfulLoginState(req, username) {
    try {
        await ensureReady();
        const normalizedUser = normalizeUsername(username);
        const ip = getClientIp(req) || '(unknown)';
        await run(
            `DELETE FROM auth_login_attempts
             WHERE success = 0 AND username = ? AND ip = ?`,
            [normalizedUser, ip]
        );
        await run(
            `DELETE FROM auth_security_locks
             WHERE lock_type = 'account' AND username = ?`,
            [normalizedUser]
        );
    } catch (err) {
        console.error('[auth-security-monitor] clear failed:', err.message);
    }
}

module.exports = {
    ensureReady,
    recordLoginAttempt,
    getLoginBlock,
    clearSuccessfulLoginState,
    listActiveLocks,
    unlockLock
};
