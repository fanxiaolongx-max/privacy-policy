(() => {
    'use strict';

    const state = {
        user: null,
        settings: { mySenderId: '' },
        conversations: [],
        conversationTotal: 0,
        conversationOffset: 0,
        activeConversation: null,
        nextBefore: null,
        messages: [],
        chatHits: [],
        chatHitIndex: 0,
        unreadOnly: false,
        pinnedOnly: false,
        searchPage: 1,
        searchTotal: 0,
        searchRows: [],
        searchParams: null,
        conversationCache: new Map(),
        sourcePage: 1,
        sourceTotal: 0,
        sourceTotalPages: 1
    };
    const $ = id => document.getElementById(id);
    const typeLabels = { single: '单聊', group: '群组', discussion: '讨论组', other: '其他' };
    let toastTimer;
    let conversationDebounce;
    let peopleDebounce;
    let sourceDebounce;
    let preloadRunning = false;

    function showToast(message, error = false) {
        const toast = $('toast');
        toast.textContent = message;
        toast.className = `toast show${error ? ' error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
    }

    function setLoading(visible, text = '正在处理…') {
        $('loading').hidden = !visible;
        $('loadingText').textContent = text;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('zh-CN');
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function compactText(value, length = 70) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text.length > length ? `${text.slice(0, length)}…` : text;
    }

    function shortTime(value) {
        if (!value) return '';
        const today = new Date().toISOString().slice(0, 10);
        return value.slice(0, 10) === today ? value.slice(11, 16) : value.slice(5, 16);
    }

    function dayLabel(value) {
        const day = String(value || '').slice(0, 10);
        const today = new Date();
        const yesterday = new Date(Date.now() - 86400000);
        const local = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (day === local(today)) return '今天';
        if (day === local(yesterday)) return '昨天';
        return day;
    }

    function appendHighlighted(parent, value, keyword) {
        const text = String(value || '');
        if (!keyword) {
            parent.textContent = text;
            return;
        }
        const needle = String(keyword).toLowerCase();
        let cursor = 0;
        while (cursor < text.length) {
            const index = text.toLowerCase().indexOf(needle, cursor);
            if (index < 0) {
                parent.append(document.createTextNode(text.slice(cursor)));
                break;
            }
            if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)));
            const mark = document.createElement('mark');
            mark.textContent = text.slice(index, index + needle.length);
            parent.append(mark);
            cursor = index + needle.length;
        }
    }

    function queryString(params) {
        const search = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') search.set(key, value);
        });
        return search.toString();
    }

    async function apiUpload(path, formData) {
        const headers = {};
        const token = localStorage.getItem('tools_token');
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(path, { method: 'POST', headers, body: formData });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        return body;
    }

    function switchView(name) {
        document.querySelectorAll('.top-tab').forEach(button => button.classList.toggle('active', button.dataset.view === name));
        document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
        if (name === 'analytics') loadStats();
        if (name === 'manage' && state.user && state.user.role === 'admin') loadSources();
    }

    function conversationFilters() {
        return {
            q: $('conversationQuery').value.trim(),
            type: $('conversationType').value,
            unread: state.unreadOnly ? '1' : '',
            pinned: state.pinnedOnly ? '1' : '',
            limit: 40,
            offset: state.conversationOffset
        };
    }

    async function fetchConversationData(id, focusId = null) {
        const [conversation, messages] = await Promise.all([
            API.get(`/api/chat-history/conversations/${encodeURIComponent(id)}`),
            API.get(`/api/chat-history/conversations/${encodeURIComponent(id)}/messages?${focusId ? `around=${focusId}` : 'limit=80'}`)
        ]);
        const payload = {
            conversation,
            messages: messages.items || [],
            nextBefore: messages.nextBefore,
            hasMore: Boolean(messages.hasMore),
            fetchedAt: Date.now()
        };
        state.conversationCache.set(id, payload);
        return payload;
    }

    async function preloadConversations(conversations) {
        if (preloadRunning || !Array.isArray(conversations) || !conversations.length) return;
        preloadRunning = true;
        const queue = conversations.slice(0, 15);
        for (const item of queue) {
            if (!state.conversationCache.has(item.id)) {
                try {
                    await fetchConversationData(item.id);
                } catch (_err) { /* ignore preload error */ }
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        preloadRunning = false;
    }

    async function loadConversations(reset = true) {
        if (reset) state.conversationOffset = 0;
        const data = await API.get(`/api/chat-history/conversations?${queryString(conversationFilters())}`);
        state.settings.mySenderId = data.mySenderId || state.settings.mySenderId;
        state.conversations = reset ? data.items : state.conversations.concat(data.items);
        state.conversationTotal = data.total;
        state.conversationOffset = state.conversations.length;
        renderConversations();
    }

    function renderConversations() {
        const host = $('conversationList');
        host.replaceChildren();
        if (!state.conversations.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<span>🗂️</span><h2>暂无会话</h2><p>调整筛选条件或导入聊天记录。</p>';
            host.append(empty);
        }
        state.conversations.forEach(item => {
            const button = document.createElement('button');
            button.className = `conversation-item${state.activeConversation && state.activeConversation.id === item.id ? ' active' : ''}`;
            button.dataset.id = item.id;
            button.type = 'button';
            const avatar = document.createElement('span');
            avatar.className = 'conv-avatar';
            avatar.textContent = (item.display_name || '?').slice(0, 1).toUpperCase();
            const body = document.createElement('span');
            body.className = 'conv-body';
            const top = document.createElement('span');
            top.className = 'conv-top';
            const name = document.createElement('span');
            name.className = 'conv-name';
            name.textContent = `${item.pinned ? '📌 ' : ''}${item.display_name}`;
            const time = document.createElement('span');
            time.className = 'conv-time';
            time.textContent = shortTime(item.last_message_time);
            top.append(name, time);
            const bottom = document.createElement('span');
            bottom.className = 'conv-bottom';
            const preview = document.createElement('span');
            preview.className = 'conv-preview';
            preview.textContent = compactText(item.last_message || '暂无消息');
            const type = document.createElement('span');
            type.className = 'type-dot';
            type.textContent = typeLabels[item.conversation_type] || '其他';
            bottom.append(preview, type);
            if (Number(item.unread_count) > 0) {
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = Number(item.unread_count) > 99 ? '99+' : item.unread_count;
                bottom.append(badge);
            }
            body.append(top, bottom);
            button.append(avatar, body);
            button.addEventListener('click', () => openConversation(item.id));
            button.addEventListener('mouseenter', () => {
                if (!state.conversationCache.has(item.id)) {
                    fetchConversationData(item.id).catch(() => {});
                }
            });
            host.append(button);
        });
        const hasMoreConvs = state.conversations.length < state.conversationTotal;
        $('loadMoreConversations').hidden = !hasMoreConvs;
        if (hasMoreConvs) {
            $('loadMoreConversations').textContent = `加载更多会话 (${state.conversations.length} / ${state.conversationTotal})`;
        }
        preloadConversations(state.conversations);
    }

    function applyConversationData(data, id, focusId, fromSearch, updateScroll = true) {
        const { conversation, messages, hasMore, nextBefore } = data;
        state.activeConversation = conversation;
        state.messages = messages;
        state.nextBefore = nextBefore;
        $('chatEmpty').hidden = true;
        $('chatWorkspace').hidden = false;
        document.body.classList.add('has-chat');
        $('chatName').textContent = conversation.display_name;
        $('chatAvatar').textContent = (conversation.display_name || '?').slice(0, 1).toUpperCase();
        $('chatMeta').textContent = `${typeLabels[conversation.conversation_type] || '其他'} · ${formatNumber(conversation.message_count)} 条消息 · ${formatNumber(conversation.participant_count)} 人`;
        $('pinButton').classList.toggle('active', Boolean(conversation.pinned));
        $('loadOlderMessages').hidden = !hasMore;
        renderMessages(state.messages, fromSearch && state.lastSearch ? state.lastSearch.keyword : '', focusId);
        renderConversationDetail(conversation);
        document.querySelectorAll('.conversation-item').forEach(el => {
            const isTarget = el.dataset.id === id;
            el.classList.toggle('active', isTarget);
            if (isTarget) {
                const badge = el.querySelector('.badge');
                if (badge) badge.remove();
            }
        });

        if (updateScroll) {
            const scroller = $('messageScroller');
            requestAnimationFrame(() => {
                if (focusId) {
                    const target = document.querySelector(`[data-message-id="${focusId}"]`);
                    if (target && scroller) {
                        const scrollerRect = scroller.getBoundingClientRect();
                        const targetRect = target.getBoundingClientRect();
                        const delta = (targetRect.top - scrollerRect.top) - (scrollerRect.height / 2) + (targetRect.height / 2);
                        scroller.scrollTop += delta;
                    }
                } else {
                    const saved = localStorage.getItem(`chat-history-scroll:${id}`);
                    scroller.scrollTop = saved === null ? scroller.scrollHeight : Number(saved);
                }
            });
        }
    }

    async function openConversation(id, focusId = null, fromSearch = false) {
        if (state.activeConversation && state.activeConversation.id !== id) {
            localStorage.setItem(`chat-history-scroll:${state.activeConversation.id}`, String($('messageScroller').scrollTop));
            state.chatHits = [];
            $('chatSearch').value = '';
            if ($('clearChatInputBtn')) $('clearChatInputBtn').hidden = true;
            $('chatHitNav').hidden = true;
            $('clearChatSearch').hidden = true;
        }
        if (fromSearch && state.lastSearch) {
            $('searchReturnBanner').hidden = false;
            $('chatBackToSearch').hidden = false;
            const kw = state.lastSearch.keyword ? `“${state.lastSearch.keyword}”` : '当前搜索条件';
            $('searchReturnText').textContent = `正在查看搜索结果关联消息 · 关键词：${kw} · 第 ${state.lastSearch.page} 页 · 共 ${formatNumber(state.lastSearch.total)} 条匹配`;
        } else if (!fromSearch) {
            $('searchReturnBanner').hidden = true;
            $('chatBackToSearch').hidden = true;
        }

        const convSummary = state.conversations.find(c => c.id === id);
        if (convSummary) {
            state.activeConversation = { ...convSummary };
            if (Number(convSummary.unread_count) > 0) {
                convSummary.unread_count = 0;
            }
        }

        // Immediately remove unread badge and highlight active item in sidebar
        document.querySelectorAll('.conversation-item').forEach(el => {
            const isTarget = el.dataset.id === id;
            el.classList.toggle('active', isTarget);
            if (isTarget) {
                const badge = el.querySelector('.badge');
                if (badge) badge.remove();
            }
        });

        // Fire mark-as-read to backend API
        API.put(`/api/chat-history/conversations/${encodeURIComponent(id)}/read`, {}).catch(() => {});

        const cached = !focusId ? state.conversationCache.get(id) : null;
        if (cached) {
            applyConversationData(cached, id, focusId, fromSearch);
            if (Date.now() - cached.fetchedAt > 20000) {
                fetchConversationData(id).then(fresh => {
                    if (state.activeConversation && state.activeConversation.id === id && !focusId) {
                        applyConversationData(fresh, id, null, fromSearch, false);
                    }
                }).catch(() => {});
            }
        } else {
            $('chatEmpty').hidden = true;
            $('chatWorkspace').hidden = false;
            document.body.classList.add('has-chat');
            if (convSummary) {
                $('chatName').textContent = convSummary.display_name;
                $('chatAvatar').textContent = (convSummary.display_name || '?').slice(0, 1).toUpperCase();
                $('chatMeta').textContent = `${typeLabels[convSummary.conversation_type] || '其他'} · ${formatNumber(convSummary.message_count)} 条消息`;
            }
            try {
                const data = await fetchConversationData(id, focusId);
                applyConversationData(data, id, focusId, fromSearch);
            } catch (error) {
                showToast(error.message, true);
            }
        }
    }

    function renderMessages(items, keyword = '', focusId = null) {
        const host = $('messageList');
        host.replaceChildren();
        let lastDay = '';
        items.forEach(item => {
            const day = String(item.message_time || '').slice(0, 10);
            if (day !== lastDay) {
                const separator = document.createElement('div');
                separator.className = 'date-sep';
                const label = document.createElement('span');
                label.textContent = dayLabel(item.message_time);
                separator.append(label);
                host.append(separator);
                lastDay = day;
            }
            const mine = state.settings.mySenderId && String(item.sender_id) === String(state.settings.mySenderId);
            const row = document.createElement('div');
            row.className = `message-row ${mine ? 'mine' : 'other'}`;
            row.dataset.messageId = item.id;
            const meta = document.createElement('div');
            meta.className = 'message-meta';
            meta.textContent = `${mine ? '我' : (item.sender_name || item.sender_id || '未知')} · ${String(item.message_time || '').slice(11, 16)}`;
            const wrap = document.createElement('div');
            wrap.className = 'bubble-wrap';
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            if (Number(item.id) === Number(focusId)) bubble.style.boxShadow = '0 0 0 3px #e7b62e';
            appendHighlighted(bubble, item.content, keyword);
            bubble.title = '右键复制消息';
            bubble.addEventListener('contextmenu', async event => {
                event.preventDefault();
                try {
                    await navigator.clipboard.writeText(item.content || '');
                    showToast('已复制消息');
                } catch (_error) {
                    showToast('复制失败', true);
                }
            });
            const favorite = document.createElement('button');
            favorite.className = `favorite-btn${item.favorite ? ' active' : ''}`;
            favorite.textContent = item.favorite ? '★' : '☆';
            favorite.title = item.favorite ? '取消收藏' : '收藏';
            favorite.addEventListener('click', async () => {
                const next = !Boolean(item.favorite);
                try {
                    await API.put(`/api/chat-history/favorites/${encodeURIComponent(item.stable_key)}`, { favorite: next });
                    item.favorite = next ? 1 : 0;
                    favorite.classList.toggle('active', next);
                    favorite.textContent = next ? '★' : '☆';
                } catch (error) { showToast(error.message, true); }
            });
            wrap.append(bubble, favorite);
            row.append(meta, wrap);
            host.append(row);
        });
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<span>🔎</span><h2>没有匹配的消息</h2>';
            host.append(empty);
        }
    }

    async function loadOlderMessages() {
        if (!state.activeConversation || !state.nextBefore) return;
        const scroller = $('messageScroller');
        const previousHeight = scroller.scrollHeight;
        const data = await API.get(`/api/chat-history/conversations/${encodeURIComponent(state.activeConversation.id)}/messages?before=${state.nextBefore}&limit=80`);
        state.messages = (data.items || []).concat(state.messages);
        state.nextBefore = data.nextBefore;
        $('loadOlderMessages').hidden = !data.hasMore;
        renderMessages(state.messages);
        requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight - previousHeight; });
    }

    function renderConversationDetail(conversation) {
        const host = $('detailContent');
        host.replaceChildren();
        const info = document.createElement('section');
        info.className = 'detail-section';
        info.innerHTML = '<h3>基本信息</h3>';
        const value = document.createElement('div');
        value.className = 'detail-value';
        value.textContent = `${typeLabels[conversation.conversation_type] || '其他'}\n${conversation.relative_path}\n${conversation.first_message_time || '-'} 至 ${conversation.last_message_time || '-'}`;
        info.append(value);
        const people = document.createElement('section');
        people.className = 'detail-section';
        people.innerHTML = '<h3>参与者</h3>';
        (conversation.participants || []).forEach(item => {
            const row = document.createElement('div');
            row.className = 'participant';
            const name = document.createElement('strong');
            name.textContent = `${item.sender_name || '未知'}${item.sender_id ? ` (${item.sender_id})` : ''}`;
            const count = document.createElement('span');
            count.textContent = `${formatNumber(item.message_count)} 条`;
            row.append(name, count);
            people.append(row);
        });
        host.append(info, people);
    }

    async function runChatSearch() {
        if (!state.activeConversation) return;
        const keyword = $('chatSearch').value.trim();
        if (!keyword) return;
        setLoading(true, '正在搜索当前会话…');
        try {
            const data = await API.get(`/api/chat-history/search?${queryString({ keyword, conversationId: state.activeConversation.id, limit: 200 })}`);
            state.chatHits = data.items || [];
            state.chatHitIndex = 0;
            $('clearChatSearch').hidden = false;
            $('chatHitNav').hidden = !state.chatHits.length;
            if (!state.chatHits.length) {
                state.messages = [];
                renderMessages([], keyword);
            } else {
                await showChatHit(0);
            }
        } catch (error) { showToast(error.message, true); }
        finally { setLoading(false); }
    }

    async function showChatHit(index) {
        if (!state.activeConversation || !state.chatHits.length) return;
        state.chatHitIndex = Math.max(0, Math.min(index, state.chatHits.length - 1));
        const hit = state.chatHits[state.chatHitIndex];
        const data = await API.get(`/api/chat-history/conversations/${encodeURIComponent(state.activeConversation.id)}/messages?around=${hit.id}`);
        state.messages = data.items || [];
        state.nextBefore = null;
        $('loadOlderMessages').hidden = true;
        $('chatHitCount').textContent = `${state.chatHitIndex + 1} / ${state.chatHits.length}`;
        $('chatHitPrev').disabled = state.chatHitIndex === 0;
        $('chatHitNext').disabled = state.chatHitIndex >= state.chatHits.length - 1;
        renderMessages(state.messages, $('chatSearch').value.trim(), hit.id);
        requestAnimationFrame(() => document.querySelector(`[data-message-id="${hit.id}"]`)?.scrollIntoView({ block: 'center' }));
    }

    function collectSearchParams(offset = 0, limit = 50) {
        return {
            keyword: $('searchKeyword').value.trim(),
            sender: $('searchSender').value.trim(),
            type: $('searchType').value,
            direction: $('searchDirection').value,
            from: $('searchFrom').value,
            to: $('searchTo').value,
            favorites: $('searchFavorites').checked ? '1' : '',
            limit,
            offset
        };
    }

    async function runGlobalSearch(page = 1) {
        const params = collectSearchParams((page - 1) * 50, 50);
        if (!params.keyword && !params.sender && !params.type && !params.direction && !params.from && !params.to && !params.favorites) {
            showToast('请至少输入一个搜索条件', true);
            return;
        }
        setLoading(true, '正在检索聊天记录…');
        try {
            const data = await API.get(`/api/chat-history/search?${queryString(params)}`);
            state.searchPage = page;
            state.searchTotal = data.total;
            state.searchRows = data.items || [];
            state.searchParams = params;
            renderSearchResults(data);
        } catch (error) { showToast(error.message, true); }
        finally { setLoading(false); }
    }

    function renderSearchResults(data) {
        const host = $('searchResults');
        host.replaceChildren();
        $('searchSummary').textContent = `找到 ${formatNumber(data.total)} 条消息`;
        $('searchEngine').textContent = data.ftsAvailable ? 'FTS5 trigram 全文索引' : 'SQLite LIKE 兼容搜索';
        $('exportSearch').disabled = data.total === 0;
        const keyword = $('searchKeyword').value.trim();
        state.searchRows.forEach(item => {
            const card = document.createElement('article');
            card.className = 'search-item';
            card.dataset.searchMessageId = item.id;
            const head = document.createElement('div');
            head.className = 'search-item-head';
            const conversation = document.createElement('strong');
            conversation.textContent = item.display_name;
            const sender = document.createElement('span');
            sender.textContent = `${item.sender_name || item.sender_id || '未知'} · ${item.message_time}`;
            const spacer = document.createElement('span');
            spacer.className = 'spacer';
            const star = document.createElement('button');
            star.className = `favorite-btn${item.favorite ? ' active' : ''}`;
            star.textContent = item.favorite ? '★' : '☆';
            star.addEventListener('click', async () => {
                const next = !Boolean(item.favorite);
                await API.put(`/api/chat-history/favorites/${encodeURIComponent(item.stable_key)}`, { favorite: next });
                item.favorite = next ? 1 : 0;
                star.classList.toggle('active', next);
                star.textContent = next ? '★' : '☆';
            });
            head.append(conversation, sender, spacer, star);
            const content = document.createElement('div');
            content.className = 'search-content';
            appendHighlighted(content, item.content, keyword);
            const context = document.createElement('div');
            context.className = 'search-context';
            context.textContent = [item.previous_content && `上一条：${compactText(item.previous_content, 80)}`, item.next_content && `下一条：${compactText(item.next_content, 80)}`].filter(Boolean).join(' · ');
            const actions = document.createElement('div');
            actions.className = 'search-actions';
            const open = document.createElement('button');
            open.className = 'link-btn';
            open.textContent = '在会话中查看 →';
            open.addEventListener('click', async () => {
                state.lastSearch = {
                    keyword,
                    page: state.searchPage,
                    total: data.total,
                    targetMessageId: item.id
                };
                switchView('chat');
                await openConversation(item.conversation_id, item.id, true);
            });
            actions.append(open);
            card.append(head, content, context, actions);
            host.append(card);
        });
        const pages = Math.max(1, Math.ceil(data.total / 50));
        $('searchPage').textContent = `${state.searchPage} / ${pages}`;
        $('searchPrev').disabled = state.searchPage <= 1;
        $('searchNext').disabled = state.searchPage >= pages;
    }

    function returnToSearch() {
        switchView('search');
        $('searchReturnBanner').hidden = true;
        $('chatBackToSearch').hidden = true;
        if (state.lastSearch && state.lastSearch.targetMessageId) {
            const targetId = state.lastSearch.targetMessageId;
            requestAnimationFrame(() => {
                const card = document.querySelector(`[data-search-message-id="${targetId}"]`);
                if (card) {
                    card.classList.add('highlight-target');
                    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    setTimeout(() => card.classList.remove('highlight-target'), 3500);
                }
            });
        }
    }

    async function exportSearch() {
        if (!state.searchParams || !state.searchTotal) return;
        setLoading(true, '正在生成 Excel…');
        try {
            const rows = [];
            const maxRows = Math.min(state.searchTotal, 50000);
            for (let offset = 0; offset < maxRows; offset += 200) {
                const data = await API.get(`/api/chat-history/search?${queryString({ ...state.searchParams, offset, limit: 200 })}`);
                rows.push(...data.items);
                if (!data.items.length) break;
            }
            const data = rows.map(item => ({
                '会话': item.display_name,
                '类型': typeLabels[item.conversation_type] || '其他',
                '发送人': item.sender_name,
                '发送人工号': item.sender_id,
                '时间': item.message_time,
                '消息内容': item.content,
                '是否收藏': item.favorite ? '是' : '否'
            }));
            const sheet = XLSX.utils.json_to_sheet(data);
            sheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 21 }, { wch: 70 }, { wch: 10 }];
            const book = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(book, sheet, '聊天搜索结果');
            XLSX.writeFile(book, `聊天记录_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.xlsx`);
            if (state.searchTotal > 50000) showToast('数据过多，本次导出前 50,000 条');
        } catch (error) { showToast(error.message, true); }
        finally { setLoading(false); }
    }

    async function loadStats() {
        try {
            const [overview, people, directory] = await Promise.all([
                API.get('/api/chat-history/stats/overview'),
                API.get(`/api/chat-history/stats/people?${queryString({ q: $('peopleQuery').value.trim(), limit: 200 })}`),
                API.get(`/api/chat-history/directory?${queryString({ q: $('directoryQuery').value.trim(), limit: 200 })}`)
            ]);
            renderOverview(overview);
            renderPeople(people.items || []);
            renderDirectory(directory.items || []);
        } catch (error) { showToast(error.message, true); }
    }

    function renderOverview(data) {
        const summary = data.summary || {};
        const others = Number(summary.message_count || 0) - Number(summary.my_messages || 0);
        const unidentCount = Number(summary.unidentified_messages || 0);
        const metrics = [
            { label: '会话总数', value: summary.conversation_count, type: 'default' },
            { label: '消息总数', value: summary.message_count, type: 'default' },
            { label: '数据识别率', value: summary.recognition_rate || '100.0%', type: 'info' },
            { label: '工号已识别', value: summary.identified_messages || summary.message_count, type: 'default' },
            {
                label: '未识别工号',
                value: unidentCount,
                type: unidentCount > 0 ? 'warn kpi-clickable' : 'default kpi-clickable',
                actionHint: '查看明细 →',
                onClick: openUnidentifiedDialog
            },
            { label: '映射人员库', value: summary.directory_person_count || summary.participant_count, type: 'default' },
            { label: '我发送', value: summary.my_messages, type: 'default' },
            { label: '他人发送', value: others, type: 'default' }
        ];
        const kpis = $('kpiGrid');
        kpis.replaceChildren();
        metrics.forEach(item => {
            const card = document.createElement('div');
            card.className = `kpi ${item.type.includes('warn') ? 'kpi-warn' : item.type.includes('info') ? 'kpi-info' : ''} ${item.type.includes('kpi-clickable') ? 'kpi-clickable' : ''}`;
            const name = document.createElement('label');
            name.textContent = item.label;
            if (item.actionHint) {
                const hint = document.createElement('span');
                hint.className = 'kpi-action-hint';
                hint.textContent = item.actionHint;
                name.append(hint);
            }
            const number = document.createElement('strong');
            number.textContent = typeof item.value === 'number' ? formatNumber(item.value) : item.value;
            card.append(name, number);
            if (item.onClick) {
                card.addEventListener('click', item.onClick);
            }
            kpis.append(card);
        });
        const months = data.months || [];
        const maxMonth = Math.max(1, ...months.map(item => Number(item.message_count)));
        const monthChart = $('monthChart');
        monthChart.replaceChildren();
        months.forEach(item => {
            const col = document.createElement('div');
            col.className = 'bar-col';
            col.title = `${item.month}: ${formatNumber(item.message_count)}`;
            const bar = document.createElement('i');
            bar.style.height = `${Math.max(2, Number(item.message_count) / maxMonth * 92)}%`;
            const label = document.createElement('span');
            label.textContent = item.month;
            col.append(bar, label);
            monthChart.append(col);
        });
        const hourMap = new Map((data.hours || []).map(item => [Number(item.hour), Number(item.message_count)]));
        const maxHour = Math.max(1, ...hourMap.values());
        const hourChart = $('hourChart');
        hourChart.replaceChildren();
        for (let hour = 0; hour < 24; hour += 1) {
            const value = hourMap.get(hour) || 0;
            const cell = document.createElement('div');
            cell.className = 'hour-cell';
            cell.style.background = `rgba(18,163,111,${0.08 + value / maxHour * 0.78})`;
            cell.textContent = `${String(hour).padStart(2, '0')}:00`;
            cell.title = `${formatNumber(value)} 条消息`;
            hourChart.append(cell);
        }
        const types = data.types || [];
        const maxType = Math.max(1, ...types.map(item => Number(item.message_count)));
        const typeHost = $('typeStats');
        typeHost.replaceChildren();
        types.forEach(item => {
            const row = document.createElement('div');
            row.className = 'type-row';
            const top = document.createElement('div');
            const name = document.createElement('strong');
            name.textContent = typeLabels[item.type] || '其他';
            const number = document.createElement('span');
            number.textContent = `${formatNumber(item.conversation_count)} 会话 · ${formatNumber(item.message_count)} 消息`;
            top.append(name, number);
            const bar = document.createElement('i');
            bar.style.setProperty('--value', `${Number(item.message_count) / maxType * 100}%`);
            row.append(top, bar);
            typeHost.append(row);
        });
    }

    async function openUnidentifiedDialog() {
        setLoading(true, '正在加载未识别消息明细…');
        try {
            const res = await API.get('/api/chat-history/stats/unidentified?limit=100');
            const table = $('unidentifiedTable');
            table.replaceChildren();
            const items = res.items || [];
            if (!items.length) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="5" style="text-align:center;color:var(--green);padding:24px;font-weight:600;">🎉 暂无未识别工号或格式异常的消息！所有消息发送人工号识别率 100%。</td>';
                table.append(row);
            } else {
                items.forEach(item => {
                    const tr = document.createElement('tr');
                    const conv = document.createElement('td');
                    conv.innerHTML = `<strong>${escapeHtml(item.display_name)}</strong><small style="display:block;color:var(--muted);">${escapeHtml(item.relative_path || '')}</small>`;
                    const sender = document.createElement('td');
                    sender.textContent = item.sender_name || '（完全缺失）';
                    const issue = document.createElement('td');
                    issue.innerHTML = `<span class="badge-warn">${escapeHtml(item.issue_type)}</span>`;
                    const time = document.createElement('td');
                    time.textContent = item.message_time || '-';
                    const content = document.createElement('td');
                    content.textContent = compactText(item.content || '', 90);
                    tr.append(conv, sender, issue, time, content);
                    table.append(tr);
                });
            }
            $('unidentifiedDialog').showModal();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            setLoading(false);
        }
    }

    function renderDirectory(items) {
        const body = $('directoryTable');
        body.replaceChildren();
        if (!items.length) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="8" style="text-align:center;color:var(--muted);padding:18px;">暂无匹配的人员映射数据（导入聊天记录时系统会自动提取并维护工号映射库）</td>';
            body.append(row);
            return;
        }
        items.forEach(item => {
            const tr = document.createElement('tr');
            const idTd = document.createElement('td');
            idTd.innerHTML = `<code>${escapeHtml(item.sender_id)}</code>`;
            const nameTd = document.createElement('td');
            nameTd.innerHTML = `<strong>${escapeHtml(item.sender_name)}</strong>`;
            const aliasTd = document.createElement('td');
            aliasTd.textContent = item.alias_names || '-';
            aliasTd.style.color = 'var(--muted)';
            const convTd = document.createElement('td');
            convTd.textContent = `${formatNumber(item.conversation_count)} 个会话`;
            const msgTd = document.createElement('td');
            msgTd.textContent = `${formatNumber(item.message_count)} 条`;
            const firstTd = document.createElement('td');
            firstTd.textContent = item.first_seen_at ? item.first_seen_at.slice(0, 10) : '-';
            const lastTd = document.createElement('td');
            lastTd.textContent = item.last_seen_at ? item.last_seen_at.slice(0, 16) : '-';
            const actionTd = document.createElement('td');
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-small';
            editBtn.textContent = '✏️ 编辑姓名';
            editBtn.addEventListener('click', () => {
                $('editSenderId').value = item.sender_id;
                $('editSenderName').value = item.sender_name;
                $('editAliasNames').value = item.alias_names || '';
                $('editSyncMessages').checked = true;
                $('editPersonDialog').showModal();
            });
            actionTd.append(editBtn);
            tr.append(idTd, nameTd, aliasTd, convTd, msgTd, firstTd, lastTd, actionTd);
            body.append(tr);
        });
    }

    async function exportDirectory() {
        setLoading(true, '正在生成人员映射表…');
        try {
            const data = await API.get('/api/chat-history/directory?limit=10000');
            const rows = (data.items || []).map(item => ({
                '工号 (Sender ID)': item.sender_id,
                '映射姓名 (Name)': item.sender_name,
                '别名 / 曾用名': item.alias_names || '',
                '关联会话数': item.conversation_count,
                '发信总量': item.message_count,
                '首次活跃时间': item.first_seen_at || '',
                '最近活跃时间': item.last_seen_at || '',
                '最后更新时间': item.updated_at || ''
            }));
            const sheet = XLSX.utils.json_to_sheet(rows);
            sheet['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
            const book = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(book, sheet, '工号与姓名映射库');
            XLSX.writeFile(book, `工号与姓名映射表_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.xlsx`);
            showToast('工号姓名映射表已导出');
        } catch (error) {
            showToast(error.message, true);
        } finally {
            setLoading(false);
        }
    }

    function responseLabel(minutes) {
        if (minutes === null || minutes === undefined) return '-';
        const value = Number(minutes);
        if (value < 60) return `${Math.round(value)} 分钟`;
        return `${(value / 60).toFixed(1)} 小时`;
    }

    function renderPeople(items) {
        const body = $('peopleTable');
        body.replaceChildren();
        items.forEach(item => {
            const row = document.createElement('tr');
            const person = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = `${item.sender_name || '未知'}${item.is_me ? ' （我）' : ''}`;
            const id = document.createElement('small');
            id.textContent = item.sender_id || '-';
            person.append(strong, id);
            [item.message_count, item.conversation_count, item.active_days, item.average_length, responseLabel(item.average_response_minutes), item.last_message_time || '-'].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = typeof value === 'number' ? formatNumber(value) : value;
                row.append(cell);
            });
            row.prepend(person);
            body.append(row);
        });
    }

    function openImportDialog() {
        $('importDialog').showModal();
    }

    async function importFiles(fileList) {
        const files = [...fileList].filter(file => /\.txt$/i.test(file.name));
        if (!files.length) {
            showToast('选定目录中没有 TXT 文件', true);
            return;
        }
        $('importDialog').close();
        switchView('manage');
        $('importPanel').hidden = false;
        $('importLog').replaceChildren();
        let processed = 0;
        let imported = 0;
        let skipped = 0;
        let failed = 0;
        const batchSize = 20;
        for (let start = 0; start < files.length; start += batchSize) {
            const batch = files.slice(start, start + batchSize);
            const form = new FormData();
            const relativePaths = batch.map(file => file.webkitRelativePath || file.relativePath || file.name);
            form.append('relativePaths', JSON.stringify(relativePaths));
            form.append('modifiedAts', JSON.stringify(batch.map(file => file.lastModified || 0)));
            batch.forEach(file => form.append('files', file, file.name));
            $('importStage').textContent = `正在导入 ${relativePaths[0]}`;
            try {
                const result = await apiUpload('/api/chat-history/import', form);
                imported += Number(result.imported || 0);
                skipped += Number(result.skipped || 0);
                failed += (result.errors || []).length;
                (result.results || []).forEach(item => appendImportLog(`${item.skipped ? '跳过未变更' : '已导入'} · ${item.relativePath} · ${formatNumber(item.messageCount)} 条`, 'ok'));
                (result.errors || []).forEach(item => appendImportLog(`失败 · ${item.relativePath} · ${item.error}`, 'error'));
            } catch (error) {
                failed += batch.length;
                appendImportLog(`批次导入失败 · ${error.message}`, 'error');
            }
            processed += batch.length;
            const percent = Math.round(processed / files.length * 100);
            $('importProgress').style.width = `${percent}%`;
            $('importCount').textContent = `${processed} / ${files.length}`;
        }
        $('importStage').textContent = `导入完成：新增/更新 ${imported}，跳过 ${skipped}，失败 ${failed}`;
        showToast(failed ? '导入完成，部分文件失败' : '聊天记录导入完成', Boolean(failed));
        state.conversationCache.clear();
        await Promise.all([loadSources(), loadConversations(true)]);
        $('directoryInput').value = '';
        $('filesInput').value = '';
    }

    async function importTestData() {
        $('importDialog').close();
        setLoading(true, '正在生成全场景测试数据…');
        try {
            if (!state.settings.mySenderId) {
                try {
                    const res = await API.put('/api/chat-history/settings', { mySenderId: 'f84300033' });
                    state.settings.mySenderId = res.mySenderId;
                    $('mySenderId').value = res.mySenderId;
                } catch (_err) { /* ignore */ }
            }
            const myId = state.settings.mySenderId || 'f84300033';
            const files = window.ChatTestData ? window.ChatTestData.createTestFiles(myId) : [];
            if (!files.length) throw new Error('测试数据生成器未就绪，请检查脚本加载');
            await importFiles(files);
            showToast('全场景测试聊天数据已导入成功！');
            switchView('chat');
            if (state.conversations && state.conversations.length) {
                await openConversation(state.conversations[0].id);
            }
        } catch (error) {
            showToast(`导入测试数据失败：${error.message}`, true);
        } finally {
            setLoading(false);
        }
    }

    function appendImportLog(message, kind) {
        const line = document.createElement('div');
        line.className = kind === 'error' ? 'log-error' : 'log-ok';
        line.textContent = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`;
        $('importLog').append(line);
        $('importLog').scrollTop = $('importLog').scrollHeight;
    }

    async function clearTestData() {
        const confirmed = window.confirm('确认要清空所有一键导入的测试聊天数据吗？\n\n- 仅删除路径为“测试数据/...”的会话及消息\n- 真实导入的聊天记录将被完整保留\n- 清空后可随时再次一键导入测试数据');
        if (!confirmed) return;
        setLoading(true, '正在清空测试数据…');
        try {
            const res = await API.post('/api/chat-history/sources/clear-test-data');
            showToast(`已成功清空 ${res.deletedCount || 0} 个测试数据源！`);
            state.conversationCache.clear();
            state.activeConversation = null;
            $('chatEmpty').hidden = false;
            $('chatWorkspace').hidden = true;
            await Promise.all([loadSources(1), loadConversations(true)]);
            if (state.activeTab === 'analytics') loadStats();
        } catch (error) {
            showToast(error.message, true);
        } finally {
            setLoading(false);
        }
    }

    async function loadSources(page = 1) {
        if (!state.user || state.user.role !== 'admin') return;
        try {
            state.sourcePage = page;
            const q = $('sourceQuery') ? $('sourceQuery').value.trim() : '';
            const type = $('sourceType') ? $('sourceType').value : '';
            const data = await API.get(`/api/chat-history/sources?${queryString({ q, type, page, limit: 20 })}`);
            const sources = Array.isArray(data) ? data : (data.items || []);
            state.sourceTotal = data.total !== undefined ? data.total : sources.length;
            state.sourceTotalPages = data.totalPages || Math.max(1, Math.ceil(state.sourceTotal / 20));

            if ($('sourceTotalMeta')) {
                $('sourceTotalMeta').textContent = `共 ${formatNumber(state.sourceTotal)} 个数据源${q ? '（搜索结果）' : ''}`;
            }
            if ($('sourcePage')) {
                $('sourcePage').textContent = `${state.sourcePage} / ${state.sourceTotalPages}`;
            }
            if ($('sourcePrev')) $('sourcePrev').disabled = state.sourcePage <= 1;
            if ($('sourceNext')) $('sourceNext').disabled = state.sourcePage >= state.sourceTotalPages;

            const host = $('sourceList');
            host.replaceChildren();
            if (!sources.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-state';
                empty.innerHTML = `<span>🗂️</span><h2>${q ? '没有匹配的数据源' : '尚未导入数据'}</h2><p>${q ? '尝试更改搜索关键词或类型筛选。' : '点击右上角导入 TXT 记录或测试数据。'}</p>`;
                host.append(empty);
                return;
            }
            sources.forEach(source => {
                const row = document.createElement('div');
                row.className = 'source-item';
                
                const info = document.createElement('div');
                info.className = 'source-info';

                const headLine = document.createElement('div');
                headLine.className = 'source-headline';
                
                const typeBadge = document.createElement('span');
                typeBadge.className = `type-badge type-${source.conversation_type || 'other'}`;
                typeBadge.textContent = typeLabels[source.conversation_type] || '其他';

                const name = document.createElement('strong');
                name.className = 'source-name';
                name.textContent = source.display_name || source.relative_path;

                const countBadge = document.createElement('span');
                countBadge.className = 'source-count-badge';
                countBadge.textContent = `${formatNumber(source.message_count)} 条消息`;

                headLine.append(typeBadge, name, countBadge);

                const meta = document.createElement('small');
                meta.className = 'source-meta';
                const sizeStr = formatBytes(source.file_size);
                meta.textContent = `${source.relative_path} · 大小: ${sizeStr} · 导入时间: ${source.imported_at ? source.imported_at.replace('T', ' ').slice(0, 19) : '-'}`;

                info.append(headLine, meta);

                const remove = document.createElement('button');
                remove.className = 'danger-btn';
                remove.type = 'button';
                remove.textContent = '删除';
                remove.addEventListener('click', async () => {
                    const confirmation = window.prompt(`删除后该会话及所有消息将从当前租户消失。\n请输入会话名称“${source.display_name}”确认：`);
                    if (confirmation !== source.display_name) return;
                    try {
                        await API.delete(`/api/chat-history/sources/${encodeURIComponent(source.id)}`);
                        showToast('数据源已删除');
                        state.conversationCache.delete(source.conversation_id);
                        await Promise.all([loadSources(state.sourcePage), loadConversations(true)]);
                    } catch (error) { showToast(error.message, true); }
                });
                row.append(info, remove);
                host.append(row);
            });
        } catch (error) { showToast(error.message, true); }
    }

    async function initialize() {
        if (window.location.protocol === 'file:') {
            document.body.innerHTML = '<div class="empty-state" style="height:100vh"><span>🔒</span><h2>请从 Tools Platform 内打开</h2><p>此工具依赖平台的租户数据、登录鉴权和聊天服务。</p></div>';
            return;
        }
        setLoading(true, '正在连接聊天记录服务…');
        try {
            const [user, settings] = await Promise.all([API.get('/api/auth/me'), API.get('/api/chat-history/settings')]);
            state.user = user;
            state.settings = settings;
            document.querySelectorAll('.admin-only').forEach(element => { element.hidden = user.role !== 'admin'; });
            $('tenantHint').textContent = `${user.username} · 租户共享数据 · 个人状态独立`;
            $('mySenderId').value = settings.mySenderId || '';
            await loadConversations(true);
        } catch (error) {
            showToast(error.message, true);
        } finally {
            setLoading(false);
        }
    }

    let directoryDebounce;
    document.querySelectorAll('.top-tab').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
    $('conversationQuery').addEventListener('input', () => { clearTimeout(conversationDebounce); conversationDebounce = setTimeout(() => loadConversations(true), 250); });
    $('conversationType').addEventListener('change', () => loadConversations(true));
    $('unreadFilter').addEventListener('click', () => { state.unreadOnly = !state.unreadOnly; $('unreadFilter').classList.toggle('active', state.unreadOnly); loadConversations(true); });
    $('pinnedFilter').addEventListener('click', () => { state.pinnedOnly = !state.pinnedOnly; $('pinnedFilter').classList.toggle('active', state.pinnedOnly); loadConversations(true); });
    $('loadMoreConversations').addEventListener('click', () => loadConversations(false));
    $('loadOlderMessages').addEventListener('click', loadOlderMessages);
    $('toggleChatSearchBtn')?.addEventListener('click', () => {
        const bar = $('chatSearchbar');
        const willShow = bar.hidden;
        bar.hidden = !willShow;
        $('toggleChatSearchBtn').classList.toggle('active', willShow);
        if (willShow) {
            $('chatSearch').focus();
            $('chatSearch').select();
        }
    });
    $('chatSearch').addEventListener('input', () => {
        $('clearChatInputBtn').hidden = !$('chatSearch').value.trim();
    });
    $('clearChatInputBtn')?.addEventListener('click', () => {
        $('chatSearch').value = '';
        $('clearChatInputBtn').hidden = true;
        $('chatSearch').focus();
    });
    $('chatSearchButton').addEventListener('click', runChatSearch);
    $('chatSearch').addEventListener('keydown', event => {
        if (event.key === 'Enter') runChatSearch();
        if (event.key === 'Escape') {
            if (!$('clearChatSearch').hidden) {
                $('clearChatSearch').click();
            } else {
                $('chatSearch').value = '';
                $('clearChatInputBtn').hidden = true;
            }
        }
    });
    $('chatHitPrev').addEventListener('click', () => showChatHit(state.chatHitIndex - 1));
    $('chatHitNext').addEventListener('click', () => showChatHit(state.chatHitIndex + 1));
    $('clearChatSearch').addEventListener('click', () => {
        $('chatSearch').value = '';
        $('clearChatInputBtn').hidden = true;
        $('clearChatSearch').hidden = true;
        $('chatHitNav').hidden = true;
        state.chatHits = [];
        if (state.activeConversation) openConversation(state.activeConversation.id);
    });
    $('pinButton').addEventListener('click', async () => {
        if (!state.activeConversation) return;
        const next = !Boolean(state.activeConversation.pinned);
        await API.put(`/api/chat-history/conversations/${encodeURIComponent(state.activeConversation.id)}/pin`, { pinned: next });
        state.activeConversation.pinned = next ? 1 : 0;
        $('pinButton').classList.toggle('active', next);
        if (state.conversationCache.has(state.activeConversation.id)) {
            const cached = state.conversationCache.get(state.activeConversation.id);
            if (cached && cached.conversation) cached.conversation.pinned = next ? 1 : 0;
        }
        loadConversations(true);
    });
    $('detailButton').addEventListener('click', () => { $('detailPane').hidden = false; });
    $('closeDetail').addEventListener('click', () => { $('detailPane').hidden = true; });
    $('chatAvatar').addEventListener('click', () => document.body.classList.remove('has-chat'));
    $('mobileBackToConversations')?.addEventListener('click', () => document.body.classList.remove('has-chat'));
    $('returnToSearchButton')?.addEventListener('click', returnToSearch);
    $('chatBackToSearch')?.addEventListener('click', returnToSearch);
    $('dismissSearchBanner')?.addEventListener('click', () => { $('searchReturnBanner').hidden = true; });
    $('searchForm').addEventListener('submit', event => { event.preventDefault(); runGlobalSearch(1); });
    $('searchPrev').addEventListener('click', () => runGlobalSearch(state.searchPage - 1));
    $('searchNext').addEventListener('click', () => runGlobalSearch(state.searchPage + 1));
    $('exportSearch').addEventListener('click', exportSearch);
    $('refreshStats').addEventListener('click', loadStats);
    $('peopleQuery').addEventListener('input', () => { clearTimeout(peopleDebounce); peopleDebounce = setTimeout(loadStats, 250); });
    $('directoryQuery')?.addEventListener('input', () => {
        clearTimeout(directoryDebounce);
        directoryDebounce = setTimeout(() => loadDirectory($('directoryQuery').value.trim()), 250);
    });
    $('exportDirectoryBtn')?.addEventListener('click', exportDirectory);
    $('closeUnidentifiedDialog')?.addEventListener('click', () => $('unidentifiedDialog').close());
    $('closeUnidentifiedBtn')?.addEventListener('click', () => $('unidentifiedDialog').close());
    $('closeEditPersonDialog')?.addEventListener('click', () => $('editPersonDialog').close());
    $('cancelEditPersonBtn')?.addEventListener('click', () => $('editPersonDialog').close());
    $('editPersonForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const senderId = $('editSenderId').value.trim();
        const senderName = $('editSenderName').value.trim();
        const aliasNames = $('editAliasNames').value.trim();
        const syncMessages = $('editSyncMessages').checked;
        if (!senderId || !senderName) return;
        setLoading(true, '正在保存人员映射…');
        try {
            await API.put(`/api/chat-history/directory/${encodeURIComponent(senderId)}`, {
                senderName,
                aliasNames,
                syncMessages
            });
            $('editPersonDialog').close();
            showToast('人员姓名映射已更新');
            state.conversationCache.clear();
            await Promise.all([loadStats(), loadConversations(true)]);
            if (state.activeConversation) openConversation(state.activeConversation.id);
        } catch (error) {
            showToast(error.message, true);
        } finally {
            setLoading(false);
        }
    });
    $('clearTestDataBtn')?.addEventListener('click', clearTestData);
    $('settingsButton').addEventListener('click', () => $('settingsDialog').showModal());
    $('saveSettings').addEventListener('click', async event => {
        event.preventDefault();
        try {
            const result = await API.put('/api/chat-history/settings', { mySenderId: $('mySenderId').value.trim() });
            state.settings.mySenderId = result.mySenderId;
            $('settingsDialog').close();
            showToast('我的工号已保存');
            if (state.activeConversation) openConversation(state.activeConversation.id);
            loadConversations(true);
        } catch (error) { showToast(error.message, true); }
    });
    ['importButton', 'manageImportButton'].forEach(id => $(id)?.addEventListener('click', openImportDialog));
    $('closeImportDialog')?.addEventListener('click', () => $('importDialog').close());
    $('chooseDirectory')?.addEventListener('click', () => $('directoryInput').click());
    $('chooseFiles')?.addEventListener('click', () => $('filesInput').click());
    $('chooseTestData')?.addEventListener('click', importTestData);
    $('manageTestDataButton')?.addEventListener('click', importTestData);
    $('emptyImportTestData')?.addEventListener('click', importTestData);
    $('emptyImportDirectory')?.addEventListener('click', openImportDialog);
    $('directoryInput')?.addEventListener('change', event => importFiles(event.target.files));
    $('filesInput')?.addEventListener('change', event => importFiles(event.target.files));
    $('sourceQuery')?.addEventListener('input', () => {
        clearTimeout(sourceDebounce);
        sourceDebounce = setTimeout(() => loadSources(1), 250);
    });
    $('sourceType')?.addEventListener('change', () => loadSources(1));
    $('sourcePrev')?.addEventListener('click', () => {
        if (state.sourcePage > 1) loadSources(state.sourcePage - 1);
    });
    $('sourceNext')?.addEventListener('click', () => {
        if (state.sourcePage < state.sourceTotalPages) loadSources(state.sourcePage + 1);
    });
    $('refreshSources')?.addEventListener('click', () => loadSources(state.sourcePage));
    let scrollMemoryTimer;
    $('messageScroller').addEventListener('scroll', () => {
        if (!state.activeConversation || !$('chatHitNav').hidden) return;
        clearTimeout(scrollMemoryTimer);
        scrollMemoryTimer = setTimeout(() => {
            localStorage.setItem(`chat-history-scroll:${state.activeConversation.id}`, String($('messageScroller').scrollTop));
        }, 100);
    }, { passive: true });
    window.addEventListener('tools:languagechange', () => {
        window.parent?.postMessage({ type: 'tools-custom-tool-language', lang: localStorage.getItem('tools_lang') || 'zh-CN' }, window.location.origin);
    });
    document.addEventListener('DOMContentLoaded', initialize);
})();

