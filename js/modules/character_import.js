// --- 角色导入与创建模块 ---

let pendingImportData = null;

async function readDocxTextForChar(arrayBuffer) {
    if (typeof mammoth === 'undefined' || !mammoth || !mammoth.extractRawText) {
        throw new Error('mammoth 库未加载，无法解析 .docx 文件');
    }
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result && result.value ? result.value : '';
}

function parseCharPersonaFromJson(jsonObj) {
    if (!jsonObj) return '';
    // 1. 如果是外层带 data 的结构（如 SillyTavern 导出）
    const target = jsonObj.data || jsonObj;

    // 2. 常见角色卡 persona / description 字段优先
    if (typeof target.persona === 'string' && target.persona.trim()) {
        return target.persona.trim();
    }
    if (typeof target.description === 'string' && target.description.trim()) {
        return target.description.trim();
    }
    if (typeof target.content === 'string' && target.content.trim()) {
        return target.content.trim();
    }

    // 3. 条目数组结构（世界书 / 设定集等）
    let entries = null;
    if (Array.isArray(target)) {
        entries = target;
    } else if (Array.isArray(target.entries)) {
        entries = target.entries;
    } else if (target.entries && typeof target.entries === 'object') {
        entries = Object.values(target.entries);
    } else if (target.character_book && target.character_book.entries) {
        const cb = target.character_book.entries;
        entries = Array.isArray(cb) ? cb : Object.values(cb);
    }

    if (entries && entries.length > 0) {
        const parts = entries.map((item, idx) => {
            if (typeof item === 'string') return item;
            if (!item || typeof item !== 'object') return '';
            const title = item.name || item.title || item.comment || (item.keys && item.keys[0]) || `条目 #${idx + 1}`;
            const body = item.content || item.text || item.value || '';
            if (body && title) {
                return `### ${title}\n${body}`;
            }
            return body || title || '';
        }).filter(p => p && p.trim());
        if (parts.length > 0) {
            return parts.join('\n\n');
        }
    }

    // 4. 普通 JSON 对象 fallback 为格式化文本
    return JSON.stringify(jsonObj, null, 2);
}

function setupAddCharModal() {
    const addCharModal = document.getElementById('add-char-modal');
    const addCharForm = document.getElementById('add-char-form');
    const charDocFileInput = document.getElementById('char-doc-file');
    const charDocStatus = document.getElementById('char-doc-status');
    const charPersonaTextarea = document.getElementById('char-persona');

    // 监听文档导入
    if (charDocFileInput) {
        charDocFileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (charDocStatus) {
                charDocStatus.textContent = `正在解析 ${file.name}...`;
                charDocStatus.style.color = '#888';
            }

            try {
                const lowerName = (file.name || '').toLowerCase();
                let personaText = '';

                if (lowerName.endsWith('.docx')) {
                    const buf = await file.arrayBuffer();
                    personaText = await readDocxTextForChar(buf);
                } else if (lowerName.endsWith('.json')) {
                    const rawJson = await file.text();
                    try {
                        const parsed = JSON.parse(rawJson);
                        personaText = parseCharPersonaFromJson(parsed);
                    } catch (jsonErr) {
                        // 若不是合法的 JSON 则直接保留纯文本
                        personaText = rawJson;
                    }
                } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || file.type.startsWith('text/')) {
                    personaText = await file.text();
                } else {
                    throw new Error('仅支持 .docx / .txt / .json / .md 格式');
                }

                if (charPersonaTextarea) {
                    charPersonaTextarea.value = personaText;
                }

                if (charDocStatus) {
                    charDocStatus.textContent = `✓ 已成功导入 ${file.name}（${personaText.length} 字符）`;
                    charDocStatus.style.color = '#34c759';
                }
            } catch (err) {
                console.error('人设文档解析失败:', err);
                if (charDocStatus) {
                    charDocStatus.textContent = `✗ 解析失败：${err.message || err}`;
                    charDocStatus.style.color = '#ff3b30';
                }
                showToast('人设文档解析失败');
            }
        });
    }

    // modal 关闭或提交后重置文件选择与状态
    if (addCharModal) {
        const observer = new MutationObserver(() => {
            if (!addCharModal.classList.contains('visible')) {
                if (charDocFileInput) charDocFileInput.value = '';
                if (charDocStatus) {
                    charDocStatus.textContent = '';
                    charDocStatus.style.color = '#888';
                }
                if (charPersonaTextarea) {
                    charPersonaTextarea.value = '';
                }
            }
        });
        observer.observe(addCharModal, { attributes: true, attributeFilter: ['class'] });
    }

    if (addCharForm) {
        addCharForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const personaValue = charPersonaTextarea ? charPersonaTextarea.value.trim() : '';
            const newChar = {
                peekData: {}, 
                id: `char_${Date.now()}`,
                realName: document.getElementById('char-real-name').value,
                remarkName: document.getElementById('char-remark-name').value,
                persona: personaValue,
                avatar: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
                myName: document.getElementById('my-name-for-char').value || 'user',
                myRemarkName: '',
                myPersona: '',
                myAvatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
                theme: 'white_pink',
                maxMemory: 100,
                chatBg: '',
                history: [],
                isPinned: false,
                status: '在线',
                worldBookIds: [],
                useCustomBubbleCss: false,
                customBubbleCss: '',
                bilingualBubbleStyle: 'under',
                unreadCount: 0,
                memoryJournals: [],
                journalWorldBookIds: [],
                peekScreenSettings: { wallpaper: '', customIcons: {}, unlockAvatar: '' },
                lastUserMessageTimestamp: null,
                statusPanel: {
                    enabled: false,
                    promptSuffix: '',
                    regexPattern: '',
                    replacePattern: '',
                    historyLimit: 3,
                    currentStatusRaw: '',
                    currentStatusHtml: '',
                    history: []
                },
                autoReply: {
                    enabled: false,
                    mode: 'fixed',
                    interval: 60,
                    minInterval: 60,
                    maxInterval: 180,
                    nextRandomIntervalMs: null,
                    quietHours: {
                        enabled: false,
                        start: '23:00',
                        end: '07:00'
                    },
                    failureCount: 0,
                    retryAt: 0,
                    lastTriggerTime: 0
                }
            };
            db.characters.push(newChar);
            await saveData();
            renderChatList();
            addCharModal.classList.remove('visible');
            if (charDocFileInput) charDocFileInput.value = '';
            if (charDocStatus) charDocStatus.textContent = '';
            if (charPersonaTextarea) charPersonaTextarea.value = '';
            showToast(`角色“${newChar.remarkName}”创建成功！`);
            promptForBackupIfNeeded('new_char');
        });
    }
}

async function handleCharacterImport(file) {
    if (!file) return;
    showToast('正在解析角色卡...');
    try {
        let result;
        if (file.name.endsWith('.png')) {
            result = await parseCharPng(file);
        } else if (file.name.endsWith('.json')) {
            result = await parseCharJson(file);
        } else {
            throw new Error('不支持的文件格式。请选择 .png 或 .json 文件。');
        }

        if (result) {
            showImportConfirmModal(result.data, result.avatar);
        }
    } catch (error) {
        console.error('角色卡导入失败:', error);
        showToast(`导入失败: ${error.message}`);
    }
}

function parseCharPng(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                const view = new DataView(buffer);
                const signature = [137, 80, 78, 71, 13, 10, 26, 10];
                for (let i = 0; i < signature.length; i++) {
                    if (view.getUint8(i) !== signature[i]) {
                        return reject(new Error('文件不是一个有效的PNG。'));
                    }
                }

                let offset = 8;
                let charaData = null;

                while (offset < view.byteLength) {
                    const length = view.getUint32(offset);
                    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
                    
                    if (type === 'tEXt') {
                        const textChunk = new Uint8Array(buffer, offset + 8, length);
                        let separatorIndex = -1;
                        for(let i = 0; i < textChunk.length; i++) {
                            if (textChunk[i] === 0) {
                                separatorIndex = i;
                                break;
                            }
                        }

                        if (separatorIndex !== -1) {
                            const keyword = new TextDecoder('utf-8').decode(textChunk.slice(0, separatorIndex));
                            if (keyword === 'chara') {
                                const base64Data = new TextDecoder('utf-8').decode(textChunk.slice(separatorIndex + 1));
                                try {
                                    const decodedString = atob(base64Data);
                                    const bytes = new Uint8Array(decodedString.length);
                                    for (let i = 0; i < decodedString.length; i++) {
                                        bytes[i] = decodedString.charCodeAt(i);
                                    }
                                    const utf8Decoder = new TextDecoder('utf-8');
                                    charaData = JSON.parse(utf8Decoder.decode(bytes));
                                    break;
                                } catch (decodeError) {
                                    return reject(new Error(`解析角色数据失败: ${decodeError.message}`));
                                }
                            }
                        }
                    }
                    offset += 12 + length;
                }

                if (charaData) {
                    const imageReader = new FileReader();
                    imageReader.readAsDataURL(file);
                    imageReader.onload = (imgEvent) => {
                        resolve({ data: charaData, avatar: imgEvent.target.result });
                    };
                    imageReader.onerror = () => {
                        resolve({ data: charaData, avatar: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg' });
                    };
                } else {
                    reject(new Error('在PNG中未找到有效的角色数据 (tEXt chunk not found or invalid)。'));
                }
            } catch (error) {
                reject(new Error(`解析PNG失败: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('读取PNG文件失败。'));
    });
}

function parseCharJson(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                resolve({ data: data, avatar: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg' });
            } catch (error) {
                reject(new Error(`解析JSON失败: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('读取JSON文件失败。'));
    });
}

async function createCharacterFromData(data, avatar) {
    const charData = data.data || data;

    if (!charData || !charData.name) {
        throw new Error('角色卡数据无效，缺少角色名称。');
    }

    const newChar = {
        peekData: {},
        id: `char_${Date.now()}`,
        realName: charData.name || '未命名',
        remarkName: charData.name || '未命名',
        persona: charData.description || charData.persona || '',
        avatar: avatar || 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
        myName: 'user',
        myRemarkName: '',
        myPersona: '',
        myAvatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
        theme: 'white_pink',
        maxMemory: 100,
        chatBg: '',
        history: [],
        isPinned: false,
        status: '在线',
            worldBookIds: [],
            useCustomBubbleCss: false,
            customBubbleCss: '',
            bilingualBubbleStyle: 'under',
            unreadCount: 0,
        memoryJournals: [],
        journalWorldBookIds: [],
        peekScreenSettings: { wallpaper: '', customIcons: {}, unlockAvatar: '' },
        lastUserMessageTimestamp: null,
        statusPanel: {
            enabled: false,
            promptSuffix: '',
            regexPattern: '',
            replacePattern: '',
            historyLimit: 3,
            currentStatusRaw: '',
            currentStatusHtml: '',
            history: []
        },
        autoReply: {
            enabled: false,
            interval: 60,
            lastTriggerTime: 0
        }
    };

    const importedWorldBookIds = [];
    
    if (charData.character_book && Array.isArray(charData.character_book.entries)) {
        const categoryName = data.name || charData.name;
        
        let folderId = null;
        let folder = db.worldBooks.find(item => item.type === 'folder' && item.name === categoryName && !item.parentId);
        if (folder) {
            folderId = folder.id;
        } else {
            folderId = `wb_f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            db.worldBooks.push({
                id: folderId,
                parentId: null,
                type: 'folder',
                name: categoryName
            });
        }

        charData.character_book.entries.forEach(entry => {
            const name = entry.comment;
            const content = entry.content;
            if (name && content) {
                // 策略：内容相同则复用，内容不同则重命名导入
                const exactMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase() && wb.content === content);
                if (exactMatch) {
                    if (!importedWorldBookIds.includes(exactMatch.id)) importedWorldBookIds.push(exactMatch.id);
                } else {
                    // 检查是否已经导入过重命名版本
                    const renamedName = `${name} (${categoryName})`;
                    const renamedMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === renamedName.toLowerCase() && wb.content === content);
                    
                    if (renamedMatch) {
                        if (!importedWorldBookIds.includes(renamedMatch.id)) importedWorldBookIds.push(renamedMatch.id);
                    } else {
                        // 需要新建
                        let newBookName = name;
                        const nameConflict = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase());
                        if (nameConflict) {
                            newBookName = renamedName;
                            // 二次冲突检查
                            if (db.worldBooks.some(wb => wb.name.toLowerCase() === newBookName.toLowerCase())) {
                                newBookName = `${newBookName}_${Math.random().toString(36).substr(2, 4)}`;
                            }
                        }
                        
                        let entryDepth = 100;
                        if (entry.insertion_order !== undefined) {
                            entryDepth = parseInt(entry.insertion_order);
                        } else if (entry.depth !== undefined) {
                            entryDepth = parseInt(entry.depth);
                        } else if (entry.extensions && entry.extensions.depth !== undefined) {
                            entryDepth = parseInt(entry.extensions.depth);
                        }

                        const newBook = {
                            id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            parentId: folderId,
                            type: 'entry',
                            name: newBookName,
                            content: content,
                            position: 'after',
                            category: categoryName,
                            depth: isNaN(entryDepth) ? 100 : entryDepth
                        };
                        db.worldBooks.push(newBook);
                        importedWorldBookIds.push(newBook.id);
                    }
                }
            }
        });
    }
    else {
        const worldInfo = charData.world_info || charData.wi || '';
        if (worldInfo && typeof worldInfo === 'string' && worldInfo.trim() !== '') {
            const entries = worldInfo.split(/\n\s*\n/).filter(entry => entry.trim() !== '');
            
            if (entries.length > 0) {
                const categoryName = charData.name || '导入的角色设定';
                
                let folderId = null;
                let folder = db.worldBooks.find(item => item.type === 'folder' && item.name === categoryName && !item.parentId);
                if (folder) {
                    folderId = folder.id;
                } else {
                    folderId = `wb_f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    db.worldBooks.push({
                        id: folderId,
                        parentId: null,
                        type: 'folder',
                        name: categoryName
                    });
                }

                entries.forEach(entryText => {
                    const lines = entryText.trim().split('\n');
                    if (lines.length > 0) {
                        const name = lines[0].trim();
                        const content = lines.slice(1).join('\n').trim();
                        if (name && content) {
                        // 策略：内容相同则复用，内容不同则重命名导入
                        const exactMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase() && wb.content === content);
                        if (exactMatch) {
                            if (!importedWorldBookIds.includes(exactMatch.id)) importedWorldBookIds.push(exactMatch.id);
                        } else {
                            // 检查是否已经导入过重命名版本
                            const renamedName = `${name} (${charData.name || '未命名'})`;
                            const renamedMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === renamedName.toLowerCase() && wb.content === content);
                            
                            if (renamedMatch) {
                                if (!importedWorldBookIds.includes(renamedMatch.id)) importedWorldBookIds.push(renamedMatch.id);
                            } else {
                                // 需要新建
                                let newBookName = name;
                                const nameConflict = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase());
                                if (nameConflict) {
                                    newBookName = renamedName;
                                    // 二次冲突检查
                                    if (db.worldBooks.some(wb => wb.name.toLowerCase() === newBookName.toLowerCase())) {
                                        newBookName = `${newBookName}_${Math.random().toString(36).substr(2, 4)}`;
                                    }
                                }
                                
                                const newBook = {
                                    id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                    parentId: folderId,
                                    type: 'entry',
                                    name: newBookName,
                                    content: content,
                                    position: 'after',
                                    category: categoryName
                                };
                                db.worldBooks.push(newBook);
                                importedWorldBookIds.push(newBook.id);
                            }
                        }
                    }
                }
                });
            }
        }
    }
    
    if (importedWorldBookIds.length > 0) {
        newChar.worldBookIds = importedWorldBookIds;
        setTimeout(() => {
            showToast(`同时导入了 ${importedWorldBookIds.length} 条世界书设定。`);
        }, 1600);
    }

    db.characters.push(newChar);
    await saveData();
    renderChatList();
    showToast(`角色“${newChar.remarkName}”导入成功！`);
}

function setupImportConfirmModal() {
    const modal = document.getElementById('import-confirm-modal');
    const form = document.getElementById('import-confirm-form');
    const cancelBtn = document.getElementById('cancel-import-btn');
    const nameInput = document.getElementById('import-char-name');

    if (!modal || !form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!pendingImportData) return;

        const newName = nameInput.value.trim();
        if (!newName) return showToast('请输入角色真名');

        // 更新名字
        if (pendingImportData.data.data) {
            // 适配 V2 格式 (data.data.name)
            pendingImportData.data.data.name = newName;
        } else {
            // 适配 V1 格式 (data.name)
            pendingImportData.data.name = newName;
        }

        try {
            await createCharacterFromData(pendingImportData.data, pendingImportData.avatar);
            modal.classList.remove('visible');
            pendingImportData = null;
        } catch (error) {
            console.error(error);
            showToast('创建角色失败: ' + error.message);
        }
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('visible');
        pendingImportData = null;
    });
}

function showImportConfirmModal(data, avatar) {
    const modal = document.getElementById('import-confirm-modal');
    const nameInput = document.getElementById('import-char-name');
    
    if (!modal) return;

    pendingImportData = { data, avatar };
    
    // 获取原始名字
    let originalName = '';
    if (data.data && data.data.name) {
        originalName = data.data.name;
    } else if (data.name) {
        originalName = data.name;
    }

    nameInput.value = originalName;
    modal.classList.add('visible');
}
