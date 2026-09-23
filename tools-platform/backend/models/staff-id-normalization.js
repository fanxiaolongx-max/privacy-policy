function normalizeStaffId(value) {
    const id = String(value || '').trim();
    // One import-system prefix may precede a numeric ID or the WX ID family.
    // WX itself is part of the ID and must remain intact.
    return /^[a-z](?=(?:WX\d{5,}|\d{5,})$)/i.test(id) ? id.slice(1) : id;
}

module.exports = { normalizeStaffId };
