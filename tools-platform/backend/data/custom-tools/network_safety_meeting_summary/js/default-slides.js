// js/default-slides.js

export const defaultSlides = [
    {
        id: "slide-1",
        layout: "cover",
        title: "闭风险、除隐患、守住网络安全生命线！",
        subtitle: "Eliminate potential dangers and defend network stability lifeline",
        topicHtml: "<h1 class=\"editable\">[组织] Network Safety</h1><div class=\"sub editable\">Meeting Briefing</div><div class=\"date editable\">[YYYY-MM]</div>"
    },
    {
        id: "slide-2",
        layout: "custom",
        html: `
            <h2 class="slide-title editable" contenteditable="true" data-ppt-type="title">Network Safety Monthly Meeting</h2>
            <div class="rules-grid" data-ppt-type="rules-grid">
                <div class="rule-box">
                    <div class="rule-head editable" contenteditable="true">Rule</div>
                    <ol class="editable" contenteditable="true">
                        <li>Attendees are requested to join on time.</li>
                        <li>Complete required preparation before the meeting.</li>
                        <li>Follow meeting discipline and certification requirements.</li>
                    </ol>
                </div>
                <div class="qr">
                    <div class="rule-head editable" contenteditable="true">Attendance QR</div>
                    <div class="qr-box"><span>HIS</span></div>
                    <div class="editable" contenteditable="true" style="font-size:7px;text-align:center;">[Paste QR screenshot before export if needed]</div>
                </div>
                <div class="rule-box">
                    <div class="rule-head editable" contenteditable="true">Discipline</div>
                    <ol class="editable" contenteditable="true">
                        <li>Be punctual and prepared.</li>
                        <li>Keep laptops closed and phones silent.</li>
                        <li>Online attendees keep mute.</li>
                        <li>Stay focused and avoid leaving early.</li>
                    </ol>
                </div>
            </div>
        `
    },
    {
        id: "slide-3",
        layout: "agenda",
        title: "Agenda",
        rows: [
            { active: true, content: "Opening Speech ([time])", owner: "[Owner]" },
            { active: false, content: "Network Safety Case Study ([time])", owner: "[Owner]" },
            { active: false, content: "Network Safety Process & Regulation Introduction ([time])", owner: "[Owner]" },
            { active: false, content: "Internal Control ([time])", owner: "[Owner]" },
            { active: false, content: "Exam ([time])", owner: "All" },
            { active: false, content: "Award Distribution", owner: "[Owner]" }
        ]
    },
    {
        id: "slide-4",
        layout: "custom",
        html: `
            <h2 class="slide-title editable" contenteditable="true" data-ppt-type="title">Opening Speech</h2>
            <div class="speaker" data-ppt-type="speaker">
                <div class="avatar"></div>
                <div class="editable" contenteditable="true">[Speaker]</div>
                <div class="editable" contenteditable="true">[Title]</div>
            </div>
        `
    },
    {
        id: "slide-5",
        layout: "agenda",
        title: "Agenda",
        rows: [
            { active: false, content: "Opening Speech ([time])", owner: "[Owner]" },
            { active: true, content: "Network Safety Case Study ([time])", owner: "[Owner]" },
            { active: false, content: "Network Safety Process & Regulation Introduction ([time])", owner: "[Owner]" },
            { active: false, content: "Internal Control ([time])", owner: "[Owner]" },
            { active: false, content: "Exam ([time])", owner: "All" },
            { active: false, content: "Award Distribution", owner: "[Owner]" }
        ]
    },
    {
        id: "slide-6",
        layout: "case",
        title: "Case 1: [Case title]",
        cells: [
            "[Describe time, symptom and impact]",
            "[Describe root cause]",
            "[Describe process/tool/people gap]",
            "[Describe improvement actions and owner]"
        ],
        noteHtml: "Owner: [Name]<br>Requirement: use the fixed template.<br>Need to review with [Reviewer].",
        noteStyle: "bottom: 40px; right: 40px;"
    },
    {
        id: "slide-7",
        layout: "case",
        title: "Case 2: [Case title]",
        cells: [
            "[Describe time, symptom and impact]",
            "[Describe root cause]",
            "[Describe process/tool/people gap]",
            "[Describe improvement actions and owner]"
        ],
        noteHtml: "Owner: [Name]<br>Requirement: 1. Use the fixed template.<br>2. Need to review with [Reviewer].",
        noteStyle: "top: 118px; left: 72px; width: 220px;"
    },
    {
        id: "slide-8",
        layout: "agenda",
        title: "Agenda",
        rows: [
            { active: false, content: "Opening Speech ([time])", owner: "[Owner]" },
            { active: false, content: "Network Safety Case Study ([time])", owner: "[Owner]" },
            { active: true, content: "Network Safety Process & Regulation Introduction ([time])", owner: "[Owner]" },
            { active: false, content: "Internal Control ([time])", owner: "[Owner]" },
            { active: false, content: "Exam ([time])", owner: "All" },
            { active: false, content: "Award Distribution", owner: "[Owner]" }
        ]
    },
    {
        id: "slide-9",
        layout: "two-column",
        title: "Process & Regulation",
        leftCol: {
            title: "Key Control Points",
            items: ["[KCP 1]", "[KCP 2]", "[KCP 3]", "[KCP 4]"]
        },
        rightCol: {
            title: "Reporting Requirements",
            items: ["[Requirement 1]", "[Requirement 2]", "[Requirement 3]", "[Requirement 4]"]
        }
    },
    {
        id: "slide-10",
        layout: "agenda",
        title: "Summary & Actions",
        rows: [
            { active: true, content: "[Action item]", owner: "[Owner / Date]" },
            { active: false, content: "[Action item]", owner: "[Owner / Date]" },
            { active: false, content: "[Action item]", owner: "[Owner / Date]" },
            { active: false, content: "[Action item]", owner: "[Owner / Date]" }
        ]
    }
];
