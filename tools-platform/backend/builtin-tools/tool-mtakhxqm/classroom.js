/* Four primary modules; existing lesson IDs remain stable for deep links. */
const CLASSROOM_MODULES = {
    foundation: [['tab-alphabet', '28 个字母'], ['tab-starter-basics', '发音符号'], ['tab-starter-rules', '连写'], ['tab-starter-positions', '字形'], ['tab-symbol-vocab', '口语要点']],
    words: [['tab-starter-words', '词汇记忆']],
    life: [['tab-basic', '常用口语'], ['tab-family', '家人'], ['tab-supermarket', '购物'], ['tab-numbers', '付款'], ['tab-dialogue', '对话'], ['tab-quiz', '复习']],
    drill: [['tab-letter-drill', '字母抽查']]
};
window.classroomNavigate = function (id) {
    const module = Object.keys(CLASSROOM_MODULES).find(key => CLASSROOM_MODULES[key].some(([tab]) => tab === id));
    if (!module) return;
    window.letterDrill?.pause();
    stopSpeech();
    document.querySelectorAll('.section').forEach(section => section.classList.toggle('active', section.id === id));
    document.querySelectorAll('[data-module]').forEach(button => {
        button.classList.toggle('active', button.dataset.module === module);
        button.setAttribute('aria-current', button.dataset.module === module ? 'page' : 'false');
    });
    const subnav = document.getElementById('lesson-subnav');
    subnav.replaceChildren();
    if (CLASSROOM_MODULES[module].length > 1) CLASSROOM_MODULES[module].forEach(([tab, title]) => {
        const button = document.createElement('button');
        button.textContent = title;
        button.className = tab === id ? 'selected' : '';
        button.setAttribute('aria-pressed', String(tab === id));
        button.onclick = () => switchTab(tab);
        subnav.append(button);
    });
};
function initClassroom() {
    const header = document.querySelector('header');
    if (header && window.ResizeObserver) {
        const updateHeaderHeight = () => document.documentElement.style.setProperty('--classroom-header-height', header.getBoundingClientRect().height + 'px');
        updateHeaderHeight();
        new ResizeObserver(updateHeaderHeight).observe(header);
    }
    // Reuse the drill lexicon so new everyday words can also be reviewed in the deck.
    const existingWords = new Set(STARTER_WORD_DATA.map(word => word.ar));
    for (const word of window.EgyptianDrillData.COMMON_WORDS) {
        if (existingWords.has(word.ar)) continue;
        STARTER_WORD_DATA.push({...word, emoji:'💬'});
        existingWords.add(word.ar);
    }
    window.classroomNavigate('tab-alphabet');
    window.letterDrill.init();
    const letterFilters = document.getElementById('deck-letter-chips');
    if (letterFilters) {
        letterFilters.replaceChildren();
        [{l:'all', name:'全部字母'}, ...ALPHABET].forEach(letter => {
            const button = document.createElement('button');
            button.className = 'deck-chip' + (letter.l === 'all' ? ' active' : '');
            button.textContent = letter.l === 'all' ? letter.name : letter.l + ' · ' + letter.name;
            button.onclick = () => {
                filterDeckByLetter(letter.l);
                [...letterFilters.children].forEach(child => child.classList.toggle('active', child === button));
            };
            letterFilters.append(button);
        });
    }
    // Keep detailed filters available without making them the first screen of the deck.
    const dashboard = document.querySelector('.deck-dashboard');
    if (dashboard) {
        const filters = [...dashboard.children].filter(child => !child.classList.contains('deck-tabs-header'));
        const details = document.createElement('details');
        details.className = 'lesson-filters';
        details.innerHTML = '<summary>筛选词汇 · 字母 / 发音 / 位置</summary>';
        filters.forEach(child => details.append(child));
        dashboard.append(details);
    }
}
