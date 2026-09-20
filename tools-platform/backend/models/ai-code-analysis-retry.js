const ANALYSIS_CODE_LIMITS = [200 * 1024, 100 * 1024, 50 * 1024];

function getAnalysisCode(message, codeStart) {
    const content = String(message || '');
    if (!Number.isSafeInteger(codeStart) || codeStart < 1 || codeStart >= content.length) return null;
    const code = content.slice(codeStart);
    if (!code.trim() || code.length > ANALYSIS_CODE_LIMITS[0]) return null;
    return { prefix: content.slice(0, codeStart), code };
}

function buildAnalysisAttempt(analysisCode, limit) {
    const included = analysisCode.code.slice(0, limit);
    const note = included.length < analysisCode.code.length
        ? `\n\n本次因 AI 服务请求大小限制，仅提供以下代码的前 ${included.length} 个字符；未提供的后续代码不得推断。`
        : '';
    return `${analysisCode.prefix}${note}\n\n${included}`;
}

async function runAnalysisWithSizeFallback(analysisCode, generate, onRetry) {
    let lastError;
    const limits = ANALYSIS_CODE_LIMITS.filter((limit, index) => index === 0 || analysisCode.code.length > limit);
    for (let index = 0; index < limits.length; index += 1) {
        const content = buildAnalysisAttempt(analysisCode, limits[index]);
        try {
            return { result: await generate(content), content, attempts: index + 1 };
        } catch (error) {
            lastError = error;
            if (Number(error?.status || error?.statusCode) !== 413 || error.partialOutput) throw error;
            if (index + 1 < limits.length) onRetry?.({ attempt: index + 2, limit: limits[index + 1] });
        }
    }
    const error = new Error(`文件内容仍超出当前 AI 服务的请求限制（已自动缩减代码并尝试 ${limits.length} 次）。请改用单个知识片段的“AI 分析”，或直接提出具体问题。`);
    error.status = 413;
    error.statusCode = 413;
    error.cause = lastError;
    throw error;
}

module.exports = { ANALYSIS_CODE_LIMITS, getAnalysisCode, buildAnalysisAttempt, runAnalysisWithSizeFallback };
