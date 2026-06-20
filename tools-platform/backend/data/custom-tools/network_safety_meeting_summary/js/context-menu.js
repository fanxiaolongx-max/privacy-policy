export function initContextMenu(deckWrapper, thumbDeck, actions) {
    let contextMenu = document.getElementById('pptContextMenu');
    if (!contextMenu) {
        contextMenu = document.createElement('div');
        contextMenu.id = 'pptContextMenu';
        contextMenu.className = 'ppt-context-menu hidden';
        document.body.appendChild(contextMenu);
    }

    const hideMenu = () => {
        contextMenu.classList.add('hidden');
    };

    const showMenu = (x, y, items) => {
        contextMenu.innerHTML = '';
        items.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'ppt-context-menu-divider';
                contextMenu.appendChild(divider);
                return;
            }
            const el = document.createElement('div');
            el.className = `ppt-context-menu-item ${item.danger ? 'danger' : ''}`;
            el.innerHTML = `<i class="${item.icon}"></i> <span>${item.label}</span>`;
            if (item.shortcut) {
                const shortcut = document.createElement('span');
                shortcut.className = 'ppt-context-menu-shortcut';
                shortcut.textContent = item.shortcut;
                shortcut.style.marginLeft = 'auto';
                shortcut.style.opacity = '0.5';
                shortcut.style.fontSize = '10px';
                el.appendChild(shortcut);
            }
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                hideMenu();
                item.action();
            });
            contextMenu.appendChild(el);
        });
        
        contextMenu.classList.remove('hidden');
        
        // Adjust position so it doesn't go off screen
        const rect = contextMenu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x -= rect.width;
        if (y + rect.height > window.innerHeight) y -= rect.height;
        
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    };

    document.addEventListener('click', hideMenu);
    
    // Component Context Menu
    deckWrapper?.addEventListener('contextmenu', e => {
        if (document.body.classList.contains('presentation-mode')) return;
        
        const component = e.target.closest('.ppt-element');
        e.preventDefault();
        
        if (component) {
            // Select component if not already selected
            if (!actions.isComponentSelected(component)) {
                actions.selectComponent(component, e.shiftKey);
            }
            
            showMenu(e.clientX, e.clientY, [
                { icon: 'ph-bold ph-copy', label: '复制', shortcut: 'Cmd/Ctrl+C', action: actions.copyComponents },
                { icon: 'ph-bold ph-scissors', label: '剪切', shortcut: 'Cmd/Ctrl+X', action: actions.cutComponents },
                { icon: 'ph-bold ph-clipboard', label: '粘贴', shortcut: 'Cmd/Ctrl+V', action: actions.pasteComponents },
                { icon: 'ph-bold ph-copy', label: '重复', shortcut: 'Cmd/Ctrl+D', action: actions.duplicateComponents },
                { divider: true },
                { icon: 'ph-bold ph-intersect', label: '组合', shortcut: 'Cmd+G', action: actions.groupComponents },
                { icon: 'ph-bold ph-exclude', label: '取消组合', shortcut: 'Cmd+Shift+G', action: actions.ungroupComponents },
                { divider: true },
                { icon: 'ph-bold ph-caret-up', label: '置于顶层', action: actions.bringToFront },
                { icon: 'ph-bold ph-lock-key', label: '锁定 / 解锁', action: actions.toggleLock },
                { divider: true },
                { icon: 'ph-bold ph-trash', label: '删除', shortcut: 'Del/Backspace', danger: true, action: actions.deleteComponents }
            ]);
        } else {
            // Slide background context menu
            showMenu(e.clientX, e.clientY, [
                { icon: 'ph-bold ph-clipboard', label: '粘贴组件', shortcut: 'Cmd/Ctrl+V', action: actions.pasteComponents },
                { divider: true },
                { icon: 'ph-bold ph-image', label: '更改背景图片', action: actions.changeBackground },
                { icon: 'ph-bold ph-plus', label: '新建幻灯片', action: actions.addSlide }
            ]);
        }
    });

    // Thumbnail Context Menu
    thumbDeck?.addEventListener('contextmenu', e => {
        if (document.body.classList.contains('presentation-mode')) return;
        
        const thumb = e.target.closest('.thumb-item');
        if (!thumb) return;
        e.preventDefault();
        
        const index = Array.from(thumbDeck.children).indexOf(thumb);
        if (index !== -1 && index !== actions.getActiveSlideIndex()) {
            actions.setActiveSlide(index);
        }

        showMenu(e.clientX, e.clientY, [
            { icon: 'ph-bold ph-copy', label: '复制幻灯片', shortcut: 'Cmd/Ctrl+C', action: actions.copySlide },
            { icon: 'ph-bold ph-scissors', label: '剪切幻灯片', shortcut: 'Cmd/Ctrl+X', action: actions.cutSlide },
            { icon: 'ph-bold ph-clipboard', label: '粘贴幻灯片', shortcut: 'Cmd/Ctrl+V', action: actions.pasteSlide },
            { icon: 'ph-bold ph-copy', label: '重复幻灯片', action: actions.duplicateSlide },
            { divider: true },
            { icon: 'ph-bold ph-plus', label: '新建幻灯片', action: actions.addSlide },
            { divider: true },
            { icon: 'ph-bold ph-trash', label: '删除幻灯片', shortcut: 'Del/Backspace', danger: true, action: actions.deleteSlide }
        ]);
    });
}
