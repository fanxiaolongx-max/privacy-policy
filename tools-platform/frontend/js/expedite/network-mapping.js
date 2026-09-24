(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ExpediteNetwork = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const knownNetworks = {
        'EG-Egypt ET': 'ET',
        'EG-Egypt Orange': 'ORG',
        'EG-Egypt Telecom': 'TE',
        'EG-Egypt Vodafone': 'VDF'
    };

    function getTickets(data) {
        try {
            const raw = typeof data.raw_data_json === 'string' ? JSON.parse(data.raw_data_json) : data.raw_data_json;
            return Array.isArray(raw && raw.expiringTickets) ? raw.expiringTickets : [];
        } catch (e) {
            return [];
        }
    }

    function getRawNetwork(ticket) {
        const data = ticket.data || {};
        return String(data.network_name || data['网络名称'] || data.network || 'Unknown Network').trim();
    }

    function resolveCategory(network, categories, mappings) {
        const available = (categories || []).map(value => String(value).replace(/^\[|\]$/g, '').trim());
        const hasConfigured = mappings && Object.prototype.hasOwnProperty.call(mappings, network);
        const candidate = hasConfigured ? mappings[network] : (knownNetworks[network] || network);
        return available.find(cat => cat.toLowerCase() === String(candidate).replace(/^\[|\]$/g, '').trim().toLowerCase()) || '';
    }

    return { getTickets, getRawNetwork, resolveCategory };
});
