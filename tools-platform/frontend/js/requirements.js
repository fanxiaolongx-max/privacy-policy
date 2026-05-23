const ReqApp = {
    requirements: [],
    currentReqId: null,

    init: async function() {
        await this.loadRequirements();
    },

    loadRequirements: async function() {
        try {
            this.requirements = await API.get('/api/requirements');
            this.renderBoard();
        } catch (e) {
            console.error('Failed to load requirements', e);
        }
    },

    renderBoard: function() {
        const board = document.getElementById('reqBoard');
        board.innerHTML = '';

        if (this.requirements.length === 0) {
            board.innerHTML = '<div style="color: #64748b; grid-column: 1 / -1; text-align: center; padding: 40px;">暂无需求，点击右上角提交一个吧！</div>';
            return;
        }

        const sortType = document.getElementById('reqSortSelect') ? document.getElementById('reqSortSelect').value : 'progress';
        let sortedReqs = [...this.requirements];
        
        if (sortType === 'progress') {
            const statusOrder = { '提交': 1, '需求接受': 2, '需求实现中': 3, '需求完成': 4, '验收完成': 5, '需求评价': 6, '已拒绝': 99 };
            sortedReqs.sort((a, b) => {
                const orderA = statusOrder[a.status] || 99;
                const orderB = statusOrder[b.status] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
            });
        } else if (sortType === 'updated') {
            sortedReqs.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        } else if (sortType === 'created') {
            sortedReqs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        sortedReqs.forEach(req => {
            const card = document.createElement('div');
            card.className = 'req-card';
            card.onclick = () => this.openEditModal(req.id);

            const timeStr = new Date(req.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            const statusClass = `status-${req.status.replace(/\s+/g, '')}`;

            // Mini flow chart HTML
            const statuses = ['提交', '需求接受', '需求实现中', '需求完成', '验收完成', '需求评价'];
            const currentIndex = statuses.indexOf(req.status);
            const isRejected = req.status === '已拒绝';

            let miniFlowHtml = '';
            if (isRejected) {
                miniFlowHtml = `<div style="color: #ef4444; font-size: 13px; font-weight: bold; border: 1px dashed #ef4444; padding: 4px 12px; border-radius: 12px; background: rgba(239, 68, 68, 0.1);">❌ 已拒绝采纳</div>`;
            } else {
                miniFlowHtml = `<div style="display:flex; align-items:center;">`;
                statuses.forEach((s, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isActive = idx === currentIndex;
                    let color = '#334155'; // default
                    let fontColor = '#64748b';
                    if (isCompleted) { color = '#10b981'; fontColor = '#cbd5e1'; }
                    if (isActive) { color = '#3b82f6'; fontColor = '#f8fafc'; }
                    
                    miniFlowHtml += `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; position:relative; width: 38px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; z-index: 2; ${isActive ? 'box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);' : ''}"></div>
                            <div style="font-size: 11px; color: ${fontColor}; white-space: nowrap; transform: scale(0.9); ${isActive ? 'font-weight:bold;' : ''}">${s.replace('需求', '')}</div>
                        </div>
                    `;
                    if (idx < statuses.length - 1) {
                        const lineBg = idx < currentIndex ? '#10b981' : '#334155';
                        miniFlowHtml += `<div style="height: 2px; flex: 1; min-width: 15px; max-width: 25px; background: ${lineBg}; margin-top: -16px; margin-left: -4px; margin-right: -4px; z-index: 1;"></div>`;
                    }
                });
                miniFlowHtml += `</div>`;
            }

            card.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <h3 class="req-title" style="margin:0; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.escapeHTML(req.title)}">${this.escapeHTML(req.title)}</h3>
                        <span class="req-status-badge" style="background:rgba(255,255,255,0.1); color:#cbd5e1; margin:0;">${this.escapeHTML(req.category || '未分类')}</span>
                    </div>
                    <div class="req-desc" style="margin-bottom: 6px; -webkit-line-clamp: 1;" title="${this.escapeHTML(req.description || '无详细描述')}">${this.escapeHTML(req.description || '无详细描述')}</div>
                    <div class="req-meta" style="font-size: 12px; color: #64748b;">
                        <span>👤 ${this.escapeHTML(req.creator || 'Guest')}</span>
                        <span style="margin: 0 6px;">|</span>
                        <span>📅 ${timeStr}</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: center; min-width: 320px; padding: 0 10px;">
                    ${miniFlowHtml}
                </div>

                <div style="width: 130px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; border-left: 1px dashed rgba(255,255,255,0.1); padding-left: 16px;">
                    <span class="req-status-badge ${statusClass}" style="margin: 0 0 8px 0; width: 100%; text-align: center; box-sizing: border-box;">${req.status}</span>
                    ${req.assignee ? `<span style="font-size: 12px; color: #94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;" title="${this.escapeHTML(req.assignee)}">🛠️ ${this.escapeHTML(req.assignee)}</span>` : '<span style="font-size: 12px; color: #64748b; font-style: italic;">未分配</span>'}
                </div>
            `;
            board.appendChild(card);
        });
    },

    openCreateModal: function() {
        this.currentReqId = null;
        document.getElementById('modalTitle').textContent = '提交新需求';
        
        // Reset form and enable inputs
        const inputs = ['reqTitleInput', 'reqCategorySelect', 'reqDescInput', 'reqStatusSelect', 'reqAssigneeInput', 'reqRemarkInput'];
        inputs.forEach(id => {
            document.getElementById(id).value = '';
            document.getElementById(id).disabled = false;
        });
        document.getElementById('reqStatusSelect').value = '提交';
        
        // UI visibility
        document.getElementById('manageRow').style.display = 'none';
        document.getElementById('remarkGroup').style.display = 'none';
        document.getElementById('flowchartContainer').style.display = 'none';
        document.getElementById('logsSection').style.display = 'none';
        
        document.getElementById('btnDeleteReq').style.display = 'none';
        document.getElementById('btnSaveReq').style.display = 'block';

        document.getElementById('reqModal').style.display = 'flex';
    },

    openEditModal: async function(id) {
        try {
            const req = await API.get(`/api/requirements/${id}`);
            this.currentReqId = id;
            document.getElementById('modalTitle').textContent = '需求详情与管理';
            
            document.getElementById('reqTitleInput').value = req.title;
            const categorySelect = document.getElementById('reqCategorySelect');
            if (req.category) {
                // Check if option exists, otherwise select default or create option
                const exists = Array.from(categorySelect.options).some(opt => opt.value === req.category);
                if (!exists) {
                    const newOpt = new Option(req.category, req.category);
                    categorySelect.add(newOpt);
                }
                categorySelect.value = req.category;
            } else {
                categorySelect.value = '';
            }
            
            document.getElementById('reqDescInput').value = req.description;
            document.getElementById('reqStatusSelect').value = req.status;
            document.getElementById('reqAssigneeInput').value = req.assignee || '';
            document.getElementById('reqRemarkInput').value = '';

            // Update Flowchart (pass req to access logs)
            this.updateFlowchart(req);

            // Update Select Options to prevent backwards/skipping
            const statuses = ['提交', '需求接受', '需求实现中', '需求完成', '验收完成', '需求评价'];
            const currentIndex = statuses.indexOf(req.status);
            const selectEl = document.getElementById('reqStatusSelect');
            
            for (let i = 0; i < selectEl.options.length; i++) {
                const opt = selectEl.options[i];
                const optVal = opt.value;
                if (req.status === '已拒绝') {
                    opt.disabled = optVal !== '已拒绝';
                } else if (optVal === '已拒绝') {
                    opt.disabled = false;
                } else {
                    const optIndex = statuses.indexOf(optVal);
                    // 允许留在当前状态，或前进一格
                    if (optIndex < currentIndex || optIndex > currentIndex + 1) {
                        opt.disabled = true;
                    } else {
                        opt.disabled = false;
                    }
                }
            }

            // Render Logs
            this.renderLogs(req.logs || []);

            // UI visibility
            document.getElementById('manageRow').style.display = 'flex';
            document.getElementById('remarkGroup').style.display = 'block';
            document.getElementById('flowchartContainer').style.display = 'flex';
            document.getElementById('logsSection').style.display = 'block';
            
            // Set inputs state based on admin role
            const isAdmin = localStorage.getItem('tools_role') === 'admin';
            const inputs = ['reqTitleInput', 'reqCategorySelect', 'reqDescInput', 'reqStatusSelect', 'reqAssigneeInput', 'reqRemarkInput'];
            inputs.forEach(id => {
                document.getElementById(id).disabled = !isAdmin;
            });
            
            // Allow delete and save only if admin
            if (isAdmin) {
                document.getElementById('btnDeleteReq').style.display = 'block';
                document.getElementById('btnSaveReq').style.display = 'block';
            } else {
                document.getElementById('btnDeleteReq').style.display = 'none';
                document.getElementById('btnSaveReq').style.display = 'none';
            }

            document.getElementById('reqModal').style.display = 'flex';
        } catch (e) {
            showToast('获取需求详情失败: ' + e.message, 'error');
        }
    },

    closeModal: function() {
        document.getElementById('reqModal').style.display = 'none';
    },

    saveReq: async function() {
        const title = document.getElementById('reqTitleInput').value.trim();
        const category = document.getElementById('reqCategorySelect').value;
        const description = document.getElementById('reqDescInput').value.trim();
        
        if (!title) {
            showToast('需求标题不能为空', 'error');
            return;
        }
        if (!category) {
            showToast('请选择页面分类', 'error');
            return;
        }

        const payload = { title, description, category };

        if (this.currentReqId) {
            payload.status = document.getElementById('reqStatusSelect').value;
            payload.assignee = document.getElementById('reqAssigneeInput').value.trim();
            payload.remark = document.getElementById('reqRemarkInput').value.trim();
        }

        try {
            const btn = document.getElementById('btnSaveReq');
            const originalText = btn.textContent;
            btn.textContent = '保存中...';
            btn.disabled = true;

            if (this.currentReqId) {
                await API.put(`/api/requirements/${this.currentReqId}`, payload);
                showToast('需求已更新', 'success');
            } else {
                await API.post('/api/requirements', payload);
                showToast('需求提交成功', 'success');
            }

            this.closeModal();
            this.loadRequirements();
        } catch (e) {
            showToast('保存失败: ' + e.message, 'error');
        } finally {
            const btn = document.getElementById('btnSaveReq');
            btn.textContent = '保存';
            btn.disabled = false;
        }
    },

    deleteReq: async function() {
        if (!this.currentReqId) return;
        if (!confirm('确定要删除这个需求吗？相关的流转日志也会被删除且不可恢复。')) return;

        try {
            await API.delete(`/api/requirements/${this.currentReqId}`);
            showToast('需求已删除', 'success');
            this.closeModal();
            this.loadRequirements();
        } catch (e) {
            showToast('删除失败: ' + e.message, 'error');
        }
    },

    updateFlowchart: function(req) {
        const currentStatus = req.status;
        const statuses = ['提交', '需求接受', '需求实现中', '需求完成', '验收完成', '需求评价'];
        let currentIndex = statuses.indexOf(currentStatus);
        const isRejected = currentStatus === '已拒绝';
        
        if (isRejected) {
            currentIndex = 0; // 只保留提交状态点亮
        }

        // 计算各个状态的进入时间
        const timeEntered = {};
        timeEntered['提交'] = new Date(req.created_at).getTime();
        
        const logs = req.logs || [];
        logs.forEach(log => {
            if (log.new_status && statuses.includes(log.new_status) && !timeEntered[log.new_status]) {
                timeEntered[log.new_status] = new Date(log.created_at).getTime();
            }
        });
        
        const now = Date.now();
        const getDays = (ms) => Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
        
        const steps = document.querySelectorAll('.flow-step');
        const lines = document.querySelectorAll('.step-line');

        steps.forEach((step, index) => {
            const stepStatus = statuses[index];
            step.className = 'flow-step'; // reset
            
            // 计算并显示停留时间
            let durationText = '';
            if (timeEntered[stepStatus]) {
                const startTime = timeEntered[stepStatus];
                let endTime = now;
                
                if (index < currentIndex && timeEntered[statuses[index + 1]]) {
                    endTime = timeEntered[statuses[index + 1]];
                } else if (isRejected) {
                    const rejectLog = logs.slice().reverse().find(l => l.new_status === '已拒绝');
                    if (rejectLog) endTime = new Date(rejectLog.created_at).getTime();
                } else if (currentStatus === statuses[statuses.length - 1] && index !== statuses.length - 1) {
                     // 正常完结流程，前面节点的endTime已经被限制了，这里是兜底
                }

                const days = getDays(endTime - startTime);
                // 确保至少显示0天，或者可以显示详细的停留天数
                durationText = `<div class="step-duration" style="font-size:10px; color:#64748b; margin-top:2px;">停 ${days} 天</div>`;
            }

            let durEl = step.querySelector('.step-duration');
            if (durEl) {
                if (durationText) durEl.outerHTML = durationText;
                else durEl.remove();
            } else if (durationText) {
                step.insertAdjacentHTML('beforeend', durationText);
            }

            if (isRejected) {
                if (index === 0) step.classList.add('completed');
                else step.style.opacity = '0.2';
            } else {
                step.style.opacity = '';
                if (index < currentIndex) {
                    step.classList.add('completed');
                } else if (index === currentIndex) {
                    step.classList.add('active');
                }
            }
        });

        lines.forEach((line, index) => {
            line.className = 'step-line'; // reset
            if (!isRejected && index < currentIndex) {
                line.classList.add('completed');
            }
        });
    },

    renderLogs: function(logs) {
        const container = document.getElementById('logsTimeline');
        container.innerHTML = '';
        
        if (logs.length === 0) {
            container.innerHTML = '<div style="color:#64748b; font-size:12px;">暂无日志</div>';
            return;
        }

        logs.forEach(log => {
            const dateStr = new Date(log.created_at).toLocaleString('zh-CN', { 
                month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit' 
            });

            const el = document.createElement('div');
            el.className = 'log-item';
            
            let actionText = '';
            if (log.old_status && log.new_status && log.old_status !== log.new_status) {
                actionText = `状态流转：<span style="color:#94a3b8">${log.old_status}</span> ➔ <span style="color:#34d399">${log.new_status}</span>`;
            } else {
                actionText = '更新了信息';
            }

            el.innerHTML = `
                <div class="log-time">${dateStr}</div>
                <div class="log-content">
                    <div class="log-header">
                        <span class="log-operator">${this.escapeHTML(log.operator || 'System')}</span>
                        <span class="log-action">${actionText}</span>
                    </div>
                    ${log.remark ? `<div class="log-remark">${this.escapeHTML(log.remark)}</div>` : ''}
                </div>
            `;
            container.appendChild(el);
        });
    },

    escapeHTML: function(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ReqApp.init();
});
