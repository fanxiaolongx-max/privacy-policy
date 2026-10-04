const MAX_WAL_BUSY_RETRIES = 4;

function runStatement(connection, sql) {
    return new Promise((resolve, reject) => {
        connection.run(sql, error => error ? reject(error) : resolve());
    });
}

async function enableWal(connection) {
    // Fresh default-tenant and platform connections can both try to switch
    // the same file to WAL. SQLite can reject that switch immediately even
    // with a busy timeout, so retry only this initialization operation.
    for (let attempt = 0; ; attempt++) {
        try {
            await runStatement(connection, 'PRAGMA journal_mode = WAL');
            break;
        } catch (error) {
            if (error.code !== 'SQLITE_BUSY' || attempt >= MAX_WAL_BUSY_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
        }
    }
}

function initializeSqliteConnection(connection) {
    const operations = [];
    connection.serialize(() => {
        // Queue these synchronously before any caller can use the raw handle.
        operations.push(runStatement(connection, 'PRAGMA busy_timeout = 5000'));
        operations.push(runStatement(connection, 'PRAGMA foreign_keys = ON'));
        operations.push(enableWal(connection));
    });
    const ready = Promise.allSettled(operations).then(results => {
        const failed = results.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
    });
    // A module may open a connection before its first query. Keep the original
    // rejection for query callers without an unhandled rejection in that gap.
    ready.catch(() => {});
    return ready;
}

module.exports = { initializeSqliteConnection };
