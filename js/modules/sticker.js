// --- 表情包管理 (js/modules/sticker.js) ---

async function setupStickerSystem() {
    const stickerMenuBtn = document.getElementById('sticker-menu-btn');
    const stickerMenuActionSheet = document.getElementById('sticker-menu-actionsheet');
    const stickerCategoryBar = document.getElementById('sticker-category-bar');
    
    const menuMultiSelectBtn = document.getElementById('menu-multi-select-btn');
    const menuBatchImportBtn = document.getElementById('menu-batch-import-btn');
    const menuDocImportBtn = document.getElementById('menu-doc-import-btn');
    const menuAddNewBtn = document.getElementById('menu-add-new-btn');
    const menuCancelBtn = document.getElementById('menu-cancel-btn');

    const deleteSelectedStickersBtn = document.getElementById('delete-selected-stickers-btn');
    const moveStickerGroupBtn = document.getElementById('move-sticker-group-btn');
    const stickerManageBar = document.getElementById('sticker-manage-bar');
    const selectAllStickersBtn = document.getElementById('select-all-stickers-btn');

    const moveStickerModal = document.getElementById('move-sticker-modal');
    const moveTargetGroupInput = document.getElementById('move-target-group-input');
    const confirmMoveStickerBtn = document.getElementById('confirm-move-sticker-btn');
    const cancelMoveStickerBtn = document.getElementById('cancel-move-sticker-btn');
    const existingGroupsList = document.getElementById('existing-groups-list');

    const batchAddStickerModal = document.getElementById('batch-add-sticker-modal');
    const batchAddStickerForm = document.getElementById('batch-add-sticker-form');
    const stickerUrlsTextarea = document.getElementById('sticker-urls-textarea');
    const batchStickerGroupInput = document.getElementById('batch-sticker-group');
    const addStickerModal = document.getElementById('add-sticker-modal');
    const addStickerForm = document.getElementById('add-sticker-form');
    const stickerNameInput = document.getElementById('sticker-name');
    const stickerGroupInput = document.getElementById('sticker-group');
    const stickerEditIdInput = document.getElementById('sticker-edit-id');
    const stickerPreview = document.getElementById('sticker-preview');
    const stickerUrlInput = document.getElementById('sticker-url-input');
    const stickerFileUpload = document.getElementById('sticker-file-upload');
    const addStickerModalTitle = document.getElementById('add-sticker-modal-title');

    stickerMenuBtn.addEventListener('click', () => {
        if (isStickerManageMode) {
            exitStickerManageMode();
        } else {
            stickerMenuActionSheet.classList.add('visible');
        }
    });

    menuCancelBtn.addEventListener('click', () => stickerMenuActionSheet.classList.remove('visible'));

    menuMultiSelectBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        enterStickerManageMode();
    });

    function enterStickerManageMode() {
        isStickerManageMode = true;
        stickerManageBar.style.display = 'block';
        
        stickerMenuBtn.innerHTML = '<span style="font-size:14px; font-weight:bold; color:var(--primary-color);">完成</span>';
        selectedStickerIds.clear();
        updateStickerSelectCount();
        renderStickerGrid(); 
    }

    function exitStickerManageMode() {
        isStickerManageMode = false;
        stickerManageBar.style.display = 'none';
        
        stickerMenuBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" /></svg>';
        selectedStickerIds.clear();
        renderStickerGrid();
    }

    function updateStickerSelectCount() {
        const count = selectedStickerIds.size;
        document.getElementById('sticker-select-count').textContent = `已选 ${count} 项`;
        deleteSelectedStickersBtn.disabled = count === 0;
        moveStickerGroupBtn.disabled = count === 0;
    }

    menuBatchImportBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        batchAddStickerModal.classList.add('visible');
        stickerUrlsTextarea.value = '';
        batchStickerGroupInput.value = '';
    });

    // ===== 从文档导入表情（支持 .txt / .md / .docx） =====
    const docImportStickerModal = document.getElementById('doc-import-sticker-modal');
    const docImportStickerForm = document.getElementById('doc-import-sticker-form');
    const docImportGroupInput = document.getElementById('doc-import-sticker-group');
    const docImportFileInput = document.getElementById('doc-import-sticker-file');
    const docImportPreview = document.getElementById('doc-import-sticker-preview');
    const docImportCount = document.getElementById('doc-import-count');
    const docImportCancelBtn = document.getElementById('doc-import-cancel-btn');

    function refreshDocImportCount() {
        const text = (docImportPreview.value || '').trim();
        if (!text) {
            docImportCount.textContent = '0';
            return;
        }
        const lines = text.split('\n');
        let count = 0;
        for (const line of lines) {
            const t = line.trim().replace('：', ':');
            if (!t) continue;
            const ci = t.indexOf(':');
            if (ci > 0 && t.substring(ci + 1).trim().startsWith('http')) count++;
        }
        docImportCount.textContent = String(count);
    }

    // 解析后的文本先入预览框（用户可编辑），点"开始导入"才真正入库
    async function handleDocImportFile(file) {
        if (!file) return;
        const nameLower = file.name.toLowerCase();
        docImportPreview.value = `⏳ 正在解析 ${file.name} ...`;
        docImportCount.textContent = '0';
        try {
            let text = '';
            if (nameLower.endsWith('.docx')) {
                // 用项目已有的 mammoth 把 docx 转纯文本（项目已通过 CDN 引入 mammoth@1.4.21）
                if (typeof mammoth === 'undefined') {
                    throw new Error('mammoth 库未加载，请检查网络连接');
                }
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                text = (result && result.value) ? result.value : '';
                if (result && result.messages && result.messages.length) {
                    console.log('[doc-import] mammoth warnings:', result.messages);
                }
            } else if (nameLower.endsWith('.txt') || nameLower.endsWith('.md') || file.type === 'text/plain') {
                text = await file.text();
            } else {
                throw new Error('暂不支持的文件类型：' + (file.type || file.name));
            }
            // 规范化换行 + 过滤空行
            text = text.replace(/\r\n?/g, '\n');
            docImportPreview.value = text.trim();
            refreshDocImportCount();
            showToast(`已解析 ${file.name}`);
        } catch (err) {
            console.error('[doc-import] 解析失败:', err);
            docImportPreview.value = '';
            refreshDocImportCount();
            showToast('解析失败：' + (err && err.message ? err.message : String(err)));
        }
    }

    menuDocImportBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        docImportGroupInput.value = '';
        docImportFileInput.value = '';
        docImportPreview.value = '';
        docImportCount.textContent = '0';
        docImportStickerModal.classList.add('visible');
    });

    docImportCancelBtn.addEventListener('click', () => {
        docImportStickerModal.classList.remove('visible');
    });

    docImportFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleDocImportFile(file);
    });

    // 用户编辑预览文本时实时刷新计数
    docImportPreview.addEventListener('input', refreshDocImportCount);

    docImportStickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textInput = (docImportPreview.value || '').trim();
        const groupName = docImportGroupInput.value.trim();
        if (!textInput) return showToast('请先选择文件或在预览框粘贴 名称:URL 数据');
        if (!groupName) return showToast('请填写分组名称');
        const lines = textInput.split('\n');
        const newStickers = [];
        for (const line of lines) {
            let trimmedLine = line.trim().replace('：', ':');
            if (!trimmedLine) continue;
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex <= 0) continue;
            const name = trimmedLine.substring(0, colonIndex).trim();
            const url = trimmedLine.substring(colonIndex + 1).trim();
            if (name && url.startsWith('http')) {
                newStickers.push({
                    id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: name,
                    data: url,
                    group: groupName,
                    lastUsedTime: Date.now()
                });
            }
        }
        if (newStickers.length > 0) {
            db.myStickers.push(...newStickers);
            await saveData();
            docImportStickerModal.classList.remove('visible');
            showToast(`文档导入成功，新增 ${newStickers.length} 个表情`);
            renderStickerCategories();
            renderStickerGrid();
        } else {
            showToast('未识别到有效的 名称:URL 数据');
        }
    });

    menuAddNewBtn.addEventListener('click', () => {
        stickerMenuActionSheet.classList.remove('visible');
        addStickerModalTitle.textContent = '添加新表情';
        addStickerForm.reset();
        stickerEditIdInput.value = '';
        stickerPreview.innerHTML = '<span>预览</span>';
        stickerUrlInput.disabled = false;
        addStickerModal.classList.add('visible');
    });

    selectAllStickersBtn.addEventListener('click', () => {
        let stickersToSelect = [];
        
        if (currentStickerCategory === 'recent') {
            stickersToSelect = [...db.myStickers]
                .sort((a, b) => (b.lastUsedTime || 0) - (a.lastUsedTime || 0))
                .slice(0, 20);
        } else if (currentStickerCategory === 'all') {
            stickersToSelect = [...db.myStickers];
        } else if (currentStickerCategory === 'ungrouped') {
            stickersToSelect = db.myStickers.filter(s => !s.group);
        } else {
            stickersToSelect = db.myStickers.filter(s => s.group === currentStickerCategory);
        }

        stickersToSelect.forEach(s => selectedStickerIds.add(s.id));
        
        updateStickerSelectCount();
        renderStickerGrid();
        showToast(`已全选当前分组 ${stickersToSelect.length} 个表情`);
    });

    deleteSelectedStickersBtn.addEventListener('click', async () => {
        if (selectedStickerIds.size === 0) return;
        if (confirm(`确定要删除这 ${selectedStickerIds.size} 个表情吗？`)) {
            const idsToDelete = Array.from(selectedStickerIds);

            await dexieDB.myStickers.bulkDelete(idsToDelete);

            db.myStickers = db.myStickers.filter(s => !selectedStickerIds.has(s.id));
            
            await saveData();
            
            showToast('表情已彻底删除');
            exitStickerManageMode();
        }
    });

    moveStickerGroupBtn.addEventListener('click', () => {
        existingGroupsList.innerHTML = '';
        const groups = [...new Set(db.myStickers.map(s => s.group).filter(g => g))];
        groups.forEach(g => {
            const option = document.createElement('option');
            option.value = g;
            existingGroupsList.appendChild(option);
        });
        
        moveTargetGroupInput.value = '';
        moveStickerModal.classList.add('visible');
    });

    cancelMoveStickerBtn.addEventListener('click', () => moveStickerModal.classList.remove('visible'));

    confirmMoveStickerBtn.addEventListener('click', async () => {
        const newGroup = moveTargetGroupInput.value.trim();
        
        db.myStickers.forEach(s => {
            if (selectedStickerIds.has(s.id)) {
                s.group = newGroup;
            }
        });
        
        await saveData();
        showToast('分组已更新');
        moveStickerModal.classList.remove('visible');
        exitStickerManageMode();
        renderStickerCategories(); 
        renderStickerGrid();
    });

    stickerCategoryBar.addEventListener('click', (e) => {
        const item = e.target.closest('.sticker-category-item');
        if (item) {
            currentStickerCategory = item.dataset.category;
            renderStickerCategories(); 
            renderStickerGrid(); 
        }
    });

    batchAddStickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textInput = stickerUrlsTextarea.value.trim();
        const groupName = batchStickerGroupInput.value.trim();
        if (!textInput) return showToast('请输入数据');
        const lines = textInput.split('\n');
        const newStickers = [];
        for (const line of lines) {
            let trimmedLine = line.trim().replace('：', ':');
            if (!trimmedLine) continue;
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex <= 0) continue;
            const name = trimmedLine.substring(0, colonIndex).trim();
            const url = trimmedLine.substring(colonIndex + 1).trim();
            if (name && url.startsWith('http')) {
                newStickers.push({
                    id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: name,
                    data: url,
                    group: groupName,
                    lastUsedTime: Date.now() 
                });
            }
        }
        if (newStickers.length > 0) {
            db.myStickers.push(...newStickers);
            await saveData();
            batchAddStickerModal.classList.remove('visible');
            showToast(`导入 ${newStickers.length} 个表情`);
            renderStickerCategories();
            renderStickerGrid();
        } else {
            showToast('格式错误');
        }
    });

    addStickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = stickerNameInput.value.trim();
        const group = stickerGroupInput.value.trim();
        const id = stickerEditIdInput.value;
        const previewImg = stickerPreview.querySelector('img');
        const data = previewImg ? previewImg.src : null;
        if (!name || !data) return showToast('请填写完整');
        
        const stickerData = { name, data, group, lastUsedTime: Date.now() };
        
        if (id) {
            const index = db.myStickers.findIndex(s => s.id === id);
            if (index > -1) db.myStickers[index] = { ...db.myStickers[index], ...stickerData };
        } else {
            stickerData.id = `sticker_${Date.now()}`;
            db.myStickers.push(stickerData);
        }
        await saveData();
        addStickerModal.classList.remove('visible');
        showToast('保存成功');
        renderStickerCategories();
        renderStickerGrid();
    });
    
    stickerUrlInput.addEventListener('input', (e) => {
        stickerPreview.innerHTML = `<img src="${e.target.value}" alt="预览">`;
        stickerFileUpload.value = '';
    });
    stickerFileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedUrl = await compressImage(file, {quality: 0.8, maxWidth: 200, maxHeight: 200});
                stickerPreview.innerHTML = `<img src="${compressedUrl}" alt="预览">`;
                stickerUrlInput.value = '';
                stickerUrlInput.disabled = true;
            } catch (error) {
                showToast('压缩失败');
            }
        }
    });

    const stickerToggleBtn = document.getElementById('sticker-toggle-btn');
    stickerToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const msgInput = document.getElementById('message-input');
        const isKeyboardOpen = (document.activeElement === msgInput);
        
        if (msgInput) msgInput.blur(); // 强制收起键盘

        if (isKeyboardOpen) {
             // 键盘 -> 面板：无动画
             showPanel('sticker', true);
        } else {
            if (chatExpansionPanel.classList.contains('visible') && panelStickerArea.style.display !== 'none') {
                showPanel('none'); // 面板 -> 关闭：默认有动画
            } else {
                // 关闭 -> 面板 或 面板(功能) -> 面板(表情)：默认有动画
                showPanel('sticker');
            }
        }
    });
}

function renderStickerCategories() {
    const bar = document.getElementById('sticker-category-bar');
    bar.innerHTML = '';

    const groups = [...new Set(db.myStickers.map(s => s.group).filter(g => g))];
    
    const categories = [
        { id: 'recent', name: '最近使用' },
        { id: 'all', name: '全部' },
        ...groups.map(g => ({ id: g, name: g })),
        { id: 'ungrouped', name: '未分类' }
    ];

    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = `sticker-category-item ${currentStickerCategory === cat.id ? 'active' : ''}`;
        item.textContent = cat.name;
        item.dataset.category = cat.id;
        bar.appendChild(item);
    });
}

function renderStickerGrid() {
    const container = document.getElementById('sticker-grid-container');
    container.innerHTML = '';

    let stickersToShow = [];

    if (currentStickerCategory === 'recent') {
        stickersToShow = [...db.myStickers]
            .sort((a, b) => (b.lastUsedTime || 0) - (a.lastUsedTime || 0))
            .slice(0, 20);
        if (stickersToShow.length === 0) {
            container.innerHTML = '<p style="color:#aaa; text-align:center; grid-column:1/-1; padding:20px;">还没有使用过表情包哦</p>';
            return;
        }
    } else if (currentStickerCategory === 'all') {
        stickersToShow = [...db.myStickers];
    } else if (currentStickerCategory === 'ungrouped') {
        stickersToShow = db.myStickers.filter(s => !s.group);
    } else {
        stickersToShow = db.myStickers.filter(s => s.group === currentStickerCategory);
    }

    if (stickersToShow.length === 0) {
        container.innerHTML = '<p style="color:#aaa; text-align:center; grid-column:1/-1; padding:20px;">该分组下没有表情</p>';
        return;
    }

    stickersToShow.forEach(sticker => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        
        if (isStickerManageMode) {
            item.classList.add('is-managing');
            if (selectedStickerIds.has(sticker.id)) {
                item.classList.add('is-selected');
            }
        }
        
        item.innerHTML = `<img src="${sticker.data}" alt="${sticker.name}"><span style="font-size:10px; margin-top:4px; color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:center;">${sticker.name}</span>`;

        item.addEventListener('click', () => {
            if (isStickerManageMode) {
                if (selectedStickerIds.has(sticker.id)) {
                    selectedStickerIds.delete(sticker.id);
                    item.classList.remove('is-selected');
                } else {
                    selectedStickerIds.add(sticker.id);
                    item.classList.add('is-selected');
                }
                const count = selectedStickerIds.size;
                document.getElementById('sticker-select-count').textContent = `已选 ${count} 项`;
                document.getElementById('delete-selected-stickers-btn').disabled = count === 0;
                document.getElementById('move-sticker-group-btn').disabled = count === 0;
            } else {
                sendSticker(sticker);
            }
        });

        container.appendChild(item);
    });
}

function handleStickerLongPress(stickerId) {
    if (isStickerManageMode) return;
    clearTimeout(longPressTimer);
    currentStickerActionTarget = stickerId;
    document.getElementById('sticker-actionsheet').classList.add('visible');
}

async function sendSticker(sticker) {
    const dbSticker = db.myStickers.find(s => s.id === sticker.id);
    if (dbSticker) {
        dbSticker.lastUsedTime = Date.now();
    }

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
    
    const messageContentForAI = `[${myName}发送的表情包：${sticker.name}]`;
    const message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: messageContentForAI,
        parts: [{type: 'text', text: messageContentForAI}],
        timestamp: Date.now(),
        stickerData: sticker.data 
    };
    if (currentChatType === 'group') {
        message.senderId = 'user_me';
    }
    chat.history.push(message);
    addMessageBubble(message, currentChatId, currentChatType);
    
    await saveData(); 
    renderChatList();
    
    showPanel('none');
}
