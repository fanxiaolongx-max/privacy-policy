const slaSnapshotsRepo = require('./models/sla-snapshots-repository');
const uploadHistoryRepo = require('./models/upload-history-repository');

async function main() {
    console.log("=== 抽查 SLA Snapshots SQLite (最新 1 条) ===");
    const snapDb = await slaSnapshotsRepo.listSnapshots({ mode: 'sqlite' });
    
    const lastD = snapDb.items[snapDb.items.length - 1];
    
    // We only print the first few characters of some big fields to not flood the console
    function truncate(obj) {
        const copy = { ...obj };
        if (copy.topMetrics) copy.topMetrics = copy.topMetrics.length + " items";
        if (copy.files) copy.files = copy.files.length + " files";
        return copy;
    }
    
    console.log("\n[SQLite] 最新快照 (部分字段):");
    console.log(JSON.stringify(truncate(lastD), null, 2));
    
    console.log("\n=== 抽查 Upload History SQLite (最新 1 条) ===");
    const uploadDb = await uploadHistoryRepo.listHistory({ mode: 'sqlite', limit: 1000 });
    
    const lastUploadD = uploadDb.items[uploadDb.items.length - 1];
    
    console.log("\n[SQLite] 最新上传记录:");
    console.log(JSON.stringify(lastUploadD, null, 2));

}

main().catch(console.error);
