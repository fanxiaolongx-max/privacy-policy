/**
 * uivf12/auth-probe.js
 * 生成可内嵌到抓取脚本中的运行时认证来源探测器。只在目标页面本地读取，绝不回传 Token。
 */
(function () {
    const runtimeSource = String.raw`
        function uivProbeNormalizeKey(value) {
            return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        }
        function uivProbeUnique(values) {
            const seen = new Set();
            return values.filter(value => {
                const key = uivProbeNormalizeKey(value);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        function uivProbeKind(header) {
            const lower = String(header || "").toLowerCase();
            if (/csrf|xsrf|anti[-_]?forgery/.test(lower)) return "csrf";
            if (lower === "authorization" || lower === "proxy-authorization") return "authorization";
            if (/api[-_]?key/.test(lower)) return "apiKey";
            return "token";
        }
        function uivProbeNames(auth, kind) {
            const byKind = {
                csrf: ["XSRF-TOKEN", "CSRF-TOKEN", "csrftoken", "csrfToken", "csrf_token", "_csrf", "antiForgeryToken", "requestVerificationToken", "NETLIVE-XSRF-TOKEN", "x-gde-csrf-token"],
                authorization: ["access_token", "accessToken", "authToken", "token", "id_token", "idToken", "jwt", "jwtToken", "bearerToken", "authorization"],
                apiKey: ["x-api-key", "api-key", "api_key", "apiKey", "apikey"],
                token: ["token", "access_token", "accessToken", "authToken", "sessionToken", "securityToken"]
            };
            const header = String(auth && auth.header || "");
            const sourceKey = String(auth && auth.sourceKey || "");
            const derived = header.replace(/^x[-_]/i, "");
            return uivProbeUnique([sourceKey, header, derived].concat(byKind[kind] || byKind.token));
        }
        function uivProbeKeyMatches(key, names, kind) {
            const normalized = uivProbeNormalizeKey(key);
            if (!normalized) return false;
            if (names.some(name => uivProbeNormalizeKey(name) === normalized)) return true;
            if (kind === "csrf") return /csrf|xsrf|antiforgery|requestverification/.test(normalized);
            if (kind === "authorization") return /^(?:access|auth|id|jwt|bearer|security|session)?token$/.test(normalized) || normalized === "authorization";
            if (kind === "apiKey") return /apikey/.test(normalized);
            return /token|secret/.test(normalized);
        }
        function uivProbeCleanToken(value) {
            if (value === null || value === undefined || typeof value === "object") return "";
            let text = String(value).trim();
            if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
            if (!text || text.length < 4 || text.length > 8192) return "";
            if (/redacted|value_omitted|undefined|^null$/i.test(text)) return "";
            return text;
        }
        function uivProbeGetAtPath(value, path) {
            const keys = String(path || "").replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
            if (keys.some(key => ["__proto__", "prototype", "constructor"].includes(String(key).toLowerCase()))) return undefined;
            return keys.reduce((current, key) => current == null ? undefined : current[key], value);
        }
        function uivProbeFindInObject(value, names, kind, depth, seen) {
            if (value === null || value === undefined || depth > 6) return "";
            if (typeof value !== "object") return "";
            if (seen.has(value)) return "";
            seen.add(value);
            if (Array.isArray(value)) {
                for (const item of value.slice(0, 30)) {
                    const nested = uivProbeFindInObject(item, names, kind, depth + 1, seen);
                    if (nested) return nested;
                }
                return "";
            }
            const entries = Object.entries(value).slice(0, 120);
            for (const [key, child] of entries) {
                if (!uivProbeKeyMatches(key, names, kind)) continue;
                const token = uivProbeCleanToken(child);
                if (token) return token;
            }
            for (const [, child] of entries) {
                const nested = uivProbeFindInObject(child, names, kind, depth + 1, seen);
                if (nested) return nested;
            }
            return "";
        }
        function uivProbeValue(rawValue, auth, names, kind, allowRaw) {
            const raw = String(rawValue || "").trim();
            if (!raw) return "";
            let parsed;
            try { parsed = JSON.parse(raw); } catch (_) { parsed = undefined; }
            if (auth && auth.valuePath) {
                if (parsed === undefined) return "";
                return uivProbeCleanToken(uivProbeGetAtPath(parsed, auth.valuePath));
            }
            if (parsed && typeof parsed === "object") {
                return uivProbeFindInObject(parsed, names, kind, 0, new WeakSet());
            }
            if (parsed !== undefined && typeof parsed !== "object") return uivProbeCleanToken(parsed);
            return allowRaw ? uivProbeCleanToken(raw) : "";
        }
        function uivProbeCookie(auth, names, kind, exactOnly) {
            let cookieText = "";
            try { cookieText = String(document.cookie || ""); } catch (_) { return null; }
            const entries = cookieText.split(";").map(part => {
                const index = part.indexOf("=");
                return index < 0 ? [part.trim(), ""] : [part.slice(0, index).trim(), part.slice(index + 1)];
            });
            const sourceKey = String(auth && auth.sourceKey || "");
            for (const [key, raw] of entries) {
                const exact = sourceKey && uivProbeNormalizeKey(key) === uivProbeNormalizeKey(sourceKey);
                if (!exact && (exactOnly || !uivProbeKeyMatches(key, names, kind))) continue;
                let decoded = raw;
                try { decoded = decodeURIComponent(raw); } catch (_) {}
                const token = uivProbeCleanToken(decoded);
                if (token) return { token, source: "Cookie:" + key };
            }
            return null;
        }
        function uivProbeStorage(storage, storageName, auth, names, kind, exactOnly) {
            const keys = [];
            try {
                for (let index = 0; index < Math.min(storage.length, 240); index++) {
                    const key = storage.key(index);
                    if (key !== null) keys.push(key);
                }
            } catch (_) { return null; }
            const sourceKey = String(auth && auth.sourceKey || "");
            const preferred = keys.filter(key => sourceKey && uivProbeNormalizeKey(key) === uivProbeNormalizeKey(sourceKey));
            const semantic = exactOnly ? [] : keys.filter(key => uivProbeKeyMatches(key, names, kind));
            for (const key of uivProbeUnique(preferred.concat(semantic))) {
                let raw = "";
                try { raw = storage.getItem(key) || ""; } catch (_) { continue; }
                const token = uivProbeValue(raw, auth, names, kind, true);
                if (token) return { token, source: storageName + ":" + key };
            }
            if (exactOnly) return null;
            for (const key of keys) {
                let raw = "";
                try { raw = storage.getItem(key) || ""; } catch (_) { continue; }
                if (!/^\s*[\[{]/.test(raw)) continue;
                const token = uivProbeValue(raw, { valuePath: "" }, names, kind, false);
                if (token) return { token, source: storageName + ":" + key + "(JSON)" };
            }
            return null;
        }
        function uivProbeDocument(names, kind) {
            let nodes = [];
            try { nodes = Array.from(document.querySelectorAll("meta[name], input[name], input[id]")).slice(0, 300); }
            catch (_) { return null; }
            for (const node of nodes) {
                const key = node.getAttribute("name") || node.getAttribute("id") || "";
                if (!uivProbeKeyMatches(key, names, kind)) continue;
                const raw = node.tagName === "META" ? node.getAttribute("content") : node.value;
                const token = uivProbeCleanToken(raw);
                if (token) return { token, source: node.tagName.toLowerCase() + ":" + key };
            }
            return null;
        }
        function uivResolveAdapterAuth(rawAuth) {
            const auth = rawAuth && typeof rawAuth === "object" ? rawAuth : { strategy: "none" };
            const strategy = String(auth.strategy || "none");
            if (strategy === "none" || strategy === "cookie") return null;
            const header = String(auth.header || "").trim();
            if (!header || /^(?:cookie|set-cookie)$/i.test(header)) throw new Error("认证请求头无效或浏览器不允许脚本设置：" + (header || "(空)"));
            const kind = uivProbeKind(header);
            const names = uivProbeNames(auth, kind);
            let resolved = null;
            if (strategy === "cookieHeader") resolved = uivProbeCookie(auth, names, kind, true);
            if (strategy === "localStorage") resolved = uivProbeStorage(localStorage, "localStorage", auth, names, kind, true);
            if (strategy === "sessionStorage") resolved = uivProbeStorage(sessionStorage, "sessionStorage", auth, names, kind, true);
            if (strategy === "autoProbe") {
                resolved = uivProbeCookie(auth, names, kind, false)
                    || uivProbeStorage(localStorage, "localStorage", auth, names, kind, false)
                    || uivProbeStorage(sessionStorage, "sessionStorage", auth, names, kind, false)
                    || uivProbeDocument(names, kind);
            }
            if (!resolved || !resolved.token) {
                const attempted = strategy === "autoProbe" ? "Cookie、localStorage、sessionStorage、meta/隐藏字段" : strategy + ":" + (auth.sourceKey || "(未设置)");
                throw new Error("未找到 " + header + " 的认证值；已尝试 " + attempted + "。HttpOnly Cookie 无法被页面脚本直接读取，请确认登录状态或在高级编辑中指定来源。");
            }
            let value = resolved.token;
            const prefix = String(auth.prefix || "");
            const hasScheme = /^[A-Za-z][A-Za-z0-9._-]{1,20}\s+\S/.test(value);
            if (prefix && value.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) value = prefix + value;
            else if (!prefix && kind === "authorization" && !hasScheme) value = "Bearer " + value;
            console.info("[UIVF12 Auth] 已从 " + resolved.source + " 获取 " + header + "（Token 值已隐藏）");
            return { header, value, source: resolved.source };
        }
    `;

    window.UIVAuthProbe = Object.freeze({
        getRuntimeSource() {
            return runtimeSource;
        }
    });
})();
