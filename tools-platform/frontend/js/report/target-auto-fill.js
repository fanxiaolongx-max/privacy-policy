(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ReportTargetAutoFill = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function hasTargetValue(value) {
        return value !== '' && value !== null && value !== undefined;
    }

    function previousMonths(month) {
        const currentMonth = parseInt(month, 10);
        if (currentMonth < 1 || currentMonth > 12) return [];
        const months = [];
        for (let candidate = currentMonth - 1; candidate >= 1; candidate--) {
            months.push(String(candidate));
        }
        return months;
    }

    function findLatestValue(targetData, months, getter) {
        for (const month of months) {
            const value = getter(targetData, month);
            if (hasTargetValue(value)) return { value, month };
        }
        return null;
    }

    function inheritLatestTargets(targetData, month, categories) {
        if (!targetData || typeof targetData !== 'object' || !targetData.autoFill) {
            return { changed: false, commonSourceMonth: null, categorySourceMonths: {} };
        }

        const currentMonth = String(parseInt(month, 10));
        const months = previousMonths(currentMonth);
        if (!months.length) {
            return { changed: false, commonSourceMonth: null, categorySourceMonths: {} };
        }

        let changed = false;
        let commonSourceMonth = null;
        if (!hasTargetValue(targetData[currentMonth])) {
            const latestCommon = findLatestValue(targetData, months, (data, candidate) => data[candidate]);
            if (latestCommon) {
                targetData[currentMonth] = latestCommon.value;
                commonSourceMonth = latestCommon.month;
                changed = true;
            }
        }

        const configuredCategoryTargets = targetData.categoryTargets && typeof targetData.categoryTargets === 'object'
            && !Array.isArray(targetData.categoryTargets)
            ? targetData.categoryTargets
            : {};
        const currentCategoryTargets = configuredCategoryTargets[currentMonth]
            && typeof configuredCategoryTargets[currentMonth] === 'object'
            && !Array.isArray(configuredCategoryTargets[currentMonth])
            ? { ...configuredCategoryTargets[currentMonth] }
            : {};
        const categoryNames = new Set(Array.isArray(categories) ? categories : []);
        months.forEach(candidate => {
            const values = configuredCategoryTargets[candidate];
            if (values && typeof values === 'object' && !Array.isArray(values)) {
                Object.keys(values).forEach(category => categoryNames.add(category));
            }
        });

        const categorySourceMonths = {};
        categoryNames.forEach(category => {
            if (hasTargetValue(currentCategoryTargets[category])) return;
            const latestCategory = findLatestValue(configuredCategoryTargets, months, (data, candidate) => {
                const values = data[candidate];
                return values && typeof values === 'object' && !Array.isArray(values)
                    ? values[category]
                    : undefined;
            });
            if (!latestCategory) return;
            currentCategoryTargets[category] = latestCategory.value;
            categorySourceMonths[category] = latestCategory.month;
            changed = true;
        });

        if (Object.keys(currentCategoryTargets).length) {
            if (!targetData.categoryTargets || typeof targetData.categoryTargets !== 'object' || Array.isArray(targetData.categoryTargets)) {
                targetData.categoryTargets = {};
            }
            targetData.categoryTargets[currentMonth] = currentCategoryTargets;
        }

        return { changed, commonSourceMonth, categorySourceMonths };
    }

    return { hasTargetValue, previousMonths, inheritLatestTargets };
});
