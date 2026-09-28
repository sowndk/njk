// --- 世界书功能 (js/modules/worldbook.js) ---

let wbViewMode = 'grid'; // 'grid' 或 'list'
let wbPathStack = [{ id: null, name: '世界书' }];

function enterWorldBookMultiSelectMode(initialId) {
    if (isWorldBookMultiSelectMode) return;
    isWorldBookMultiSelectMode = true;

    document.getElementById('add-world-book-btn').style.display = 'none';
    document.getElementById('world-book-view-toggle-btn').style.display = 'none';
    document.getElementById('cancel-wb-multi-select-btn').style.display = 'inline-block';
    document.getElementById('world-book-multi-select-bar').style.display = 'flex';
    document.querySelector('#world-book-screen .content').style.paddingBottom = '70px';

    selectedWorldBookIds.clear();
    if (initialId) {
        selectedWorldBookIds.add(initialId);
    }

    updateWorldBookSelectCount();
    renderWorldBookList(); 
}

function exitWorldBookMultiSelectMode() {
    isWorldBookMultiSelectMode = false;

    document.getElementById('add-world-book-btn').style.display = 'inline-block';
    document.getElementById('world-book-view-toggle-btn').style.display = 'inline-block';
    document.getElementById('cancel-wb-multi-select-btn').style.display = 'none';
    document.getElementById('world-book-multi-select-bar').style.display = 'none';
    document.querySelector('#world-book-screen .content').style.paddingBottom = '0';

    selectedWorldBookIds.clear();
    renderWorldBookList();
}

function toggleWorldBookSelection(bookId) {
    if (selectedWorldBookIds.has(bookId)) {
        selectedWorldBookIds.delete(bookId);
    } else {
        selectedWorldBookIds.add(bookId);
    }
    updateWorldBookSelectCount();
    renderWorldBookList();
}

function updateWorldBookSelectCount() {
    const count = selectedWorldBookIds.size;
    document.getElementById('world-book-select-count').textContent = `已选择 ${count} 项`;
    document.getElementById('delete-selected-world-books-btn').disabled = count === 0;
    
    const moveBtn = document.getElementById('move-selected-world-books-btn');
    if (moveBtn) {
        moveBtn.disabled = count === 0;
    }
}

async function deleteSelectedWorldBooks() {
    const count = selectedWorldBookIds.size;
    if (count === 0) return;

    if (confirm(`确定要删除这 ${count} 个项目吗？此操作不可恢复。`)) {
        const idsToDelete = Array.from(selectedWorldBookIds);
        
        // 递归删除文件夹及其内容
        const allIdsToDelete = new Set();
        const findChildren = (parentId) => {
            db.worldBooks.forEach(item => {
                if (item.parentId === parentId) {
                    allIdsToDelete.add(item.id);
                    if (item.type === 'folder') findChildren(item.id);
                }
            });
        };
        
        idsToDelete.forEach(id => {
            allIdsToDelete.add(id);
            const item = db.worldBooks.find(wb => wb.id === id);
            if (item && item.type === 'folder') findChildren(id);
        });

        const finalIds = Array.from(allIdsToDelete);
        await dexieDB.worldBooks.bulkDelete(finalIds);
        db.worldBooks = db.worldBooks.filter(book => !allIdsToDelete.has(book.id));
        
        db.characters.forEach(char => {
            if (char.worldBookIds) {
                char.worldBookIds = char.worldBookIds.filter(id => !allIdsToDelete.has(id));
            }
        });
        db.groups.forEach(group => {
            if (group.worldBookIds) {
                group.worldBookIds = group.worldBookIds.filter(id => !allIdsToDelete.has(id));
            }
        });

        await saveData();
        showToast(`已成功删除 ${finalIds.length} 个项目`);
        exitWorldBookMultiSelectMode();
    }
}

async function migrateWorldBookPositions() {
    let migrated = false;
    db.worldBooks.forEach(item => {
        if (item.type === 'entry' && (item.position === 'middle' || item.position === 'center')) {
            item.position = 'before';
            item.depth = 300;
            migrated = true;
        }
    });
    if (migrated) {
        await saveData();
        console.log('Worldbook positions migrated: middle -> before (depth 300)');
    }
}

async function migrateWorldBookCategories() {
    const entriesToMigrate = db.worldBooks.filter(item => item.type === 'entry' && item.category && !item.parentId);
    if (entriesToMigrate.length === 0) return;

    const categories = [...new Set(entriesToMigrate.map(item => item.category))];
    let migrated = false;

    for (const catName of categories) {
        // 查找是否已存在同名文件夹
        let folder = db.worldBooks.find(item => item.type === 'folder' && item.name === catName && !item.parentId);
        
        if (!folder) {
            folder = {
                id: `wb_f_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                parentId: null,
                type: 'folder',
                name: catName
            };
            db.worldBooks.push(folder);
            migrated = true;
        }

        // 迁移属于该分类的条目
        entriesToMigrate.forEach(item => {
            if (item.category === catName) {
                item.parentId = folder.id;
                migrated = true;
            }
        });
    }

    if (migrated) {
        await saveData();
        console.log('Worldbook categories migrated to folders.');
    }
}

async function moveSelectedWorldBooksToCurrent() {
    const count = selectedWorldBookIds.size;
    if (count === 0) return;

    const currentFolder = wbPathStack[wbPathStack.length - 1];
    const targetFolderId = currentFolder.id;
    const targetFolderName = currentFolder.name;

    if (confirm(`确定要将选中的 ${count} 个项目移动到 [${targetFolderName}] 吗？`)) {
        const idsToMove = Array.from(selectedWorldBookIds);
        
        // 循环引用检查：不能将文件夹移动到它自己或它的子文件夹中
        const isDescendant = (parentId, targetId) => {
            if (!parentId) return false;
            if (parentId === targetId) return true;
            const parent = db.worldBooks.find(wb => wb.id === parentId);
            if (parent && parent.parentId) {
                return isDescendant(parent.parentId, targetId);
            }
            return false;
        };

        let hasError = false;
        idsToMove.forEach(id => {
            const item = db.worldBooks.find(wb => wb.id === id);
            if (item && item.type === 'folder') {
                // 检查目标文件夹是否是该文件夹的子孙
                if (targetFolderId === id || isDescendant(targetFolderId, id)) {
                    showToast(`错误：不能将文件夹 [${item.name}] 移动到它自身或其子文件夹中`);
                    hasError = true;
                }
            }
        });

        if (hasError) return;

        // 执行移动
        idsToMove.forEach(id => {
            const item = db.worldBooks.find(wb => wb.id === id);
            if (item) {
                item.parentId = targetFolderId;
            }
        });

        await saveData();
        showToast(`已成功移动 ${count} 个项目`);
        exitWorldBookMultiSelectMode();
    }
}

async function setupWorldBookApp() {
    await migrateWorldBookPositions();
    await migrateWorldBookCategories();
    const addWorldBookBtn = document.getElementById('add-world-book-btn');
    const viewToggleBtn = document.getElementById('world-book-view-toggle-btn');
    const backBtn = document.getElementById('world-book-back-btn');
    const newMenu = document.getElementById('world-book-new-menu');
    
    const editWorldBookForm = document.getElementById('edit-world-book-form');
    const worldBookNameInput = document.getElementById('world-book-name');
    const worldBookContentInput = document.getElementById('world-book-content');
    const worldBookListContainer = document.getElementById('world-book-list-container');
    const worldBookIdInput = document.getElementById('world-book-id');

    // 视图切换
    viewToggleBtn.addEventListener('click', () => {
        wbViewMode = wbViewMode === 'grid' ? 'list' : 'grid';
        document.getElementById('wb-grid-icon').style.display = wbViewMode === 'grid' ? 'block' : 'none';
        document.getElementById('wb-list-icon').style.display = wbViewMode === 'list' ? 'block' : 'none';
        worldBookListContainer.className = wbViewMode === 'grid' ? 'grid-view' : 'list-view';
        renderWorldBookList();
    });

    // 返回逻辑
    backBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡到 body 触发全局 back-btn 逻辑
        if (wbPathStack.length > 1) {
            wbPathStack.pop();
            renderWorldBookList();
        } else {
            switchScreen('home-screen');
        }
    });

    // 编辑界面的返回逻辑
    const editBackBtn = document.querySelector('#edit-world-book-screen .back-btn');
    if (editBackBtn) {
        // 移除可能存在的旧监听器（如果有的话）
        const newEditBackBtn = editBackBtn.cloneNode(true);
        editBackBtn.parentNode.replaceChild(newEditBackBtn, editBackBtn);
        
        newEditBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchScreen('world-book-screen');
        });
    }

    // 新建菜单切换
    addWorldBookBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        newMenu.style.display = newMenu.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
        newMenu.style.display = 'none';
    });

    // 新建文件夹
    document.getElementById('wb-menu-new-folder').addEventListener('click', async () => {
        const name = prompt('请输入文件夹名称：');
        if (name && name.trim()) {
            const currentFolderId = wbPathStack[wbPathStack.length - 1].id;
            const newFolder = {
                id: `wb_f_${Date.now()}`,
                parentId: currentFolderId,
                type: 'folder',
                name: name.trim()
            };
            db.worldBooks.push(newFolder);
            await saveData();
            renderWorldBookList();
        }
    });

    // 新建条目
    document.getElementById('wb-menu-new-entry').addEventListener('click', () => {
        currentEditingWorldBookId = null;
        editWorldBookForm.reset();
        document.getElementById('world-book-id').value = '';
        document.getElementById('world-book-category').value = '';
        document.getElementById('world-book-depth').value = '100';
        document.querySelector('input[name="world-book-position"][value="before"]').checked = true;
        switchScreen('edit-world-book-screen');
    });
    
    editWorldBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = worldBookNameInput.value.trim();
        const content = worldBookContentInput.value.trim();
        const category = document.getElementById('world-book-category').value.trim();
        const position = document.querySelector('input[name="world-book-position"]:checked').value;
        const depth = parseInt(document.getElementById('world-book-depth').value) || 100;
        const currentFolderId = wbPathStack[wbPathStack.length - 1].id;

        if (!name || !content) return showToast('名称和内容不能为空');
        
        if (currentEditingWorldBookId) {
            const book = db.worldBooks.find(wb => wb.id === currentEditingWorldBookId);
            if (book) {
                book.name = name;
                book.content = content;
                book.position = position;
                book.category = category;
                book.depth = depth;
            }
        } else {
            db.worldBooks.push({
                id: `wb_${Date.now()}`, 
                parentId: currentFolderId,
                type: 'entry',
                name, 
                content, 
                position, 
                category,
                depth
            });
        }
        await saveData();
        showToast('世界书条目已保存');
        renderWorldBookList();
        switchScreen('world-book-screen');
    });

    worldBookListContainer.addEventListener('click', e => {
        const itemCard = e.target.closest('.wb-item-card');
        if (!itemCard) return;

        const id = itemCard.dataset.id;
        const item = db.worldBooks.find(wb => wb.id === id);
        if (!item) return;

        if (isWorldBookMultiSelectMode) {
            // 在多选模式下：
            // 1. 如果点击的是图标区域，或者是条目，则切换选中状态
            // 2. 如果点击的是文件夹的其他区域（如名称），则进入文件夹进行导航
            if (e.target.closest('.wb-icon-wrapper') || item.type === 'entry') {
                toggleWorldBookSelection(id);
            } else if (item.type === 'folder') {
                wbPathStack.push({ id: item.id, name: item.name });
                renderWorldBookList();
            }
            return;
        }

        if (item.type === 'folder') {
            wbPathStack.push({ id: item.id, name: item.name });
            renderWorldBookList();
        } else {
            // 编辑条目
            currentEditingWorldBookId = item.id;
            worldBookIdInput.value = item.id;
            worldBookNameInput.value = item.name;
            worldBookContentInput.value = item.content;
            document.getElementById('world-book-category').value = item.category || '';
            document.getElementById('world-book-depth').value = item.depth !== undefined ? item.depth : 100;
            
        // 安全地设置注入位置，如果不是 after 或 guidelines 或 limit_break 则默认为 before
        let positionValue = 'before';
        if (item.position === 'after') positionValue = 'after';
        else if (item.position === 'guidelines') positionValue = 'guidelines';
        else if (item.position === 'limit_break') positionValue = 'limit_break';
        
        const positionRadio = document.querySelector(`input[name="world-book-position"][value="${positionValue}"]`);
        if (positionRadio) positionRadio.checked = true;
            
            switchScreen('edit-world-book-screen');
        }
    });

    // 长按进入多选
    let wbLongPressTimer;
    worldBookListContainer.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.wb-item-card');
        if (!item) return;
        wbLongPressTimer = setTimeout(() => {
            enterWorldBookMultiSelectMode(item.dataset.id);
        }, 600);
    });
    worldBookListContainer.addEventListener('touchend', () => clearTimeout(wbLongPressTimer));
    worldBookListContainer.addEventListener('touchmove', () => clearTimeout(wbLongPressTimer));

    document.getElementById('delete-selected-world-books-btn').addEventListener('click', deleteSelectedWorldBooks);
    document.getElementById('move-selected-world-books-btn').addEventListener('click', moveSelectedWorldBooksToCurrent);
    document.getElementById('cancel-wb-multi-select-btn').addEventListener('click', exitWorldBookMultiSelectMode);
}

function renderWorldBookList() {
    const container = document.getElementById('world-book-list-container');
    const currentFolder = wbPathStack[wbPathStack.length - 1];
    
    // 更新标题
    document.getElementById('world-book-title').textContent = currentFolder.name;
    
    // 过滤当前层级内容
    const currentItems = db.worldBooks.filter(item => {
        if (currentFolder.id === null) {
            return !item.parentId;
        }
        return item.parentId === currentFolder.id;
    });

    document.getElementById('no-world-books-placeholder').style.display = currentItems.length === 0 ? 'block' : 'none';
    container.innerHTML = '';

    currentItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'wb-item-card';
        card.dataset.id = item.id;
        if (isWorldBookMultiSelectMode) {
            card.classList.add('is-selecting');
            if (selectedWorldBookIds.has(item.id)) card.classList.add('selected');
        }

        const isFolder = item.type === 'folder';
        const iconHTML = isFolder 
            ? `<svg class="wb-folder-icon" viewBox="0 0 24 24" width="${wbViewMode === 'grid' ? 32 : 24}" height="${wbViewMode === 'grid' ? 32 : 24}"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`
            : `<svg class="wb-entry-icon" viewBox="0 0 24 24" width="${wbViewMode === 'grid' ? 32 : 24}" height="${wbViewMode === 'grid' ? 32 : 24}"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;

        card.innerHTML = `
            <div class="wb-icon-wrapper">${iconHTML}</div>
            <div class="wb-item-name">${item.name}</div>
        `;
        
        container.appendChild(card);
    });
}

function renderCategorizedWorldBookList(container, books, selectedIds, idPrefix) {
    container.innerHTML = '';
    // 仅显示条目，不显示文件夹
    const entries = books.filter(b => b.type === 'entry');
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<li style="color: #888; text-align: center; padding: 15px;">暂无世界书条目</li>';
        return;
    }

    const groupedBooks = entries.reduce((acc, book) => {
        const category = book.category || '未分类';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(book);
        return acc;
    }, {});

    const sortedCategories = Object.keys(groupedBooks).sort((a, b) => {
        if (a === '未分类') return 1;
        if (b === '未分类') return -1;
        return a.localeCompare(b);
    });

    sortedCategories.forEach(category => {
        const categoryBooks = groupedBooks[category];
        const allInCategorySelected = categoryBooks.every(book => selectedIds.includes(book.id));

        const groupEl = document.createElement('div');
        groupEl.className = 'world-book-category-group';

        groupEl.innerHTML = `
            <div class="world-book-category-header">
                <input type="checkbox" class="category-checkbox" ${allInCategorySelected ? 'checked' : ''}>
                <span class="category-name">${category}</span>
                <span class="category-arrow">▼</span>
            </div>
            <ul class="world-book-items-list">
                ${categoryBooks.map(book => {
                    const isChecked = selectedIds.includes(book.id);
                    return `
                        <li class="world-book-select-item">
                            <input type="checkbox" class="item-checkbox" id="${idPrefix}-${book.id}" value="${book.id}" ${isChecked ? 'checked' : ''}>
                            <label for="${idPrefix}-${book.id}">${book.name}</label>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
        container.appendChild(groupEl);
    });

    container.querySelectorAll('.world-book-category-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return; 
            const group = header.closest('.world-book-category-group');
            group.classList.toggle('open');
        });
    });

    container.querySelectorAll('.category-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const group = e.target.closest('.world-book-category-group');
            const itemCheckboxes = group.querySelectorAll('.item-checkbox');
            itemCheckboxes.forEach(itemCb => {
                itemCb.checked = e.target.checked;
            });
        });
    });

    container.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const group = e.target.closest('.world-book-category-group');
            const categoryCheckbox = group.querySelector('.category-checkbox');
            const allItems = group.querySelectorAll('.item-checkbox');
            const allChecked = Array.from(allItems).every(item => item.checked);
            categoryCheckbox.checked = allChecked;
        });
    });
}

// --- 全屏世界书选择器逻辑 ---
let selectorPathStack = [{ id: null, name: '根目录' }];
let tempSelectedWbIds = new Set();

function openWorldBookSelector(initialSelectedIds) {
    selectorPathStack = [{ id: null, name: '根目录' }];
    tempSelectedWbIds = new Set(initialSelectedIds || []);
    
    document.getElementById('world-book-selection-modal').classList.add('visible');
    renderWorldBookSelectorList();
}

function closeWorldBookSelector() {
    document.getElementById('world-book-selection-modal').classList.remove('visible');
}

function renderWorldBookSelectorList() {
    const container = document.getElementById('world-book-selection-list');
    const currentFolder = selectorPathStack[selectorPathStack.length - 1];
    
    // 更新面包屑
    const breadcrumb = document.getElementById('wb-selector-breadcrumb');
    const backBtn = document.getElementById('wb-selector-back-folder-btn');
    const currentName = document.getElementById('wb-selector-current-folder-name');
    
    if (selectorPathStack.length > 1) {
        backBtn.style.display = 'flex';
        currentName.textContent = currentFolder.name;
    } else {
        backBtn.style.display = 'none';
        currentName.textContent = '根目录';
    }

    // 过滤当前层级内容
    const currentItems = db.worldBooks.filter(item => {
        if (currentFolder.id === null) {
            return !item.parentId;
        }
        return item.parentId === currentFolder.id;
    });

    container.innerHTML = '';

    if (currentItems.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888; font-size: 14px;">文件夹为空</div>';
        return;
    }

    currentItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'wb-selector-row';
        
        const isFolder = item.type === 'folder';
        
        let iconSvg = '';
        if (isFolder) {
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/></svg>`;
        } else {
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M6 11.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>`;
        }

        let rightContent = '';
        if (isFolder) {
            // 检查文件夹内的所有条目是否都被选中
            const getAllChildEntries = (folderId) => {
                let entries = [];
                db.worldBooks.forEach(wb => {
                    if (wb.parentId === folderId) {
                        if (wb.type === 'entry') entries.push(wb.id);
                        else if (wb.type === 'folder') entries = entries.concat(getAllChildEntries(wb.id));
                    }
                });
                return entries;
            };
            const childEntryIds = getAllChildEntries(item.id);
            const isAllChecked = childEntryIds.length > 0 && childEntryIds.every(id => tempSelectedWbIds.has(id));
            
            rightContent = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" class="wb-selector-checkbox folder-selector" ${isAllChecked ? 'checked' : ''} title="全选文件夹内容">
                    <div class="wb-selector-arrow"></div>
                </div>
            `;
        } else {
            const isChecked = tempSelectedWbIds.has(item.id);
            rightContent = `<input type="checkbox" class="wb-selector-checkbox" ${isChecked ? 'checked' : ''}>`;
        }

        row.innerHTML = `
            <div class="wb-selector-icon">${iconSvg}</div>
            <div class="wb-selector-name">${item.name}</div>
            ${rightContent}
        `;

        row.addEventListener('click', (e) => {
            if (isFolder) {
                const folderCheckbox = row.querySelector('.folder-selector');
                // 如果点击的是勾选框，执行全选/取消全选
                if (e.target === folderCheckbox) {
                    const getAllChildEntries = (folderId) => {
                        let entries = [];
                        db.worldBooks.forEach(wb => {
                            if (wb.parentId === folderId) {
                                if (wb.type === 'entry') entries.push(wb.id);
                                else if (wb.type === 'folder') entries = entries.concat(getAllChildEntries(wb.id));
                            }
                        });
                        return entries;
                    };
                    const childEntryIds = getAllChildEntries(item.id);
                    if (folderCheckbox.checked) {
                        childEntryIds.forEach(id => tempSelectedWbIds.add(id));
                    } else {
                        childEntryIds.forEach(id => tempSelectedWbIds.delete(id));
                    }
                    renderWorldBookSelectorList(); // 刷新显示状态
                } else {
                    // 点击其他区域进入文件夹
                    selectorPathStack.push({ id: item.id, name: item.name });
                    renderWorldBookSelectorList();
                }
            } else {
                // 切换选中状态
                const checkbox = row.querySelector('.wb-selector-checkbox');
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                
                if (checkbox.checked) {
                    tempSelectedWbIds.add(item.id);
                } else {
                    tempSelectedWbIds.delete(item.id);
                }
            }
        });

        container.appendChild(row);
    });
}

// 绑定选择器事件
document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('wb-selector-back-folder-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (selectorPathStack.length > 1) {
                selectorPathStack.pop();
                renderWorldBookSelectorList();
            }
        });
    }

    const cancelBtn = document.getElementById('cancel-world-book-selection-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeWorldBookSelector);
    }

setupWbImportDoc();

// === 世界书-从文档导入（docx/txt/json） ===

// === 文档导入辅助:统一返回 {folderName, segments:[{name,content}]} ===
// 嗅探 SillyTavern 角色卡:obj.entries 是 object + 每项含 content
function parseWbImportResult(rawText, ext, fileName) {
    if (!ext) return null;
    const lowerExt = ext.toLowerCase();
    // 只在 .json 分支做 ST 嗅探
    if (lowerExt === '.json') {
        let obj;
        try { obj = JSON.parse(rawText); } catch (e) { return null; }
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
        const ents = obj.entries;
        if (!ents || typeof ents !== 'object' || Array.isArray(ents)) return null;
        // 嗅探:至少有一项含 content 字段(避免误把 {entries:{...}} 这种奇怪结构识别为 ST 卡)
        let probeCount = 0;
        for (const k in ents) {
            if (ents[k] && typeof ents[k] === 'object' && typeof ents[k].content === 'string') {
                probeCount++;
                if (probeCount >= 1) break;
            }
        }
        if (probeCount === 0) return null;
        // 确认是 ST 角色卡,开始转换
        // folderName 用 originalData.name > 文件名去后缀
        const folderName = (obj.originalData && typeof obj.originalData.name === 'string' && obj.originalData.name.trim())
            ? obj.originalData.name.trim()
            : (fileName.replace(/\.[^.]+$/, '').trim() || fileName);
        const segments = [];
        for (const k in ents) {
            const e = ents[k];
            if (!e || typeof e !== 'object') continue;
            // disable=true 跳过
            if (e.disable === true) continue;
            const content = typeof e.content === 'string' ? e.content : '';
            if (!content.trim()) continue;
            // 头部标签:触发词 / 始终开启
            const headParts = [];
            if (e.constant === true) headParts.push('【始终开启】');
            if (Array.isArray(e.key) && e.key.length > 0) {
                headParts.push('【触发词:' + e.key.join(', ') + '】');
            }
            const header = headParts.length ? headParts.join(' ') + '\n' : '';
            // name: comment > key[0] > '条目 N'
            let entryName = '';
            if (typeof e.comment === 'string' && e.comment.trim()) {
                entryName = e.comment.trim();
            } else if (Array.isArray(e.key) && e.key.length > 0 && e.key[0]) {
                entryName = String(e.key[0]).slice(0, 30);
            } else {
                entryName = '条目 ' + (segments.length + 1);
            }
            entryName = entryName.slice(0, 30);
            segments.push({ name: entryName, content: header + content });
        }
        if (!segments.length) return null;
        return { folderName: folderName, segments: segments };
    }
    return null;  // 其它格式走老逻辑
}

function setupWbImportDoc() {
    const menuItem = document.getElementById('wb-menu-import-doc');
    const modal = document.getElementById('wb-import-doc-modal');
    const cancelBtn = document.getElementById('wb-import-doc-cancel');
    const startBtn = document.getElementById('wb-import-doc-start');
    const fileInput = document.getElementById('wb-import-doc-files');
    const statusEl = document.getElementById('wb-import-doc-status');

    if (!menuItem || !modal) return;

    function closeModal() {
        modal.classList.remove('visible');
        if (fileInput) fileInput.value = '';
        if (statusEl) statusEl.textContent = '';
    }

    menuItem.addEventListener('click', function() {
        const newMenu = document.getElementById('world-book-new-menu');
        if (newMenu) newMenu.style.display = 'none';
        if (statusEl) statusEl.textContent = '';
        modal.classList.add('visible');
    });

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    if (startBtn) {
        startBtn.addEventListener('click', async function() {
            const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
            if (!files.length) {
                if (statusEl) statusEl.textContent = '⚠ 请先选择至少一个文档';
                return;
            }
            const modeEl = document.querySelector('input[name="wb-import-doc-mode"]:checked');
            const mode = modeEl ? modeEl.value : 'paragraph';

            startBtn.disabled = true;
            if (statusEl) statusEl.textContent = '⏳ 正在解析...';

            let totalFolders = 0;
            let totalEntries = 0;
            const errors = [];

            const parentId = (typeof wbPathStack !== 'undefined' && wbPathStack.length > 0)
                ? wbPathStack[wbPathStack.length - 1]
                : null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (statusEl) statusEl.textContent = '⏳ 解析中(' + (i+1) + '/' + files.length + '): ' + file.name;

                try {
                    let text = '';
                    const lowerName = file.name.toLowerCase();
                    if (lowerName.endsWith('.docx')) {
                        if (typeof window.mammoth === 'undefined') {
                            throw new Error('mammoth 未加载,无法解析 docx');
                        }
                        const arrayBuffer = await file.arrayBuffer();
                        const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                        text = result.value || '';

                    // [ST-JSON-SNIFF] detect SillyTavern card and short-circuit
                    if (lowerName.endsWith('.json')) {
                        try {
                            const _rawSt = await file.text();
                            const _parsedSt = parseWbImportResult(_rawSt, '.json', file.name);
                            if (_parsedSt) {
                                const _stFolderId = 'wb_imp_f_' + Date.now() + '_' + i;
                                if (typeof db !== 'undefined' && Array.isArray(db.worldBooks)) {
                                    db.worldBooks.push({
                                        id: _stFolderId,
                                        parentId: parentId,
                                        type: 'folder',
                                        name: _parsedSt.folderName,
                                        depth: 100
                                    });
                                    totalFolders++;
                                    for (let _si = 0; _si < _parsedSt.segments.length; _si++) {
                                        const _seg = _parsedSt.segments[_si];
                                        const _entryName = (_seg.name || ('条目 ' + (_si + 1))).slice(0, 30);
                                        db.worldBooks.push({
                                            id: 'wb_imp_e_' + Date.now() + '_' + i + '_' + _si,
                                            parentId: _stFolderId,
                                            type: 'entry',
                                            name: _entryName,
                                            content: _seg.content,
                                            position: 'before',
                                            depth: 100
                                        });
                                        totalEntries++;
                                    }
                                    continue;
                                }
                            }
                        } catch (_ste) {}
                    }

                    } else if (lowerName.endsWith('.json')) {
                        const raw = await file.text();
                        try {
                            const obj = JSON.parse(raw);
                            text = JSON.stringify(obj, null, 2);
                        } catch (je) {
                            throw new Error('JSON 解析失败: ' + je.message);
                        }
                    } else {
                        text = await file.text();
                    }

                    const folderName = file.name.replace(/\.[^.]+$/, '').trim() || file.name;

                    let segments = [];
                    if (mode === 'paragraph') {
                        segments = text.split(/\n\s*\n+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
                    } else {
                        segments = [text.trim()].filter(function(s) { return s.length > 0; });
                    }
                    if (!segments.length) {
                        errors.push(file.name + ': 内容为空');
                        continue;
                    }

                    const folderId = 'wb_imp_f_' + Date.now() + '_' + i;
                    if (typeof db !== 'undefined' && Array.isArray(db.worldBooks)) {
                        db.worldBooks.push({
                            id: folderId,
                            parentId: parentId,
                            type: 'folder',
                            name: folderName,
                            depth: 100
                        });
                        totalFolders++;

                        for (let j = 0; j < segments.length; j++) {
                            const seg = segments[j];
                            let entryName;
                            if (seg && typeof seg === 'object' && typeof seg.name === 'string' && seg.name) {
                                entryName = seg.name.slice(0, 30);
                            } else {
                                const firstLine = String(seg).split('\n')[0].slice(0, 30).trim();
                                entryName = firstLine || ('条目 ' + (j+1));
                            }
                            db.worldBooks.push({
                                id: 'wb_imp_e_' + Date.now() + '_' + i + '_' + j,
                                parentId: folderId,
                                type: 'entry',
                                name: entryName,
                                content: seg,
                                position: 'before',
                                depth: 100
                            });
                            totalEntries++;
                        }
                    } else {
                        throw new Error('db.worldBooks 不存在');
                    }
                } catch (err) {
                    errors.push(file.name + ': ' + (err.message || err));
                }
            }

            if (typeof saveData === 'function') {
                await saveData();
            }
            if (typeof renderWorldBookList === 'function') {
                renderWorldBookList();
            }

            startBtn.disabled = false;
            let msg = '✅ 成功导入 ' + totalFolders + ' 个文件夹 / ' + totalEntries + ' 个条目';
            if (errors.length) {
                msg += '\n⚠ 失败 ' + errors.length + ' 个:\n' + errors.join('\n');
            }
            if (statusEl) statusEl.textContent = msg;

            if (totalFolders > 0 && typeof showToast === 'function') {
                showToast('导入完成: ' + totalFolders + ' 夹 / ' + totalEntries + ' 条');
            }

            if (errors.length === 0) {
                setTimeout(closeModal, 1200);
            }
        });
    }
}


});
