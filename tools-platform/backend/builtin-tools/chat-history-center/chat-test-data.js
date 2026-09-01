(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ChatTestData = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * 生成全场景海量测试聊天数据（共 60 个会话，涵盖单聊、群聊、讨论组、历史归档，用于全面测试左侧会话列表分页加载更多及搜索、统计）
     * @param {string} mySenderId - 当前用户的工号，默认 'f84300033'
     * @returns {Array<{relativePath: string, originalName: string, content: string, modifiedAt: number}>}
     */
    function generateTestDataset(mySenderId = 'f84300033') {
        const myId = String(mySenderId || 'f84300033').trim();
        const myName = '陈工';
        const now = Date.now();
        const dataset = [];

        // 1. 核心单聊: 后端开发技术沟通 (single)
        dataset.push({
            relativePath: '测试数据/单聊/技术研发部/李工-后端专家.txt',
            originalName: '李工-后端专家.txt',
            content: [
                `李工-后端专家(li_backend) 2026-08-10 09:15:20`,
                `陈工早上好，关于昨天的数据库连接池与索引优化方案，我梳理了核心配置参数。`,
                `${myName}(${myId}) 2026-08-10 09:18:05`,
                `收到，最大连接数和 busyTimeout 是怎么设定的？`,
                `李工-后端专家(li_backend) 2026-08-10 09:22:40`,
                `// SQLite WAL 模式与连接池参数\nconst dbConfig = {\n    journalMode: 'WAL',\n    busyTimeout: 10000,\n    maxConnections: 20,\n    idleTimeoutMillis: 30000\n};\n// 配合 FTS5 trigram 分词构建全文索引`,
                `${myName}(${myId}) 2026-08-10 09:25:12`,
                `好的，这套参数在压测下非常稳定，可以直接合入主分支。`,
                `李工-后端专家(li_backend) 2026-09-01 10:30:00`,
                `陈工，最新一期的隐私政策合规接口已经就绪，有空时请协助做一下全链路回归测试。`
            ].join('\n'),
            modifiedAt: now
        });

        // 2. 核心单聊: 产品与合规要求对齐 (single)
        dataset.push({
            relativePath: '测试数据/单聊/产品设计部/王经理-产品总监.txt',
            originalName: '王经理-产品总监.txt',
            content: [
                `王经理-产品总监(wang_pm) 2026-07-15 11:10:00`,
                `陈工，下半年隐私政策与合规新规要求对第三方 SDK 收集个人信息行为做细粒度展示与撤回。`,
                `${myName}(${myId}) 2026-07-15 11:15:30`,
                `收到，目前我们的工具平台已经支持动态 SDK 清单扫描与隐私政策版本差异对比功能。`,
                `王经理-产品总监(wang_pm) 2026-07-20 16:30:00`,
                `【合规自查与上线排期表】\n1. 7月25日前：完成所有接入 SDK 权限与数据收集目的声明\n2. 7月30日前：上线用户隐私政策授权撤回与数据注销入口\n3. 8月05日前：出具合规评测自查报告并归档到知识库`,
                `${myName}(${myId}) 2026-07-20 16:45:10`,
                `技术侧已全面对齐排期，会按时保质交付！`,
                `王经理-产品总监(wang_pm) 2026-08-01 09:00:00`,
                `法务团队已审核通过新版隐私政策初版材料，辛苦技术团队各位同学！🎉`
            ].join('\n'),
            modifiedAt: now
        });

        // 3. 核心群聊: 移动端隐私政策合规专项群 (group, 带 BOM, 代码/Emoji/重复消息)
        dataset.push({
            relativePath: '测试数据/群组/移动端隐私政策合规专项群.txt',
            originalName: '移动端隐私政策合规专项群.txt',
            content: [
                `\uFEFF张律师-法务合规(lawyer_zhang) 2026-05-18 10:00:00`,
                `各位好，本次专项主要针对《个人信息保护法》及最新应用商店审核标准进行系统性隐私政策合规整改。`,
                `王经理-产品总监(wang_pm) 2026-05-18 10:05:12`,
                `收到，产品侧已经梳理好所有涉及个人信息采集的业务场景与隐私政策弹窗交互逻辑。`,
                `周前端-UI组长(zhou_fe) 2026-06-10 14:20:00`,
                `客户端已经更新了隐私政策弹窗逻辑，支持多语言切换与深色模式自适应。`,
                `${myName}(${myId}) 2026-06-10 14:22:30`,
                `接口规范与合规文档已归档在：https://privacy.example.com/compliance/app-policy-v2.1.pdf`,
                `孙测试-QA总监(sun_qa) 2026-08-20 16:00:00`,
                `全量合规测试用例已全部通过，已具备发版条件。`,
                `王经理-产品总监(wang_pm) 2026-09-01 11:00:00`,
                `🚀 移动端新版本已顺利上架各大应用市场，隐私政策合规检查 100% 通过！感谢大家！`
            ].join('\n'),
            modifiedAt: now
        });

        // 4. 核心群聊: 微服务核心架构攻坚群 (group, 90条超长大批量消息)
        const groupArchLines = [];
        const archMembers = [
            { name: '王工-核心架构', id: 'wang_arch' },
            { name: '李工-后端专家', id: 'li_backend' },
            { name: '赵运维-SRE总监', id: 'zhao_ops' },
            { name: '钱DBA-数据库专家', id: 'qian_dba' },
            { name: myName, id: myId }
        ];
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
                if (m === 0) body = `关于【${topic}】，目前技术方案已经初步成型，核心指标预期提升 35% 以上。`;
                else if (m === 1) body = `性能压测指标如下：\n- QPS 峰值：12,500\n- P99 延迟：< 18ms\n- 内存增长：稳定在 128MB 以内`;
                else if (m === 2) body = `同意该方案，请钱DBA协助评估一下索引更新对写吞吐量的影响。`;
                else if (m === 3) body = `已在预发环境完成数据库压测，WAL 模式下并发写入无锁争用现象。`;
                else body = `【进展同步 #${msgCounter}】${topic} 阶段性目标达成，相关监控指标已接入 Grafana 大盘。`;
                groupArchLines.push(`${member.name}(${member.id}) ${timeStr}`);
                groupArchLines.push(body);
            }
        }
        dataset.push({
            relativePath: '测试数据/群组/微服务核心架构攻坚群.txt',
            originalName: '微服务核心架构攻坚群.txt',
            content: groupArchLines.join('\n'),
            modifiedAt: now
        });

        // 5. 核心讨论组: 线上事故应急排查讨论组 (discussion)
        dataset.push({
            relativePath: '测试数据/讨论组/线上生产事故排查紧急讨论组.txt',
            originalName: '线上生产事故排查紧急讨论组.txt',
            content: [
                `赵运维-SRE总监(zhao_ops) 2026-08-28 14:15:00`,
                `【P1 告警】网关服务 504 Gateway Timeout 比例突增至 12%，正在排查上游微服务节点！`,
                `李工-后端专家(li_backend) 2026-08-28 14:16:30`,
                `收到！正在登录 APM 监控查看数据库连接池与慢 SQL 调用链追踪。`,
                `赵运维-SRE总监(zhao_ops) 2026-08-28 14:18:45`,
                `抓取到异常节点错误堆栈：\n2026-08-28 14:18:22 ERROR [DB-POOL] connection timeout after 3000ms\n    at Pool.acquire (/app/node_modules/generic-pool/index.js:142)\n    at Database.query (/app/backend/models/store.js:88)`,
                `${myName}(${myId}) 2026-08-28 14:20:10`,
                `看堆栈是瞬时大流量导致连接池占满！先快速通过 K8s HPA 扩容后端 Pod 实例，并临时调大连接池上限！`,
                `赵运维-SRE总监(zhao_ops) 2026-08-28 14:22:00`,
                `已扩容至 10 个 Pod 实例，连接池上限调整为 80，流量正在重新负载均衡。`,
                `李工-后端专家(li_backend) 2026-08-28 14:25:30`,
                `监控曲线已回落，504 错误率已降至 0.01% 以下，接口响应恢复至 15ms。`
            ].join('\n'),
            modifiedAt: now
        });

        // 6. 核心归档: 2026年Q2技术方案研讨纪要 (other)
        dataset.push({
            relativePath: '测试数据/历史归档/2026年Q2技术方案研讨纪要.txt',
            originalName: '2026年Q2技术方案研讨纪要.txt',
            content: [
                `王工-核心架构(wang_arch) 2026-06-30 17:00:00`,
                `【2026年Q2核心架构演进研讨纪要】\n1. 数据持久化：采用单租户独立 SQLite 数据库文件，通过 tenant-sqlite-pool 实现连接复用。\n2. 全文检索：利用 SQLite FTS5 trigram 分词引擎，实现中英文免字典实时检索。\n3. 前端交互：原生精简响应式布局，零三方打包依赖，兼顾桌面端与浏览器端。`,
                `${myName}(${myId}) 2026-06-30 17:15:20`,
                `方案整体思路清晰，各项技术选型切合实际业务需求，建议按计划在 Q3 推进落地。`
            ].join('\n'),
            modifiedAt: now
        });

        // 7. 扩展 25 个各业务及职能部门同事单聊（用于测试左侧列表加载更多与丰富人员画像）
        const singleColleagues = [
            { dept: '技术研发部', name: '周周-前端组长', id: 'zhou_fe', role: '前端架构与性能优化', chat: '陈工，前端虚拟滚动与离线缓存方案已经整理完毕，已提交评审。' },
            { dept: '技术研发部', name: '吴博-AI算法专家', id: 'wu_ai', role: '大模型与智能分析', chat: '陈工，聊天记录摘要提炼与意图分析的本地推理模型吞吐量测试通过。' },
            { dept: '技术研发部', name: '郑安-安全专家', id: 'zheng_sec', role: '安全与合规审计', chat: '已完成对 SQLite 数据库静态文件加密与内存防Dump的安全加固。' },
            { dept: '技术研发部', name: '孔维-运维工程师', id: 'kong_ops', role: 'CI/CD与自动化', chat: 'GitHub Actions Windows 构建流水线已配置缓存加速，耗时缩短 40%。' },
            { dept: '技术研发部', name: '曹测-测试工程师', id: 'cao_test', role: '自动化回归测试', chat: '50 个端到端与集成测试用例已全部录入自动化套件，随时可以全量回归。' },
            { dept: '技术研发部', name: '林林-移动端开发', id: 'lin_client', role: 'Android/iOS客户端', chat: '移动端原生分享 SDK 与离线数据库已完成对接，待后端接口就绪联调。' },
            { dept: '技术研发部', name: '华研-技术经理', id: 'hua_dev', role: '项目研发管理', chat: '本月技术攻坚各节点均已按时按质交付，大家表现非常出色！' },
            { dept: '产品设计部', name: '金产-产品经理', id: 'jin_pm', role: '聊天记录与数据分析', chat: '陈工，数据洞察卡片中新增的工号映射库交互原型已更新，请查收。' },
            { dept: '产品设计部', name: '韩梅-UI设计主管', id: 'han_ui', role: 'UI/UX视觉交互', chat: '暗色主题（Dark Mode）与高对比度配色规范已打包上传 Figma。' },
            { dept: '产品设计部', name: '冯数-数据分析师', id: 'feng_data', role: '数据建模与指标', chat: '活跃度热力图与 24 小时活跃分布的统计聚合 SQL 已经优化完成。' },
            { dept: '合规法务部', name: '谢审-合规审计专员', id: 'xie_audit', role: '合规与隐私审计', chat: '第三方 SDK 权限合规性审计清单已发邮件，请技术侧安排整改对照。' },
            { dept: '运营业务部', name: '魏运-运营总监', id: 'wei_ops', role: '平台运营与推广', chat: '上周组织的企业内测反馈极好，大家对秒级搜索与离线导出功能赞不绝口。' },
            { dept: '市场营销部', name: '陶市-市场经理', id: 'tao_mkt', role: '产品发布与宣传', chat: '新版本发布通告与功能亮点介绍图已制作完成，已同步各大内部渠道。' },
            { dept: '商务合作部', name: '吕商务-商务总监', id: 'lv_bd', role: '企业客户拓展', chat: '有两家金融客户咨询私有化部署聊天记录中心方案，需要技术支持方案书。' },
            { dept: '售前支持部', name: '施售前-售前架构师', id: 'shi_sa', role: '行业解决方案', chat: '客户对多租户数据隔离机制非常认可，售前架构材料已经完成更新。' },
            { dept: '财务管理部', name: '严财-财务经理', id: 'yan_finance', role: '财务与预算', chat: 'Q3 研发服务器扩容与云服务采购预算已经审批通过，可以推进采购。' },
            { dept: '人力资源部', name: '何人事-HRBP', id: 'he_hr', role: '团队建设与招聘', chat: '资深全栈工程师与分布式数据库开发候选人本周安排初试，请陈工参与面试。' },
            { dept: '客户成功部', name: '柏客-客户成功总监', id: 'bai_cs', role: '客户售后保障', chat: '重点租户的系统使用满意度评分达 99.2 分，感谢技术团队的快速响应。' },
            { dept: '质量保证部', name: '孙浩-QA负责人', id: 'sun_qa', role: '质量管控与交付', chat: '全场景压力测试报告已生成，系统在 1000 万级消息下搜索仍保持毫秒级。' },
            { dept: '风险控制部', name: '姜控-风控专家', id: 'jiang_risk', role: '业务风控与防刷', chat: '聊天敏感词拦截与风控过滤规则引擎已完成配置，已进入灰度观察期。' },
            { dept: '系统架构部', name: '戚架-架构总监', id: 'qi_arch', role: '全局技术演进', chat: '整体架构向去中心化、轻量级混合应用演进的方向完全正确，继续保持。' },
            { dept: '项目管理部', name: '邹PM-PMO负责人', id: 'zou_pmo', role: '项目进度管控', chat: '下周一上午组织 Q3 阶段性交付复盘会，请准备技术总结汇报。' },
            { dept: '运维保障部', name: '赵敏-SRE组长', id: 'zhao_ops', role: '基础设施保障', chat: '生产服务器灾备切换演练已圆满完成，RTO 小于 10 秒，RPO 为 0。' },
            { dept: '数据平台部', name: '钱诚-DBA组长', id: 'qian_dba', role: '数据仓库与备份', chat: '租户自动备份与定时清理任务运行正常，存储空间使用率平稳。' },
            { dept: '技术研发部', name: '张小强-实习开发', id: 'zhang_intern', role: '前端功能开发', chat: '陈老师好，我提交的会话高亮样式 PR 已经改好了，麻烦您抽空帮我 Review。' }
        ];

        singleColleagues.forEach((col, idx) => {
            const dayNum = String((idx % 28) + 1).padStart(2, '0');
            const hour = String((idx * 3) % 24).padStart(2, '0');
            const min = String((idx * 7) % 60).padStart(2, '0');
            dataset.push({
                relativePath: `测试数据/单聊/${col.dept}/${col.name}.txt`,
                originalName: `${col.name}.txt`,
                content: [
                    `${col.name}(${col.id}) 2026-08-${dayNum} ${hour}:${min}:00`,
                    col.chat,
                    `${myName}(${myId}) 2026-08-${dayNum} ${hour}:${min}:35`,
                    `收到，${col.role}方向的技术细节已对齐，按既定标准推进即可！`,
                    `${col.name}(${col.id}) 2026-09-01 12:00:00`,
                    `好的，收到！`
                ].join('\n'),
                modifiedAt: now - idx * 3600000
            });
        });

        // 8. 扩展 18 个跨部门专项群聊（涵盖各种技术攻坚、业务交付与合规场景）
        const groupList = [
            { name: '前端组件库与多语言UI建设群', tag: '前端/UI', topic: '深色模式与离线双语词条自适应渲染' },
            { name: '数据库高可用与分库分表专项群', tag: '数据库', topic: 'SQLite 物理文件并发连接池优化' },
            { name: 'DevOps流水线与自动化发版群', tag: '运维/CI', topic: 'electron-builder Windows 自动化打包提速' },
            { name: 'AI智能体与大模型接入技术群', tag: 'AI/LLM', topic: '聊天记录关键词语义提取与智能检索' },
            { name: '安全红蓝对抗与数据合规自查群', tag: '安全/合规', topic: '个人隐私数据脱敏与数据沙箱隔离' },
            { name: '2026年Q3核心业务攻坚项目群', tag: '项目交付', topic: '全模块联调上线与业务大盘看板接入' },
            { name: '支付结算与财务对账系统改造群', tag: '财务/支付', topic: '对账流水千万级数据对齐与自动平账' },
            { name: '全球化多地区合规与法务审核群', tag: '法务/合规', topic: 'GDPR 与跨境数据传输合规自查' },
            { name: 'API网关与分布式限流熔断项目群', tag: '微服务网关', topic: '高并发秒杀与突发流量负载均衡' },
            { name: '实时音视频与流媒体传输攻坚群', tag: '音视频', topic: 'WebRTC 低延迟音视频连麦技术' },
            { name: '大数据实时计算与数仓建模群', tag: '大数据', topic: '实时流处理与指标统计大盘建设' },
            { name: '客户满意度提升与体验保障群', tag: '客户成功', topic: '工单流转与用户体验反馈闭环' },
            { name: 'SaaS多租户底层物理隔离技术群', tag: '多租户', topic: '租户动态路由与独立数据库切换机制' },
            { name: '桌面端Electron与跨平台编译群', tag: '桌面端', topic: 'Windows 便携版与 macOS DMG 统一分发' },
            { name: '应用商店上线与资质审核答辩群', tag: '发版合规', topic: '各大应用市场合规审核材料归档' },
            { name: '全链路性能压测与性能基准评测群', tag: '性能测试', topic: '全量压测报告与性能瓶颈攻坚' },
            { name: '业务风控与防刷安全策略群', tag: '风控安全', topic: '异常登录检测与高危操作二次验证' },
            { name: '私有化部署交付与实施保障群', tag: '客户交付', topic: '企业内网离线部署安装与现场验收' }
        ];

        groupList.forEach((grp, idx) => {
            const dayNum = String((idx % 25) + 1).padStart(2, '0');
            const hour = String((idx * 2 + 8) % 24).padStart(2, '0');
            dataset.push({
                relativePath: `测试数据/群组/${grp.name}.txt`,
                originalName: `${grp.name}.txt`,
                content: [
                    `王经理-产品总监(wang_pm) 2026-08-${dayNum} ${hour}:00:00`,
                    `各位同学，【${grp.name}】本次重点讨论：${grp.topic}。`,
                    `李工-后端专家(li_backend) 2026-08-${dayNum} ${hour}:05:20`,
                    `技术方案草案已发至群文件，请大家查阅并提出建议。`,
                    `${myName}(${myId}) 2026-08-${dayNum} ${hour}:10:15`,
                    `已对方案进行技术可行性评审，整体设计规范合理，同意推进实施。`,
                    `周周-前端组长(zhou_fe) 2026-08-${dayNum} ${hour}:15:40`,
                    `前端模块已准备就绪，今天下午开始联调！`,
                    `孙浩-QA负责人(sun_qa) 2026-08-${dayNum} ${hour}:20:00`,
                    `测试用例已同步编写完毕，随时配合验证。`
                ].join('\n'),
                modifiedAt: now - (idx + 10) * 3600000
            });
        });

        // 9. 扩展 8 个紧急讨论组（用于测试 discussion 类型及故障排查场景）
        const discussionList = [
            { name: '数据库慢查询与死锁紧急排查组', desc: '线上订单表锁等待超时排查与索引重建' },
            { name: '登录网关鉴权抖动临时处置组', desc: 'Token 校验服务熔断降级与备用集群切换' },
            { name: '第三方API超时降级临时对齐组', desc: '第三方服务不可用时的本地降级兜底方案' },
            { name: '应用市场驳回申诉材料讨论组', desc: '针对权限声明格式驳回的申诉补正答辩' },
            { name: '大客户私有化部署技术支持组', desc: '专有云环境下网络策略打通与部署排查' },
            { name: '安全漏洞应急响应临时处置组', desc: '组件依赖高危漏洞紧急升级与补丁发布' },
            { name: '跨团队接口变更联调对接组', desc: 'V2版本核心 API 字段变更与兼容性测试' },
            { name: '线上缓存雪崩应急对齐组', desc: '热点 Key 失效时的互斥锁与随机过期时间配置' }
        ];

        discussionList.forEach((dis, idx) => {
            const dayNum = String((idx % 20) + 5).padStart(2, '0');
            dataset.push({
                relativePath: `测试数据/讨论组/${dis.name}.txt`,
                originalName: `${dis.name}.txt`,
                content: [
                    `赵敏-SRE组长(zhao_ops) 2026-08-${dayNum} 15:00:00`,
                    `【紧急讨论】正在处理：${dis.desc}。`,
                    `李工-后端专家(li_backend) 2026-08-${dayNum} 15:03:00`,
                    `已定位根本原因，正在准备修复补丁。`,
                    `${myName}(${myId}) 2026-08-${dayNum} 15:08:00`,
                    `补丁已完成代码审核，允许合入发布热修分支。`,
                    `赵敏-SRE组长(zhao_ops) 2026-08-${dayNum} 15:20:00`,
                    `热修已部署生效，监控指标完全恢复正常！`
                ].join('\n'),
                modifiedAt: now - (idx + 30) * 3600000
            });
        });

        // 10. 扩展 3 个技术文档与历史归档（用于测试 other 类型）
        const archiveList = [
            { name: '2025年度隐私政策合规审计白皮书', summary: '全面总结2025年度企业合规建设成果与技术安全架构规范。' },
            { name: '企业聊天记录中心系统技术白皮书', summary: '系统化阐述聊天记录中心架构、FTS5检索机制与多租户隔离策略。' },
            { name: '微服务高并发高可用技术演进路线', summary: '规划2026-2027年度架构升级路线图与技术指标要求。' }
        ];

        archiveList.forEach((arc, idx) => {
            dataset.push({
                relativePath: `测试数据/历史归档/${arc.name}.txt`,
                originalName: `${arc.name}.txt`,
                content: [
                    `王工-核心架构(wang_arch) 2026-05-01 09:00:00`,
                    `【文档归档】《${arc.name}》\n\n${arc.summary}\n\n本技术规范已通过架构委员会终审并正式生效。`,
                    `${myName}(${myId}) 2026-05-01 09:30:00`,
                    `已归档到平台知识库中，供各团队学习参考。`
                ].join('\n'),
                modifiedAt: now - (idx + 60) * 3600000
            });
        });

        return dataset;
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

