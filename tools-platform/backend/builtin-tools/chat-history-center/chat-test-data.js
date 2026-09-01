(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ChatTestData = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * 生成全场景测试聊天数据
     * @param {string} mySenderId - 当前用户的工号，默认 'f84300033'
     * @returns {Array<{relativePath: string, originalName: string, content: string, modifiedAt: number}>}
     */
    function generateTestDataset(mySenderId = 'f84300033') {
        const myId = String(mySenderId || 'f84300033').trim();
        const myName = '陈工';

        // 1. 单聊 1: 后端开发技术沟通 (single)
        const singleBackendContent = [
            `李工-后端专家(li_backend) 2026-08-10 09:15:20`,
            `陈工早上好，关于昨天的数据库连接池与索引优化方案，我梳理了核心配置参数。`,
            `${myName}(${myId}) 2026-08-10 09:18:05`,
            `收到，最大连接数和 busyTimeout 是怎么设定的？`,
            `李工-后端专家(li_backend) 2026-08-10 09:22:40`,
            `// SQLite WAL 模式与连接池参数\nconst dbConfig = {\n    journalMode: 'WAL',\n    busyTimeout: 10000,\n    maxConnections: 20,\n    idleTimeoutMillis: 30000\n};\n// 配合 FTS5 trigram 分词构建全文索引`,
            `${myName}(${myId}) 2026-08-10 09:25:12`,
            `好的，这套参数在压测下非常稳定，可以直接合入主分支。`,
            `李工-后端专家(li_backend) 2026-08-11 14:02:18`,
            `已完成 PR 合并并打上 Release Tag v1.0.193，测试环境已更新。`,
            `李工-后端专家(li_backend) 2026-09-01 10:30:00`,
            `陈工，最新一期的隐私政策合规接口已经就绪，有空时请协助做一下全链路回归测试。`
        ].join('\n');

        // 2. 单聊 2: 产品与合规要求对齐 (single)
        const singleProductContent = [
            `王经理-产品负责人(wang_pm) 2026-07-15 11:10:00`,
            `陈工，下半年隐私政策与合规新规要求对第三方 SDK 收集个人信息行为做细粒度展示与撤回。`,
            `${myName}(${myId}) 2026-07-15 11:15:30`,
            `收到，目前我们的工具平台已经支持动态 SDK 清单扫描与隐私政策版本差异对比功能。`,
            `王经理-产品负责人(wang_pm) 2026-07-20 16:30:00`,
            `【合规自查与上线排期表】\n1. 7月25日前：完成所有接入 SDK 权限与数据收集目的声明\n2. 7月30日前：上线用户隐私政策授权撤回与数据注销入口\n3. 8月05日前：出具合规评测自查报告并归档到知识库`,
            `${myName}(${myId}) 2026-07-20 16:45:10`,
            `技术侧已全面对齐排期，会按时保质交付！`,
            `王经理-产品负责人(wang_pm) 2026-08-01 09:00:00`,
            `法务团队已审核通过新版隐私政策初版材料，辛苦技术团队各位同学！🎉`
        ].join('\n');

        // 3. 群组 1: 隐私政策合规专项群 (group, 带 BOM \uFEFF, 包含代码/Emoji/重复消息/URL)
        const groupComplianceContent = [
            `\uFEFF张律师-法务合规(lawyer_zhang) 2026-05-18 10:00:00`,
            `各位好，本次专项主要针对《个人信息保护法》及最新应用商店审核标准进行系统性隐私政策合规整改。`,
            `王经理-产品负责人(wang_pm) 2026-05-18 10:05:12`,
            `收到，产品侧已经梳理好所有涉及个人信息采集的业务场景与隐私政策弹窗交互逻辑。`,
            `周前端-客户端(zhou_ui) 2026-06-10 14:20:00`,
            `客户端已经更新了隐私政策弹窗逻辑，支持多语言切换与深色模式自适应。`,
            `${myName}(${myId}) 2026-06-10 14:22:30`,
            `接口规范与合规文档已归档在：https://privacy.example.com/compliance/app-policy-v2.1.pdf`,
            `张律师-法务合规(lawyer_zhang) 2026-07-02 15:40:00`,
            `特别注意：关于用户撤回同意后本地缓存及服务端 Token 的销毁时效，必须在 48 小时内完成。`,
            `周前端-客户端(zhou_ui) 2026-07-02 15:50:00`,
            `前端已做好 XSS 过滤防护与特殊字符转义：<script>alert("test")</script>，敏感字段展示为 ***`,
            `孙测试-QA负责人(sun_qa) 2026-08-20 16:00:00`,
            `全量合规测试用例已全部通过，已具备发版条件。`,
            `孙测试-QA负责人(sun_qa) 2026-08-20 16:00:00`,
            `全量合规测试用例已全部通过，已具备发版条件。`,
            `王经理-产品负责人(wang_pm) 2026-09-01 11:00:00`,
            `🚀 移动端新版本已顺利上架各大应用市场，隐私政策合规检查 100% 通过！感谢大家！`
        ].join('\n');

        // 4. 群组 2: 微服务核心架构攻坚群 (group, 90条超长大批量消息，跨5个月及24小时全时段，用于测试分页与数据洞察图表)
        const groupArchLines = [];
        const archMembers = [
            { name: '王工-核心架构', id: 'wang_arch' },
            { name: '李工-后端专家', id: 'li_backend' },
            { name: '赵运维-SRE总监', id: 'zhao_ops' },
            { name: '钱DBA-数据库专家', id: 'qian_dba' },
            { name: myName, id: myId }
        ];

        // 构造覆盖 5月、6月、7月、8月、9月 以及 24个时段的消息序列
        const topics = [
            '微服务网关动态路由配置与灰度发布策略',
            '分布式链路追踪 OpenTelemetry 采集性能调优',
            'SQLite FTS5 trigram 倒排索引内存占用分析',
            '多租户数据隔离机制与连接池生命周期管理',
            'Node.js 服务端高并发压测与 GC 停顿时间分析',
            'Redis 缓存穿透布隆过滤器设计与实现',
            'API 接口限流降级熔断 Sentinel 集成方案',
            'Docker 容器轻量化镜像构建与安全漏洞扫描',
            '前端虚拟滚动列表千万级聊天消息渲染流畅度评测',
            '自动化构建流水线 CI/CD 构建提速优化'
        ];

        const dates = [
            '2026-05-06', '2026-05-15', '2026-05-28',
            '2026-06-04', '2026-06-18', '2026-06-25',
            '2026-07-08', '2026-07-16', '2026-07-29',
            '2026-08-05', '2026-08-14', '2026-08-22', '2026-08-30',
            '2026-09-01'
        ];

        let msgCounter = 0;
        for (let d = 0; d < dates.length; d++) {
            const dateStr = dates[d];
            const countForDay = d === dates.length - 1 ? 8 : (d % 2 === 0 ? 6 : 7);
            for (let m = 0; m < countForDay; m++) {
                msgCounter++;
                const member = archMembers[msgCounter % archMembers.length];
                const hour = String((m * 3 + d * 2) % 24).padStart(2, '0');
                const minute = String((m * 17 + d * 11) % 60).padStart(2, '0');
                const second = String((m * 23) % 60).padStart(2, '0');
                const timeStr = `${dateStr} ${hour}:${minute}:${second}`;
                const topic = topics[(m + d) % topics.length];

                let body = '';
                if (m === 0) {
                    body = `关于【${topic}】，目前技术方案已经初步成型，核心指标预期提升 35% 以上。`;
                } else if (m === 1) {
                    body = `性能压测指标如下：\n- QPS 峰值：12,500\n- P99 延迟：< 18ms\n- 内存增长：稳定在 128MB 以内`;
                } else if (m === 2) {
                    body = `同意该方案，请钱DBA协助评估一下索引更新对写吞吐量的影响。`;
                } else if (m === 3) {
                    body = `已在预发环境完成数据库压测，WAL 模式下并发写入无锁争用现象。`;
                } else {
                    body = `【进展同步 #${msgCounter}】${topic} 阶段性目标达成，相关监控指标已接入 Grafana 大盘。`;
                }

                groupArchLines.push(`${member.name}(${member.id}) ${timeStr}`);
                groupArchLines.push(body);
            }
        }
        const groupArchContent = groupArchLines.join('\n');

        // 5. 讨论组: 线上事故应急排查讨论组 (discussion, 包含故障排查/日志堆栈/快速响应)
        const discussionIncidentContent = [
            `赵运维-SRE总监(zhao_ops) 2026-08-28 14:15:00`,
            `【P1 告警】网关服务 504 Gateway Timeout 比例突增至 12%，正在排查上游微服务节点！`,
            `李工-后端专家(li_backend) 2026-08-28 14:16:30`,
            `收到！正在登录 APM 监控查看数据库连接池与慢 SQL 调用链追踪。`,
            `赵运维-SRE总监(zhao_ops) 2026-08-28 14:18:45`,
            `抓取到异常节点错误堆栈：\n2026-08-28 14:18:22 ERROR [DB-POOL] connection timeout after 3000ms\n    at Pool.acquire (/app/node_modules/generic-pool/index.js:142)\n    at Database.query (/app/backend/models/store.js:88)\n    at async handleUserAuth (/app/backend/routes/auth.js:45)`,
            `${myName}(${myId}) 2026-08-28 14:20:10`,
            `看堆栈是瞬时大流量导致连接池占满！先快速通过 K8s HPA 扩容后端 Pod 实例，并临时调大连接池上限！`,
            `赵运维-SRE总监(zhao_ops) 2026-08-28 14:22:00`,
            `已扩容至 10 个 Pod 实例，连接池上限调整为 80，流量正在重新负载均衡。`,
            `李工-后端专家(li_backend) 2026-08-28 14:25:30`,
            `监控曲线已回落，504 错误率已降至 0.01% 以下，接口响应恢复至 15ms。`,
            `王工-核心架构(wang_arch) 2026-08-28 14:35:00`,
            `【故障复盘与改进措施】\n1. 优化慢 SQL 查询并为 stable_key 建立复合索引\n2. 增加连接池健康检查与断线自动重连熔断机制\n3. 配置 Grafana 告警阈值提前在 80% 负载时预警`
        ].join('\n');

        // 6. 其他分类: 历史方案归档 (other)
        const otherArchiveContent = [
            `王工-核心架构(wang_arch) 2026-06-30 17:00:00`,
            `【2026年Q2核心架构演进研讨纪要】\n\n一、架构目标\n构建轻量化、高内聚、具备多租户物理隔离能力的桌面与 Web 混合工具平台，内置隐私政策合规审计与聊天记录检索分析引擎。\n\n二、关键技术决策\n1. 数据持久化：采用单租户独立 SQLite 数据库文件，通过 tenant-sqlite-pool 实现连接复用。\n2. 全文检索：利用 SQLite FTS5 trigram 分词引擎，实现中英文免字典实时检索。\n3. 前端交互：原生精简响应式布局，零三方打包依赖，兼顾桌面端与浏览器端。`,
            `${myName}(${myId}) 2026-06-30 17:15:20`,
            `方案整体思路清晰，各项技术选型切合实际业务需求，建议按计划在 Q3 推进落地。`
        ].join('\n');

        const now = Date.now();

        return [
            {
                relativePath: '聊天记录/单聊/技术研发部/李工-后端开发.txt',
                originalName: '李工-后端开发.txt',
                content: singleBackendContent,
                modifiedAt: now
            },
            {
                relativePath: '聊天记录/单聊/产品设计部/王经理-产品总监.txt',
                originalName: '王经理-产品总监.txt',
                content: singleProductContent,
                modifiedAt: now
            },
            {
                relativePath: '聊天记录/群组/移动端隐私政策合规专项群.txt',
                originalName: '移动端隐私政策合规专项群.txt',
                content: groupComplianceContent,
                modifiedAt: now
            },
            {
                relativePath: '聊天记录/群组/微服务核心架构攻坚群.txt',
                originalName: '微服务核心架构攻坚群.txt',
                content: groupArchContent,
                modifiedAt: now
            },
            {
                relativePath: '聊天记录/讨论组/线上生产事故排查紧急讨论组.txt',
                originalName: '线上生产事故排查紧急讨论组.txt',
                content: discussionIncidentContent,
                modifiedAt: now
            },
            {
                relativePath: '聊天记录/历史归档/2026年Q2技术方案研讨纪要.txt',
                originalName: '2026年Q2技术方案研讨纪要.txt',
                content: otherArchiveContent,
                modifiedAt: now
            }
        ];
    }

    /**
     * 在浏览器环境下将数据集转换为可上传的 File 对象数组
     * @param {string} mySenderId
     * @returns {File[]}
     */
    function createTestFiles(mySenderId = 'f84300033') {
        const dataset = generateTestDataset(mySenderId);
        return dataset.map(item => {
            const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' });
            const file = new File([blob], item.originalName, {
                type: 'text/plain',
                lastModified: item.modifiedAt
            });
            Object.defineProperty(file, 'webkitRelativePath', {
                value: item.relativePath,
                writable: true,
                configurable: true
            });
            file.relativePath = item.relativePath;
            return file;
        });
    }

    return {
        generateTestDataset,
        createTestFiles
    };
});
