(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ReportManualAdjustAutoFill = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function generateRecordId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            try {
                return crypto.randomUUID();
            } catch (e) {
                // fallback
            }
        }
        return `record-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function normalizeRecords(detail) {
        if (!detail) return [];
        if (Array.isArray(detail.records)) {
            return detail.records.map(rec => ({
                id: String(rec?.id || generateRecordId()),
                occurredAt: String(rec?.occurredAt || ''),
                recorder: String(rec?.recorder || ''),
                reason: String(rec?.reason || ''),
                attachments: Array.isArray(rec?.attachments)
                    ? rec.attachments.map(att => ({
                        url: String(att?.url || ''),
                        name: String(att?.name || ''),
                        size: typeof att?.size === 'number' ? att.size : 0,
                        type: String(att?.type || '')
                    }))
                    : [],
                newFiles: []
            }));
        }
        if (detail && (detail.note || Array.isArray(detail.attachments))) {
            return [{
                id: generateRecordId(),
                occurredAt: '',
                recorder: '',
                reason: String(detail.note || ''),
                attachments: Array.isArray(detail.attachments)
                    ? detail.attachments.map(att => ({
                        url: String(att?.url || ''),
                        name: String(att?.name || ''),
                        size: typeof att?.size === 'number' ? att.size : 0,
                        type: String(att?.type || '')
                    }))
                    : [],
                newFiles: []
            }];
        }
        return [];
    }

    function cloneRecords(records) {
        return (Array.isArray(records) ? records : []).map(rec => ({
            id: generateRecordId(),
            occurredAt: String(rec.occurredAt || ''),
            recorder: String(rec.recorder || ''),
            reason: String(rec.reason || ''),
            attachments: Array.isArray(rec.attachments)
                ? rec.attachments.map(att => ({
                    url: String(att.url || ''),
                    name: String(att.name || ''),
                    size: typeof att.size === 'number' ? att.size : 0,
                    type: String(att.type || '')
                }))
                : [],
            newFiles: []
        }));
    }

    function hasCountValue(value) {
        return value !== undefined && value !== null && String(value).trim() !== '' && !Number.isNaN(parseInt(value, 10));
    }

    function hasDetailForCatAndIndex(details, cat, itemIndex) {
        if (!details || typeof details !== 'object') return false;
        const detail = details[cat] && details[cat][itemIndex];
        if (!detail) return false;
        const records = normalizeRecords(detail);
        return records.some(r => {
            const hasReason = !!(r.reason && String(r.reason).trim());
            const hasOccurredAt = !!(r.occurredAt && String(r.occurredAt).trim());
            const hasRecorder = !!(r.recorder && String(r.recorder).trim());
            const hasAttachments = Array.isArray(r.attachments) && r.attachments.length > 0;
            return hasReason || hasOccurredAt || hasRecorder || hasAttachments;
        });
    }

    function hasDetailForIndex(details, itemIndex, categories) {
        if (!details || typeof details !== 'object' || !Array.isArray(categories)) return false;
        return categories.some(cat => hasDetailForCatAndIndex(details, cat, itemIndex));
    }

    function hasCountForIndex(adjustData, itemIndex, categories) {
        if (!adjustData || typeof adjustData !== 'object' || !Array.isArray(categories)) return false;
        return categories.some(cat => {
            const val = adjustData[cat] && adjustData[cat][itemIndex];
            return hasCountValue(val);
        });
    }

    function findLatestSourceSnapshot(currentSnap, itemIndex, snapshots, categories, formatTimeFn) {
        if (!currentSnap || !Array.isArray(snapshots)) return null;
        const snapIdx = snapshots.findIndex(s => s && s.id === currentSnap.id);
        if (snapIdx < 0) return null;

        for (let i = snapIdx + 1; i < snapshots.length; i++) {
            const sourceSnap = snapshots[i];
            if (!sourceSnap) continue;
            const adjustData = sourceSnap.manualAdjustData || {};
            const adjustDetails = sourceSnap.manualAdjustDetails || {};

            const hasCount = hasCountForIndex(adjustData, itemIndex, categories);
            const hasDetail = hasDetailForIndex(adjustDetails, itemIndex, categories);

            if (hasCount || hasDetail) {
                let sourceText = '';
                if (typeof formatTimeFn === 'function') {
                    sourceText = formatTimeFn(sourceSnap);
                } else if (sourceSnap.timestamp) {
                    sourceText = String(sourceSnap.timestamp);
                } else {
                    sourceText = String(sourceSnap.id || `Snapshot-${i}`);
                }
                return {
                    snapshot: sourceSnap,
                    adjustData,
                    adjustDetails,
                    sourceText
                };
            }
        }
        return null;
    }

    function isAutoFillEnabledForItem(idxKey, prefs, manualAdjustItems) {
        if (prefs && typeof prefs === 'object' && prefs[idxKey] !== undefined) {
            return !!prefs[idxKey];
        }
        const idx = parseInt(idxKey, 10);
        if (Array.isArray(manualAdjustItems) && Number.isInteger(idx) && manualAdjustItems[idx]) {
            return !!manualAdjustItems[idx].autoFill;
        }
        return false;
    }

    function applyAutoFill({
        snapshot,
        snapshots = [],
        categories = [],
        manualAdjustItems = [],
        prefs = {},
        formatTime,
        logMessageBuilder
    }) {
        if (!snapshot || typeof snapshot !== 'object') {
            return { changed: false, filledIndices: [] };
        }

        const candidateIndices = new Set();
        if (prefs && typeof prefs === 'object') {
            Object.keys(prefs).forEach(idxKey => {
                if (prefs[idxKey]) candidateIndices.add(idxKey);
            });
        }
        if (Array.isArray(manualAdjustItems)) {
            manualAdjustItems.forEach((item, idx) => {
                if (item && !item.deleted && item.autoFill) {
                    candidateIndices.add(String(idx));
                }
            });
        }

        if (!candidateIndices.size) {
            return { changed: false, filledIndices: [] };
        }

        if (!snapshot.manualAdjustData || typeof snapshot.manualAdjustData !== 'object') {
            snapshot.manualAdjustData = {};
        }
        if (!snapshot.manualAdjustDetails || typeof snapshot.manualAdjustDetails !== 'object') {
            snapshot.manualAdjustDetails = {};
        }
        if (!snapshot.manualAdjustAutoFillSources || typeof snapshot.manualAdjustAutoFillSources !== 'object') {
            snapshot.manualAdjustAutoFillSources = {};
        }

        let changed = false;
        const filledIndices = [];

        candidateIndices.forEach(idxKey => {
            const idx = parseInt(idxKey, 10);
            if (!Number.isInteger(idx) || !manualAdjustItems[idx] || manualAdjustItems[idx].deleted) return;

            const source = findLatestSourceSnapshot(snapshot, idxKey, snapshots, categories, formatTime);
            if (!source) return;

            let itemHadEffect = false;

            categories.forEach(cat => {
                if (!snapshot.manualAdjustData[cat]) snapshot.manualAdjustData[cat] = {};
                if (!snapshot.manualAdjustDetails[cat]) snapshot.manualAdjustDetails[cat] = {};

                const currentVal = snapshot.manualAdjustData[cat][idxKey];
                const currentHasCount = hasCountValue(currentVal);
                const currentHasDetail = hasDetailForCatAndIndex(snapshot.manualAdjustDetails, cat, idxKey);

                // 防覆盖原则：当前既有明确填报次数，又有录入理由或附件，不得覆盖
                if (currentHasCount && currentHasDetail) return;

                const sourceVal = source.adjustData[cat] && source.adjustData[cat][idxKey];
                const sourceDetail = source.adjustDetails && source.adjustDetails[cat] && source.adjustDetails[cat][idxKey];
                const sourceRecords = normalizeRecords(sourceDetail);

                let assignedCount = false;

                // 1. 继承发生次数（如果当前没有发生次数）
                if (!currentHasCount) {
                    if (hasCountValue(sourceVal)) {
                        snapshot.manualAdjustData[cat][idxKey] = parseInt(sourceVal, 10) || 0;
                        assignedCount = true;
                        itemHadEffect = true;
                        changed = true;
                    } else if (sourceRecords.length > 0) {
                        snapshot.manualAdjustData[cat][idxKey] = sourceRecords.length;
                        assignedCount = true;
                        itemHadEffect = true;
                        changed = true;
                    }
                }

                // 2. 继承加减分理由与支撑材料（如果当前没有详情，且上一快照有理由或材料）
                if (!currentHasDetail && sourceRecords.length > 0) {
                    const cloned = cloneRecords(sourceRecords);
                    const totalAttachments = cloned.reduce((sum, r) => sum + r.attachments.length, 0);

                    let logSummary = '';
                    if (typeof logMessageBuilder === 'function') {
                        logSummary = logMessageBuilder({
                            sourceText: source.sourceText,
                            recordCount: cloned.length,
                            attachmentCount: totalAttachments
                        });
                    } else {
                        logSummary = `从历史快照 [${source.sourceText}] 自动继承理由与支撑材料 (${cloned.length} 条记录, ${totalAttachments} 个附件)`;
                    }

                    snapshot.manualAdjustDetails[cat][idxKey] = {
                        records: cloned,
                        changeLog: [
                            {
                                time: new Date().toISOString(),
                                summary: logSummary
                            }
                        ]
                    };

                    if (!currentHasCount && !assignedCount) {
                        snapshot.manualAdjustData[cat][idxKey] = cloned.length;
                    }

                    itemHadEffect = true;
                    changed = true;
                }
            });

            if (itemHadEffect) {
                snapshot.manualAdjustAutoFillSources[idxKey] = {
                    snapshotId: source.snapshot.id,
                    timestamp: source.snapshot.timestamp,
                    label: source.sourceText
                };
                filledIndices.push(idxKey);
            }
        });

        return { changed, filledIndices };
    }

    return {
        generateRecordId,
        normalizeRecords,
        cloneRecords,
        hasCountValue,
        hasDetailForCatAndIndex,
        hasDetailForIndex,
        hasCountForIndex,
        findLatestSourceSnapshot,
        isAutoFillEnabledForItem,
        applyAutoFill
    };
});
