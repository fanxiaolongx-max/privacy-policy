// Huawei-style default deck rebuilt from the uploaded reference template.
// Every direct `.template-component` is independently selectable, movable,
// resizable, editable and removable in the component editor.

const editable = (html) => `<div class="template-editable editable" contenteditable="true">${html}</div>`;

const component = (name, className, html) => `
    <div class="template-component ${className}" data-component-name="${name}">
        ${html}
    </div>
`;

const header = (kicker, title, subtitle, tag) => component('页面标题', 'ht-header', `
    <div>
        <div class="ht-kicker template-editable editable" contenteditable="true">${kicker}</div>
        <h1 class="template-editable editable" contenteditable="true">${title}</h1>
        <div class="ht-subtitle template-editable editable" contenteditable="true">${subtitle}</div>
    </div>
    <div class="ht-tag template-editable editable" contenteditable="true">${tag}</div>
`);

const footer = (label, page) => component('页脚', 'ht-footer', `
    <span class="template-editable editable" contenteditable="true">${label}</span>
    <i></i>
    <b class="template-editable editable" contenteditable="true">${page}</b>
`);

const card = (name, icon, title, body) => component(name, 'ht-card', `
    ${icon ? `<div class="ht-icon template-editable editable" contenteditable="true">${icon}</div>` : ''}
    <h3 class="template-editable editable" contenteditable="true">${title}</h3>
    <div class="ht-muted template-editable editable" contenteditable="true">${body}</div>
`);

const slide = (id, html) => ({ id, layout: 'custom', html: `<div class="huawei-template">${html}</div>` });

export const defaultSlides = [
    slide('slide-1', `
        ${component('封面主文案', 'ht-cover-copy', `
            <div class="ht-kicker template-editable editable" contenteditable="true">Customer First · Quality First · Responsibility First</div>
            <h1 class="template-editable editable" contenteditable="true">Network Safety Oath</h1>
            <div class="ht-cover-cn template-editable editable" contenteditable="true">网络安全宣誓</div>
            <div class="ht-cover-line"></div>
            <div class="ht-cover-meta template-editable editable" contenteditable="true">Huawei-style 16:9 Presentation Template</div>
        `)}
        ${footer('NETWORK SAFETY', '01')}
    `),
    slide('slide-2', `
        ${header('Overview', 'Agenda', '目录页模板', 'TEMPLATE 02')}
        <div class="ht-agenda">
            ${[
                ['01', 'Background', '背景与目标'],
                ['02', 'Key Principles', '核心原则'],
                ['03', 'Safety Actions', '安全行动'],
                ['04', 'Risk Control', '风险控制'],
                ['05', 'Customer Commitment', '客户承诺'],
                ['06', 'Closing Oath', '宣誓与总结']
            ].map(([index, title, body]) => component(`目录 ${index}`, 'ht-agenda-item', `
                <b class="template-editable editable" contenteditable="true">${index}</b>
                <div><h3 class="template-editable editable" contenteditable="true">${title}</h3>
                <p class="template-editable editable" contenteditable="true">${body}</p></div>
            `)).join('')}
        </div>
        ${footer('NETWORK SAFETY OATH', '02')}
    `),
    slide('slide-3', `
        ${header('Two-column Layout', 'Key Commitments', '左右双栏内容模板', 'TEMPLATE 03')}
        <div class="ht-grid-2">
            ${component('英文承诺', 'ht-column-block', `
                <div class="ht-section-title"><h2 class="template-editable editable" contenteditable="true">English</h2><span class="template-editable editable" contenteditable="true">COMMITMENT</span></div>
                <div class="ht-card-inner"><h3 class="template-editable editable" contenteditable="true">Customer First</h3>
                ${editable('Put customers first. Work hard. Take responsibility.<ul><li>No excuses</li><li>No avoidance</li><li>No complaints</li></ul>')}</div>
            `)}
            ${component('中文承诺', 'ht-column-block', `
                <div class="ht-section-title"><h2 class="template-editable editable" contenteditable="true">中文</h2><span class="template-editable editable" contenteditable="true">承诺</span></div>
                <div class="ht-card-inner"><h3 class="template-editable editable" contenteditable="true">以客户为先</h3>
                ${editable('努力工作，勇于担责。<ul><li>不找借口</li><li>不推诿</li><li>不抱怨</li></ul>')}</div>
            `)}
        </div>
        ${footer('ONE TEAM · ONE STANDARD', '03')}
    `),
    slide('slide-4', `
        ${header('Card Layout', 'Three Core Principles', '三栏卡片模板', 'TEMPLATE 04')}
        <div class="ht-grid-3">
            ${card('原则一', '01', 'Customer First', 'Understand customer needs and create measurable value.')}
            ${card('原则二', '02', 'Safety First', 'Follow every red line and control every operational risk.')}
            ${card('原则三', '03', 'Ownership', 'Face problems directly and close every issue completely.')}
        </div>
        ${component('重点引语', 'ht-quote', editable('“No hiding. No delay. Face problems and solve them.”'))}
        ${footer('CORE PRINCIPLES', '04')}
    `),
    slide('slide-5', `
        ${header('Dashboard Layout', 'Safety Performance Overview', '四项指标模板', 'TEMPLATE 05')}
        <div class="ht-grid-4">
            ${[
                ['100%', 'Procedure Compliance', '100'],
                ['0', 'Red-line Violations', '4'],
                ['96%', 'Risk Closure Rate', '96'],
                ['24h', 'Average Response Time', '72']
            ].map(([value, label, width], index) => component(`指标 ${index + 1}`, 'ht-metric-card', `
                <strong class="template-editable editable" contenteditable="true">${value}</strong>
                <span class="template-editable editable" contenteditable="true">${label}</span>
                <div class="ht-progress"><i style="width:${width}%"></i></div>
            `)).join('')}
        </div>
        ${footer('SAFETY PERFORMANCE', '05')}
    `),
    slide('slide-6', `
        ${header('Process Layout', 'Safe Change Management', '横向流程图模板', 'TEMPLATE 06')}
        <div class="ht-flow">
            ${[
                ['1', 'Understand', 'Know the network and customer requirements.'],
                ['2', 'Assess', 'Identify risks and prepare mitigation plans.'],
                ['3', 'Approve', 'Follow the change procedure and authorization flow.'],
                ['4', 'Execute', 'Operate carefully and monitor every step.'],
                ['5', 'Verify', 'Confirm service health and close all issues.']
            ].map(([index, title, body]) => component(`流程 ${index}`, 'ht-flow-step', `
                <b class="template-editable editable" contenteditable="true">${index}</b>
                <h3 class="template-editable editable" contenteditable="true">${title}</h3>
                <p class="template-editable editable" contenteditable="true">${body}</p>
            `)).join('')}
        </div>
        ${footer('CHANGE MANAGEMENT', '06')}
    `),
    slide('slide-7', `
        ${header('Timeline Layout', 'Safety Improvement Roadmap', '时间轴模板', 'TEMPLATE 07')}
        ${component('时间轴连接线', 'ht-timeline-rule', '')}
        <div class="ht-timeline">
            ${[
                ['Phase 1', 'Baseline', 'Assess current network risks.'],
                ['Phase 2', 'Planning', 'Define controls and owners.'],
                ['Phase 3', 'Execution', 'Implement corrective actions.'],
                ['Phase 4', 'Verification', 'Validate closure and quality.'],
                ['Phase 5', 'Optimization', 'Standardize and improve.']
            ].map(([phase, title, body], index) => component(`阶段 ${index + 1}`, 'ht-timeline-item', `
                <i></i><b class="template-editable editable" contenteditable="true">${phase}</b>
                <h3 class="template-editable editable" contenteditable="true">${title}</h3>
                <p class="template-editable editable" contenteditable="true">${body}</p>
            `)).join('')}
        </div>
        ${footer('ROADMAP', '07')}
    `),
    slide('slide-8', `
        ${header('Comparison Layout', 'Reactive vs. Proactive Safety', '对比分析模板', 'TEMPLATE 08')}
        <div class="ht-comparison">
            ${component('被动响应', 'ht-pillar', `
                <div class="ht-section-title"><h2 class="template-editable editable" contenteditable="true">Reactive</h2><span class="template-editable editable" contenteditable="true">AFTER ISSUE</span></div>
                ${editable('<ul><li>Respond after failure</li><li>Depend on escalation</li><li>Temporary workaround</li><li>Limited prevention</li></ul>')}
            `)}
            ${component('对比标识', 'ht-vs', editable('VS'))}
            ${component('主动预防', 'ht-pillar', `
                <div class="ht-section-title"><h2 class="template-editable editable" contenteditable="true">Proactive</h2><span class="template-editable editable" contenteditable="true">BEFORE ISSUE</span></div>
                ${editable('<ul><li>Identify risks early</li><li>Own the problem directly</li><li>Close root causes</li><li>Prevent recurrence</li></ul>')}
            `)}
        </div>
        ${component('行动主张', 'ht-quote', editable('Stay close to the network. Prevent problems early.'))}
        ${footer('PROACTIVE SAFETY', '08')}
    `),
    slide('slide-9', `
        ${header('Risk Layout', 'Network Risk Matrix', '风险矩阵模板', 'TEMPLATE 09')}
        ${component('风险矩阵', 'ht-matrix', `
            ${[
                ['head', 'Impact / Probability'], ['head', 'Rare'], ['head', 'Possible'], ['head', 'Likely'], ['head', 'Almost Certain'],
                ['head', 'Critical'], ['med', 'Medium'], ['high', 'High'], ['crit', 'Critical'], ['crit', 'Critical'],
                ['head', 'Major'], ['low', 'Low'], ['med', 'Medium'], ['high', 'High'], ['crit', 'Critical'],
                ['head', 'Moderate'], ['low', 'Low'], ['med', 'Medium'], ['med', 'Medium'], ['high', 'High'],
                ['head', 'Minor'], ['low', 'Low'], ['low', 'Low'], ['med', 'Medium'], ['med', 'Medium']
            ].map(([className, text]) => `<div class="${className} template-editable editable" contenteditable="true">${text}</div>`).join('')}
        `)}
        ${footer('RISK CONTROL', '09')}
    `),
    slide('slide-10', `
        ${header('Data Layout', 'Monthly Safety Trend', '数据图表模板', 'TEMPLATE 10')}
        <div class="ht-dashboard">
            ${component('月度趋势图', 'ht-chart-panel', `
                <div class="ht-section-title"><h2 class="template-editable editable" contenteditable="true">Issue Closure Trend</h2><span class="template-editable editable" contenteditable="true">MONTHLY</span></div>
                <div class="ht-chart">
                    ${[['42', 'Jan'], ['58', 'Feb'], ['68', 'Mar'], ['76', 'Apr'], ['88', 'May'], ['96', 'Jun']]
                        .map(([height, month]) => `<div class="ht-bar" style="height:${height}%"><span class="template-editable editable" contenteditable="true">${month}</span></div>`).join('')}
                </div>
                <div class="ht-legend template-editable editable" contenteditable="true"><i></i> Closure Rate</div>
            `)}
            <div class="ht-highlight-stack">
                ${component('提升指标', 'ht-highlight', `<strong class="template-editable editable" contenteditable="true">+54%</strong><span class="template-editable editable" contenteditable="true">Improvement in closure rate</span>`)}
                ${component('下降指标', 'ht-highlight', `<strong class="template-editable editable" contenteditable="true">-37%</strong><span class="template-editable editable" contenteditable="true">Reduction in recurring issues</span>`)}
            </div>
        </div>
        ${footer('MONTHLY TREND', '10')}
    `),
    slide('slide-11', `
        ${header('Hero Layout', 'One Team, One Commitment', '大标题 + 视觉重点模板', 'TEMPLATE 11')}
        <div class="ht-hero">
            ${component('宣誓文案', 'ht-hero-quote', editable('I will honor this pledge.<br>I will lead by example.<br><strong>I will keep my promise.</strong>'))}
            ${component('核心指标视觉', 'ht-hero-visual', `<div class="template-editable editable" contenteditable="true">100%</div>`)}
        </div>
        ${footer('TEAM OATH', '11')}
    `),
    slide('slide-12', `
        ${header('Closing Layout', 'Key Takeaways', '总结收尾模板', 'TEMPLATE 12')}
        <div class="ht-summary">
            ${[
                ['Customer First', 'Understand the customer, create value, and take ownership.'],
                ['Safety First', 'Respect every red line and make every operation successful.'],
                ['Act Early', 'Prevent risks before they become incidents.'],
                ['Close the Loop', 'Face issues directly and resolve them completely.']
            ].map(([title, body], index) => component(`总结 ${index + 1}`, 'ht-summary-card', `
                <h2 class="template-editable editable" contenteditable="true">${title}</h2>
                <p class="template-editable editable" contenteditable="true">${body}</p>
            `)).join('')}
        </div>
        ${footer('NETWORK SAFETY OATH', '12')}
    `)
];
