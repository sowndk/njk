// --- 界面交互逻辑 (js/ui.js) ---

// DOM 元素缓存 (将在脚本加载时初始化)
const homeScreen = document.getElementById('home-screen');
let chatRoomScreen = document.getElementById('chat-room-screen');
let chatExpansionPanel = document.getElementById('chat-expansion-panel');
let panelFunctionArea = document.getElementById('panel-function-area');
let panelStickerArea = document.getElementById('panel-sticker-area');
let messageArea = document.getElementById('message-area');
let chatRoomHeaderDefault = document.getElementById('chat-room-header-default');
let chatRoomHeaderSelect = document.getElementById('chat-room-header-select');
let multiSelectBar = document.getElementById('multi-select-bar');
let multiSelectTitle = document.getElementById('multi-select-title');
let selectCount = document.getElementById('select-count');
let deleteSelectedBtn = document.getElementById('delete-selected-btn');
let chatRoomTitle = document.getElementById('chat-room-title');
let chatRoomStatusText = document.getElementById('chat-room-status-text');
let typingIndicator = document.getElementById('typing-indicator');
let messageInput = document.getElementById('message-input');
let getReplyBtn = document.getElementById('get-reply-btn');
let regenerateBtn = document.getElementById('regenerate-btn');

// 绑定功能面板按钮
function setupAirDropPanelBtn() {
    const airdropPanelBtn = document.getElementById('airdrop-panel-btn');
    if (airdropPanelBtn) {
        // 移除旧的监听器以防重复绑定
        const newBtn = airdropPanelBtn.cloneNode(true);
        airdropPanelBtn.parentNode.replaceChild(newBtn, airdropPanelBtn);
        
        newBtn.addEventListener('click', async () => {
            document.getElementById('chat-expansion-panel').classList.remove('visible');
            if (currentChatType !== 'private') {
                showToast('隔空投送仅支持私聊');
                return;
            }
            const chat = db.characters.find(c => c.id === currentChatId);
            if (!chat) return;

            if (!dexieDB) {
                showToast('数据库未就绪');
                return;
            }

            try {
                const photos = await dexieDB.characterPhotos.where('charId').equals(chat.id).reverse().sortBy('timestamp');
                if (photos.length > 0) {
                    showAirDropPreview(photos[0], chat);
                } else {
                    showToast('TA的相册空空如也');
                }
            } catch (error) {
                console.error("Load AirDrop Error:", error);
                showToast('加载失败');
            }
        });
    }
}

// 屏幕切换
const switchScreen = (targetId) => {
    // 离开聊天室时清理自定义样式
    if (targetId !== 'chat-room-screen') {
        const customStyles = document.querySelectorAll('style[id^="custom-bubble-style-for-"]');
        customStyles.forEach(style => style.remove());
    } else {
        // 返回聊天室时重新应用样式（步骤 18：优先应用"日夜组合预设"，否则走手动 CSS）
        if (typeof currentChatId !== 'undefined' && currentChatId) {
            const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
            if (chat) {
                if (typeof applyChatBubbleCss === 'function') {
                    applyChatBubbleCss(currentChatId, chat);
                } else {
                    updateCustomBubbleStyle(currentChatId, chat.customBubbleCss, chat.useCustomBubbleCss);
                }
            }
        }
    }
    
    // 修复：实时获取所有 screen 元素，确保动态创建的页面也能被正确隐藏
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(targetId);
    if (targetScreen) targetScreen.classList.add('active');
    
    // 关闭所有覆盖层和侧边栏
    const overlays = document.querySelectorAll('.modal-overlay, .action-sheet-overlay, .settings-sidebar');
    overlays.forEach(o => o.classList.remove('visible', 'open'));

    // 离开设置页面时清空CSS预览区域，防止预览样式(可能是全局的)污染其他页面
    if (targetId !== 'chat-settings-screen' && targetId !== 'group-settings-screen') {
        const previewContainers = document.querySelectorAll('.bubble-css-preview');
        previewContainers.forEach(el => el.innerHTML = '');
    }

    // 控制全局底栏显示与状态
    const globalNav = document.getElementById('global-bottom-nav');
    if (globalNav) {
        if (targetId === 'chat-list-screen' || targetId === 'contacts-screen' || targetId === 'more-screen' || targetId === 'phone-screen') {
            globalNav.style.display = 'flex';
            // 更新选中状态
            const navItems = globalNav.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                if (item.getAttribute('data-target') === targetId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        } else {
            globalNav.style.display = 'none';
        }
    }

    if (targetId === 'more-screen') {
        renderMoreScreen();
    }

    if (targetId === 'world-book-screen') {
        if (typeof renderWorldBookList === 'function') renderWorldBookList();
    }
};

function renderMoreScreen() {
    let myName = 'User Name';
    let myAvatar = 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg';

    let activePersona = null;
    if (db.activePersonaId) {
        activePersona = db.myPersonaPresets.find(p => p.id === db.activePersonaId);
    }
    
    if (!activePersona && db.myPersonaPresets && db.myPersonaPresets.length > 0) {
        activePersona = db.myPersonaPresets[0];
    }

    if (activePersona) {
        myName = activePersona.name || 'User';
        myAvatar = activePersona.avatar || myAvatar;
    } else if (db.characters && db.characters.length > 0) {
        const firstChar = db.characters[0];
        myName = firstChar.myName || 'User Name';
        myAvatar = firstChar.myAvatar || 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg';
    }
    
    const avatarEl = document.getElementById('more-my-avatar');
    const nameEl = document.getElementById('more-my-name');
    const dateEl = document.getElementById('more-date-display');

    if (avatarEl) avatarEl.src = myAvatar;
    if (nameEl) nameEl.textContent = myName;
    
    // 更新日期显示 (格式: YYYY#MMDD)
    if (dateEl) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateEl.textContent = `${year}#${month}${day}`;
    }

    // 应用自定义背景图
    const bgLayer = document.querySelector('.glass-background-layer');
    if (bgLayer && db.moreProfileCardBg) {
        bgLayer.style.backgroundImage = `url('${db.moreProfileCardBg}')`;
    }

    // 触发搜索引导
    if (window.GuideSystem) {
        window.GuideSystem.check('guide_search_entry');
    }
}

function setupMoreCardBgModal() {
    const modal = document.getElementById('more-card-bg-modal');
    const form = document.getElementById('more-card-bg-form');
    const preview = document.getElementById('more-card-bg-preview');
    const urlInput = document.getElementById('more-card-bg-url-input');
    const fileUpload = document.getElementById('more-card-bg-file-upload');
    
    // 绑定点击事件到背景层
    // 注意：由于 renderMoreScreen 可能会被多次调用，我们需要使用事件委托或者确保只绑定一次
    // 这里我们使用事件委托绑定到 document，在 renderMoreScreen 中不需要重复绑定
    document.body.addEventListener('click', (e) => {
        // 只要点击了更多界面的个人卡片区域（包括背景和内容），都触发更换背景
        // 这样可以避免因为内容层遮挡背景层导致点击无效
        // 2026-01-21 修改：将点击范围限定在背景层 (glass-background-layer)，避免点击头像/名字触发
        if (e.target.classList.contains('glass-background-layer')) {
            // 打开模态框
            modal.classList.add('visible');
            urlInput.value = '';
            fileUpload.value = null;
            preview.style.backgroundImage = `url('${db.moreProfileCardBg || 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg'}')`;
            preview.innerHTML = '';
        }
    });

    // URL 输入预览
    urlInput.addEventListener('input', () => {
        if (urlInput.value) {
            preview.style.backgroundImage = `url('${urlInput.value}')`;
            preview.innerHTML = '';
        }
    });

    // 文件上传预览
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.style.backgroundImage = `url('${e.target.result}')`;
                preview.innerHTML = '';
                // 临时存储 base64，提交时使用
                fileUpload.dataset.base64 = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // 保存
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        let newBg = db.moreProfileCardBg;

        if (fileUpload.files.length > 0 && fileUpload.dataset.base64) {
            newBg = fileUpload.dataset.base64;
        } else if (urlInput.value) {
            newBg = urlInput.value;
        }

        if (newBg !== db.moreProfileCardBg) {
            db.moreProfileCardBg = newBg;
            await saveData();
            renderMoreScreen(); // 重新渲染以应用更改
            showToast('背景已更新');
        }
        
        modal.classList.remove('visible');
        // 清理
        fileUpload.dataset.base64 = '';
    });
}

// 右键菜单
function createContextMenu(items, x, y) {
    removeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    menu.style.visibility = 'hidden';
    document.body.appendChild(menu);

    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        if (item.danger) menuItem.classList.add('danger');
        menuItem.textContent = item.label;
        menuItem.onclick = () => {
            item.action();
            removeContextMenu();
        };
        menu.appendChild(menuItem);
    });

    const rect = menu.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const padding = 10; // 屏幕边缘间距

    // 水平方向调整
    if (x + rect.width > winWidth - padding) {
        x = winWidth - rect.width - padding;
    }
    if (x < padding) {
        x = padding;
    }
    
    // 垂直方向调整
    if (y + rect.height > winHeight - padding) {
        // 如果下方空间不足，向上弹出
        y = y - rect.height;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.visibility = 'visible';

    document.addEventListener('click', removeContextMenu, {once: true});
}

function removeContextMenu() {
    const menu = document.querySelector('.context-menu');
    if (menu) menu.remove();
}

// 更新气泡样式
function updateCustomBubbleStyle(chatId, css, enabled) {
    const STYLE_TAG_CLASS = 'dynamic-chat-style-tag';
    const existingStyles = document.querySelectorAll(`.${STYLE_TAG_CLASS}, style[id^="custom-bubble-style-for-"]`);
    existingStyles.forEach(el => el.remove());

    if (!enabled || !css) return;

    // 获取 chat 对象以支持模板变量
    let chat = null;
    if (typeof db !== 'undefined') {
        chat = db.characters.find(c => c.id === chatId) || db.groups.find(g => g.id === chatId);
    }

    // 处理模板变量 ({{char_avatar}}, {{user_avatar}} 等)
    // processTemplate 定义在 js/utils.js 中
    const processedCss = (typeof processTemplate === 'function' && chat) ? processTemplate(css, chat) : css;

    const styleElement = document.createElement('style');
    styleElement.id = `custom-bubble-style-for-${chatId}`;
    styleElement.className = STYLE_TAG_CLASS;

    styleElement.textContent = processedCss;

    document.head.appendChild(styleElement);
}

/**
 * 根据预设名查找 db.bubbleCssPresets 中的 CSS 并应用到当前会话。
 * 步骤 18 新增：用于气泡日夜组合预设机制。
 *
 * 行为：
 * - 预设名为空 → 清掉已注入的
 * - 在 db.bubbleCssPresets 找不到该预设名 → 清掉 + 控制台 warn
 * - 找到 → 调 updateCustomBubbleStyle 注入对应 CSS
 * - 不动 chat.customBubbleCss / chat.useCustomBubbleCss（避免污染手动通道）
 */
function applyBubblePresetByName(chatId, presetName) {
    if (!chatId) return;
    const targetPresetName = (presetName || '').trim();
    if (!targetPresetName) {
        const existing = document.getElementById('custom-bubble-style-for-' + chatId);
        if (existing) existing.remove();
        return;
    }
    const presets = (typeof db !== 'undefined' && db && db.bubbleCssPresets) ? db.bubbleCssPresets : [];
    const found = presets.find(function(p) { return p && p.name === targetPresetName; });
    if (!found) {
        console.warn('[applyBubblePresetByName] 预设未找到:', targetPresetName);
        const existing = document.getElementById('custom-bubble-style-for-' + chatId);
        if (existing) existing.remove();
        return;
    }
    updateCustomBubbleStyle(chatId, found.css || '', true);
}

/**
 * 气泡日夜组合预设：根据当前系统日夜模式，从 day/night 两个预设名中选一个应用。
 * 步骤 18 新增。
 *
 * 行为：
 * - 总开关未开（chat.useBubbleDayNightPreset !== true）→ 不动（让手动 CSS 通道走老逻辑）
 * - 系统是白天 → 用 bubbleCssPresetDayName
 * - 系统是夜间 → 用 bubbleCssPresetNightName
 * - 对应预设名为空 → 不切换（保留已有注入或清掉）
 */
function applyBubbleDayNightPresetForCurrentMode(chatId, chat) {
    if (!chatId) return;
    if (!chat || chat.useBubbleDayNightPreset !== true) return;
    const isNight = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const targetName = isNight ? (chat.bubbleCssPresetNightName || '') : (chat.bubbleCssPresetDayName || '');
    applyBubblePresetByName(chatId, targetName);
    // 步骤 39：同步切换日间/夜间聊天背景
    if (typeof applyChatDayNightWallpaper === 'function') {
        applyChatDayNightWallpaper(chatId, chat);
    }
}

/**
 * 步骤 39：根据当前系统日夜模式渲染独立聊天壁纸
 * 仅在 chat.useBubbleDayNightPreset === true 时按当前模式选择对应壁纸
 * 日间优先 chat.chatBgDay，夜间优先 chat.chatBgNight，未设置时回退至通用 chat.chatBg
 */
function applyChatDayNightWallpaper(chatId, chat) {
    if (!chatId || !chat) return;
    const chatRoomScreen = document.getElementById('chat-room-screen');
    if (!chatRoomScreen) return;
    if (chat.useBubbleDayNightPreset === true) {
        const isNight = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const url = isNight ? (chat.chatBgNight || chat.chatBg || '') : (chat.chatBgDay || chat.chatBg || '');
        chatRoomScreen.style.backgroundImage = url ? `url(${url})` : '';
    } else {
        chatRoomScreen.style.backgroundImage = chat.chatBg ? `url(${chat.chatBg})` : '';
    }
}

/**
 * 统一入口：决定当前会话用哪种气泡 CSS 注入方式。
 * 步骤 18 新增：把“组合预设 vs 手动 CSS”的优先级判定集中到一个函数。
 *
 * 优先级：组合预设（useBubbleDayNightPreset === true） > 手动 CSS（useCustomBubbleCss）
 */
function applyChatBubbleCss(chatId, chat) {
    if (!chatId || !chat) return;
    if (chat.useBubbleDayNightPreset === true) {
        applyBubbleDayNightPresetForCurrentMode(chatId, chat);
    } else {
        updateCustomBubbleStyle(chatId, chat.customBubbleCss || '', chat.useCustomBubbleCss === true);
    }
}

// 步骤 18：监听系统深色模式变化，自动切换当前可见 chat 的气泡预设
if (typeof window !== 'undefined' && window.matchMedia) {
    try {
        const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleColorSchemeChange = () => {
            try {
                // 仅在当前处于聊天界面时刷新样式（避免无关页面被影响）
                if (typeof currentChatId !== 'undefined' && currentChatId && typeof document !== 'undefined') {
                    const chatRoom = document.getElementById('chat-room-screen');
                    if (chatRoom && chatRoom.classList.contains('active')) {
                        const chat = (typeof currentChatType !== 'undefined' && currentChatType === 'private')
                            ? db.characters.find(c => c.id === currentChatId)
                            : db.groups.find(g => g.id === currentChatId);
                        if (chat) {
                            if (typeof applyChatBubbleCss === 'function') {
                                applyChatBubbleCss(currentChatId, chat);
                            }
                            if (typeof applyChatDayNightWallpaper === 'function') {
                                applyChatDayNightWallpaper(currentChatId, chat);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('日夜组合预设：系统模式切换刷新失败', err);
            }
        };
        if (typeof darkMediaQuery.addEventListener === 'function') {
            darkMediaQuery.addEventListener('change', handleColorSchemeChange);
        } else if (typeof darkMediaQuery.addListener === 'function') {
            // 兼容旧 API
            darkMediaQuery.addListener(handleColorSchemeChange);
        }
    } catch (err) {
        console.warn('日夜组合预设：matchMedia 监听注册失败', err);
    }
}


function updateBubbleCssPreview(previewContainer, css, useDefault, theme) {
    previewContainer.innerHTML = '';

    const sentBubble = document.createElement('div');
    sentBubble.className = 'message-bubble sent';
    sentBubble.textContent = '这是我方气泡。';
    sentBubble.style.alignSelf = 'flex-end';
    sentBubble.style.borderBottomRightRadius = '5px';

    const receivedBubble = document.createElement('div');
    receivedBubble.className = 'message-bubble received';
    receivedBubble.textContent = '这是对方气泡。';
    receivedBubble.style.alignSelf = 'flex-start';
    receivedBubble.style.borderBottomLeftRadius = '5px';

    [sentBubble, receivedBubble].forEach(bubble => {
        bubble.style.maxWidth = '70%';
        bubble.style.padding = '8px 12px';
        bubble.style.wordWrap = 'break-word';
        bubble.style.lineHeight = '1.4';
    });

    if (useDefault || !css) {
        sentBubble.style.backgroundColor = theme.sent.bg;
        sentBubble.style.color = theme.sent.text;
        sentBubble.style.borderRadius = '18px';
        sentBubble.style.borderBottomRightRadius = '5px';
        receivedBubble.style.backgroundColor = theme.received.bg;
        receivedBubble.style.color = theme.received.text;
        receivedBubble.style.borderRadius = '18px';
        receivedBubble.style.borderBottomLeftRadius = '5px';
    } else {
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            #${previewContainer.id} {
                ${css}
            }
        `;
        previewContainer.appendChild(styleTag);
    }
    previewContainer.appendChild(receivedBubble);
    previewContainer.appendChild(sentBubble);
}

// 主屏幕逻辑
let currentPageIndex = 0;
let homeSortables = [];
let isHomeEditMode = false;
let homePressTimer = null;

/**
 * 辅助函数：根据 HTML 解析项目尺寸行数与列数
 */
function getItemSpan(html) {
    let rows = 1, cols = 1;
    if (html) {
        const match = html.match(/grid-item-(\d+)x(\d+)/);
        if (match) {
            rows = parseInt(match[1], 10);
            cols = parseInt(match[2], 10);
        }
    }
    return { rows, cols };
}

/**
 * 初始分页计算算法：仅在迁移旧数据或初始化时使用
 * 将项目转换为带具体坐标 { id, r, c, rows, cols } 的槽位放置结构
 */
function calculatePagesFromIds(ids, allItemsHtmlMap) {
    const PAGE_COLS = 4;
    const PAGE_ROWS = 6;
    let pages = [];
    let currentPageItems = [];
    let grid = Array(PAGE_ROWS).fill(null).map(() => Array(PAGE_COLS).fill(false));
    let currR = 0;
    let currC = 0;

    ids.forEach(id => {
        const html = allItemsHtmlMap[id];
        if (!html) return;
        
        const { rows, cols } = getItemSpan(html);
        
        let placed = false;
        while (currR <= PAGE_ROWS - rows) {
            let canFit = true;
            if (currC + cols > PAGE_COLS) {
                canFit = false;
            } else {
                for (let i = 0; i < rows; i++) {
                    for (let j = 0; j < cols; j++) {
                        if (grid[currR + i][currC + j]) {
                            canFit = false;
                            break;
                        }
                    }
                    if (!canFit) break;
                }
            }

            if (canFit) {
                for (let i = 0; i < rows; i++) {
                    for (let j = 0; j < cols; j++) {
                        grid[currR + i][currC + j] = true;
                    }
                }
                currentPageItems.push({ id, r: currR, c: currC, rows, cols });
                placed = true;
                currC += cols;
                if (currC >= PAGE_COLS) {
                    currC = 0;
                    currR++;
                }
                break;
            } else {
                currC++;
                if (currC >= PAGE_COLS) {
                    currC = 0;
                    currR++;
                }
            }
        }
        
        if (!placed) {
            pages.push(currentPageItems);
            currentPageItems = [];
            grid = Array(PAGE_ROWS).fill(null).map(() => Array(PAGE_COLS).fill(false));
            currR = 0;
            currC = 0;
            if (rows <= PAGE_ROWS && cols <= PAGE_COLS) {
                for (let i = 0; i < rows; i++) {
                    for (let j = 0; j < cols; j++) {
                        grid[i][j] = true;
                    }
                }
                currentPageItems.push({ id, r: 0, c: 0, rows, cols });
                currC = cols;
                if (currC >= PAGE_COLS) {
                    currC = 0;
                    currR = 1;
                }
            }
        }
    });
    
    if (currentPageItems.length > 0) {
        pages.push(currentPageItems);
    }
    
    while (pages.length < 2) {
        pages.push([]);
    }
    
    return pages;
}

function setupHomeScreen() {
    const getIcon = (id) => db.customIcons[id] || defaultIcons[id].url;
    if (!db.insWidgetSettings) {
        db.insWidgetSettings = {
            avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
            bubble1: '„- ω -„',
            avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
            bubble2: 'ｷ...✩'
        };
    }
    const insWidget = db.insWidgetSettings;

    // 定义所有可用的组件和应用
    const allItems = {
        'app-chat': `<div class="grid-item-1x1" data-id="app-chat"><a href="#" class="app-icon" data-target="chat-list-screen"><img src="${getIcon('chat-list-screen')}" alt="404" class="icon-img"><span class="app-name">${defaultIcons['chat-list-screen'].name}</span></a></div>`,
        'app-api': `<div class="grid-item-1x1" data-id="app-api"><a href="#" class="app-icon" data-target="api-settings-screen"><img src="${getIcon('api-settings-screen')}" alt="API" class="icon-img"><span class="app-name">${defaultIcons['api-settings-screen'].name}</span></a></div>`,
        'app-worldbook': `<div class="grid-item-1x1" data-id="app-worldbook"><a href="#" class="app-icon" data-target="world-book-screen"><img src="${getIcon('world-book-screen')}" alt="世界书" class="icon-img"><span class="app-name">${defaultIcons['world-book-screen'].name}</span></a></div>`,
        'app-customize': `<div class="grid-item-1x1" data-id="app-customize"><a href="#" class="app-icon" data-target="customize-screen"><img src="${getIcon('customize-screen')}" alt="自定义" class="icon-img"><span class="app-name">${defaultIcons['customize-screen'].name}</span></a></div>`,
        'app-console': `<div class="grid-item-1x1" data-id="app-console"><a href="#" class="app-icon" data-target="console-screen"><img src="${getIcon('console-screen')}" alt="Console" class="icon-img"><span class="app-name">${defaultIcons['console-screen'].name}</span></a></div>`,
        'app-widget-market': `<div class="grid-item-1x1" data-id="app-widget-market"><a href="#" class="app-icon" data-target="widget-market-screen"><img src="${getIcon('widget-market-screen')}" alt="小组件" class="icon-img"><span class="app-name">小组件</span></a></div>`,
        'app-reader': `<div class="grid-item-1x1" data-id="app-reader"><a href="#" class="app-icon" data-target="reader-bookshelf-screen"><img src="${getIcon('reader-bookshelf-screen')}" alt="阅读器" class="icon-img"><span class="app-name">${defaultIcons['reader-bookshelf-screen'].name}</span></a></div>`,
        'app-placeholder': `<div class="grid-item-1x1" data-id="app-placeholder"><a href="#" class="app-icon" onclick="return false;"><img src="${getIcon('placeholder-app')}" alt="<3" class="icon-img"><span class="app-name">${defaultIcons['placeholder-app'].name}</span></a></div>`
    };

    // 收集需要执行的 JS 代码
    const widgetScripts = [];

    // 注入自定义小组件
    if (db.addedWidgets && db.widgetTemplates) {
        db.addedWidgets.forEach(instance => {
            const template = db.widgetTemplates.find(t => t.id === instance.templateId);
            if (template) {
                // 修复：必须替换 {{id}} 占位符，否则 HTML 无法匹配注入的 CSS 选择器
                let html = template.html.replace(/{{id}}/g, template.id);
                // 替换变量
                const vars = { ...template.defaultVars, ...instance.vars };
                for (const [key, value] of Object.entries(vars)) {
                    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
                }
                
                // 收集 JS 代码
                if (template.js) {
                    let jsCode = template.js.replace(/{{id}}/g, template.id);
                    for (const [key, value] of Object.entries(vars)) {
                        jsCode = jsCode.replace(new RegExp(`{{${key}}}`, 'g'), value);
                    }
                    widgetScripts.push({ id: instance.id, code: jsCode });
                }
                
                // 转换尺寸类名 (4x2 对应 grid-item-2x4)
                let sizeClass = `grid-item-${template.size}`;
                if (template.size === '4x2') sizeClass = 'grid-item-2x4';
                
                allItems[instance.id] = `
                    <div class="${sizeClass}" data-id="${instance.id}">
                        <div class="custom-widget-container" style="width:100%; height:100%; position:relative;">
                            ${html}
                            <button class="delete-widget-btn" data-id="${instance.id}" style="display:none; position:absolute; top:-5px; right:-5px; background:#ff3b30; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; z-index:10; align-items:center; justify-content:center; font-size:14px;">×</button>
                        </div>
                    </div>`;
            }
        });
    }

    // 确保所有项目都在 allItems 中，并处理新添加的项目
    const allItemIds = Object.keys(allItems);
    
    // 数据结构迁移与初始化：确保 db.homeLayoutPages 中每个项目都是 { id, r, c, rows, cols }
    let needsSaveMigration = false;
    if (!db.homeLayoutPages) {
        const order = db.homeLayoutOrder || ['app-chat', 'app-api', 'app-worldbook', 'app-customize', 'app-console', 'app-widget-market', 'app-placeholder'];
        db.homeLayoutPages = calculatePagesFromIds(order, allItems);
        needsSaveMigration = true;
    } else {
        // 清理已移入 Dock 的图标（app-wallpaper 与 app-tutorial）
        const removedFromHome = new Set(['app-wallpaper', 'app-tutorial']);
        let cleaned = false;
        db.homeLayoutPages = db.homeLayoutPages.map(page => {
            return (page || []).filter(item => {
                const id = typeof item === 'string' ? item : (item && item.id);
                if (removedFromHome.has(id)) {
                    cleaned = true;
                    return false;
                }
                return true;
            });
        });
        if (cleaned) needsSaveMigration = true;

        // 如果存在部分老旧的纯 ID 字符串（例如旧预设导入或遗留项），仅清理/转换，不摧毁已有合法坐标对象
        const hasValidCoordObjects = db.homeLayoutPages.some(page => page && page.some(item => item && typeof item === 'object' && typeof item.r === 'number'));
        const hasRawStrings = db.homeLayoutPages.some(page => page && page.some(item => typeof item === 'string'));
        if (hasRawStrings) {
            if (!hasValidCoordObjects) {
                // 全是旧版纯字符串数组，整页初始排列迁移
                let migratedPages = [];
                db.homeLayoutPages.forEach(page => {
                    const ids = (page || []).map(item => (typeof item === 'string' ? item : item.id));
                    const res = calculatePagesFromIds(ids, allItems);
                    migratedPages.push(...res.filter(p => p.length > 0));
                });
                if (migratedPages.length === 0) migratedPages = [[]];
                db.homeLayoutPages = migratedPages;
            } else {
                // 已有自由放置坐标对象：仅剔除混入的裸字符串，交由下方新项目自动寻坑逻辑分配空闲坐标
                db.homeLayoutPages = db.homeLayoutPages.map(page =>
                    (page || []).filter(item => item && typeof item === 'object' && typeof item.id === 'string')
                );
            }
            needsSaveMigration = true;
        }

        // 同步清理已不存在于 allItems 中的悬空项目引用
        db.homeLayoutPages = db.homeLayoutPages.map(page =>
            (page || []).filter(item => {
                if (!item || !item.id || !allItems[item.id]) {
                    needsSaveMigration = true;
                    return false;
                }
                return true;
            })
        );

        // 4x6 规格校验与超界修正：如果已有项目中存在超出 6 行边界（r + rows > 6）或超出 4 列边界，将其移入待重新安置列表
        const overflowItems = [];
        db.homeLayoutPages = db.homeLayoutPages.map(page => {
            return (page || []).filter(item => {
                const rows = item.rows || 1;
                const cols = item.cols || 1;
                const r = typeof item.r === 'number' ? item.r : 0;
                const c = typeof item.c === 'number' ? item.c : 0;
                if (r < 0 || r + rows > 6 || c < 0 || c + cols > 4) {
                    overflowItems.push(item.id);
                    needsSaveMigration = true;
                    return false;
                }
                return true;
            });
        });

        // 检查是否有重叠冲突（例如旧 4x8 数据迁移遗留），若重叠则保留前者，后者重新寻坑安置
        db.homeLayoutPages.forEach(page => {
            const gridOcc = Array(6).fill(null).map(() => Array(4).fill(false));
            const validPage = [];
            (page || []).forEach(item => {
                const rows = item.rows || 1;
                const cols = item.cols || 1;
                const r = item.r;
                const c = item.c;
                let overlap = false;
                for (let dr = 0; dr < rows; dr++) {
                    for (let dc = 0; dc < cols; dc++) {
                        if (gridOcc[r + dr][c + dc]) overlap = true;
                    }
                }
                if (!overlap) {
                    for (let dr = 0; dr < rows; dr++) {
                        for (let dc = 0; dc < cols; dc++) {
                            gridOcc[r + dr][c + dc] = true;
                        }
                    }
                    validPage.push(item);
                } else {
                    overflowItems.push(item.id);
                    needsSaveMigration = true;
                }
            });
            page.length = 0;
            page.push(...validPage);
        });
    }

    // 检查是否有新添加但未在布局中的项目（如新添加的小组件、或超界修正的项目）
    const existingIds = new Set();
    db.homeLayoutPages.forEach(page => {
        (page || []).forEach(item => {
            if (item && item.id) existingIds.add(item.id);
        });
    });

    let hasNewItems = false;
    allItemIds.forEach(id => {
        if (!existingIds.has(id)) {
            const html = allItems[id];
            const { rows, cols } = getItemSpan(html);
            // 为新项目在当前页面寻找首个空闲槽位 (4 列 6 行)
            let placed = false;
            for (let p = 0; p < db.homeLayoutPages.length; p++) {
                const page = db.homeLayoutPages[p];
                const occ = Array(6).fill(null).map(() => Array(4).fill(false));
                page.forEach(it => {
                    for (let r = it.r; r < it.r + it.rows && r < 6; r++) {
                        for (let c = it.c; c < it.c + it.cols && c < 4; c++) {
                            occ[r][c] = true;
                        }
                    }
                });
                for (let r = 0; r <= 6 - rows; r++) {
                    for (let c = 0; c <= 4 - cols; c++) {
                        let canFit = true;
                        for (let dr = 0; dr < rows; dr++) {
                            for (let dc = 0; dc < cols; dc++) {
                                if (occ[r + dr][c + dc]) { canFit = false; break; }
                            }
                            if (!canFit) break;
                        }
                        if (canFit) {
                            page.push({ id, r, c, rows, cols });
                            placed = true;
                            hasNewItems = true;
                            break;
                        }
                    }
                    if (placed) break;
                }
                if (placed) break;
            }
            if (!placed) {
                // 若已有页面全满，开辟新页放置
                db.homeLayoutPages.push([{ id, r: 0, c: 0, rows, cols }]);
                hasNewItems = true;
            }
        }
    });

    // 清理空页面并至少保留 1 页
    const originalLength = db.homeLayoutPages.length;
    db.homeLayoutPages = db.homeLayoutPages.filter(page => page && page.length > 0);
    if (db.homeLayoutPages.length === 0) {
        db.homeLayoutPages = [[]];
    }
    const pagesChanged = (db.homeLayoutPages.length !== originalLength);

    // 同步扁平化的旧版 homeLayoutOrder
    db.homeLayoutOrder = db.homeLayoutPages.flat().map(item => item.id);

    if (needsSaveMigration || hasNewItems || pagesChanged) {
        saveData();
    }

    // 生成 HTML：每个项目精准绑定 grid-column 和 grid-row，保持绝对坑位
    let swiperHtml = '';
    let indicatorHtml = '';
    
    // 生成 4x6 背景浅色虚线槽位指示网格 (共 24 个槽)
    let slotsBgHtml = '<div class="home-slots-background">';
    for (let i = 0; i < 24; i++) {
        slotsBgHtml += '<div class="home-grid-slot-cell"></div>';
    }
    slotsBgHtml += '</div>';

    db.homeLayoutPages.forEach((pageItems, index) => {
        let pageHtml = pageItems.map(item => {
            const rawHtml = allItems[item.id];
            if (!rawHtml) return '';
            const rowStart = item.r + 1;
            const colStart = item.c + 1;
            const styleInject = `grid-column: ${colStart} / span ${item.cols}; grid-row: ${rowStart} / span ${item.rows};`;
            
            // 注入 inline 样式与坐标属性
            if (/style\s*=\s*"[^"]*"/.test(rawHtml)) {
                return rawHtml.replace(/style\s*=\s*"([^"]*)"/, `style="${styleInject} $1" data-r="${item.r}" data-c="${item.c}" data-rows="${item.rows}" data-cols="${item.cols}"`);
            } else {
                return rawHtml.replace(/<div\s+class="([^"]*)"/, `<div class="$1" style="${styleInject}" data-r="${item.r}" data-c="${item.c}" data-rows="${item.rows}" data-cols="${item.cols}"`);
            }
        }).join('');

        swiperHtml += `
        <div class="home-screen-page">
            <div class="home-grid-layout" id="home-grid-layout-${index + 1}" style="min-height: 500px;">
                ${pageHtml}
            </div>
            ${slotsBgHtml}
        </div>`;
        indicatorHtml += `<span class="dot ${index === 0 ? 'active' : ''}"></span>`;
    });

    const homeScreenHTML = `
    <div class="home-screen-swiper" id="home-screen-swiper">
        ${swiperHtml}
    </div>
    <div class="dock-container">
        <div class="dock dock-normal">
            <a href="#" class="app-icon" data-target="wallpaper-screen"><img src="${getIcon('wallpaper-screen')}" alt="壁纸" class="icon-img"></a>
            <a href="#" class="app-icon" data-target="tutorial-screen"><img src="${getIcon('tutorial-screen')}" alt="教程" class="icon-img"></a>
            <a href="#" class="app-icon" data-target="storage-analysis-screen"><img src="${getIcon('storage-analysis-screen')}" alt="存储" class="icon-img"></a>
        </div>
        <div class="dock dock-edit" style="display: none;">
            <a href="#" class="app-icon" id="add-widget-btn">
                <div class="icon-img" style="background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </div>
            </a>
            <a href="#" class="app-icon" id="finish-edit-btn">
                <div class="icon-img" style="background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            </a>
        </div>
    </div>`;

    
    homeScreen.innerHTML = homeScreenHTML;

    // 执行收集到的小组件 JS 代码
    // 先清理旧的脚本标签
    document.querySelectorAll('.widget-dynamic-script').forEach(el => el.remove());
    widgetScripts.forEach(scriptData => {
        try {
            const scriptEl = document.createElement('script');
            scriptEl.className = 'widget-dynamic-script';
            scriptEl.setAttribute('data-widget-id', scriptData.id);
            // 使用 IIFE 包装，避免变量污染全局作用域
            scriptEl.textContent = `(function() { \n${scriptData.code}\n })();`;
            document.body.appendChild(scriptEl);
        } catch (e) {
            console.error(`Error executing script for widget ${scriptData.id}:`, e);
        }
    });

    // 拦截长按菜单，防止与编辑模式冲突
    homeScreen.addEventListener('contextmenu', (e) => {
        // 如果长按的是可编辑元素（如签名档），则允许弹出系统菜单
        if (e.target.closest('[contenteditable="true"]')) {
            return;
        }
        // 否则阻止默认菜单弹出，确保顺利进入编辑模式
        e.preventDefault();
    });

    // 监听滑动事件更新指示器
    const swiper = document.getElementById('home-screen-swiper');
    if (swiper) {
        swiper.addEventListener('scroll', () => {
            const pageIndex = Math.round(swiper.scrollLeft / swiper.clientWidth);
            updatePageIndicator(pageIndex);
        });

        // PC 端鼠标拖拽翻页逻辑
        let isDown = false;
        let startX;
        let scrollLeft;
        let dragDistance = 0;

        swiper.addEventListener('mousedown', (e) => {
            // 如果点击的是可编辑元素、图标，或者处于编辑模式，不触发翻页拖拽
            if (e.target.closest('[contenteditable]') || e.target.closest('.app-icon') || isHomeEditMode) return;
            
            isDown = true;
            dragDistance = 0;
            swiper.style.scrollSnapType = 'none'; // 拖拽时临时禁用吸附，保证丝滑
            swiper.style.cursor = 'grabbing';
            startX = e.pageX - swiper.offsetLeft;
            scrollLeft = swiper.scrollLeft;
        });

        const handleDragEnd = () => {
            if (!isDown) return;
            isDown = false;
            swiper.style.cursor = '';
            
            // 恢复吸附前，根据拖拽距离判断是否需要主动翻页
            const threshold = 50; // 触发翻页的最小拖拽距离
            const pageWidth = swiper.clientWidth;
            const currentPage = Math.round(scrollLeft / pageWidth);
            
            if (Math.abs(dragDistance) > threshold) {
                // 拖拽距离足够，主动滚动到下一页/上一页
                const targetPage = dragDistance > 0 ? currentPage - 1 : currentPage + 1;
                // 确保目标页在合法范围内
                const maxPage = swiper.children.length - 1;
                const finalPage = Math.max(0, Math.min(targetPage, maxPage));
                
                swiper.scrollTo({
                    left: finalPage * pageWidth,
                    behavior: 'smooth'
                });
            } else {
                // 拖拽距离不够，回弹到当前页
                swiper.scrollTo({
                    left: currentPage * pageWidth,
                    behavior: 'smooth'
                });
            }

            // 延迟恢复吸附，等待平滑滚动动画完成
            setTimeout(() => {
                swiper.style.scrollSnapType = 'x mandatory';
            }, 300);
        };

        swiper.addEventListener('mouseleave', handleDragEnd);
        swiper.addEventListener('mouseup', handleDragEnd);

        swiper.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - swiper.offsetLeft;
            dragDistance = x - startX;
            const walk = dragDistance * 1.5; // 滚动速度倍率
            swiper.scrollLeft = scrollLeft - walk;
        });
    }

    const polaroidImage = db.homeWidgetSettings?.polaroidImage;
    if (polaroidImage) {
        updatePolaroidImage(polaroidImage);
    }

    updateClock();
    applyWallpaper(db.wallpaper);
    
    // 绑定应用点击事件
    homeScreen.querySelectorAll('.app-icon[data-target]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            if (isHomeEditMode) return; // 编辑模式下禁止点击
            const target = icon.getAttribute('data-target');
            if (target === 'world-book-screen') renderWorldBookList();
            else if (target === 'customize-screen') renderCustomizeForm();
            else if (target === 'tutorial-screen') renderTutorialContent();
            else if (target === 'widget-market-screen') {
                if (typeof renderWidgetMarket === 'function') renderWidgetMarket();
                switchScreen(target);
            }
            else switchScreen(target);
        });
    });

    // 绑定编辑模式按钮
    const addWidgetBtn = document.getElementById('add-widget-btn');
    if (addWidgetBtn) {
        addWidgetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof renderWidgetAddModal === 'function') {
                renderWidgetAddModal();
            }
            const modal = document.getElementById('widget-add-modal');
            if (modal) modal.classList.add('visible');
        });
    }
    
    const closeWidgetAddModalBtn = document.getElementById('close-widget-add-modal-btn');
    const widgetAddModal = document.getElementById('widget-add-modal');
    if (closeWidgetAddModalBtn && widgetAddModal) {
        closeWidgetAddModalBtn.addEventListener('click', () => {
            widgetAddModal.classList.remove('visible');
        });
        // 点击遮罩层关闭
        widgetAddModal.addEventListener('click', (e) => {
            if (e.target === widgetAddModal) {
                widgetAddModal.classList.remove('visible');
            }
        });
    }

    const finishEditBtn = document.getElementById('finish-edit-btn');
    if (finishEditBtn) {
        finishEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exitHomeEditMode();
        });
    }

    // 绑定删除小组件按钮
    homeScreen.querySelectorAll('.delete-widget-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const instanceId = btn.getAttribute('data-id');
            if (confirm('确定要删除这个小组件吗？')) {
                const wasEditing = isHomeEditMode;
                db.addedWidgets = db.addedWidgets.filter(w => w.id !== instanceId);
                // 从分页坐标数据中删除（兼容对象与字符串格式）
                if (db.homeLayoutPages) {
                    db.homeLayoutPages = db.homeLayoutPages.map(page =>
                        (page || []).filter(it => (typeof it === 'string' ? it : it.id) !== instanceId)
                    );
                }
                db.homeLayoutOrder = (db.homeLayoutOrder || []).filter(id => id !== instanceId);
                await saveData();
                setupHomeScreen();
                if (wasEditing) {
                    enterHomeEditMode();
                }
            }
        });
    });

    updateBatteryStatus();

    const homeWidgetContainer = homeScreen.querySelector('.home-widget-container');

    // Central Circle Click
    const centralCircle = homeWidgetContainer?.querySelector('.central-circle');
    if (centralCircle) {
        centralCircle.addEventListener('click', () => {
            if (isHomeEditMode) return;
            const modal = document.getElementById('ins-widget-avatar-modal');
            const preview = document.getElementById('ins-widget-avatar-preview');
            const urlInput = document.getElementById('ins-widget-avatar-url-input');
            const fileUpload = document.getElementById('ins-widget-avatar-file-upload');
            const targetInput = document.getElementById('ins-widget-avatar-target');

            targetInput.value = 'centralCircle'; 
            preview.style.backgroundImage = `url("${db.homeWidgetSettings.centralCircleImage}")`;
            preview.innerHTML = '';
            urlInput.value = '';
            fileUpload.value = null;
            modal.classList.add('visible');
        });
    }

    // Blur to Save Logic
    homeScreen.addEventListener('blur', async (e) => {
        const target = e.target;
        if (target.hasAttribute('contenteditable')) {
            const oval = target.closest('.satellite-oval');
            if (oval) { 
                const part = oval.dataset.widgetPart;
                const prop = target.classList.contains('satellite-emoji') ? 'emoji' : 'text';
                const newValue = target.textContent.trim();

                if (db.homeWidgetSettings[part] && db.homeWidgetSettings[part][prop] !== newValue) {
                    db.homeWidgetSettings[part][prop] = newValue;
                    await saveData();
                    showToast('小组件已更新');
                }
            } else if (target.id === 'widget-signature') { 
                const newSignature = target.textContent.trim();
                if (db.homeSignature !== newSignature) {
                    db.homeSignature = newSignature;
                    await saveData();
                    showToast('签名已保存');
                }
            } else if (target.id === 'ins-widget-bubble-1' || target.id === 'ins-widget-bubble-2') { 
                 const bubbleId = target.id === 'ins-widget-bubble-1' ? 'bubble1' : 'bubble2';
                 const newText = target.textContent.trim();
                 if (db.insWidgetSettings[bubbleId] !== newText) {
                     db.insWidgetSettings[bubbleId] = newText;
                     await saveData();
                     showToast('小组件文字已保存');
                 }
            }
        }
    }, true); 
    
    const signatureWidget = document.getElementById('widget-signature');
    if (signatureWidget) {
        signatureWidget.textContent = db.homeSignature || '';
    }

    homeScreen.addEventListener('click', (e) => {
        // 编辑模式下的点击拦截逻辑
        if (isHomeEditMode) {
            // 检查点击的是否是网格内的小组件或应用图标
            const gridItem = e.target.closest('.home-grid-layout > div');
            if (gridItem) {
                // 如果点击的是删除按钮，放行
                if (e.target.closest('.delete-widget-btn')) {
                    return;
                }
                // 否则拦截所有点击，防止触发跳转或小组件内部逻辑
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        const activeEl = document.activeElement;
        if (activeEl && activeEl.hasAttribute('contenteditable') && e.target !== activeEl) {
            activeEl.blur();
        }
        
        // 点击空白处退出编辑模式
        if (isHomeEditMode && !e.target.closest('.home-grid-layout > div')) {
            exitHomeEditMode();
        }
    }, true); // 使用捕获阶段以确保最高优先级拦截

    homeScreen.querySelectorAll('.satellite-emoji').forEach(span => {
        span.addEventListener('input', (e) => {
            const chars = [...e.target.textContent];
            if (chars.length > 1) {
                e.target.textContent = chars[0];
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(e.target);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    });

    // 初始化 SortableJS
    initHomeSortables();
}

let lastPageFlipTime = 0;
const flipCooldown = 800; // 翻页冷却时间 800ms
let edgeFlipInterval = null;
let currentDragX = 0;
let currentDragY = 0;

function initHomeSortables() {
    const gridLayouts = document.querySelectorAll('.home-grid-layout');
    const swiper = document.getElementById('home-screen-swiper');
    
    // 清理旧的实例
    homeSortables.forEach(sortable => sortable.destroy());
    homeSortables = [];

    if (typeof Sortable === 'undefined') {
        console.error("SortableJS not loaded");
        return;
    }

    const handleGlobalDrag = (e) => {
        const pt = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
        if (pt && typeof pt.clientX === 'number') {
            currentDragX = pt.clientX;
            currentDragY = pt.clientY;
        }
    };

    gridLayouts.forEach(layout => {
        const sortable = new Sortable(layout, {
            group: 'home-grid',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            delay: 800, // 初始长按 800ms
            delayOnTouchOnly: false,
            forceFallback: true,
            fallbackOnBody: true,
            scroll: false, // 禁用默认滚动
            onStart: function() {
                if (swiper) swiper.style.scrollSnapType = 'none';
                
                // 动态添加一个空页，以便可以拖拽到新页
                const newPageIdx = document.querySelectorAll('.home-grid-layout').length + 1;
                const newPage = document.createElement('div');
                newPage.className = 'home-screen-page';
                
                let slotsBgHtml = '<div class="home-slots-background" style="display: grid !important;">';
                for (let i = 0; i < 24; i++) {
                    slotsBgHtml += '<div class="home-grid-slot-cell"></div>';
                }
                slotsBgHtml += '</div>';

                newPage.innerHTML = `<div class="home-grid-layout edit-mode" id="home-grid-layout-${newPageIdx}" style="min-height: 500px;"></div>${slotsBgHtml}`;
                swiper.appendChild(newPage);
                
                // 为新页初始化 Sortable
                const newLayout = newPage.querySelector('.home-grid-layout');
                const newSortable = new Sortable(newLayout, {
                    group: 'home-grid',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    delay: 0,
                    delayOnTouchOnly: false,
                    forceFallback: true,
                    fallbackOnBody: true,
                    scroll: false
                });
                homeSortables.push(newSortable);

                // 更新指示器
                const indicator = document.querySelector('.page-indicator');
                if (indicator) {
                    const dot = document.createElement('span');
                    dot.className = 'dot';
                    indicator.appendChild(dot);
                }
                
                // 挂载全局位置监听
                window.addEventListener('mousemove', handleGlobalDrag);
                window.addEventListener('touchmove', handleGlobalDrag);

                // 启动边缘检测定时器
                if (edgeFlipInterval) clearInterval(edgeFlipInterval);
                edgeFlipInterval = setInterval(() => {
                    if (!swiper) return;
                    const now = Date.now();
                    if (now - lastPageFlipTime < flipCooldown) return;

                    const edgeThreshold = 60;
                    const screenWidth = window.innerWidth;
                    const pageWidth = swiper.clientWidth;
                    const maxScroll = swiper.scrollWidth - pageWidth;

                    if (currentDragX > 0 && currentDragX < edgeThreshold && swiper.scrollLeft > 0) {
                        const targetScroll = Math.max(0, swiper.scrollLeft - pageWidth);
                        swiper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                        lastPageFlipTime = now;
                        if (typeof triggerHapticFeedback === 'function') triggerHapticFeedback('light');
                    } else if (currentDragX > screenWidth - edgeThreshold && swiper.scrollLeft < maxScroll) {
                        const targetScroll = Math.min(maxScroll, swiper.scrollLeft + pageWidth);
                        swiper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                        lastPageFlipTime = now;
                        if (typeof triggerHapticFeedback === 'function') triggerHapticFeedback('light');
                    }
                }, 100);
            },
            onChoose: function (evt) {
                if (!isHomeEditMode) {
                    // 检查是否点击了可编辑元素，如果是则不进入编辑模式
                    if (evt.originalEvent.target.closest('[contenteditable]')) {
                        evt.preventDefault();
                        return;
                    }
                    enterHomeEditMode();
                    if (typeof triggerHapticFeedback === 'function') {
                        triggerHapticFeedback('heavy');
                    }
                }
            },
            onEnd: async function (evt) {
                // 清理全局监听和定时器
                window.removeEventListener('mousemove', handleGlobalDrag);
                window.removeEventListener('touchmove', handleGlobalDrag);
                if (edgeFlipInterval) {
                    clearInterval(edgeFlipInterval);
                    edgeFlipInterval = null;
                }

                const dragEl = evt.item;
                const dragId = dragEl ? dragEl.getAttribute('data-id') : null;
                const targetGrid = evt.to;
                const allGrids = Array.from(document.querySelectorAll('.home-grid-layout'));
                const targetPageIndex = allGrids.indexOf(targetGrid);

                // 如果基础信息丢失，回退重绘
                if (!dragId || !targetGrid || targetPageIndex === -1) {
                    setupHomeScreen();
                    if (isHomeEditMode) enterHomeEditMode();
                    currentDragX = 0;
                    currentDragY = 0;
                    return;
                }

                // 获取松手指针坐标
                let clientX = currentDragX;
                let clientY = currentDragY;
                if (evt.originalEvent) {
                    const orig = evt.originalEvent;
                    const touch = (orig.changedTouches && orig.changedTouches[0]) || (orig.touches && orig.touches[0]);
                    if (touch && typeof touch.clientX === 'number') {
                        clientX = touch.clientX;
                        clientY = touch.clientY;
                    } else if (typeof orig.clientX === 'number') {
                        clientX = orig.clientX;
                        clientY = orig.clientY;
                    }
                }

                // 获取项目尺寸规格
                const dragRows = parseInt(dragEl.getAttribute('data-rows')) || 1;
                const dragCols = parseInt(dragEl.getAttribute('data-cols')) || 1;

                // 计算相对于目标网格内部有效区域的行列坐标
                const rect = targetGrid.getBoundingClientRect();
                const style = window.getComputedStyle(targetGrid);
                const padLeft = parseFloat(style.paddingLeft) || 15;
                const padRight = parseFloat(style.paddingRight) || 15;
                const padTop = parseFloat(style.paddingTop) || 5;
                const padBottom = parseFloat(style.paddingBottom) || 5;
                const colGap = parseFloat(style.columnGap) || parseFloat(style.gap) || 15;
                const rowGap = parseFloat(style.rowGap) || parseFloat(style.gap) || 15;

                const gridW = Math.max(1, rect.width - padLeft - padRight);
                const gridH = Math.max(1, rect.height - padTop - padBottom);

                const relX = clientX - rect.left - padLeft;
                const relY = clientY - rect.top - padTop;

                // 精确匹配 4 列 6 行 + gap 的单格宽高与步进跨度
                const cellW = Math.max(1, (gridW - 3 * colGap) / 4);
                const cellH = Math.max(1, (gridH - 5 * rowGap) / 6);
                const stepX = cellW + colGap;
                const stepY = cellH + rowGap;

                let targetC = Math.floor((relX + colGap / 2) / stepX);
                let targetR = Math.floor((relY + rowGap / 2) / stepY);

                // 边界约束与对齐（防止超出 4x6 网格）
                targetC = Math.max(0, Math.min(4 - dragCols, targetC));
                targetR = Math.max(0, Math.min(6 - dragRows, targetR));

                // 目标页现有项目（排除正在拖拽的自身项）
                const targetPageList = (db.homeLayoutPages[targetPageIndex] || []).filter(it => (it.id || it) !== dragId);

                // 矩形碰撞检测：检查目标区域内是否与其它已有组件重叠
                const hasCollision = targetPageList.some(it => {
                    const r = typeof it.r === 'number' ? it.r : 0;
                    const c = typeof it.c === 'number' ? it.c : 0;
                    const rows = it.rows || 1;
                    const cols = it.cols || 1;
                    return !(targetR + dragRows <= r ||
                             r + rows <= targetR ||
                             targetC + dragCols <= c ||
                             c + cols <= targetC);
                });

                let finalPageIndex = targetPageIndex;

                // 方案 A（原生防碰撞）：若发生碰撞，弹回原位，不移动或挤压其他图标
                if (hasCollision) {
                    if (typeof triggerHapticFeedback === 'function') {
                        triggerHapticFeedback('medium');
                    }
                    // 找到原所在页保持 swiper 视角
                    for (let pIdx = 0; pIdx < db.homeLayoutPages.length; pIdx++) {
                        if (db.homeLayoutPages[pIdx].some(it => (it.id || it) === dragId)) {
                            finalPageIndex = pIdx;
                            break;
                        }
                    }
                } else {
                    // 无碰撞：更新坐标与所在页面
                    // 1. 从所有页中移除该项目
                    db.homeLayoutPages.forEach((page, pIdx) => {
                        db.homeLayoutPages[pIdx] = page.filter(it => (it.id || it) !== dragId);
                    });

                    // 2. 补齐目标页（如果拖拽到新页面）
                    while (db.homeLayoutPages.length <= targetPageIndex) {
                        db.homeLayoutPages.push([]);
                    }

                    // 3. 将带新坐标的项目加入目标页
                    db.homeLayoutPages[targetPageIndex].push({
                        id: dragId,
                        r: targetR,
                        c: targetC,
                        rows: dragRows,
                        cols: dragCols
                    });

                    // 4. 清理末尾的多余空页面（至少保留一页）
                    while (db.homeLayoutPages.length > 1 && db.homeLayoutPages[db.homeLayoutPages.length - 1].length === 0) {
                        db.homeLayoutPages.pop();
                    }
                    if (finalPageIndex >= db.homeLayoutPages.length) {
                        finalPageIndex = Math.max(0, db.homeLayoutPages.length - 1);
                    }

                    // 5. 同步扁平化 order 保持兼容性
                    db.homeLayoutOrder = db.homeLayoutPages.flat().map(it => it.id || it);

                    if (typeof saveData === 'function') {
                        await saveData();
                    }
                }

                // 重新渲染以呈现最新状态
                const wasEditMode = isHomeEditMode;
                setupHomeScreen();
                if (wasEditMode) {
                    enterHomeEditMode();
                }

                // 保持 swiper 处于当前操作页面
                const swiperEl = document.getElementById('home-screen-swiper');
                if (swiperEl) {
                    swiperEl.style.scrollSnapType = 'x mandatory';
                    swiperEl.scrollTo({ left: finalPageIndex * swiperEl.clientWidth, behavior: 'instant' });
                }

                currentDragX = 0;
                currentDragY = 0;
            }
        });
        homeSortables.push(sortable);
    });
}

function enterHomeEditMode() {
    isHomeEditMode = true;
    const gridLayouts = document.querySelectorAll('.home-grid-layout');
    
    gridLayouts.forEach(layout => {
        layout.classList.add('edit-mode');
        
        // 禁用所有 contenteditable
        layout.querySelectorAll('[contenteditable]').forEach(el => {
            el.setAttribute('data-editable', 'true');
            el.removeAttribute('contenteditable');
        });

        // 显示删除按钮
        layout.querySelectorAll('.delete-widget-btn').forEach(btn => {
            btn.style.display = 'flex';
        });
    });

    // 将所有 Sortable 实例的 delay 设为 0
    homeSortables.forEach(sortable => {
        sortable.option('delay', 0);
    });

    // 切换 Dock
    const dockNormal = document.querySelector('.dock-normal');
    const dockEdit = document.querySelector('.dock-edit');
    if (dockNormal && dockEdit) {
        dockNormal.style.display = 'none';
        dockEdit.style.display = 'flex';
    }
}

function exitHomeEditMode() {
    isHomeEditMode = false;
    const gridLayouts = document.querySelectorAll('.home-grid-layout');
    
    gridLayouts.forEach(layout => {
        layout.classList.remove('edit-mode');
        
        // 恢复 contenteditable
        layout.querySelectorAll('[data-editable="true"]').forEach(el => {
            el.setAttribute('contenteditable', 'true');
            el.removeAttribute('data-editable');
        });

        // 隐藏删除按钮
        layout.querySelectorAll('.delete-widget-btn').forEach(btn => {
            btn.style.display = 'none';
        });
    });

    // 恢复 delay 为 800
    homeSortables.forEach(sortable => {
        sortable.option('delay', 800);
    });

    // 切换 Dock
    const dockNormal = document.querySelector('.dock-normal');
    const dockEdit = document.querySelector('.dock-edit');
    if (dockNormal && dockEdit) {
        dockNormal.style.display = 'flex';
        dockEdit.style.display = 'none';
    }
}


function updateClock() {
    const now = new Date();
    const timeString = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const dateString = `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日`;

    const homeTimeDisplay = document.getElementById('time-display');
    const homeDateDisplay = document.getElementById('date-display');
    if (homeTimeDisplay) homeTimeDisplay.textContent = timeString;
    if (homeDateDisplay) homeDateDisplay.textContent = dateString;

    const peekTimeDisplay = document.getElementById('peek-time-display');
    const peekDateDisplay = document.getElementById('peek-date-display');
    if (peekTimeDisplay) peekTimeDisplay.textContent = timeString;
    if (peekDateDisplay) peekDateDisplay.textContent = dateString;
}

function updatePageIndicator(index) {
    const dots = document.querySelectorAll('.page-indicator .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function applyWallpaper(url) {
    if (homeScreen) homeScreen.style.backgroundImage = `url(${url})`;
}



async function injectCustomFont(preset) {
    if (!preset || !preset.isCustom || !preset.fontFamily || !preset.id) return;
    try {
        const fontData = await dexieDB.customFonts.get(preset.id);
        if (fontData && fontData.file) {
            const arrayBuffer = await fontData.file.arrayBuffer();
            const fontFace = new FontFace(preset.fontFamily, arrayBuffer);
            const loadedFace = await fontFace.load();
            document.fonts.add(loadedFace);
            console.log(`Custom font ${preset.fontFamily} injected successfully.`);
        }
    } catch (error) {
        console.error(`Failed to inject custom font ${preset.fontFamily}:`, error);
    }
}

async function loadAllCustomFonts() {
    if (!db.fontPresets) return;
    const customPresets = db.fontPresets.filter(p => p.isCustom);
    for (const preset of customPresets) {
        await injectCustomFont(preset);
    }
}

function applyGlobalFont(fontValue, isCustom = false) {
    const styleId = 'global-font-style';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }
    if (fontValue) {
        if (isCustom) {
            styleElement.innerHTML = `:root { --font-family: '${fontValue}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }`;
        } else {
            const fontName = 'CustomGlobalFont';
            styleElement.innerHTML = `@font-face { font-family: '${fontName}'; src: url('${fontValue}'); } :root { --font-family: '${fontName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }`;
        }
    } else {
        styleElement.innerHTML = `:root { --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }`;
    }
}

function applyGlobalCss(css) {
    const styleId = 'global-css-style';
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }
    
    styleElement.innerHTML = css || '';
}

function applyFontSize(scale) {
    document.documentElement.style.setProperty('--app-font-scale', scale);
}

// 统一面板控制函数
function showPanel(type) {
    triggerHapticFeedback('light');
    const toggleExpansionBtn = document.getElementById('toggle-expansion-btn');
    const panel = document.getElementById('chat-expansion-panel');

    if (type === 'none') {
        chatExpansionPanel.classList.remove('visible');
        if (toggleExpansionBtn) toggleExpansionBtn.classList.remove('rotate-45');
        return;
    }

    chatExpansionPanel.classList.add('visible');

    if (type === 'function') {
        panelFunctionArea.style.display = 'flex';
        panelStickerArea.style.display = 'none';
        
        // 初始化功能面板的分页滑动
        if (!document.querySelector('.function-swiper-wrapper')) {
            setupFunctionPanelSwiper();
        }

        if (toggleExpansionBtn) toggleExpansionBtn.classList.add('rotate-45');

        // 触发功能面板引导
        if (window.GuideSystem) {
            if (currentChatType === 'private') {
                window.GuideSystem.check('guide_char_gallery');
            } else if (currentChatType === 'group') {
                window.GuideSystem.check('guide_group_summary');
            }
        }
    } else if (type === 'sticker') {
        panelFunctionArea.style.display = 'none';
        panelStickerArea.style.display = 'flex';
        if (toggleExpansionBtn) toggleExpansionBtn.classList.remove('rotate-45');
        renderStickerCategories();
        renderStickerGrid();
    }

    setTimeout(() => {
        messageArea.scrollTop = messageArea.scrollHeight;
    }, 50);
}

function initKeyboardDetection() {
    if (!window.visualViewport) return;

    let maxViewportHeight = window.visualViewport.height;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // 初始化应用保存的高度
    if (db.savedKeyboardHeight) {
        document.documentElement.style.setProperty('--panel-height', `${db.savedKeyboardHeight}px`);
    }

    window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
        
        // 如果高度变小了，且输入框聚焦，说明键盘弹出了
        if (currentHeight < maxViewportHeight && isInputFocused) {
            const diff = maxViewportHeight - currentHeight;
            // 简单的阈值判断，防止误判
            if (diff > 150) { 
                const keyboardHeight = diff;
                
                // iOS 下，键盘弹出时我们不应该增加 --panel-height，因为浏览器会自动调整视口
                // 增加高度会导致输入框被顶得过高，遮挡消息
                if (!isIOS) {
                    document.documentElement.style.setProperty('--panel-height', `${keyboardHeight}px`);
                }
                
                // 保存到 DB (防抖)
                if (db.savedKeyboardHeight !== keyboardHeight) {
                    db.savedKeyboardHeight = keyboardHeight;
                    if (typeof saveData === 'function') {
                        saveData();
                    }
                }

                // 键盘弹出后，确保消息区域滚动到底部
                if (targetScreen && targetScreen.id === 'chat-room-screen') {
                    setTimeout(() => {
                        if (messageArea) messageArea.scrollTop = messageArea.scrollHeight;
                    }, 100);
                }
            }
        } else if (currentHeight > maxViewportHeight) {
            // 可能是地址栏收起导致的高度增加，更新最大高度
            maxViewportHeight = currentHeight;
        }
    });

    // 修复移动端（iOS / Android）键盘弹出导致的窗口滚动偏移（防止顶栏被顶出屏幕）
    const resetWindowScroll = () => {
        window.scrollTo(0, 0);
        if (document.body) document.body.scrollTop = 0;
        if (document.documentElement) document.documentElement.scrollTop = 0;
    };

    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // 键盘弹出时，强制重置窗口滚动位置，确保顶栏保持在屏幕顶部
            setTimeout(resetWindowScroll, 50);
            setTimeout(resetWindowScroll, 150);
        }
    });

    document.addEventListener('focusout', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // 键盘收起时，再次重置滚动位置
            setTimeout(() => {
                resetWindowScroll();
                // 额外触发一次 resize 检查，确保布局恢复
                window.dispatchEvent(new Event('resize'));
            }, 50);
        }
    });
}

// 底部导航栏逻辑
function setupBottomNavigation() {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                // 切换屏幕
                switchScreen(targetId);
                
                // 更新所有底部导航栏的选中状态
                document.querySelectorAll('.bottom-nav .nav-item').forEach(nav => {
                    if (nav.getAttribute('data-target') === targetId) {
                        nav.classList.add('active');
                    } else {
                        nav.classList.remove('active');
                    }
                });
            }
        });
    });
}

function setupPhoneScreen() {
    const bubble = document.getElementById('burnout-bubble');
    if (bubble) {
        bubble.addEventListener('click', () => {
            document.getElementById('burnout-update-modal').classList.add('visible');
        });
    }
}

function setupFunctionPanelSwiper() {
    const panelArea = document.getElementById('panel-function-area');
    const originalGrid = panelArea.querySelector('.expansion-grid');
    if (!originalGrid) return; 

    // 获取所有 expansion-item
    const items = Array.from(originalGrid.querySelectorAll('.expansion-item'));
    if (items.length === 0) return;

    // 创建新结构
    const swiperContainer = document.createElement('div');
    swiperContainer.className = 'function-swiper-container';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'function-swiper-wrapper';

    const pagination = document.createElement('div');
    pagination.className = 'function-pagination';

    const itemsPerPage = 8;
    const pageCount = Math.ceil(items.length / itemsPerPage);

    for (let i = 0; i < pageCount; i++) {
        const slide = document.createElement('div');
        slide.className = 'function-slide';
        
        const pageItems = items.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
        pageItems.forEach(item => slide.appendChild(item));
        
        wrapper.appendChild(slide);

        const dot = document.createElement('span');
        dot.className = `dot ${i === 0 ? 'active' : ''}`;
        pagination.appendChild(dot);
    }

    // 移除旧 grid
    originalGrid.remove();

    swiperContainer.appendChild(wrapper);
    // 只有多页时才显示 pagination
    if (pageCount > 1) {
        swiperContainer.appendChild(pagination);
    }
    
    panelArea.appendChild(swiperContainer);

    // 绑定滚动事件更新 pagination
    wrapper.addEventListener('scroll', () => {
        const width = wrapper.offsetWidth;
        if (width > 0) {
            const index = Math.round(wrapper.scrollLeft / width);
            const dots = pagination.querySelectorAll('.dot');
            dots.forEach((d, i) => d.classList.toggle('active', i === index));
        }
    });
}
