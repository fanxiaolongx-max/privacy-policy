(async () => {
    "use strict";

    /* =========================================================
     * 0. 停止旧版本
     * ========================================================= */

    try {
        if (typeof window.stopSatisfactionMonitor === "function") {
            window.stopSatisfactionMonitor();
        }
    } catch (error) {
        console.warn("停止旧监控时出现提示：", error);
    }

    try {
        const oldWindow = window.__SATISFACTION_FLOAT_WINDOW__;

        if (oldWindow && !oldWindow.closed) {
            oldWindow.close();
        }
    } catch (error) {
        console.warn("关闭旧浮窗时出现提示：", error);
    }

    if (window.self !== window.top) {
        console.error(
            "当前 Console 运行在 iframe。请在 Console 顶部执行环境中选择 top 后重新运行。"
        );
        return;
    }

    /* =========================================================
     * 1. 配置
     * ========================================================= */

    const SETTINGS_KEY = "satisfaction-monitor-settings-v2";

    const DEFAULT_SETTINGS = {
        excludedEmployeePrefixes: ["WX", "84"],
        targetScore: 97,
        refreshIntervalSeconds: 5
    };

    const CONFIG = {
        listApiBase:
            "https://w3.huawei.com/iadmin/saas/gateway/com.huawei.iadmin.saas.catering:catering_general/catering/general/services/accounting/publicitySatisfaction/getSatisfactionList",

        detailApi:
            "https://w3.huawei.com/iadmin/saas/gateway/com.huawei.iadmin.saas.catering:catering_general/catering/general/services/accounting/publicitySatisfaction/exportDetailsMultiSheet",

        xlsxScriptUrls: [
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
            "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"
        ],

        pageSize: 100,
        queryMonths: 6,

        minInterval: 3000,
        maxInterval: 5000,

        passScore: 97,

        restaurants: {
            SV: ["SV餐厅", "SV"],
            CFC: ["CFC餐厅", "CFC"]
        },

        monitorWindow: {
            width: 470,
            height: 455
        },

        detailWindow: {
            width: 1100,
            height: 780
        },

        maxStoredEvents: 100,
        autoDownloadWhenParseFails: true
    };

    /* =========================================================
     * 2. 工具函数
     * ========================================================= */

    function sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(value) {
        return String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");
    }

    function normalizeHeader(value) {
        return String(value ?? "")
            .replace(/\r?\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizeEmployeeNumber(value) {
        return String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s_-]+/g, "");
    }

    function normalizePrefix(value) {
        return String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[\s_-]+/g, "");
    }

    function normalizePrefixList(values) {
        return [
            ...new Set(
                (Array.isArray(values) ? values : [])
                    .map(normalizePrefix)
                    .filter(Boolean)
            )
        ];
    }

    function parsePrefixText(value) {
        return normalizePrefixList(
            String(value ?? "")
                .split(/[\s,，;；、\n\r]+/)
                .filter(Boolean)
        );
    }

    function loadSettings() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(SETTINGS_KEY) || "{}"
            );

            const prefixes = normalizePrefixList(
                Array.isArray(saved.excludedEmployeePrefixes)
                    ? saved.excludedEmployeePrefixes
                    : DEFAULT_SETTINGS.excludedEmployeePrefixes
            );

            const targetScore = typeof saved.targetScore === "number" && saved.targetScore >= 0 && saved.targetScore <= 100 
                ? saved.targetScore 
                : DEFAULT_SETTINGS.targetScore;

            const refreshIntervalSeconds = typeof saved.refreshIntervalSeconds === "number" && saved.refreshIntervalSeconds >= 1 
                ? saved.refreshIntervalSeconds 
                : DEFAULT_SETTINGS.refreshIntervalSeconds;

            return {
                excludedEmployeePrefixes:
                    prefixes.length > 0
                        ? prefixes
                        : DEFAULT_SETTINGS.excludedEmployeePrefixes.slice(),
                targetScore,
                refreshIntervalSeconds
            };
        } catch (error) {
            console.warn("读取设置失败，使用默认值：", error);

            return {
                excludedEmployeePrefixes:
                    DEFAULT_SETTINGS.excludedEmployeePrefixes.slice(),
                targetScore: DEFAULT_SETTINGS.targetScore,
                refreshIntervalSeconds: DEFAULT_SETTINGS.refreshIntervalSeconds
            };
        }
    }

    function saveSettings() {
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify(state.settings)
        );
    }

    function cleanCell(value) {
        return String(value ?? "").trim();
    }

    function toNumber(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const normalized =
            typeof value === "string"
                ? value.replace(/,/g, "").trim()
                : value;

        const number = Number(normalized);

        return Number.isFinite(number) ? number : null;
    }

    function round(value, digits = 2) {
        if (!Number.isFinite(value)) {
            return null;
        }

        const factor = 10 ** digits;

        return (
            Math.round((value + Number.EPSILON) * factor) /
            factor
        );
    }

    function formatScore(value) {
        return Number.isFinite(value)
            ? value.toFixed(2)
            : "--";
    }

    function formatInteger(value) {
        return Number.isFinite(value)
            ? String(value)
            : "--";
    }

    function formatDateTime(timestamp) {
        return timestamp
            ? new Date(timestamp).toLocaleString()
            : "--";
    }

    function formatMonth(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0")
        ].join("-");
    }

    function addMonths(date, months) {
        const result = new Date(date);

        result.setDate(1);
        result.setMonth(result.getMonth() + months);

        return result;
    }

    function getPreviousMonth(month) {
        if (!/^\d{4}-\d{2}$/.test(month || "")) {
            return null;
        }

        const [year, monthNumber] = month
            .split("-")
            .map(Number);

        return formatMonth(
            new Date(year, monthNumber - 2, 1)
        );
    }

    function getMonthDateRange(month) {
        if (!/^\d{4}-\d{2}$/.test(month || "")) {
            throw new Error(`无效月份：${month}`);
        }

        const [year, monthNumber] = month
            .split("-")
            .map(Number);

        const lastDay = new Date(
            year,
            monthNumber,
            0
        ).getDate();

        return {
            startDate:
                `${year}-${String(monthNumber).padStart(2, "0")}-01`,

            endDate:
                `${year}-${String(monthNumber).padStart(2, "0")}-${String(
                    lastDay
                ).padStart(2, "0")}`
        };
    }

    function getRandomDelay() {
        let interval = state.settings?.refreshIntervalSeconds * 1000;
        if (!interval || interval < 1000) interval = 5000;
        // add a small random jitter (0-200ms) so it's not exactly on the second
        return interval + Math.random() * 200;
    }

    function calculateChange(current, previous) {
        if (
            !Number.isFinite(current) ||
            !Number.isFinite(previous)
        ) {
            return null;
        }

        return current - previous;
    }

    function formatChange(value) {
        if (!Number.isFinite(value)) {
            return "上月无数据";
        }

        if (value > 0) {
            return `↑+${value}`;
        }

        if (value < 0) {
            return `↓${value}`;
        }

        return "—";
    }

    function getEmployeeExclusion(feedbackBy) {
        const employeeNumber =
            normalizeEmployeeNumber(feedbackBy);

        const prefix =
            state.settings.excludedEmployeePrefixes.find(item =>
                employeeNumber.startsWith(item)
            );

        if (!prefix) {
            return {
                excluded: false,
                prefix: null,
                reason: ""
            };
        }

        return {
            excluded: true,
            prefix,
            reason: `工号以 ${prefix} 开头`
        };
    }

    /* =========================================================
     * 3. 状态
     * ========================================================= */

    function createDetailState() {
        return {
            initialized: false,
            loading: false,

            lastError: null,
            lastFetchAt: null,
            lastScore: null,

            rows: [],
            rowMap: new Map(),
            audit: null,

            displayedRows: [],
            displayedAudit: null,
            displayedFetchAt: null,

            pendingViewUpdate: false,
            lastChanges: null
        };
    }

    const state = {
        running: true,

        refreshTimer: null,
        uiTimer: null,

        count: 0,
        isFetchingMain: false,

        currentDelay: 0,
        nextRefreshAt: 0,

        lastSuccessAt: null,
        lastError: null,

        allRows: [],
        latestRows: [],
        lastData: null,

        pipWindow: null,

        settings: loadSettings(),

        view: {
            mode: "monitor",
            restaurant: null,
            month: null,

            filter: "critical",
            sort: "impact",
            search: "",

            bodyScrollTop: 0,
            tableScrollTop: 0,
            tableScrollLeft: 0
        },

        detail: {
            xlsxReady:
                typeof window.XLSX !== "undefined",

            xlsxLoading: false,
            xlsxLoadError: null,

            SV: createDetailState(),
            CFC: createDetailState(),

            events: []
        }
    };

    window.__SATISFACTION_MONITOR__ = state;

    /* =========================================================
     * 4. 主满意度接口
     * ========================================================= */

    function getMainRequestBody() {
        const now = new Date();

        return {
            regionCode: "",
            countryAlphaCode: "",
            cityAlphaCode: "",
            canteenCode: "",

            publicStartMonth: formatMonth(
                addMonths(
                    now,
                    -(CONFIG.queryMonths - 1)
                )
            ),

            publicEndMonth: formatMonth(now)
        };
    }

    async function fetchPage(pageNumber) {
        const url =
            `${CONFIG.listApiBase}/${CONFIG.pageSize}/${pageNumber}`;

        const response = await fetch(url, {
            headers: {
                accept: "application/json, text/plain, */*",
                "content-type": "application/json"
            },

            referrer:
                "https://w3.huawei.com/iadmin/catering/",

            body: JSON.stringify(
                getMainRequestBody()
            ),

            method: "POST",
            mode: "cors",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(
                `满意度接口请求失败：HTTP ${response.status}`
            );
        }

        const json = await response.json();

        if (json.code !== "success") {
            throw new Error(
                json.msg ||
                json.code ||
                "满意度接口调用失败"
            );
        }

        return json;
    }

    async function fetchAllRows() {
        const firstResponse = await fetchPage(1);

        const firstRows =
            firstResponse?.data?.result || [];

        const pageVO =
            firstResponse?.data?.pageVO || {};

        const totalRows =
            Number(pageVO.totalRows) ||
            firstRows.length;

        const pageSize =
            Number(pageVO.pageSize) ||
            CONFIG.pageSize;

        const totalPages = Math.max(
            1,
            Math.ceil(totalRows / pageSize)
        );

        if (totalPages <= 1) {
            return firstRows;
        }

        const requests = [];

        for (
            let page = 2;
            page <= totalPages;
            page++
        ) {
            requests.push(fetchPage(page));
        }

        const responses =
            await Promise.all(requests);

        return [
            ...firstRows,
            ...responses.flatMap(
                response =>
                    response?.data?.result || []
            )
        ];
    }

    function matchesRestaurant(row, keywords) {
        const fields = [
            row.canteenName,
            row.canteenNameCn,
            row.canteenNameEn,
            row.canteenCode
        ]
            .filter(Boolean)
            .map(normalizeText);

        return keywords.some(keyword => {
            const target =
                normalizeText(keyword);

            return fields.some(field =>
                field.includes(target)
            );
        });
    }

    function findRestaurantRow(
        rows,
        month,
        keywords
    ) {
        return (
            rows.find(
                row =>
                    row.publicMonth === month &&
                    matchesRestaurant(
                        row,
                        keywords
                    )
            ) || null
        );
    }

    function makeRestaurantData(
        name,
        currentRow,
        previousRow
    ) {
        if (!currentRow) {
            return {
                name,
                score: null,
                participants: null,
                longTerm: null,
                shortTerm: null,
                coverage: null,

                changes: {
                    participants: null,
                    longTerm: null,
                    shortTerm: null
                },

                currentRow: null,
                previousRow
            };
        }

        const participants =
            toNumber(currentRow.recycleNumber);

        const longTerm =
            toNumber(currentRow.longTermNumber);

        const shortTerm =
            toNumber(currentRow.shortTermNumber);

        const previousParticipants =
            toNumber(previousRow?.recycleNumber);

        const previousLongTerm =
            toNumber(previousRow?.longTermNumber);

        const previousShortTerm =
            toNumber(previousRow?.shortTermNumber);

        const coverageNumber =
            toNumber(currentRow.coverage);

        return {
            name,

            score:
                toNumber(currentRow.ratingGrade),

            participants,
            longTerm,
            shortTerm,

            coverage:
                currentRow.coverageString ||
                (
                    Number.isFinite(coverageNumber)
                        ? `${coverageNumber.toFixed(2)}%`
                        : null
                ),

            changes: {
                participants:
                    calculateChange(
                        participants,
                        previousParticipants
                    ),

                longTerm:
                    calculateChange(
                        longTerm,
                        previousLongTerm
                    ),

                shortTerm:
                    calculateChange(
                        shortTerm,
                        previousShortTerm
                    )
            },

            currentRow,
            previousRow
        };
    }

    function extractData(rows) {
        const months = [
            ...new Set(
                rows
                    .map(row => row.publicMonth)
                    .filter(month =>
                        /^\d{4}-\d{2}$/.test(
                            month || ""
                        )
                    )
            )
        ].sort();

        const latestMonth =
            months.at(-1);

        if (!latestMonth) {
            throw new Error(
                "没有识别到有效的 publicMonth"
            );
        }

        const previousMonth =
            getPreviousMonth(latestMonth);

        const result = {
            latestMonth,
            previousMonth,
            months,

            latestRows:
                rows.filter(
                    row =>
                        row.publicMonth === latestMonth
                ),

            SV: null,
            CFC: null
        };

        for (
            const [name, keywords]
            of Object.entries(
                CONFIG.restaurants
            )
        ) {
            result[name] =
                makeRestaurantData(
                    name,

                    findRestaurantRow(
                        rows,
                        latestMonth,
                        keywords
                    ),

                    findRestaurantRow(
                        rows,
                        previousMonth,
                        keywords
                    )
                );
        }

        return result;
    }

    /* =========================================================
     * 5. SheetJS
     * ========================================================= */

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const existing =
                document.querySelector(
                    `script[data-satisfaction-xlsx="${url}"]`
                );

            if (existing) {
                if (
                    typeof window.XLSX !== "undefined"
                ) {
                    resolve();
                    return;
                }

                existing.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );

                existing.addEventListener(
                    "error",
                    reject,
                    { once: true }
                );

                return;
            }

            const script =
                document.createElement("script");

            script.src = url;
            script.async = true;

            script.dataset.satisfactionXlsx =
                url;

            script.onload = resolve;

            script.onerror = () => {
                reject(
                    new Error(
                        `Excel 解析库加载失败：${url}`
                    )
                );
            };

            document.head.appendChild(script);
        });
    }

    async function ensureXLSX() {
        if (
            typeof window.XLSX !== "undefined"
        ) {
            state.detail.xlsxReady = true;
            return true;
        }

        if (state.detail.xlsxLoading) {
            for (
                let index = 0;
                index < 60;
                index++
            ) {
                await sleep(100);

                if (
                    typeof window.XLSX !== "undefined"
                ) {
                    state.detail.xlsxReady = true;
                    return true;
                }

                if (!state.detail.xlsxLoading) {
                    break;
                }
            }

            return (
                typeof window.XLSX !== "undefined"
            );
        }

        state.detail.xlsxLoading = true;
        state.detail.xlsxLoadError = null;

        try {
            for (
                const url
                of CONFIG.xlsxScriptUrls
            ) {
                try {
                    await loadScript(url);

                    if (
                        typeof window.XLSX !==
                        "undefined"
                    ) {
                        state.detail.xlsxReady = true;
                        return true;
                    }
                } catch (error) {
                    console.warn(error.message);
                }
            }

            throw new Error(
                "SheetJS 可能被公司页面 CSP 拦截"
            );
        } catch (error) {
            state.detail.xlsxReady = false;
            state.detail.xlsxLoadError = error;

            return false;
        } finally {
            state.detail.xlsxLoading = false;
        }
    }

    /* =========================================================
     * 6. 详表接口
     * ========================================================= */

    async function fetchDetailExcel(
        canteenCode,
        month
    ) {
        const {
            startDate,
            endDate
        } = getMonthDateRange(month);

        const response = await fetch(
            CONFIG.detailApi,
            {
                headers: {
                    accept:
                        "application/json, text/plain, */*",

                    "content-type":
                        "application/json"
                },

                referrer:
                    "https://w3.huawei.com/iadmin/catering/",

                body: JSON.stringify({
                    evaluationObjId:
                        canteenCode,

                    startDate,
                    endDate
                }),

                method: "POST",
                mode: "cors",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(
                `详表接口请求失败：HTTP ${response.status}`
            );
        }

        const arrayBuffer =
            await response.arrayBuffer();

        if (!arrayBuffer.byteLength) {
            throw new Error("详表文件为空");
        }

        return {
            arrayBuffer,
            size: arrayBuffer.byteLength
        };
    }

    function downloadArrayBuffer(
        arrayBuffer,
        filename
    ) {
        const blob = new Blob(
            [arrayBuffer],
            {
                type: "application/vnd.ms-excel"
            }
        );

        const url =
            URL.createObjectURL(blob);

        const anchor =
            document.createElement("a");

        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(
            () => URL.revokeObjectURL(url),
            5000
        );
    }

    /* =========================================================
     * 7. Excel 解析
     * ========================================================= */

    function findHeaderRowIndex(rows) {
        const maximum =
            Math.min(rows.length, 20);

        for (
            let index = 0;
            index < maximum;
            index++
        ) {
            const text =
                (rows[index] || [])
                    .map(normalizeHeader)
                    .join("|");

            if (
                /反馈人|Feedback By/i.test(text) &&
                /反馈时间|Feedback Time/i.test(text)
            ) {
                return index;
            }
        }

        return -1;
    }

    function findColumnIndex(
        headers,
        patterns
    ) {
        for (
            let index = 0;
            index < headers.length;
            index++
        ) {
            const header =
                normalizeHeader(headers[index]);

            if (
                patterns.some(pattern =>
                    pattern.test(header)
                )
            ) {
                return index;
            }
        }

        return -1;
    }

    function findAllColumnIndexes(
        headers,
        patterns
    ) {
        const indexes = [];

        for (
            let index = 0;
            index < headers.length;
            index++
        ) {
            const header =
                normalizeHeader(headers[index]);

            if (
                patterns.some(pattern =>
                    pattern.test(header)
                )
            ) {
                indexes.push(index);
            }
        }

        return indexes;
    }

    function makeDetailKey(row) {
        return [
            normalizeText(row.feedbackBy),
            normalizeText(row.feedbackTime),
            normalizeText(row.questionnaireName)
        ].join("||");
    }

    function makeFingerprint(row) {
        return JSON.stringify({
            feedbackType:
                row.feedbackType,

            scores:
                row.scores,

            comments:
                row.comments,

            openQuestion:
                row.openQuestion
        });
    }

    function applyExclusionToRow(row) {
        const exclusion =
            getEmployeeExclusion(
                row.feedbackBy
            );

        row.isExcluded =
            exclusion.excluded;

        row.excludedPrefix =
            exclusion.prefix;

        row.excludedReason =
            exclusion.reason;

        return row;
    }

    function parseWorksheetRows(
        worksheetRows,
        sheetName
    ) {
        const headerIndex =
            findHeaderRowIndex(
                worksheetRows
            );

        if (headerIndex < 0) {
            return [];
        }

        const headers =
            (worksheetRows[headerIndex] || [])
                .map(normalizeHeader);

        const questionnaireIndex =
            findColumnIndex(
                headers,
                [
                    /问卷名称/i,
                    /Questionnaire Name/i
                ]
            );

        const feedbackByIndex =
            findColumnIndex(
                headers,
                [
                    /^反馈人/i,
                    /Feedback By/i
                ]
            );

        const feedbackTypeIndex =
            findColumnIndex(
                headers,
                [
                    /反馈人类型/i,
                    /Feedback Type/i
                ]
            );

        const feedbackTimeIndex =
            findColumnIndex(
                headers,
                [
                    /反馈时间/i,
                    /Feedback Time/i
                ]
            );

        const patterns = {
            safety: [
                /^安全-食品安全$/i,
                /食品安全/i
            ],

            service: [
                /^服务-供餐服务$/i,
                /供餐服务/i
            ],

            activity: [
                /^活动-活动$/i
            ],

            environment: [
                /^环境-餐厅餐具$/i,
                /餐厅餐具/i
            ],

            dish: [
                /^菜品-出品$/i,
                /菜品-出品/i
            ]
        };

        const dimensionIndexes = {};

        for (
            const [dimension, dimensionPatterns]
            of Object.entries(patterns)
        ) {
            dimensionIndexes[dimension] =
                findAllColumnIndexes(
                    headers,
                    dimensionPatterns
                );
        }

        const openQuestionIndex =
            findColumnIndex(
                headers,
                [
                    /^问答-/i,
                    /Open-ended/i,
                    /您有什么想吃的/i
                ]
            );

        if (
            feedbackByIndex < 0 ||
            feedbackTimeIndex < 0
        ) {
            return [];
        }

        const parsedRows = [];

        for (
            let rowIndex = headerIndex + 1;
            rowIndex < worksheetRows.length;
            rowIndex++
        ) {
            const source =
                worksheetRows[rowIndex] || [];

            const feedbackBy =
                cleanCell(
                    source[feedbackByIndex]
                );

            const feedbackTime =
                cleanCell(
                    source[feedbackTimeIndex]
                );

            if (!feedbackBy && !feedbackTime) {
                continue;
            }

            const getScore =
                dimension => {
                    const index =
                        dimensionIndexes[
                        dimension
                        ]?.[0];

                    return Number.isInteger(index)
                        ? toNumber(source[index])
                        : null;
                };

            const getComment =
                dimension => {
                    const index =
                        dimensionIndexes[
                        dimension
                        ]?.[2];

                    return Number.isInteger(index)
                        ? cleanCell(source[index])
                        : "";
                };

            const scores = {
                safety:
                    getScore("safety"),

                service:
                    getScore("service"),

                activity:
                    getScore("activity"),

                environment:
                    getScore("environment"),

                dish:
                    getScore("dish")
            };

            const scoreArray =
                Object.values(scores);

            const numericScores =
                scoreArray.filter(
                    Number.isFinite
                );

            const validScores =
                numericScores.filter(
                    score =>
                        score >= 0 &&
                        score <= 5
                );

            const invalidScores =
                numericScores.filter(
                    score =>
                        score < 0 ||
                        score > 5
                );

            const sum =
                validScores.reduce(
                    (total, score) =>
                        total + score,
                    0
                );

            const validScoreCount =
                validScores.length;

            const maximum =
                validScoreCount * 5;

            const average =
                validScoreCount
                    ? sum / validScoreCount
                    : null;

            const isComplete =
                validScoreCount === 5;

            const isPerfect =
                isComplete &&
                validScores.every(
                    score => score === 5
                );

            const row = {
                sheetName,

                questionnaireName:
                    questionnaireIndex >= 0
                        ? cleanCell(
                            source[
                            questionnaireIndex
                            ]
                        )
                        : "",

                feedbackBy,

                feedbackType:
                    feedbackTypeIndex >= 0
                        ? cleanCell(
                            source[
                            feedbackTypeIndex
                            ]
                        )
                        : "",

                feedbackTime,

                scores,
                scoreArray,

                validScoreCount,

                invalidScoreCount:
                    invalidScores.length,

                hasInvalid:
                    invalidScores.length > 0,

                hasMissing:
                    validScoreCount < 5,

                hasCriticalScore:
                    numericScores.some(score => score <= 3),

                isComplete,
                isPerfect,

                sum,
                maximum,
                average,

                loss:
                    maximum - sum,

                comments: {
                    safety:
                        getComment("safety"),

                    service:
                        getComment("service"),

                    activity:
                        getComment("activity"),

                    environment:
                        getComment("environment"),

                    dish:
                        getComment("dish")
                },

                openQuestion:
                    openQuestionIndex >= 0
                        ? cleanCell(
                            source[
                            openQuestionIndex
                            ]
                        )
                        : "",

                excelRow:
                    rowIndex + 1
            };

            applyExclusionToRow(row);

            row.key =
                makeDetailKey(row);

            row.fingerprint =
                makeFingerprint(row);

            parsedRows.push(row);
        }

        return parsedRows;
    }

    function parseDetailWorkbook(
        arrayBuffer
    ) {
        if (
            typeof window.XLSX === "undefined"
        ) {
            throw new Error(
                "Excel 解析库尚未加载"
            );
        }

        const workbook =
            window.XLSX.read(
                arrayBuffer,
                {
                    type: "array",
                    raw: false,
                    cellDates: false
                }
            );

        const rows = [];

        for (
            const sheetName
            of workbook.SheetNames
        ) {
            const worksheet =
                workbook.Sheets[sheetName];

            const matrix =
                window.XLSX.utils
                    .sheet_to_json(
                        worksheet,
                        {
                            header: 1,
                            defval: "",
                            raw: false
                        }
                    );

            rows.push(
                ...parseWorksheetRows(
                    matrix,
                    sheetName
                )
            );
        }

        return rows;
    }

    /* =========================================================
     * 8. 复核计算
     * ========================================================= */

    function calculateAudit(
        rows,
        systemScore
    ) {
        rows.forEach(
            applyExclusionToRow
        );

        const excludedRows =
            rows.filter(
                row => row.isExcluded
            );

        const includedRows =
            rows.filter(
                row => !row.isExcluded
            );

        const validRows =
            includedRows.filter(
                row =>
                    row.validScoreCount > 0 &&
                    !row.hasInvalid
            );

        const perfectRows =
            validRows.filter(
                row => row.isPerfect
            );

        const criticalRows =
            validRows.filter(
                row => !row.isPerfect && row.hasCriticalScore
            );

        const secondaryRows =
            validRows.filter(
                row => !row.isPerfect && !row.hasCriticalScore
            );

        const totalActualScore =
            validRows.reduce(
                (total, row) =>
                    total + row.sum,
                0
            );

        const totalValidItems =
            validRows.reduce(
                (total, row) =>
                    total +
                    row.validScoreCount,
                0
            );

        const totalMaximumScore =
            totalValidItems * 5;

        let gapToTarget = 0;
        const avgMax = validRows.length > 0 ? (totalMaximumScore / validRows.length) : 25;

        if (totalMaximumScore > 0 && totalActualScore / totalMaximumScore < (state.settings.targetScore / 100)) {
            const targetRatio = state.settings.targetScore / 100;
            gapToTarget = Math.ceil((targetRatio * totalMaximumScore - totalActualScore) / ((1 - targetRatio) * avgMax));
        }

        const itemWeighted =
            totalMaximumScore > 0
                ? (
                    totalActualScore /
                    totalMaximumScore
                ) * 100
                : null;

        const personPercentages =
            validRows
                .map(row =>
                    row.maximum > 0
                        ? (
                            row.sum /
                            row.maximum
                        ) * 100
                        : null
                )
                .filter(Number.isFinite);

        const personAverage =
            personPercentages.length
                ? personPercentages.reduce(
                    (total, value) =>
                        total + value,
                    0
                ) /
                personPercentages.length
                : null;

        const dimensions = [
            "safety",
            "service",
            "activity",
            "environment",
            "dish"
        ];

        const dimensionStats = {};

        for (
            const dimension
            of dimensions
        ) {
            const values =
                validRows
                    .map(
                        row =>
                            row.scores[dimension]
                    )
                    .filter(
                        value =>
                            Number.isFinite(value) &&
                            value >= 1 &&
                            value <= 5
                    );

            const sum =
                values.reduce(
                    (total, value) =>
                        total + value,
                    0
                );

            dimensionStats[dimension] = {
                count: values.length,
                sum,

                average:
                    values.length
                        ? sum / values.length
                        : null
            };
        }

        const dimensionPercentages =
            Object.values(
                dimensionStats
            )
                .map(stat =>
                    Number.isFinite(
                        stat.average
                    )
                        ? (
                            stat.average /
                            5
                        ) * 100
                        : null
                )
                .filter(Number.isFinite);

        const dimensionAverage =
            dimensionPercentages.length
                ? dimensionPercentages.reduce(
                    (total, value) =>
                        total + value,
                    0
                ) /
                dimensionPercentages.length
                : null;

        const methods = [
            {
                key: "itemWeighted",
                name:
                    "有效评分项整体加权",
                value:
                    itemWeighted
            },

            {
                key: "personAverage",
                name:
                    "每人折算后再平均",
                value:
                    personAverage
            },

            {
                key: "dimensionAverage",
                name:
                    "五个维度等权平均",
                value:
                    dimensionAverage
            }
        ].map(method => ({
            ...method,

            rounded:
                round(
                    method.value,
                    2
                ),

            difference:
                (
                    Number.isFinite(
                        method.value
                    ) &&
                    Number.isFinite(
                        systemScore
                    )
                )
                    ? Math.abs(
                        round(
                            method.value,
                            2
                        ) -
                        systemScore
                    )
                    : null
        }));

        const closestMethod =
            methods
                .filter(method =>
                    Number.isFinite(
                        method.difference
                    )
                )
                .sort(
                    (a, b) =>
                        a.difference -
                        b.difference
                )[0] || null;

        const reviewedScore =
            closestMethod?.rounded ??
            round(itemWeighted, 2);

        const difference =
            (
                Number.isFinite(
                    reviewedScore
                ) &&
                Number.isFinite(
                    systemScore
                )
            )
                ? round(
                    reviewedScore -
                    systemScore,
                    4
                )
                : null;

        let status = "无法判断";

        if (Number.isFinite(difference)) {
            if (
                Math.abs(difference) <
                0.005
            ) {
                status = "一致";
            } else if (
                Math.abs(difference) <=
                0.02
            ) {
                status = "基本一致";
            } else {
                status = "不一致";
            }
        }

        /*
         * 只有计入复核的记录才计算影响。
         */
        for (const row of rows) {
            row.impact =
                (
                    !row.isExcluded &&
                    totalMaximumScore > 0
                )
                    ? (
                        row.loss /
                        totalMaximumScore
                    ) * 100
                    : null;
        }

        return {
            systemScore,
            reviewedScore,
            difference,
            status,

            methods,
            closestMethod,

            originalRowCount:
                rows.length,

            excludedRowCount:
                excludedRows.length,

            includedRowCount:
                includedRows.length,

            validQuestionnaires:
                validRows.length,

            perfectCount:
                perfectRows.length,

            criticalCount:
                criticalRows.length,

            secondaryCount:
                secondaryRows.length,

            totalActualScore,
            totalValidItems,
            totalMaximumScore,

            gapToTarget,

            itemWeighted,
            personAverage,
            dimensionAverage,

            dimensionStats,

            excludedRows,

            excludedPrefixes:
                state.settings
                    .excludedEmployeePrefixes
                    .slice()
        };
    }

    function recalculateAllAudits() {
        for (
            const name
            of ["SV", "CFC"]
        ) {
            const detailState =
                state.detail[name];

            if (!detailState.rows.length) {
                continue;
            }

            detailState.rows.forEach(
                applyExclusionToRow
            );

            detailState.audit =
                calculateAudit(
                    detailState.rows,
                    state.lastData?.[name]?.score
                );

            detailState.displayedRows.forEach(
                applyExclusionToRow
            );

            if (
                detailState.displayedRows.length
            ) {
                detailState.displayedAudit =
                    calculateAudit(
                        detailState.displayedRows,
                        detailState.displayedAudit
                            ?.systemScore ??
                        state.lastData?.[name]?.score
                    );
            }
        }
    }

    /* =========================================================
     * 9. 详表变化
     * ========================================================= */

    function buildDetailMap(rows) {
        const map = new Map();

        for (const row of rows) {
            map.set(row.key, row);
        }

        return map;
    }

    function compareDetailMaps(
        previousMap,
        currentMap
    ) {
        const added = [];
        const changed = [];
        const removed = [];

        for (
            const [key, currentRow]
            of currentMap.entries()
        ) {
            const previousRow =
                previousMap.get(key);

            if (!previousRow) {
                added.push(currentRow);
            } else if (
                previousRow.fingerprint !==
                currentRow.fingerprint
            ) {
                changed.push({
                    before: previousRow,
                    after: currentRow
                });
            }
        }

        for (
            const [key, previousRow]
            of previousMap.entries()
        ) {
            if (!currentMap.has(key)) {
                removed.push(previousRow);
            }
        }

        return {
            added,
            changed,
            removed,

            totalChanges:
                added.length +
                changed.length +
                removed.length
        };
    }

    function addDetailEvent(event) {
        state.detail.events.unshift(event);

        if (
            state.detail.events.length >
            CONFIG.maxStoredEvents
        ) {
            state.detail.events.length =
                CONFIG.maxStoredEvents;
        }
    }

    /* =========================================================
     * 10. 获取及更新详表
     * ========================================================= */

    async function refreshRestaurantDetail(
        restaurantName,
        restaurantData,
        reason,
        previousScore,
        options = {}
    ) {
        const {
            applyImmediately = false,
            userRequested = false
        } = options;

        const detailState =
            state.detail[restaurantName];

        if (!restaurantData?.currentRow) {
            detailState.lastError =
                new Error(
                    `${restaurantName} 没有当前月份记录`
                );

            updateDetailStatusOnly();
            return;
        }

        if (detailState.loading) {
            return;
        }

        const canteenCode =
            restaurantData.currentRow
                .canteenCode;

        const month =
            state.view.month || state.lastData?.latestMonth;

        if (!canteenCode || !month) {
            detailState.lastError =
                new Error(
                    `${restaurantName} 缺少餐厅编码或月份`
                );

            updateDetailStatusOnly();
            return;
        }

        detailState.loading = true;
        detailState.lastError = null;

        updateDetailStatusOnly();

        if (
            state.view.mode ===
            "monitor"
        ) {
            updateMonitorView();
        }

        try {
            const excel =
                await fetchDetailExcel(
                    canteenCode,
                    month
                );

            const xlsxReady =
                await ensureXLSX();

            if (!xlsxReady) {
                if (
                    CONFIG.autoDownloadWhenParseFails
                ) {
                    downloadArrayBuffer(
                        excel.arrayBuffer,
                        `${restaurantName}_${month}_满意度详表.xls`
                    );
                }

                throw new Error(
                    "Excel 解析库加载失败，详表已下载但无法自动分析"
                );
            }

            const rows =
                parseDetailWorkbook(
                    excel.arrayBuffer
                );

            const currentMap =
                buildDetailMap(rows);

            const wasInitialized =
                detailState.initialized;

            const changes =
                wasInitialized
                    ? compareDetailMaps(
                        detailState.rowMap,
                        currentMap
                    )
                    : {
                        added: [],
                        changed: [],
                        removed: [],
                        totalChanges: 0
                    };

            const audit =
                calculateAudit(
                    rows,
                    restaurantData.score
                );

            detailState.rows = rows;
            detailState.rowMap = currentMap;
            detailState.audit = audit;
            detailState.initialized = true;
            detailState.lastFetchAt = Date.now();
            detailState.lastScore =
                restaurantData.score;
            detailState.lastError = null;

            detailState.lastChanges = {
                reason,
                time: Date.now(),
                scoreBefore: previousScore,
                scoreAfter:
                    restaurantData.score,
                ...changes
            };

            if (
                !detailState.displayedRows.length ||
                applyImmediately
            ) {
                detailState.displayedRows =
                    rows.slice();

                detailState.displayedAudit =
                    audit;

                detailState.displayedFetchAt =
                    detailState.lastFetchAt;

                detailState.pendingViewUpdate =
                    false;
            } else {
                const displayedScore =
                    detailState.displayedAudit
                        ?.systemScore;

                const scoreChanged =
                    Number.isFinite(displayedScore) &&
                    Number.isFinite(
                        restaurantData.score
                    ) &&
                    displayedScore !==
                    restaurantData.score;

                if (
                    scoreChanged ||
                    changes.totalChanges > 0
                ) {
                    detailState.pendingViewUpdate =
                        true;
                }
            }

            if (!wasInitialized) {
                addDetailEvent({
                    restaurant: restaurantName,
                    type: "initial",
                    time: Date.now(),
                    totalRows: rows.length,
                    message:
                        `${restaurantName} 已建立 ${rows.length} 条反馈快照`
                });
            } else {
                addDetailEvent({
                    restaurant: restaurantName,
                    type:
                        changes.totalChanges
                            ? "changes"
                            : "updated",
                    time: Date.now(),
                    scoreBefore: previousScore,
                    scoreAfter:
                        restaurantData.score,
                    ...changes
                });
            }

            if (userRequested) {
                console.log(
                    `${restaurantName} 详表刷新完成，共 ${rows.length} 条。`
                );
            }
        } catch (error) {
            detailState.lastError = error;

            addDetailEvent({
                restaurant: restaurantName,
                type: "error",
                time: Date.now(),
                message: error.message
            });

            console.error(
                `${restaurantName} 详表处理失败：`,
                error
            );
        } finally {
            detailState.loading = false;

            updateDetailStatusOnly();

            if (
                state.view.mode ===
                "monitor"
            ) {
                updateMonitorView();
            }
        }
    }

    async function handleAutomaticDetailRefresh(
        previousData,
        currentData
    ) {
        const tasks = [];

        for (
            const name
            of ["SV", "CFC"]
        ) {
            const detailState =
                state.detail[name];

            const currentRestaurant =
                currentData[name];

            const previousScore =
                previousData?.[name]?.score;

            const currentScore =
                currentRestaurant?.score;

            const firstRun =
                !detailState.initialized;

            const scoreChanged =
                detailState.initialized &&
                Number.isFinite(currentScore) &&
                Number.isFinite(previousScore) &&
                currentScore !== previousScore;

            if (firstRun || scoreChanged) {
                tasks.push(
                    refreshRestaurantDetail(
                        name,
                        currentRestaurant,
                        firstRun
                            ? "initial"
                            : "score_changed",
                        previousScore,
                        {
                            applyImmediately: firstRun,
                            userRequested: false
                        }
                    )
                );
            }
        }

        if (tasks.length) {
            await Promise.allSettled(tasks);
        }
    }

    /* =========================================================
     * 11. PiP 窗口尺寸
     * ========================================================= */

    function resizeFloatWindow(
        mode,
        sourceDocument = null
    ) {
        /*
         * 优先使用实际产生点击事件的 PiP document。
         */
        const pipWindow =
            sourceDocument?.defaultView ||
            state.pipWindow ||
            documentPictureInPicture.window;

        if (!pipWindow || pipWindow.closed) {
            return false;
        }

        try {
            let targetWidth, targetHeight;
            if (mode === "detail") {
                const screenObject =
                    pipWindow.screen ||
                    window.screen ||
                    screen;

                const availableWidth =
                    screenObject?.availWidth ||
                    1200;

                const availableHeight =
                    screenObject?.availHeight ||
                    800;

                targetWidth = Math.min(
                    CONFIG.detailWindow.width,
                    Math.max(
                        760,
                        availableWidth - 80
                    )
                );

                targetHeight = Math.min(
                    CONFIG.detailWindow.height,
                    Math.max(
                        580,
                        availableHeight - 100
                    )
                );
            } else {
                targetWidth = CONFIG.monitorWindow.width;
                targetHeight = CONFIG.monitorWindow.height;
            }

            if (state.pipWindow === pipWindow) {
                const iframe = document.getElementById('satisfaction-float-iframe');
                if (iframe) {
                    iframe.style.width = targetWidth + 'px';
                    iframe.style.height = targetHeight + 'px';
                    
                    // Adjust close button position
                    const closeBtn = document.getElementById('satisfaction-float-close');
                    if (closeBtn) {
                        closeBtn.style.bottom = (20 + targetHeight - 12) + 'px';
                    }
                }
            } else {
                pipWindow.resizeTo(targetWidth, targetHeight);
            }

            return true;
        } catch (error) {
            console.warn(
                `浮窗切换到${mode === "detail"
                    ? "详情"
                    : "监控"
                }尺寸失败：`,
                error
            );

            return false;
        }
    }

    /* =========================================================
     * 12. 基础样式
     * ========================================================= */

    function installBaseStyles(doc) {
        doc.head.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
        }

        html,
        body {
          width: 100%;
          height: 100%;
          margin: 0;
        }

        body {
          padding: 12px;
          overflow: hidden;
          color: #172033;
          font-family:
            "Microsoft YaHei",
            "Segoe UI",
            Arial,
            sans-serif;
          background:
            linear-gradient(
              145deg,
              #eaf1f7,
              #dce7f0
            );
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app-shell {
          width: 100%;
          height: 100%;
          overflow: hidden;
          border:
            1px solid rgba(
              255,
              255,
              255,
              0.92
            );
          border-radius: 18px;
          background:
            rgba(
              255,
              255,
              255,
              0.98
            );
          box-shadow:
            0 12px 30px
            rgba(
              32,
              52,
              75,
              0.17
            );
        }

        .mono {
          font-variant-numeric:
            tabular-nums;
        }

        .good {
          color: #138a4b;
        }

        .bad {
          color: #d92d20;
        }

        .warning {
          color: #b54708;
        }

        .muted {
          color: #98a2b3;
        }

        .button {
          border:
            1px solid #d0d5dd;
          border-radius: 9px;
          padding: 6px 10px;
          color: #344054;
          background: #fff;
        }

        .button:hover {
          background: #f9fafb;
        }

        .primary-button {
          border-color: #1677ff;
          color: #fff;
          background: #1677ff;
        }

        .primary-button:hover {
          background: #1268df;
        }

        .danger-button {
          border-color: #f3b5af;
          color: #b42318;
          background: #fff5f4;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #20a464;
          box-shadow:
            0 0 0 3px
            rgba(
              32,
              164,
              100,
              0.13
            );
          animation:
            livePulse
            1.5s
            ease-in-out
            infinite;
        }

        .dot.fetching {
          background: #1677ff;
        }

        .dot.error {
          background: #d92d20;
        }

        @keyframes livePulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.4;
            transform: scale(0.72);
          }
        }

        @keyframes loadingSlide {
          0% {
            transform:
              translateX(-120%);
          }

          100% {
            transform:
              translateX(340%);
          }
        }
      </style>
    `;
    }

    /* =========================================================
     * 13. 设置弹窗
     * ========================================================= */

    function openSettingsDialog() {
        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        doc
            .getElementById(
                "settingsOverlay"
            )
            ?.remove();

        const overlay =
            doc.createElement("div");

        overlay.id = "settingsOverlay";

        overlay.innerHTML = `
      <div class="settings-backdrop">
        <div class="settings-dialog">
          <div class="settings-header">
            <div>
              <div class="settings-title">
                复核设置
              </div>

              <div class="settings-subtitle">
                这些规则只影响本地复核分数，不修改系统原始数据
              </div>
            </div>

            <button
              class="settings-close"
              id="settingsClose"
              type="button"
            >
              ×
            </button>
          </div>

          <div class="settings-body">
            <label class="settings-label">
              目标达标分数 (0-100)
            </label>
            <input
              type="number"
              class="settings-input"
              id="targetScoreInput"
              min="0" max="100" step="0.1"
              value="${state.settings.targetScore}"
              style="width:100%; padding:8px; margin-bottom:16px; border:1px solid #ccc; border-radius:4px;"
            >

            <label class="settings-label">
              后台刷新周期 (秒)
            </label>
            <input
              type="number"
              class="settings-input"
              id="refreshIntervalInput"
              min="1" max="3600" step="1"
              value="${state.settings.refreshIntervalSeconds}"
              style="width:100%; padding:8px; margin-bottom:16px; border:1px solid #ccc; border-radius:4px;"
            >

            <label class="settings-label">
              排除反馈人工号前缀
            </label>

            <textarea
              class="settings-textarea"
              id="excludedPrefixInput"
              placeholder="例如：WX、84、60"
            >${escapeHtml(
            state.settings
                .excludedEmployeePrefixes
                .join("\n")
        )}</textarea>

            <div class="settings-help">
              支持逗号、空格、分号或换行分隔。匹配时忽略大小写、空格、下划线和短横线。
            </div>

            <div class="settings-example">
              当前默认会排除：
              <strong>WX1530433</strong>、
              <strong>84369699</strong>
            </div>
          </div>

          <div class="settings-footer">
            <button
              class="button danger-button"
              id="resetSettingsButton"
              type="button"
            >
              恢复默认
            </button>

            <div style="display:flex;gap:8px;">
              <button
                class="button"
                id="cancelSettingsButton"
                type="button"
              >
                取消
              </button>

              <button
                class="button primary-button"
                id="saveSettingsButton"
                type="button"
              >
                保存并重新计算
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

        const style =
            doc.createElement("style");

        style.textContent = `
      .settings-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background:
          rgba(15, 23, 42, 0.36);
        backdrop-filter:
          blur(4px);
      }

      .settings-dialog {
        width: min(420px, 100%);
        overflow: hidden;
        border:
          1px solid rgba(
            255,
            255,
            255,
            0.9
          );
        border-radius: 16px;
        background: #fff;
        box-shadow:
          0 20px 50px
          rgba(
            15,
            23,
            42,
            0.25
          );
      }

      .settings-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 15px 16px 12px;
        border-bottom:
          1px solid #eaecf0;
      }

      .settings-title {
        font-size: 16px;
        font-weight: 700;
      }

      .settings-subtitle {
        margin-top: 3px;
        color: #667085;
        font-size: 10px;
      }

      .settings-close {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 8px;
        color: #667085;
        background: #f2f4f7;
        font-size: 18px;
      }

      .settings-body {
        padding: 15px 16px;
      }

      .settings-label {
        display: block;
        margin-bottom: 7px;
        color: #344054;
        font-size: 11px;
        font-weight: 700;
      }

      .settings-textarea {
        width: 100%;
        height: 125px;
        resize: vertical;
        border:
          1px solid #d0d5dd;
        border-radius: 10px;
        padding: 9px 10px;
        color: #344054;
        background: #fff;
        line-height: 1.6;
      }

      .settings-textarea:focus {
        outline:
          2px solid
          rgba(
            22,
            119,
            255,
            0.15
          );
        border-color: #1677ff;
      }

      .settings-help,
      .settings-example {
        margin-top: 8px;
        color: #667085;
        font-size: 10px;
        line-height: 1.5;
      }

      .settings-example {
        padding: 8px 9px;
        border-radius: 8px;
        background: #f8fafc;
      }

      .settings-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 16px;
        border-top:
          1px solid #eaecf0;
        background: #f9fafb;
      }
    `;

        overlay.prepend(style);
        doc.body.appendChild(overlay);

        const close = () =>
            overlay.remove();

        doc
            .getElementById(
                "settingsClose"
            )
            ?.addEventListener(
                "click",
                close
            );

        doc
            .getElementById(
                "cancelSettingsButton"
            )
            ?.addEventListener(
                "click",
                close
            );

        overlay
            .querySelector(
                ".settings-backdrop"
            )
            ?.addEventListener(
                "click",
                event => {
                    if (
                        event.target.classList
                            .contains(
                                "settings-backdrop"
                            )
                    ) {
                        close();
                    }
                }
            );

        doc
            .getElementById(
                "resetSettingsButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    const input = doc.getElementById("excludedPrefixInput");
                    if (input) {
                        input.value = DEFAULT_SETTINGS.excludedEmployeePrefixes.join("\n");
                    }
                    const targetInput = doc.getElementById("targetScoreInput");
                    if (targetInput) {
                        targetInput.value = DEFAULT_SETTINGS.targetScore;
                    }
                    const refreshInput = doc.getElementById("refreshIntervalInput");
                    if (refreshInput) {
                        refreshInput.value = DEFAULT_SETTINGS.refreshIntervalSeconds;
                    }
                }
            );

        doc
            .getElementById(
                "saveSettingsButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    const input = doc.getElementById("excludedPrefixInput");
                    const targetInput = doc.getElementById("targetScoreInput");
                    const refreshInput = doc.getElementById("refreshIntervalInput");

                    const prefixes = parsePrefixText(input?.value);
                    
                    let targetScore = parseFloat(targetInput?.value);
                    if (isNaN(targetScore) || targetScore < 0 || targetScore > 100) {
                        targetScore = DEFAULT_SETTINGS.targetScore;
                    }

                    let refreshInterval = parseInt(refreshInput?.value, 10);
                    if (isNaN(refreshInterval) || refreshInterval < 1) {
                        refreshInterval = DEFAULT_SETTINGS.refreshIntervalSeconds;
                    }

                    state.settings.excludedEmployeePrefixes = prefixes;
                    state.settings.targetScore = targetScore;
                    state.settings.refreshIntervalSeconds = refreshInterval;

                    saveSettings();
                    recalculateAllAudits();

                    for (
                        const name
                        of ["SV", "CFC"]
                    ) {
                        const detailState =
                            state.detail[name];

                        if (
                            detailState
                                .displayedRows
                                .length
                        ) {
                            detailState
                                .displayedAudit =
                                calculateAudit(
                                    detailState
                                        .displayedRows,
                                    detailState
                                        .displayedAudit
                                        ?.systemScore ??
                                    state.lastData?.[
                                        name
                                    ]?.score
                                );
                        }
                    }

                    close();

                    if (
                        state.view.mode ===
                        "detail"
                    ) {
                        renderDetailView(
                            state.view.restaurant,
                            {
                                preserveScroll: true
                            }
                        );
                    } else {
                        updateMonitorView();
                    }

                    console.log(
                        "复核排除前缀已更新：",
                        state.settings
                            .excludedEmployeePrefixes
                    );
                }
            );
    }

    /* =========================================================
     * 14. 监控小窗
     * ========================================================= */

    function createMonitorCard(
        prefix,
        name
    ) {
        return `
      <button
        class="monitor-card"
        id="${prefix}Card"
        data-restaurant="${name}"
        type="button"
        title="点击查看${name}评分详表"
      >
        <div class="card-name">
          ${name} 餐厅
        </div>

        <div class="score-line">
          <span
            class="big-score mono"
            id="${prefix}Score"
          >
            --
          </span>

          <span class="score-unit">
            分
          </span>
        </div>

        <div
          class="score-status"
          id="${prefix}Status"
        >
          等待数据
        </div>

        <div class="card-meta">
          <div>
            参与
            <strong
              id="${prefix}Participants"
            >
              --
            </strong>

            <span
              id="${prefix}ParticipantsChange"
            >
              --
            </span>
          </div>

          <div>
            常驻
            <strong
              id="${prefix}LongTerm"
            >
              --
            </strong>

            <span
              id="${prefix}LongTermChange"
            >
              --
            </span>

            · 外派
            <strong
              id="${prefix}ShortTerm"
            >
              --
            </strong>

            <span
              id="${prefix}ShortTermChange"
            >
              --
            </span>
          </div>

          <div>
            覆盖率
            <strong
              id="${prefix}Coverage"
            >
              --
            </strong>
          </div>
        </div>

        <div class="click-hint">
          点击查看评分详表 →
        </div>
      </button>
    `;
    }

    function renderMonitorView() {
        const pipWindow =
            state.pipWindow;

        if (!pipWindow || pipWindow.closed) {
            return;
        }

        state.view.mode = "monitor";
        state.view.restaurant = null;

        const doc =
            pipWindow.document;

        installBaseStyles(doc);

        doc.title =
            "满意度实时监控";

        doc.head.insertAdjacentHTML(
            "beforeend",
            `
        <style>
          .monitor-layout {
            height: 100%;
            padding: 14px;
          }

          .monitor-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
          }

          .monitor-title {
            font-size: 16px;
            font-weight: 700;
          }

          .monitor-header-right {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .month-badge {
            padding: 4px 8px;
            border-radius: 8px;
            color: #667085;
            background: #edf2f7;
            font-size: 11px;
          }

          .settings-button {
            width: 29px;
            height: 29px;
            border:
              1px solid #d0d5dd;
            border-radius: 9px;
            color: #475467;
            background: #fff;
            font-size: 14px;
          }

          .settings-button:hover {
            border-color: #98bff5;
            color: #1677ff;
            background: #f5f9ff;
          }

          .monitor-cards {
            display: grid;
            grid-template-columns:
              1fr 1fr;
            gap: 10px;
          }

          .monitor-card {
            width: 100%;
            padding: 11px 10px;
            border:
              1px solid #e4e9ef;
            border-radius: 14px;
            color: inherit;
            background: #f7f9fb;
            text-align: center;
            transition:
              transform 0.18s ease,
              border-color 0.18s ease,
              background 0.18s ease;
          }

          .monitor-card:hover {
            transform:
              translateY(-2px);
            border-color: #98bff5;
          }

          .monitor-card.pass {
            border-color: #b8e5ca;
            background:
              linear-gradient(
                145deg,
                #f2fcf6,
                #e7f7ee
              );
          }

          .monitor-card.fail {
            border-color: #ffb8b8;
            background:
              linear-gradient(
                145deg,
                #fff4f4,
                #ffe8e8
              );
          }

          .card-name {
            color: #596477;
            font-size: 13px;
            font-weight: 650;
          }

          .score-line {
            margin-top: 3px;
            line-height: 1;
          }

          .big-score {
            font-size: 31px;
            font-weight: 800;
          }

          .score-unit {
            margin-left: 2px;
            font-size: 11px;
          }

          .score-status {
            margin-top: 5px;
            font-size: 11px;
            font-weight: 700;
          }

          .pass .big-score,
          .pass .score-status {
            color: #138a4b;
          }

          .fail .big-score,
          .fail .score-status {
            color: #d92d20;
          }

          .card-meta {
            margin-top: 9px;
            padding-top: 8px;
            border-top:
              1px solid
              rgba(
                100,
                116,
                139,
                0.13
              );
            color: #667085;
            font-size: 10px;
            line-height: 1.7;
          }

          .click-hint {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 9px;
          }

          .rule-line {
            margin-top: 8px;
            padding: 6px 8px;
            border-radius: 9px;
            color: #667085;
            background: #f8fafc;
            font-size: 9px;
            text-align: center;
          }

          .latest-change {
            margin-top: 8px;
            padding: 9px 10px;
            border:
              1px solid #e6ebf0;
            border-radius: 12px;
            background: #f8fafc;
          }

          .change-header {
            display: flex;
            justify-content: space-between;
            color: #475467;
            font-size: 11px;
            font-weight: 700;
          }

          .change-content {
            margin-top: 6px;
            min-height: 30px;
            color: #667085;
            font-size: 10px;
            line-height: 1.5;
          }

          .refresh-area {
            margin-top: 8px;
            padding-top: 8px;
            border-top:
              1px solid
              rgba(
                100,
                116,
                139,
                0.12
              );
          }

          .refresh-top,
          .refresh-bottom {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .refresh-top {
            color: #667085;
            font-size: 10px;
          }

          .refresh-bottom {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 9px;
          }

          .live-label {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .progress-track {
            height: 5px;
            margin-top: 6px;
            overflow: hidden;
            border-radius: 999px;
            background: #e9eef3;
          }

          .progress-bar {
            width: 100%;
            height: 100%;
            border-radius: inherit;
            background:
              linear-gradient(
                90deg,
                #1677ff,
                #20a464
              );
            transform-origin:
              left center;
            transform: scaleX(0);
            transition:
              transform 0.1s linear;
          }

          .progress-bar.fetching {
            width: 42%;
            transform: none;
            animation:
              loadingSlide
              0.9s
              ease-in-out
              infinite;
          }
        </style>
      `
        );

        doc.body.innerHTML = `
      <div class="app-shell">
        <div class="monitor-layout">
          <div class="monitor-header">
            <div class="monitor-title">
              满意度实时监控
            </div>

            <div class="monitor-header-right">
              <div
                class="month-badge"
                id="monthBadge"
              >
                等待获取
              </div>

              <button
                class="settings-button"
                id="settingsButton"
                type="button"
                title="复核设置"
              >
                ⚙
              </button>
            </div>
          </div>

          <div class="monitor-cards">
            ${createMonitorCard("sv", "SV")}
            ${createMonitorCard("cfc", "CFC")}
          </div>

          <div class="rule-line">
            本地复核排除前缀：
            <strong id="rulePrefixText">
              ${escapeHtml(
            state.settings
                .excludedEmployeePrefixes
                .join("、") ||
            "无"
        )}
            </strong>
          </div>

          <div class="latest-change">
            <div class="change-header">
              <span>最新反馈变化</span>

              <span
                id="detailStateBadge"
              >
                等待详表
              </span>
            </div>

            <div
              class="change-content"
              id="latestChangeContent"
            >
              首次获取分数后将自动建立反馈快照
            </div>
          </div>

          <div class="refresh-area">
            <div class="refresh-top">
              <div class="live-label">
                <span
                  class="dot"
                  id="liveDot"
                ></span>

                <span id="liveText">
                  监控运行中
                </span>
              </div>

              <div
                class="mono"
                id="countdownText"
              >
                准备刷新
              </div>
            </div>

            <div class="progress-track">
              <div
                class="progress-bar"
                id="progressBar"
              ></div>
            </div>

            <div class="refresh-bottom">
              <span id="refreshStatus">
                等待首次获取
              </span>

              <span
                class="mono"
                id="updateTime"
              >
                --
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

        doc
            .getElementById(
                "settingsButton"
            )
            ?.addEventListener(
                "click",
                openSettingsDialog
            );

        for (
            const name
            of ["SV", "CFC"]
        ) {
            const card =
                doc.querySelector(
                    `[data-restaurant="${name}"]`
                );

            card?.addEventListener(
                "click",
                event => {
                    /*
                     * 必须在当前 PiP 窗口的真实点击事件中，
                     * 同步执行 resizeTo。
                     */
                    const sourceDocument =
                        event.currentTarget
                            .ownerDocument;

                    const resized =
                        resizeFloatWindow(
                            "detail",
                            sourceDocument
                        );

                    if (!resized) {
                        console.warn(
                            "详情内容仍会正常打开，但浏览器没有允许自动放大。"
                        );
                    }

                    /*
                     * 不 await，避免用户激活失效。
                     */
                    void openDetailView(name);
                }
            );
        }

        updateMonitorView();
    }

    function updateMonitorCard(
        prefix,
        restaurant
    ) {
        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const card =
            doc.getElementById(
                `${prefix}Card`
            );

        const score =
            restaurant?.score;

        card?.classList.remove(
            "pass",
            "fail"
        );

        if (Number.isFinite(score)) {
            card?.classList.add(
                score >= state.settings.targetScore
                    ? "pass"
                    : "fail"
            );
        }

        const scoreElement =
            doc.getElementById(
                `${prefix}Score`
            );

        const statusElement =
            doc.getElementById(
                `${prefix}Status`
            );

        if (scoreElement) {
            scoreElement.textContent =
                formatScore(score);
        }

        if (statusElement) {
            statusElement.textContent =
                !Number.isFinite(score)
                    ? "暂无数据"
                    : score >= state.settings.targetScore
                        ? "达标"
                        : `未达标，差 ${(
                            state.settings.targetScore -
                            score
                        ).toFixed(2)} 分`;
        }

        const values = {
            Participants:
                restaurant?.participants,

            LongTerm:
                restaurant?.longTerm,

            ShortTerm:
                restaurant?.shortTerm
        };

        for (
            const [suffix, value]
            of Object.entries(values)
        ) {
            const element =
                doc.getElementById(
                    `${prefix}${suffix}`
                );

            if (element) {
                element.textContent =
                    formatInteger(value);
            }
        }

        const coverage =
            doc.getElementById(
                `${prefix}Coverage`
            );

        if (coverage) {
            coverage.textContent =
                restaurant?.coverage ||
                "--";
        }

        const changes = {
            ParticipantsChange:
                restaurant?.changes
                    ?.participants,

            LongTermChange:
                restaurant?.changes
                    ?.longTerm,

            ShortTermChange:
                restaurant?.changes
                    ?.shortTerm
        };

        for (
            const [suffix, value]
            of Object.entries(changes)
        ) {
            const element =
                doc.getElementById(
                    `${prefix}${suffix}`
                );

            if (!element) {
                continue;
            }

            element.textContent =
                formatChange(value);

            element.className =
                !Number.isFinite(value)
                    ? "muted"
                    : value > 0
                        ? "good"
                        : value < 0
                            ? "bad"
                            : "muted";
        }
    }

    function updateLatestChangePanel() {
        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const badge =
            doc.getElementById(
                "detailStateBadge"
            );

        const content =
            doc.getElementById(
                "latestChangeContent"
            );

        if (!badge || !content) {
            return;
        }

        const loading =
            ["SV", "CFC"].filter(
                name =>
                    state.detail[name].loading
            );

        if (loading.length) {
            badge.textContent =
                `${loading.join("/")} 获取中`;

            content.textContent =
                "正在后台获取本月评分详表并复核……";

            return;
        }

        const latestEvent =
            state.detail.events[0];

        if (!latestEvent) {
            const initialized =
                ["SV", "CFC"].filter(
                    name =>
                        state.detail[name]
                            .initialized
                ).length;

            badge.textContent =
                initialized
                    ? `已初始化 ${initialized}/2`
                    : "等待详表";

            content.textContent =
                initialized
                    ? "反馈快照已建立，分数变化时将自动重新分析。"
                    : "首次获取分数后将自动建立反馈快照。";

            return;
        }

        if (
            latestEvent.type ===
            "error"
        ) {
            badge.textContent =
                `${latestEvent.restaurant} 失败`;

            content.innerHTML =
                `<span class="bad">${escapeHtml(
                    latestEvent.message
                )}</span>`;

            return;
        }

        if (
            latestEvent.type ===
            "initial"
        ) {
            badge.textContent =
                `${latestEvent.restaurant} 已初始化`;

            content.innerHTML =
                `${escapeHtml(
                    latestEvent.restaurant
                )} 已建立 <strong>${latestEvent.totalRows}</strong> 条反馈快照`;

            return;
        }

        if (
            latestEvent.type ===
            "changes"
        ) {
            badge.textContent =
                `${latestEvent.restaurant} 变化 ${latestEvent.totalChanges}`;

            content.innerHTML = `
        <strong>
          ${escapeHtml(
                latestEvent.restaurant
            )}
        </strong>
        分数
        ${formatScore(
                latestEvent.scoreBefore
            )}
        →
        ${formatScore(
                latestEvent.scoreAfter
            )}，
        新增 ${latestEvent.added.length}，
        修改 ${latestEvent.changed.length}，
        删除 ${latestEvent.removed.length}
      `;

            return;
        }

        badge.textContent =
            `${latestEvent.restaurant} 已更新`;

        content.textContent =
            "详表已重新获取，未识别到记录级变化。";
    }

    function updateMonitorRefreshUi() {
        if (
            state.view.mode !==
            "monitor"
        ) {
            return;
        }

        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const countdown =
            doc.getElementById(
                "countdownText"
            );

        const progress =
            doc.getElementById(
                "progressBar"
            );

        const status =
            doc.getElementById(
                "refreshStatus"
            );

        const liveDot =
            doc.getElementById(
                "liveDot"
            );

        const liveText =
            doc.getElementById(
                "liveText"
            );

        const updateTime =
            doc.getElementById(
                "updateTime"
            );

        liveDot?.classList.remove(
            "fetching",
            "error"
        );

        if (state.isFetchingMain) {
            if (countdown) {
                countdown.textContent =
                    "正在刷新…";
            }

            if (status) {
                status.textContent =
                    "正在请求最新数据";
            }

            if (liveText) {
                liveText.textContent =
                    "正在获取数据";
            }

            liveDot?.classList.add(
                "fetching"
            );

            progress?.classList.add(
                "fetching"
            );

            return;
        }

        progress?.classList.remove(
            "fetching"
        );

        if (state.lastError) {
            if (liveText) {
                liveText.textContent =
                    "获取失败";
            }

            liveDot?.classList.add(
                "error"
            );
        } else if (liveText) {
            liveText.textContent =
                "监控运行中";
        }

        const remaining =
            state.nextRefreshAt
                ? Math.max(
                    0,
                    state.nextRefreshAt -
                    Date.now()
                )
                : 0;

        if (countdown) {
            countdown.textContent =
                state.nextRefreshAt
                    ? `${(
                        remaining /
                        1000
                    ).toFixed(1)} 秒后刷新`
                    : "准备刷新";
        }

        if (progress) {
            const ratio =
                state.currentDelay > 0
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            remaining /
                            state.currentDelay
                        )
                    )
                    : 0;

            progress.style.transform =
                `scaleX(${ratio})`;
        }

        if (status) {
            if (state.lastError) {
                status.textContent =
                    "上次获取失败，将自动重试";
            } else if (state.lastSuccessAt) {
                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            state.lastSuccessAt
                        ) /
                        1000
                    );

                status.textContent =
                    seconds <= 1
                        ? "刚刚获取成功"
                        : `${seconds} 秒前获取成功`;
            } else {
                status.textContent =
                    "等待首次获取";
            }
        }

        if (updateTime) {
            updateTime.textContent =
                state.lastSuccessAt
                    ? new Date(
                        state.lastSuccessAt
                    ).toLocaleTimeString()
                    : "--";
        }
    }

    function updateMonitorView() {
        if (
            state.view.mode !==
            "monitor"
        ) {
            return;
        }

        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const data =
            state.lastData;

        const monthBadge =
            doc.getElementById(
                "monthBadge"
            );

        if (monthBadge) {
            monthBadge.textContent =
                data
                    ? `${data.latestMonth}｜环比 ${data.previousMonth}`
                    : "等待获取";
        }

        const rulePrefixText =
            doc.getElementById(
                "rulePrefixText"
            );

        if (rulePrefixText) {
            rulePrefixText.textContent =
                state.settings
                    .excludedEmployeePrefixes
                    .join("、") ||
                "无";
        }

        updateMonitorCard(
            "sv",
            data?.SV
        );

        updateMonitorCard(
            "cfc",
            data?.CFC
        );

        updateLatestChangePanel();
        updateMonitorRefreshUi();
    }

    /* =========================================================
     * 15. 详情筛选与表格
     * ========================================================= */

    function getDisplayedRows(
        restaurantName
    ) {
        return (
            state.detail[restaurantName]
                .displayedRows || []
        );
    }

    function getDisplayedAudit(
        restaurantName
    ) {
        return state.detail[
            restaurantName
        ].displayedAudit;
    }

    function getFilteredDetailRows(
        restaurantName
    ) {
        let rows =
            getDisplayedRows(
                restaurantName
            ).slice();

        switch (state.view.filter) {
            case "included":
                rows =
                    rows.filter(
                        row => !row.isExcluded
                    );
                break;

            case "perfect":
                rows =
                    rows.filter(
                        row =>
                            !row.isExcluded &&
                            row.isPerfect
                    );
                break;

            case "critical":
                rows =
                    rows.filter(
                        row =>
                            !row.isExcluded &&
                            !row.isPerfect &&
                            row.hasCriticalScore &&
                            !row.hasInvalid &&
                            row.validScoreCount > 0
                    );
                break;

            case "secondary":
                rows =
                    rows.filter(
                        row =>
                            !row.isExcluded &&
                            !row.isPerfect &&
                            !row.hasCriticalScore &&
                            !row.hasInvalid &&
                            row.validScoreCount > 0
                    );
                break;

            case "excluded":
                rows =
                    rows.filter(
                        row => row.isExcluded
                    );
                break;

            default:
                break;
        }

        const keyword =
            normalizeText(
                state.view.search
            );

        if (keyword) {
            rows =
                rows.filter(row =>
                    [
                        row.feedbackBy,
                        row.feedbackType,
                        row.feedbackTime,
                        row.openQuestion,
                        row.excludedReason,

                        ...Object.values(
                            row.comments
                        )
                    ].some(value =>
                        normalizeText(value)
                            .includes(keyword)
                    )
                );
        }

        switch (state.view.sort) {
            case "time":
                rows.sort(
                    (a, b) =>
                        String(
                            b.feedbackTime
                        ).localeCompare(
                            String(
                                a.feedbackTime
                            )
                        )
                );
                break;

            case "averageAsc":
                rows.sort(
                    (a, b) =>
                        (
                            a.average ??
                            Infinity
                        ) -
                        (
                            b.average ??
                            Infinity
                        )
                );
                break;

            case "averageDesc":
                rows.sort(
                    (a, b) =>
                        (
                            b.average ??
                            -Infinity
                        ) -
                        (
                            a.average ??
                            -Infinity
                        )
                );
                break;

            default:
                rows.sort(
                    (a, b) =>
                        (
                            b.impact ?? 0
                        ) -
                        (
                            a.impact ?? 0
                        )
                );
                break;
        }

        return rows;
    }

    function getScoreCellClass(score) {
        if (!Number.isFinite(score)) {
            return "score-empty";
        }

        if (score === 5) {
            return "score-five";
        }

        if (
            score >= 1 &&
            score <= 5
        ) {
            return score <= 3
                ? "score-low"
                : "score-nonfive";
        }

        return "score-invalid";
    }

    function getRowComment(row) {
        return (
            row.openQuestion ||
            Object.values(
                row.comments
            )
                .filter(Boolean)
                .join("；")
        );
    }

    function renderDetailTableRows(
        restaurantName
    ) {
        const rows =
            getFilteredDetailRows(
                restaurantName
            );

        if (!rows.length) {
            return `
        <tr>
          <td
            colspan="13"
            class="empty-row"
          >
            当前筛选条件下没有数据
          </td>
        </tr>
      `;
        }

        return rows.map(row => {
            const scoreCells =
                [
                    row.scores.safety,
                    row.scores.service,
                    row.scores.activity,
                    row.scores.environment,
                    row.scores.dish
                ]
                    .map(
                        score => `
              <td
                class="${getScoreCellClass(
                            score
                        )}"
              >
                ${Number.isFinite(score)
                                ? score
                                : "-"
                            }
              </td>
            `
                    )
                    .join("");

            const rowClass =
                row.isExcluded
                    ? "excluded-row"
                    : row.hasInvalid ||
                        row.validScoreCount === 0
                        ? "abnormal-row"
                        : row.isPerfect
                            ? "perfect-row"
                            : "non-perfect-row";

            const percentage =
                row.maximum > 0
                    ? (
                        row.sum /
                        row.maximum
                    ) * 100
                    : null;

            return `
        <tr class="${rowClass}">
          <td>
            ${escapeHtml(
                row.feedbackBy
            )}
          </td>

          <td>
            ${escapeHtml(
                row.feedbackType
            )}
          </td>

          <td class="time-cell">
            ${escapeHtml(
                row.feedbackTime
            )}
          </td>

          ${scoreCells}

          <td class="mono">
            ${formatScore(
                row.average
            )}
          </td>

          <td class="mono">
            ${formatScore(
                percentage
            )}
          </td>

          <td class="mono impact-cell">
            ${row.isExcluded
                    ? "--"
                    : Number.isFinite(
                        row.impact
                    )
                        ? `-${row.impact.toFixed(
                            4
                        )}`
                        : "--"
                }
          </td>

          <td>
            ${row.isExcluded
                    ? `
                  <span class="excluded-tag">
                    已排除
                  </span>
                  ${escapeHtml(
                        row.excludedReason
                    )}
                `
                    : "计入复核"
                }
          </td>

          <td
            class="comment-cell"
            title="${escapeHtml(
                    getRowComment(row)
                )}"
          >
            ${escapeHtml(
                    getRowComment(row)
                )}
          </td>
        </tr>
      `;
        }).join("");
    }

    /* =========================================================
     * 16. 详情页面状态
     * ========================================================= */

    function updateDetailStatusOnly() {
        if (
            state.view.mode !==
            "detail"
        ) {
            return;
        }

        const restaurantName =
            state.view.restaurant;

        const detailState =
            state.detail[
            restaurantName
            ];

        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const statusDot =
            doc.getElementById(
                "detailLiveDot"
            );

        const statusText =
            doc.getElementById(
                "detailLiveText"
            );

        const backgroundTime =
            doc.getElementById(
                "detailBackgroundTime"
            );

        const updateBanner =
            doc.getElementById(
                "detailUpdateBanner"
            );

        const updateBannerText =
            doc.getElementById(
                "detailUpdateText"
            );

        statusDot?.classList.remove(
            "fetching",
            "error"
        );

        if (detailState.loading) {
            statusDot?.classList.add(
                "fetching"
            );

            if (statusText) {
                statusText.textContent =
                    "后台正在获取最新详表";
            }
        } else if (
            detailState.lastError
        ) {
            statusDot?.classList.add(
                "error"
            );

            if (statusText) {
                statusText.textContent =
                    `后台更新失败：${detailState.lastError.message}`;
            }
        } else if (statusText) {
            statusText.textContent =
                "后台监控持续运行，不会自动刷新当前表格";
        }

        if (backgroundTime) {
            backgroundTime.textContent =
                detailState.lastFetchAt
                    ? `后台最新：${formatDateTime(
                        detailState.lastFetchAt
                    )}`
                    : "后台尚未获取";
        }

        if (updateBanner) {
            updateBanner.hidden =
                !detailState.pendingViewUpdate;
        }

        if (
            updateBannerText &&
            detailState.pendingViewUpdate
        ) {
            const changes =
                detailState.lastChanges;

            const summary = [];

            if (
                Number.isFinite(
                    changes?.scoreBefore
                ) &&
                Number.isFinite(
                    changes?.scoreAfter
                ) &&
                changes.scoreBefore !==
                changes.scoreAfter
            ) {
                summary.push(
                    `系统分数 ${formatScore(
                        changes.scoreBefore
                    )} → ${formatScore(
                        changes.scoreAfter
                    )}`
                );
            }

            if (changes?.totalChanges) {
                summary.push(
                    `新增 ${changes.added.length}、修改 ${changes.changed.length}、删除 ${changes.removed.length}`
                );
            }

            updateBannerText.textContent =
                summary.length
                    ? summary.join("｜")
                    : "后台已获取到新数据";
        }

        const liveSystemScore =
            doc.getElementById(
                "liveSystemScore"
            );

        if (liveSystemScore) {
            liveSystemScore.textContent =
                formatScore(
                    state.lastData?.[
                        restaurantName
                    ]?.score
                );
        }
    }

    function saveDetailScrollPosition() {
        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const body =
            doc.getElementById(
                "detailBody"
            );

        const tableWrap =
            doc.getElementById(
                "detailTableWrap"
            );

        state.view.bodyScrollTop =
            body?.scrollTop || 0;

        state.view.tableScrollTop =
            tableWrap?.scrollTop || 0;

        state.view.tableScrollLeft =
            tableWrap?.scrollLeft || 0;
    }

    function restoreDetailScrollPosition() {
        const doc =
            state.pipWindow?.document;

        if (!doc) {
            return;
        }

        const body =
            doc.getElementById(
                "detailBody"
            );

        const tableWrap =
            doc.getElementById(
                "detailTableWrap"
            );

        if (body) {
            body.scrollTop =
                state.view.bodyScrollTop;
        }

        if (tableWrap) {
            tableWrap.scrollTop =
                state.view.tableScrollTop;

            tableWrap.scrollLeft =
                state.view.tableScrollLeft;
        }
    }

    function renderAuditMethods(audit) {
        if (!audit) {
            return "";
        }

        return audit.methods.map(method => {
            const isClosest =
                audit.closestMethod?.key ===
                method.key;

            return `
        <div class="method-row ${isClosest
                    ? "closest-method"
                    : ""
                }">
          <span>
            ${escapeHtml(
                    method.name
                )}
          </span>

          <strong class="mono">
            ${formatScore(
                    method.rounded
                )}
          </strong>

          <span class="mono method-diff">
            ${Number.isFinite(
                    method.difference
                )
                    ? `差 ${method.difference.toFixed(
                        2
                    )}`
                    : "--"
                }
          </span>

          ${isClosest
                    ? `
                <span class="method-tag">
                  最接近系统
                </span>
              `
                    : ""
                }
        </div>
      `;
        }).join("");
    }

    /* =========================================================
     * 17. 详情页面
     * ========================================================= */

    function renderDetailView(
        restaurantName,
        options = {}
    ) {
        const {
            preserveScroll = false
        } = options;

        const pipWindow =
            state.pipWindow;

        if (!pipWindow || pipWindow.closed) {
            return;
        }

        if (preserveScroll) {
            saveDetailScrollPosition();
        }

        state.view.mode = "detail";
        state.view.restaurant =
            restaurantName;

        const detailState =
            state.detail[
            restaurantName
            ];

        const restaurant =
            state.lastData?.[
            restaurantName
            ];

        const audit =
            getDisplayedAudit(
                restaurantName
            );

        const rows =
            getDisplayedRows(
                restaurantName
            );

        const doc =
            pipWindow.document;

        installBaseStyles(doc);

        doc.title =
            `${restaurantName} 满意度详表复核`;

        doc.head.insertAdjacentHTML(
            "beforeend",
            `
        <style>
          .detail-layout {
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          .detail-toolbar {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 11px 14px;
            border-bottom:
              1px solid #e4e7ec;
          }

          .toolbar-left,
          .toolbar-right {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .detail-title {
            font-size: 16px;
            font-weight: 700;
          }

          .detail-subtitle {
            color: #667085;
            font-size: 10px;
          }

          .background-status {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #667085;
            font-size: 10px;
          }

          .detail-body {
            flex: 1;
            min-height: 0;
            overflow: auto;
            padding: 12px 14px 14px;
          }

          .update-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
            padding: 9px 11px;
            border:
              1px solid #9ec5ff;
            border-radius: 11px;
            color: #095cbb;
            background: #edf5ff;
            font-size: 11px;
          }

          .update-banner[hidden] {
            display: none;
          }

          .update-banner-title {
            font-weight: 700;
          }

          .audit-grid {
            display: grid;
            grid-template-columns:
              repeat(
                4,
                minmax(0,1fr)
              );
            gap: 10px;
          }

          .audit-card {
            padding: 10px 12px;
            border:
              1px solid #e4e7ec;
            border-radius: 12px;
            background: #f9fafb;
          }

          .audit-card.match {
            border-color: #b7e4c7;
            background: #f2fbf5;
          }

          .audit-card.mismatch {
            border-color: #f7c1bc;
            background: #fff4f3;
          }

          .audit-label {
            color: #667085;
            font-size: 10px;
          }

          .audit-value {
            margin-top: 3px;
            font-size: 22px;
            font-weight: 750;
          }

          .audit-note {
            margin-top: 3px;
            color: #98a2b3;
            font-size: 9px;
          }

          .calculation-grid {
            display: grid;
            grid-template-columns:
              1.15fr 1fr;
            gap: 10px;
            margin-top: 10px;
          }

          .calculation-panel,
          .method-panel {
            padding: 11px 12px;
            border:
              1px solid #e4e7ec;
            border-radius: 12px;
            background: #fff;
          }

          .panel-title {
            margin-bottom: 7px;
            color: #344054;
            font-size: 11px;
            font-weight: 700;
          }

          .formula {
            padding: 9px 10px;
            border-radius: 9px;
            color: #344054;
            background: #f8fafc;
            font-size: 11px;
            line-height: 1.65;
          }

          .formula strong {
            color: #1677ff;
          }

          .method-row {
            display: grid;
            grid-template-columns:
              1fr 60px 70px auto;
            align-items: center;
            gap: 8px;
            padding: 6px 7px;
            border-radius: 8px;
            font-size: 10px;
          }

          .closest-method {
            background: #edf6ff;
          }

          .method-diff {
            color: #667085;
          }

          .method-tag {
            padding: 2px 5px;
            border-radius: 999px;
            color: #095cbb;
            background: #dceeff;
            font-size: 8px;
          }

          .dimension-row {
            display: grid;
            grid-template-columns:
              70px 60px 60px 1fr;
            gap: 8px;
            margin-top: 5px;
            font-size: 10px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns:
              repeat(6,1fr);
            gap: 6px;
            margin-top: 8px;
            font-size: 10px;
          }

          .summary-item {
            padding: 6px 7px;
            border-radius: 8px;
            background: #f8fafc;
          }

          .rule-summary {
            margin-top: 8px;
            padding: 8px 9px;
            border:
              1px solid #e4e7ec;
            border-radius: 9px;
            color: #667085;
            background: #fff;
            font-size: 10px;
          }

          .data-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 12px;
            padding: 9px 10px;
            border:
              1px solid #e4e7ec;
            border-radius:
              12px 12px 0 0;
            background: #f9fafb;
          }

          .filter-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
          }

          .filter-button {
            border:
              1px solid #d0d5dd;
            border-radius: 999px;
            padding: 4px 8px;
            color: #475467;
            background: #fff;
            font-size: 10px;
          }

          .filter-button.active {
            border-color: #1677ff;
            color: #095cbb;
            background: #eaf3ff;
          }

          .control-right {
            display: flex;
            align-items: center;
            gap: 7px;
          }

          .search-input,
          .sort-select {
            height: 29px;
            border:
              1px solid #d0d5dd;
            border-radius: 8px;
            padding: 0 8px;
            color: #344054;
            background: #fff;
            font-size: 10px;
          }

          .search-input {
            width: 180px;
          }

          .table-wrap {
            max-height: 430px;
            overflow: auto;
            border:
              1px solid #e4e7ec;
            border-top: 0;
            border-radius:
              0 0 12px 12px;
          }

          table {
            width: 100%;
            min-width: 1120px;
            border-collapse: collapse;
            font-size: 10px;
          }

          th,
          td {
            padding: 7px 8px;
            border-bottom:
              1px solid #eef0f2;
            text-align: left;
            white-space: nowrap;
          }

          th {
            position: sticky;
            top: 0;
            z-index: 3;
            color: #475467;
            background: #f2f4f7;
            font-weight: 700;
          }

          td:nth-child(n+4):nth-child(-n+11),
          th:nth-child(n+4):nth-child(-n+11) {
            text-align: center;
          }

          .perfect-row {
            background: #f4fbf6;
          }

          .non-perfect-row {
            background: #fffaf0;
          }

          .abnormal-row {
            background: #fff1f0;
          }

          .excluded-row {
            color: #667085;
            background: #f2f4f7;
          }

          .excluded-row td {
            opacity: 0.82;
          }

          .excluded-tag {
            display: inline-block;
            margin-right: 4px;
            padding: 2px 5px;
            border-radius: 999px;
            color: #475467;
            background: #d0d5dd;
            font-size: 8px;
            font-weight: 700;
          }

          .score-five {
            color: #138a4b;
            font-weight: 700;
          }

          .score-nonfive {
            color: #b54708;
            font-weight: 700;
          }

          .score-low,
          .score-invalid {
            color: #d92d20;
            font-weight: 800;
          }

          .score-empty {
            color: #98a2b3;
          }

          .time-cell {
            color: #667085;
          }

          .impact-cell {
            color: #d92d20;
          }

          .comment-cell {
            max-width: 260px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .empty-row {
            height: 100px;
            text-align: center;
            color: #98a2b3;
          }

          .detail-loading {
            padding: 70px 20px;
            text-align: center;
            color: #667085;
          }

          @media (max-width: 850px) {
            .audit-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(0,1fr)
                );
            }

            .calculation-grid {
              grid-template-columns: 1fr;
            }

            .summary-grid {
              grid-template-columns:
                repeat(3,1fr);
            }

            .data-controls {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        </style>
      `
        );

        if (
            detailState.loading &&
            !rows.length
        ) {
            doc.body.innerHTML = `
        <div class="app-shell">
          <div class="detail-layout">
            <div class="detail-toolbar">
              <div class="toolbar-left">
                <button
                  class="button"
                  id="backButton"
                  type="button"
                >
                  ← 返回监控
                </button>

                <div>
                  <div class="detail-title">
                    ${restaurantName} 满意度详表
                  </div>

                  <div class="detail-subtitle">
                    正在获取并解析本月 Excel
                  </div>
                </div>
              </div>
            </div>

            <div class="detail-loading">
              正在获取评分详表并自动复核……
            </div>
          </div>
        </div>
      `;

            doc
                .getElementById(
                    "backButton"
                )
                ?.addEventListener(
                    "click",
                    event => {
                        const sourceDocument =
                            event.currentTarget
                                .ownerDocument;

                        resizeFloatWindow(
                            "monitor",
                            sourceDocument
                        );

                        renderMonitorView();
                    }
                );

            return;
        }

        const dimensionNames = {
            safety: "食品安全",
            service: "供餐服务",
            activity: "活动",
            environment: "餐具环境",
            dish: "菜品出品"
        };

        const dimensionRows =
            audit
                ? Object.entries(
                    audit.dimensionStats
                ).map(
                    ([key, stat]) => `
              <div class="dimension-row">
                <span>
                  ${dimensionNames[key]}
                </span>

                <span>
                  ${stat.count}项
                </span>

                <span class="mono">
                  ${formatScore(
                        stat.average
                    )}
                </span>

                <span class="mono">
                  ${Number.isFinite(
                        stat.average
                    )
                            ? `${(
                                (
                                    stat.average /
                                    5
                                ) *
                                100
                            ).toFixed(2)}%`
                            : "--"
                        }
                </span>
              </div>
            `
                ).join("")
                : "";

        const statusClass =
            audit?.status === "一致" ||
                audit?.status === "基本一致"
                ? "match"
                : "mismatch";

        doc.body.innerHTML = `
      <div class="app-shell">
        <div class="detail-layout">
          <div class="detail-toolbar">
            <div class="toolbar-left">
              <button
                class="button"
                id="backButton"
                type="button"
              >
                ← 返回监控
              </button>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="detail-title">
                    ${restaurantName} 餐厅 · 满意度复核
                  </div>
                  <select id="detailMonthSelect" style="padding: 2px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; background: white;">
                    ${(state.lastData?.months || [state.view.month || state.lastData?.latestMonth]).filter(Boolean).map(m => `<option value="${m}" ${m === (state.view.month || state.lastData?.latestMonth) ? 'selected' : ''}>${m}</option>`).join('')}
                  </select>
                </div>

                <div class="detail-subtitle">
                  · 当前展示快照：
                  ${formatDateTime(
                detailState
                    .displayedFetchAt
            )}
                </div>
              </div>
            </div>

            <div class="toolbar-right">
              <div class="background-status">
                <span
                  class="dot"
                  id="detailLiveDot"
                ></span>

                <span
                  id="detailLiveText"
                >
                  后台监控持续运行
                </span>
              </div>

              <button
                class="button"
                id="detailSettingsButton"
                type="button"
              >
                ⚙ 设置
              </button>

              <button
                class="button"
                id="refreshDetailButton"
                type="button"
              >
                手动刷新详表
              </button>
            </div>
          </div>

          <div
            class="detail-body"
            id="detailBody"
          >
            <div
              class="update-banner"
              id="detailUpdateBanner"
              ${detailState
                .pendingViewUpdate
                ? ""
                : "hidden"
            }
            >
              <div>
                <div class="update-banner-title">
                  后台发现新数据
                </div>

                <div id="detailUpdateText">
                  点击右侧按钮后更新当前表格
                </div>
              </div>

              <button
                class="button primary-button"
                id="applyLatestButton"
                type="button"
              >
                应用最新数据
              </button>
            </div>

            <div class="audit-grid">
              <div class="audit-card">
                <div class="audit-label">
                  当前展示的系统分数
                </div>

                <div class="audit-value mono">
                  ${formatScore(
                audit?.systemScore
            )}
                </div>

                <div class="audit-note">
                  后台最新：
                  <strong
                    class="mono"
                    id="liveSystemScore"
                  >
                    ${formatScore(
                restaurant?.score
            )}
                  </strong>
                </div>
              </div>

              <div class="audit-card ${statusClass}">
                <div class="audit-label">
                  排除规则后复核分数
                </div>

                <div class="audit-value mono" style="display: flex; align-items: baseline; gap: 8px;">
                  ${formatScore(
                audit?.reviewedScore
            )}
                  ${audit?.gapToTarget > 0 ? `<span style="color: #ff4d4f; font-size: 13px; font-weight: normal; font-family: sans-serif;">(距${state.settings.targetScore}分差 ${audit.gapToTarget} 个全5)</span>` : ''}
                </div>

                <div class="audit-note">
                  ${audit
                ?.closestMethod
                ?.name ||
            "暂无"
            }
                </div>
              </div>

              <div class="audit-card ${statusClass}">
                <div class="audit-label">
                  差异
                </div>

                <div class="audit-value mono">
                  ${Number.isFinite(
                audit?.difference
            )
                ? (
                    audit.difference > 0
                        ? "+"
                        : ""
                ) +
                audit.difference.toFixed(
                    4
                )
                : "--"
            }
                </div>

                <div class="audit-note">
                  复核分数 − 系统分数
                </div>
              </div>

              <div class="audit-card ${statusClass}">
                <div class="audit-label">
                  复核结论
                </div>

                <div class="audit-value">
                  ${escapeHtml(
                audit?.status ||
                "无法判断"
            )}
                </div>

                <div class="audit-note">
                  当前排除规则下的结果
                </div>
              </div>
            </div>

            <div class="data-controls">
              <div class="filter-tabs">
                <button
                  class="filter-button"
                  data-filter="all"
                  type="button"
                >
                  全部
                  ${audit
                ?.originalRowCount ??
            0
            }
                </button>

                <button
                  class="filter-button"
                  data-filter="included"
                  type="button"
                >
                  计入复核
                  ${audit
                ?.includedRowCount ??
            0
            }
                </button>

                <button
                  class="filter-button"
                  data-filter="perfect"
                  type="button"
                >
                  全五分
                  ${audit
                ?.perfectCount ??
            0
            }
                </button>

                <button
                  class="filter-button"
                  data-filter="critical"
                  type="button"
                >
                  重点关注 (≤3分)
                  ${audit
                ?.criticalCount ??
            0
            }
                </button>

                <button
                  class="filter-button"
                  data-filter="secondary"
                  type="button"
                >
                  次重点 (4分)
                  ${audit
                ?.secondaryCount ??
            0
            }
                </button>

                <button
                  class="filter-button"
                  data-filter="excluded"
                  type="button"
                >
                  已排除
                  ${audit
                ?.excludedRowCount ??
            0
            }
                </button>
              </div>

              <div class="control-right">
                <input
                  class="search-input"
                  id="detailSearch"
                  type="search"
                  placeholder="搜索反馈人/类型/意见"
                  value="${escapeHtml(
                state.view.search
            )}"
                >

                <select
                  class="sort-select"
                  id="detailSort"
                >
                  <option value="impact">
                    按影响从高到低
                  </option>

                  <option value="time">
                    按反馈时间
                  </option>

                  <option value="averageAsc">
                    按平均分升序
                  </option>

                  <option value="averageDesc">
                    按平均分降序
                  </option>
                </select>
              </div>
            </div>

            <div
              class="table-wrap"
              id="detailTableWrap"
            >
              <table>
                <thead>
                  <tr>
                    <th>反馈人</th>
                    <th>类型</th>
                    <th>反馈时间</th>
                    <th>安全</th>
                    <th>服务</th>
                    <th>活动</th>
                    <th>环境</th>
                    <th>菜品</th>
                    <th>平均分</th>
                    <th>折算百分</th>
                    <th>拉低总分</th>
                    <th>复核状态</th>
                    <th>意见 / 心愿美食</th>
                  </tr>
                </thead>

                <tbody id="detailTableBody">
                  ${renderDetailTableRows(
                restaurantName
            )}
                </tbody>
              </table>
            </div>

            <div class="calculation-grid" style="margin-top: 16px;">
              <div class="calculation-panel">
                <div class="panel-title">
                  计算过程
                </div>

                <div class="formula mono">
                  原始反馈：
                  <strong>
                    ${audit
                ?.originalRowCount ??
            0
            }
                  </strong>
                  <br>

                  排除反馈：
                  <strong>
                    ${audit
                ?.excludedRowCount ??
            0
            }
                  </strong>
                  <br>

                  计入复核：
                  <strong>
                    ${audit
                ?.includedRowCount ??
            0
            }
                  </strong>
                  <br>

                  有效问卷：
                  <strong>
                    ${audit
                ?.validQuestionnaires ??
            0
            }
                  </strong>
                  <br>

                  有效评分项：
                  <strong>
                    ${audit
                ?.totalValidItems ??
            0
            }
                  </strong>
                  <br>

                  实际总分：
                  <strong>
                    ${audit
                ?.totalActualScore ??
            0
            }
                  </strong>
                  <br>

                  理论满分：
                  <strong>
                    ${audit
                ?.totalMaximumScore ??
            0
            }
                  </strong>
                  <br><br>

                  ${audit
                ?.totalMaximumScore
                ? `
                        ${audit.totalActualScore}
                        ÷
                        ${audit.totalMaximumScore}
                        × 100
                        =
                        ${audit.itemWeighted.toFixed(
                    6
                )}
                        <br>
                        保留两位小数：
                        <strong>
                          ${formatScore(
                    round(
                        audit.itemWeighted,
                        2
                    )
                )}
                        </strong>
                      `
                : "暂无有效评分"
            }
                </div>

                <div class="summary-grid">
                  <div class="summary-item">
                    原始
                    <strong>
                      ${audit
                ?.originalRowCount ??
            0
            }
                    </strong>
                  </div>

                  <div class="summary-item">
                    计入
                    <strong>
                      ${audit
                ?.includedRowCount ??
            0
            }
                    </strong>
                  </div>

                  <div class="summary-item good">
                    全五分
                    <strong>
                      ${audit
                ?.perfectCount ??
            0
            }
                    </strong>
                  </div>

                  <div class="summary-item bad">
                    重点关注
                    <strong>
                      ${audit
                ?.criticalCount ??
            0
            }
                    </strong>
                  </div>

                  <div class="summary-item warning">
                    次重点
                    <strong>
                      ${audit
                ?.secondaryCount ??
            0
            }
                    </strong>
                  </div>

                  <div class="summary-item muted">
                    已排除
                    <strong>
                      ${audit
                ?.excludedRowCount ??
            0
            }
                    </strong>
                  </div>
                </div>

                <div class="rule-summary">
                  当前排除工号前缀：
                  <strong>
                    ${escapeHtml(
                audit
                    ?.excludedPrefixes
                    ?.join("、") ||
                "无"
            )}
                  </strong>
                </div>
              </div>

              <div class="method-panel">
                <div class="panel-title">
                  多种计算口径对比
                </div>

                ${renderAuditMethods(
                audit
            )}

                <div
                  class="panel-title"
                  style="margin-top:10px;"
                >
                  五个维度
                </div>

                ${dimensionRows}
              </div>
            </div>

            <div
              class="detail-subtitle"
              id="detailBackgroundTime"
              style="margin-top:8px;"
            >
              后台最新：
              ${formatDateTime(
                detailState.lastFetchAt
            )}
            </div>
          </div>
        </div>
      </div>
    `;

        doc
            .getElementById(
                "detailMonthSelect"
            )
            ?.addEventListener(
                "change",
                async (event) => {
                    const selectedMonth = event.target.value;
                    const detailState = state.detail[restaurantName];
                    const restaurant = state.lastData?.[restaurantName];

                    // Reset initialized so it forces a fetch for the new month
                    detailState.initialized = false;
                    
                    await openDetailView(restaurantName, selectedMonth);
                }
            );

        doc
            .getElementById(
                "backButton"
            )
            ?.addEventListener(
                "click",
                event => {
                    const sourceDocument =
                        event.currentTarget
                            .ownerDocument;

                    resizeFloatWindow(
                        "monitor",
                        sourceDocument
                    );

                    renderMonitorView();
                }
            );

        doc
            .getElementById(
                "detailSettingsButton"
            )
            ?.addEventListener(
                "click",
                openSettingsDialog
            );

        doc
            .getElementById(
                "refreshDetailButton"
            )
            ?.addEventListener(
                "click",
                async () => {
                    saveDetailScrollPosition();

                    await refreshRestaurantDetail(
                        restaurantName,
                        state.lastData?.[
                        restaurantName
                        ],
                        "manual",
                        detailState.lastScore,
                        {
                            applyImmediately: true,
                            userRequested: true
                        }
                    );

                    renderDetailView(
                        restaurantName
                    );

                    restoreDetailScrollPosition();
                }
            );

        doc
            .getElementById(
                "applyLatestButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    saveDetailScrollPosition();

                    detailState.displayedRows =
                        detailState.rows.slice();

                    detailState.displayedAudit =
                        detailState.audit;

                    detailState.displayedFetchAt =
                        detailState.lastFetchAt;

                    detailState.pendingViewUpdate =
                        false;

                    renderDetailView(
                        restaurantName
                    );

                    restoreDetailScrollPosition();
                }
            );

        doc
            .querySelectorAll(
                "[data-filter]"
            )
            .forEach(button => {
                const filter =
                    button.dataset.filter;

                button.classList.toggle(
                    "active",
                    filter === state.view.filter
                );

                button.addEventListener(
                    "click",
                    () => {
                        state.view.filter =
                            filter;

                        updateDetailTableOnly(
                            restaurantName
                        );

                        doc
                            .querySelectorAll(
                                "[data-filter]"
                            )
                            .forEach(item => {
                                item.classList.toggle(
                                    "active",
                                    item.dataset.filter ===
                                    filter
                                );
                            });
                    }
                );
            });

        const sortSelect =
            doc.getElementById(
                "detailSort"
            );

        if (sortSelect) {
            sortSelect.value =
                state.view.sort;

            sortSelect.addEventListener(
                "change",
                event => {
                    state.view.sort =
                        event.target.value;

                    updateDetailTableOnly(
                        restaurantName
                    );
                }
            );
        }

        const searchInput =
            doc.getElementById(
                "detailSearch"
            );

        let searchTimer = null;

        searchInput?.addEventListener(
            "input",
            event => {
                clearTimeout(searchTimer);

                searchTimer =
                    setTimeout(
                        () => {
                            state.view.search =
                                event.target.value;

                            updateDetailTableOnly(
                                restaurantName
                            );
                        },
                        180
                    );
            }
        );

        const detailBody =
            doc.getElementById(
                "detailBody"
            );

        detailBody?.addEventListener(
            "scroll",
            () => {
                state.view.bodyScrollTop =
                    detailBody.scrollTop;
            },
            { passive: true }
        );

        const tableWrap =
            doc.getElementById(
                "detailTableWrap"
            );

        tableWrap?.addEventListener(
            "scroll",
            () => {
                state.view.tableScrollTop =
                    tableWrap.scrollTop;

                state.view.tableScrollLeft =
                    tableWrap.scrollLeft;
            },
            { passive: true }
        );

        if (preserveScroll) {
            restoreDetailScrollPosition();
        }

        updateDetailStatusOnly();
    }

    function updateDetailTableOnly(
        restaurantName
    ) {
        const doc =
            state.pipWindow?.document;

        const tableWrap =
            doc?.getElementById(
                "detailTableWrap"
            );

        const body =
            doc?.getElementById(
                "detailTableBody"
            );

        if (!body) {
            return;
        }

        const scrollTop =
            tableWrap?.scrollTop || 0;

        const scrollLeft =
            tableWrap?.scrollLeft || 0;

        body.innerHTML =
            renderDetailTableRows(
                restaurantName
            );

        if (tableWrap) {
            tableWrap.scrollTop =
                scrollTop;

            tableWrap.scrollLeft =
                scrollLeft;
        }
    }

    async function openDetailView(
        restaurantName,
        targetMonth = null
    ) {
        state.view.mode = "detail";
        state.view.restaurant = restaurantName;
        state.view.month = targetMonth || state.view.month || state.lastData?.latestMonth;

        state.view.filter =
            "critical";

        state.view.sort =
            "impact";

        state.view.search = "";
        state.view.bodyScrollTop = 0;
        state.view.tableScrollTop = 0;
        state.view.tableScrollLeft = 0;

        const detailState =
            state.detail[
            restaurantName
            ];

        const restaurant =
            state.lastData?.[
            restaurantName
            ];

        renderDetailView(
            restaurantName
        );

        if (
            !detailState.initialized &&
            !detailState.loading &&
            restaurant
        ) {
            await refreshRestaurantDetail(
                restaurantName,
                restaurant,
                "initial_open",
                detailState.lastScore,
                {
                    applyImmediately: true,
                    userRequested: true
                }
            );

            renderDetailView(
                restaurantName
            );
        }
    }

    /* =========================================================
     * 18. 打开浮窗
     * ========================================================= */

    async function openFloatWindow() {
        if (state.pipWindow && !state.pipWindow.closed) {
            return;
        }

        try {
            const existing = document.getElementById('satisfaction-float-iframe');
            if (existing) existing.remove();
            const existingBtn = document.getElementById('satisfaction-float-close');
            if (existingBtn) existingBtn.remove();

            const iframe = document.createElement('iframe');
            iframe.id = 'satisfaction-float-iframe';
            Object.assign(iframe.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: CONFIG.monitorWindow.width + 'px',
                height: CONFIG.monitorWindow.height + 'px',
                border: '1px solid #ddd',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                borderRadius: '8px',
                zIndex: '999999',
                backgroundColor: '#fff'
            });
            document.body.appendChild(iframe);

            const pipWindow = iframe.contentWindow;
            pipWindow.focus = () => {};
            Object.defineProperty(pipWindow, 'closed', {
                get: () => !document.body.contains(iframe)
            });

            state.pipWindow = pipWindow;
            window.__SATISFACTION_FLOAT_WINDOW__ = pipWindow;

            // Wait for iframe document to be accessible
            await new Promise(resolve => setTimeout(resolve, 50));

            renderMonitorView();

            if (state.uiTimer) {
                clearInterval(state.uiTimer);
            }

            state.uiTimer = setInterval(() => {
                if (state.view.mode === "monitor") {
                    updateMonitorRefreshUi();
                } else {
                    updateDetailStatusOnly();
                }
            }, 200);

            const closeBtn = document.createElement('div');
            closeBtn.id = 'satisfaction-float-close';
            closeBtn.innerHTML = '×';
            Object.assign(closeBtn.style, {
                position: 'fixed',
                bottom: (20 + CONFIG.monitorWindow.height - 12) + 'px',
                right: '12px',
                width: '24px',
                height: '24px',
                background: '#ff4d4f',
                color: '#fff',
                textAlign: 'center',
                lineHeight: '22px',
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: '1000000',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            });

            const expandBtn = document.createElement('div');
            expandBtn.id = 'satisfaction-float-expand';
            expandBtn.innerHTML = '监控中';
            Object.assign(expandBtn.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: '60px',
                height: '60px',
                background: '#1677ff',
                color: '#fff',
                textAlign: 'center',
                lineHeight: '60px',
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: '1000000',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                display: 'none'
            });
            document.body.appendChild(expandBtn);

            const toggleMinimize = (minimized) => {
                if (minimized) {
                    iframe.style.display = 'none';
                    closeBtn.style.display = 'none';
                    expandBtn.style.display = 'block';
                } else {
                    iframe.style.display = 'block';
                    closeBtn.style.display = 'block';
                    expandBtn.style.display = 'none';
                }
            };
            expandBtn.onclick = () => toggleMinimize(false);

            closeBtn.onclick = () => {
                const dialogOverlay = document.createElement('div');
                Object.assign(dialogOverlay.style, {
                    position: 'fixed',
                    top: '0', left: '0', width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: '2000000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                });
                const dialogBox = document.createElement('div');
                Object.assign(dialogBox.style, {
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '24px',
                    width: '320px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                });
                dialogBox.innerHTML = `
                    <h3 style="margin:0 0 12px 0; font-size:18px; color:#1f2937; font-weight:600;">停止满意度监控</h3>
                    <p style="font-size:14px; color:#4b5563; margin:0 0 20px 0; line-height:1.5;">您要彻底停止运行还是仅仅最小化悬浮窗？</p>
                    <div style="display:flex; justify-content:flex-end; gap:12px;">
                        <button id="dlg-min-btn" style="padding:8px 16px; border:1px solid #d1d5db; background:#fff; border-radius:6px; cursor:pointer; font-size:14px; font-weight:500; color:#374151; transition:all 0.2s;">最小化窗口</button>
                        <button id="dlg-stop-btn" style="padding:8px 16px; border:none; background:#ef4444; color:#fff; border-radius:6px; cursor:pointer; font-size:14px; font-weight:500; transition:all 0.2s;">彻底停止</button>
                    </div>
                `;
                dialogOverlay.appendChild(dialogBox);
                document.body.appendChild(dialogOverlay);

                const minBtn = dialogBox.querySelector('#dlg-min-btn');
                const stopBtn = dialogBox.querySelector('#dlg-stop-btn');

                minBtn.onmouseover = () => minBtn.style.background = '#f9fafb';
                minBtn.onmouseout = () => minBtn.style.background = '#fff';
                
                stopBtn.onmouseover = () => stopBtn.style.background = '#dc2626';
                stopBtn.onmouseout = () => stopBtn.style.background = '#ef4444';

                stopBtn.onclick = () => {
                    dialogOverlay.remove();
                    if (window.stopSatisfactionMonitor) {
                        window.stopSatisfactionMonitor();
                    }
                };
                minBtn.onclick = () => {
                    dialogOverlay.remove();
                    toggleMinimize(true);
                };
            };
            document.body.appendChild(closeBtn);

        } catch (error) {
            console.warn("浮窗打开失败：", error);
        }
    }

    /* =========================================================
     * 19. 主循环
     * ========================================================= */

    async function runOnce() {
        if (!state.running) {
            return;
        }

        state.isFetchingMain = true;
        state.nextRefreshAt = 0;

        if (
            state.view.mode ===
            "monitor"
        ) {
            updateMonitorView();
        } else {
            updateDetailStatusOnly();
        }

        const previousData =
            state.lastData;

        try {
            const rows =
                await fetchAllRows();

            const data =
                extractData(rows);

            state.count++;
            state.allRows = rows;
            state.latestRows =
                data.latestRows;
            state.lastData = data;
            state.lastError = null;
            state.lastSuccessAt =
                Date.now();

            await handleAutomaticDetailRefresh(
                previousData,
                data
            );
        } catch (error) {
            state.lastError = error;

            console.error(
                `[${new Date().toLocaleTimeString()}] 获取满意度失败：`,
                error
            );
        } finally {
            state.isFetchingMain = false;

            const nextDelay =
                getRandomDelay();

            state.currentDelay =
                nextDelay;

            state.nextRefreshAt =
                Date.now() +
                nextDelay;

            if (
                state.view.mode ===
                "monitor"
            ) {
                updateMonitorView();
            } else {
                updateDetailStatusOnly();
            }

            if (state.running) {
                state.refreshTimer =
                    setTimeout(
                        runOnce,
                        nextDelay
                    );
            }
        }
    }

    /* =========================================================
     * 20. 控制台命令
     * ========================================================= */

    window.openSatisfactionFloatWindow =
        openFloatWindow;

    window.closeSatisfactionFloatWindow =
        () => {
            if (
                state.pipWindow &&
                !state.pipWindow.closed
            ) {
                state.pipWindow.close();
            }
        };

    window.openSatisfactionSettings =
        openSettingsDialog;

    window.getSatisfactionSettings =
        () => ({
            excludedEmployeePrefixes:
                state.settings
                    .excludedEmployeePrefixes
                    .slice()
        });

    window.setSatisfactionExcludedPrefixes =
        prefixes => {
            const normalized =
                Array.isArray(prefixes)
                    ? normalizePrefixList(prefixes)
                    : parsePrefixText(prefixes);

            state.settings
                .excludedEmployeePrefixes =
                normalized;

            saveSettings();
            recalculateAllAudits();

            if (
                state.view.mode ===
                "detail"
            ) {
                renderDetailView(
                    state.view.restaurant,
                    {
                        preserveScroll: true
                    }
                );
            } else {
                updateMonitorView();
            }

            console.log(
                "排除前缀已更新：",
                normalized
            );

            return normalized;
        };

    window.resetSatisfactionSettings =
        () => {
            state.settings = {
                excludedEmployeePrefixes:
                    DEFAULT_SETTINGS
                        .excludedEmployeePrefixes
                        .slice()
            };

            saveSettings();
            recalculateAllAudits();

            if (
                state.view.mode ===
                "detail"
            ) {
                renderDetailView(
                    state.view.restaurant,
                    {
                        preserveScroll: true
                    }
                );
            } else {
                updateMonitorView();
            }

            console.log(
                "满意度复核设置已恢复默认"
            );
        };

    window.openSatisfactionDetail =
        restaurantName => {
            const name =
                String(
                    restaurantName || "SV"
                ).toUpperCase();

            if (
                !["SV", "CFC"].includes(name)
            ) {
                console.error(
                    "只能填写 SV 或 CFC"
                );
                return;
            }

            /*
             * Console 不一定具备用户激活，
             * 因此只切换内容，不能保证自动放大。
             */
            return openDetailView(name);
        };

    window.backToSatisfactionMonitor =
        () => {
            renderMonitorView();

            console.log(
                "已返回监控界面。通过详情页左上角按钮返回时会自动缩小。"
            );
        };

    window.refreshSatisfactionDetails =
        async restaurantName => {
            const names =
                restaurantName
                    ? [
                        String(
                            restaurantName
                        ).toUpperCase()
                    ]
                    : ["SV", "CFC"];

            for (const name of names) {
                if (
                    !["SV", "CFC"].includes(name)
                ) {
                    console.error(
                        "只能填写 SV 或 CFC"
                    );
                    continue;
                }

                const restaurant =
                    state.lastData?.[name];

                if (!restaurant) {
                    console.warn(
                        `${name} 暂无主接口数据`
                    );
                    continue;
                }

                await refreshRestaurantDetail(
                    name,
                    restaurant,
                    "manual_console",
                    state.detail[name].lastScore,
                    {
                        applyImmediately: false,
                        userRequested: true
                    }
                );
            }
        };

    window.applyLatestSatisfactionDetail =
        restaurantName => {
            const name =
                String(
                    restaurantName ||
                    state.view.restaurant ||
                    "SV"
                ).toUpperCase();

            const detailState =
                state.detail[name];

            if (!detailState) {
                console.error(
                    "只能填写 SV 或 CFC"
                );
                return;
            }

            detailState.displayedRows =
                detailState.rows.slice();

            detailState.displayedAudit =
                detailState.audit;

            detailState.displayedFetchAt =
                detailState.lastFetchAt;

            detailState.pendingViewUpdate =
                false;

            if (
                state.view.mode ===
                "detail" &&
                state.view.restaurant ===
                name
            ) {
                renderDetailView(
                    name,
                    {
                        preserveScroll: true
                    }
                );
            }
        };

    window.showSatisfactionAudit =
        restaurantName => {
            const name =
                String(
                    restaurantName || "SV"
                ).toUpperCase();

            const audit =
                state.detail[name]?.audit;

            if (!audit) {
                console.warn(
                    `${name} 暂无复核数据`
                );
                return;
            }

            console.log(
                `${name} 复核详情：`,
                audit
            );

            console.table(
                audit.methods.map(method => ({
                    计算口径:
                        method.name,

                    复核分数:
                        method.rounded,

                    与系统差异:
                        method.difference,

                    是否最接近:
                        audit.closestMethod
                            ?.key ===
                            method.key
                            ? "是"
                            : ""
                }))
            );

            console.table(
                audit.excludedRows.map(row => ({
                    反馈人:
                        row.feedbackBy,

                    类型:
                        row.feedbackType,

                    反馈时间:
                        row.feedbackTime,

                    排除原因:
                        row.excludedReason,

                    评分:
                        row.scoreArray
                            .map(value =>
                                Number.isFinite(value)
                                    ? value
                                    : "-"
                            )
                            .join(" / ")
                }))
            );

            return audit;
        };

    window.showCurrentSatisfactionDetails =
        restaurantName => {
            const name =
                String(
                    restaurantName || "SV"
                ).toUpperCase();

            const rows =
                state.detail[name]?.rows;

            if (!rows?.length) {
                console.warn(
                    `${name} 暂无详表数据`
                );
                return;
            }

            console.table(
                rows.map(row => ({
                    反馈人:
                        row.feedbackBy,

                    类型:
                        row.feedbackType,

                    反馈时间:
                        row.feedbackTime,

                    食品安全:
                        row.scores.safety,

                    供餐服务:
                        row.scores.service,

                    活动:
                        row.scores.activity,

                    餐具环境:
                        row.scores.environment,

                    菜品出品:
                        row.scores.dish,

                    平均分:
                        formatScore(
                            row.average
                        ),

                    是否全五分:
                        row.isPerfect
                            ? "是"
                            : "否",

                    是否排除:
                        row.isExcluded
                            ? "是"
                            : "否",

                    排除原因:
                        row.excludedReason,

                    拉低总满意度:
                        Number.isFinite(
                            row.impact
                        )
                            ? row.impact.toFixed(4)
                            : "--",

                    心愿美食:
                        row.openQuestion
                }))
            );

            return rows;
        };

    window.downloadSatisfactionDetails =
        async restaurantName => {
            const name =
                String(
                    restaurantName || "SV"
                ).toUpperCase();

            const restaurant =
                state.lastData?.[name];

            const code =
                restaurant?.currentRow
                    ?.canteenCode;

            const month =
                state.lastData?.latestMonth;

            if (!code || !month) {
                console.warn(
                    `${name} 缺少餐厅编码或月份`
                );
                return;
            }

            const excel =
                await fetchDetailExcel(
                    code,
                    month
                );

            downloadArrayBuffer(
                excel.arrayBuffer,
                `${name}_${month}_满意度详表.xls`
            );
        };

    window.stopSatisfactionMonitor =
        () => {
            state.running = false;

            if (state.refreshTimer) {
                clearTimeout(
                    state.refreshTimer
                );

                state.refreshTimer = null;
            }

            if (state.uiTimer) {
                clearInterval(
                    state.uiTimer
                );

                state.uiTimer = null;
            }

            if (
                state.pipWindow &&
                !state.pipWindow.closed
            ) {
                state.pipWindow.close();
            }

            delete window
                .__SATISFACTION_MONITOR__;

            delete window
                .__SATISFACTION_FLOAT_WINDOW__;

            const iframe = document.getElementById("satisfaction-float-iframe");
            if (iframe) iframe.remove();
            const closeBtn = document.getElementById("satisfaction-float-close");
            if (closeBtn) closeBtn.remove();
            const expandBtn = document.getElementById("satisfaction-float-expand");
            if (expandBtn) expandBtn.remove();
            const bubble = document.getElementById("satisfaction-monitor-bubble");
            if (bubble) bubble.remove();

            console.log(
                "满意度监控和浮窗已停止"
            );
        };

    /* =========================================================
     * 21. 启动
     * ========================================================= */

    window.addEventListener("message", async (event) => {
        if (event.data?.source === "EXTENSION_POPUP") {
            const action = event.data.action;
            if (action === "START") {
                if (state.running || window.__SATISFACTION_MONITOR__) {
                    console.log("检测到旧实例，先执行终止清理...");
                    window.stopSatisfactionMonitor();
                }
                state.running = true;
                console.log("正在启动 SV / CFC 满意度监控……");
                await openFloatWindow();
                runOnce();
            } else if (action === "STOP") {
                window.stopSatisfactionMonitor();
            }
        }
    });

    console.log(
        "默认排除工号前缀：",
        state.settings
            .excludedEmployeePrefixes
    );

    // Initial start if not running
    if (!window.__SATISFACTION_MONITOR__) {
        state.running = true;
        console.log("正在首次启动 SV / CFC 满意度监控……");
        await openFloatWindow();
        runOnce();
    }
})();