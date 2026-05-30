const slaSnapshotsRepo = require('./models/sla-snapshots-repository');
const uploadHistoryRepo = require('./models/upload-history-repository');

async function main() {
    console.log("=== 抽查 SLA Snapshots (最新 1 条) ===");
    const snapJson = await slaSnapshotsRepo.listSnapshots({ mode: 'json' });
    const snapDb = await slaSnapshotsRepo.listSnapshots({ mode: 'sqlite' });
    
    const lastJ = snapJson.items[snapJson.items.length - 1];
    const lastD = snapDb.items[snapDb.items.length - 1];
    
    // We only print the first few characters of some big fields to not flood the console
    function truncate(obj) {
        const copy = { ...obj };
        if (copy.topMetrics) copy.topMetrics = copy.topMetrics.length + " items";
        if (copy.files) copy.files = copy.files.length + " files";
        return copy;
    }
    
    console.log("\n[JSON] 最新快照 (部分字段):");
    console.log(JSON.stringify(truncate(lastJ), null, 2));
    console.log("\n[SQLite] 最新快照 (部分字段):");
    console.log(JSON.stringify(truncate(lastD), null, 2));
    
    console.log("\n=== 抽查 Upload History (最新 1 条) ===");
    const uploadJson = await uploadHistoryRepo.listHistory({ mode: 'json', limit: 1000 });
    const uploadDb = await uploadHistoryRepo.listHistory({ mode: 'sqlite', limit: 1000 });
    
    const lastUploadJ = uploadJson.items[uploadJson.items.length - 1];
    const lastUploadD = uploadDb.items[uploadDb.items.length - 1];
    
    console.log("\n[JSON] 最新上传记录:");
    console.log(JSON.stringify(lastUploadJ, null, 2));
    console.log("\n[SQLite] 最新上传记录:");
    console.log(JSON.stringify(lastUploadD, null, 2));

}

main().catch(console.error);
