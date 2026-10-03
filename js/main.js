// --- 主程序入口 (js/main.js) ---

// 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

const init = async () => {
    await loadData();
    if (typeof ensureAllChatArchives === 'function') {
        const archivesMigrated = ensureAllChatArchives();
        if (archivesMigrated) await saveData();
    }
    if (!db.homeWidgetSettings || !db.homeWidgetSettings.topLeft) {
        db.homeWidgetSettings = JSON.parse(JSON.stringify(defaultWidgetSettings));
    }

    // 全局点击事件委托
    document.body.addEventListener('click', (e) => {
        // 全局点击触感反馈
        // if (e.target.closest('button, .btn, .action-btn, .nav-item, .icon-btn, .list-item, input[type="checkbox"], input[type="radio"], .back-btn')) {
        //     triggerHapticFeedback('light');
        // }

        if (e.target.closest('.context-menu')) {
            e.stopPropagation();
            return;
        }
        removeContextMenu();

        const backBtn = e.target.closest('.back-btn');
        if (backBtn) {
            const target = backBtn.getAttribute('data-target');
            if (target) {
                e.preventDefault();
                switchScreen(target);
            }
        }

        const openOverlay = document.querySelector('.modal-overlay.visible, .action-sheet-overlay.visible');
        if (openOverlay && e.target === openOverlay) {
            openOverlay.classList.remove('visible');
        }
    });

    // 导航栏跳转
    document.body.addEventListener('click', e => {
        const navLink = e.target.closest('.app-icon[data-target]');
        if (navLink) {
            e.preventDefault();
            const target = navLink.getAttribute('data-target');
            if (target === 'music-screen' || target === 'diary-screen' || target === 'piggy-bank-screen') {
                showToast('该应用正在开发中，敬请期待！');
                return;
            }
            switchScreen(target);
        }
    });

    // 定时任务
    updateClock();
    setInterval(updateClock, 30000);
    setInterval(checkAutoReply, 60000);
    
    // 检查备份提醒
    setTimeout(checkBackupReminder, 5000); // 启动后延迟5秒检查
    setInterval(checkBackupReminder, 3600000); // 每小时检查一次

    // 应用全局设置
    await loadAllCustomFonts();
    
    if (db.fontUrl && db.fontUrl.startsWith('CustomFont_')) {
        applyGlobalFont(db.fontUrl, true);
    } else {
        applyGlobalFont(db.fontUrl, false);
    }
    
    applyGlobalCss(db.globalCss);
    applyFontSize(db.fontSizeScale || 1.0);
    if (typeof applyThemeSettings === 'function') applyThemeSettings();

    // 初始化各个模块
    setupGlobalRescueGesture(); // 全局救援手势
    setupHomeScreen();
    if (typeof renderConsoleLogs === 'function') renderConsoleLogs();
    setupChatListScreen();
    setupContactsScreen();
    setupBottomNavigation();
    setupAddCharModal();
    if (typeof setupStUnlock === 'function') setupStUnlock();
    if (typeof injectChatRoomHtml === 'function') injectChatRoomHtml();
    setupChatRoom();
    if (typeof setupAirDropPanelBtn === 'function') setupAirDropPanelBtn();
    if (typeof injectChatSettingsHtml === 'function') injectChatSettingsHtml();
    if (typeof injectGroupSettingsHtml === 'function') injectGroupSettingsHtml();
    setupChatSettings();
    if (typeof setupChatArchiveSystem === 'function') setupChatArchiveSystem();
    setupApiSettingsApp();
    setupWallpaperApp();
    await setupStickerSystem();
    setupPresetFeatures();
    setupVoiceMessageSystem();
    setupPhotoVideoSystem();
    setupImageRecognition();
    setupWalletSystem();
    setupGiftSystem();
    setupTimeSkipSystem();
    setupGalleryManagement();
    try { setupCommunityModule(); } catch(e) { console.error("setupCommunityModule failed:", e); }
    
    // 错误处理包裹的模块初始化
    try { setupWorldBookApp(); } catch(e) { console.error("setupWorldBookApp failed:", e); }
    try { setupGroupChatSystem(); } catch(e) { console.error("setupGroupChatSystem failed:", e); }
    try { setupCustomizeApp(); } catch(e) { console.error("setupCustomizeApp failed:", e); }
    try { setupTutorialApp(); } catch(e) { console.error("setupTutorialApp failed:", e); }
    
    try { checkForUpdates(); } catch(e) { console.error("checkForUpdates failed:", e); }
    try { setupPeekFeature(); } catch(e) { console.error("setupPeekFeature failed:", e); }
    try { setupMemoryJournalScreen(); } catch(e) { console.error("setupMemoryJournalScreen failed:", e); }
    try { setupDeleteHistoryChunk(); } catch(e) { console.error("setupDeleteHistoryChunk failed:", e); }
    try { setupStorageAnalysisScreen(); } catch(e) { console.error("setupStorageAnalysisScreen failed:", e); }
    try { setupCleanImageCache(); } catch(e) { console.error("setupCleanImageCache failed:", e); }
    try { setupInsWidgetAvatarModal(); } catch(e) { console.error("setupInsWidgetAvatarModal failed:", e); }
    try { setupHeartPhotoModal(); } catch(e) { console.error("setupHeartPhotoModal failed:", e); }
    try { setupMoreCardBgModal(); } catch(e) { console.error("setupMoreCardBgModal failed:", e); }
    if (typeof setupShopSystem === 'function') { try { setupShopSystem(); } catch(e) { console.error("setupShopSystem failed:", e); } }
    if (window.BatteryInteraction) { try { window.BatteryInteraction.init(); } catch(e) { console.error("BatteryInteraction failed:", e); } }
    if (typeof initMoreMenu === 'function') { try { initMoreMenu(); } catch(e) { console.error("initMoreMenu failed:", e); } }
    if (typeof setupPhoneScreen === 'function') { try { setupPhoneScreen(); } catch(e) { console.error("setupPhoneScreen failed:", e); } }
    if (typeof initCotSettings === 'function') { try { initCotSettings(); } catch(e) { console.error("initCotSettings failed:", e); } }
    if (window.VideoCallModule) { try { window.VideoCallModule.init(); } catch(e) { console.error("VideoCallModule failed:", e); } }
    if (typeof initDrawingWorkshop === 'function') { try { initDrawingWorkshop(); } catch(e) { console.error("initDrawingWorkshop failed:", e); } }

    // 全局事件绑定
    const delWBBtn = document.getElementById('delete-selected-world-books-btn');
    if(delWBBtn) delWBBtn.addEventListener('click', deleteSelectedWorldBooks);
    
    const cancelWBBtn = document.getElementById('cancel-wb-multi-select-btn');
    if(cancelWBBtn) cancelWBBtn.addEventListener('click', exitWorldBookMultiSelectMode);
    
    if(window.GitHubMgr) {
        window.GitHubMgr.init();
    }

    // 自动尝试拉取模型列表
    if (window.fetchAndPopulateModels && db.apiSettings && db.apiSettings.url && db.apiSettings.key) {
        // 稍微延迟一点，确保 API 设置 DOM 已加载
        setTimeout(() => {
            window.fetchAndPopulateModels(true);
        }, 1000);
    }

    // 检查并请求持久化存储 (抗系统清理)
    if (typeof checkAndRequestPersistence === 'function') {
        setTimeout(checkAndRequestPersistence, 2000); // 延迟一点，避免与初始化逻辑冲突
    }
};

async function checkBackupReminder() {
    if (!db.backupReminderSettings || !db.backupReminderSettings.enabled) return;

    const now = Date.now();
    const lastTime = db.backupReminderSettings.lastReminderTime || 0;
    const intervalDays = db.backupReminderSettings.interval || 3;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    if (now - lastTime > intervalMs) {
        // 延迟一点弹出，避免刚进应用太突兀
        if (confirm(`【备份提醒】\n检测到您已有 ${intervalDays} 天未进行手动备份，是否立即下载备份文件以防数据丢失？`)) {
            if (window.triggerManualBackup) {
                await window.triggerManualBackup();
            }
        } else {
            // 用户点否，也更新时间，进入下一个周期
            db.backupReminderSettings.lastReminderTime = now;
            await saveData();
        }
    }
}

/**
 * 检查指定角色当前是否处于免打扰时间段内（纯函数，支持传入模拟时间戳）
 */
function isInQuietHours(char, nowMs = Date.now()) {
    if (!char.autoReply || !char.autoReply.dndEnabled) return false;
    const nowDate = new Date(nowMs);
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const [startH, startM] = (char.autoReply.dndStart || '23:00').split(':').map(Number);
    const [endH, endM] = (char.autoReply.dndEnd || '08:00').split(':').map(Number);
    const startMinutes = (isNaN(startH) ? 23 : startH) * 60 + (isNaN(startM) ? 0 : startM);
    const endMinutes = (isNaN(endH) ? 8 : endH) * 60 + (isNaN(endM) ? 0 : endM);
    if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
        return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }
}

/**
 * 计算当前免打扰时间段的结束时间绝对毫秒戳（若当前不在免打扰内则返回 0）
 */
function nextQuietEnd(char, nowMs = Date.now()) {
    if (!char.autoReply || !char.autoReply.dndEnabled) return 0;
    const [startH, startM] = (char.autoReply.dndStart || '23:00').split(':').map(Number);
    const [endH, endM] = (char.autoReply.dndEnd || '08:00').split(':').map(Number);
    const startMinutes = (isNaN(startH) ? 23 : startH) * 60 + (isNaN(startM) ? 0 : startM);
    const endMinutes = (isNaN(endH) ? 8 : endH) * 60 + (isNaN(endM) ? 0 : endM);
    if (startMinutes === endMinutes) return 0;
    const now = new Date(nowMs);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const inDnd = startMinutes <= endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;
    if (!inDnd) return 0;
    const end = new Date(nowMs);
    end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    if (startMinutes > endMinutes && currentMinutes >= startMinutes) {
        end.setDate(end.getDate() + 1);
    }
    return end.getTime();
}

async function checkAutoReply() {
    const now = Date.now();
    for (const char of db.characters) {
        try {
            if (!char.autoReply || !char.autoReply.enabled) continue;

            // 免打扰模式检查：如果在设定的免打扰时间段内，延后唤醒时间并在晨起自然唤醒
            if (char.autoReply.dndEnabled) {
                const inDnd = isInQuietHours(char, now);
                if (inDnd) {
                    // 免打扰生效中：记录标记，并计算晨起自然唤醒目标时间（DND 结束点 + 5~20 分钟晨起抖动）
                    char.autoReply._wasInDnd = true;
                    const quietEnd = nextQuietEnd(char, now);
                    if (quietEnd > 0) {
                        if (!char.autoReply.scheduledWakeUpAt || char.autoReply.scheduledWakeUpAt <= now) {
                            const wakeUpDelayMin = 5 + Math.floor(Math.random() * 16);
                            char.autoReply.scheduledWakeUpAt = quietEnd + wakeUpDelayMin * 60 * 1000;
                        }
                    } else {
                        char.autoReply.scheduledWakeUpAt = null;
                    }
                    char.autoReply.lastTriggerTime = now;
                    await saveData();
                    continue;
                }

                // 刚退出免打扰状态：重置新周期的随机时长并对齐倒计时起点
                if (char.autoReply._wasInDnd) {
                    char.autoReply._wasInDnd = false;
                    let minMin = char.autoReply.intervalMin !== undefined ? char.autoReply.intervalMin : (char.autoReply.interval || 60);
                    let maxMin = char.autoReply.intervalMax !== undefined ? char.autoReply.intervalMax : (char.autoReply.interval || 60);
                    if (minMin > maxMin) {
                        const temp = minMin;
                        minMin = maxMin;
                        maxMin = temp;
                    }
                    char.autoReply.currentRandomInterval = Math.floor(Math.random() * (maxMin - minMin + 1)) + minMin;
                    if (char.autoReply.scheduledWakeUpAt) {
                        const targetTime = char.autoReply.scheduledWakeUpAt;
                        char.autoReply.lastTriggerTime = targetTime - char.autoReply.currentRandomInterval * 60 * 1000;
                        char.autoReply.scheduledWakeUpAt = null;
                        console.log(`[AutoReply] DND 结束后自然唤醒设定 (${char.remarkName || char.realName}): 目标时间 ${new Date(targetTime).toLocaleTimeString()}`);
                    } else {
                        char.autoReply.lastTriggerTime = now;
                    }
                    await saveData();
                }
            }

            // 支持随机时间段：如果未设定当前周期随机时长，则在 [intervalMin, intervalMax] 之间生成
            let minMin = char.autoReply.intervalMin !== undefined ? char.autoReply.intervalMin : (char.autoReply.interval || 60);
            let maxMin = char.autoReply.intervalMax !== undefined ? char.autoReply.intervalMax : (char.autoReply.interval || 60);
            if (minMin > maxMin) {
                const temp = minMin;
                minMin = maxMin;
                maxMin = temp;
            }
            if (!char.autoReply.currentRandomInterval || char.autoReply.currentRandomInterval < minMin || char.autoReply.currentRandomInterval > maxMin) {
                char.autoReply.currentRandomInterval = Math.floor(Math.random() * (maxMin - minMin + 1)) + minMin;
            }
            const intervalMs = (char.autoReply.currentRandomInterval || 60) * 60 * 1000;
            const lastTriggerTime = char.autoReply.lastTriggerTime || 0;
            
            // 检查上次触发时间冷却
            if (now - lastTriggerTime < intervalMs) continue;

            let lastMsgTime = 0;
            if (char.history && char.history.length > 0) {
                lastMsgTime = char.history[char.history.length - 1].timestamp;
            } else {
                continue;
            }

            // 检查无操作时间 (最后一条消息到现在的时间)
            if (now - lastMsgTime > intervalMs) {
                console.log(`[AutoReply] 触发角色 ${char.remarkName || char.realName} (周期: ${char.autoReply.currentRandomInterval}m)`);
                char.autoReply.lastTriggerTime = now;
                // 重置当前周期的随机时长，为下一轮抽取新的随机值
                char.autoReply.currentRandomInterval = Math.floor(Math.random() * (maxMin - minMin + 1)) + minMin;
                await saveData(); // 先保存触发时间与新周期时长，防止重复触发
                
                const historyLenBefore = char.history ? char.history.length : 0;
                const lastMsgIdBefore = char.history && char.history.length > 0
                    ? char.history[char.history.length - 1].id
                    : null;
                try {
                    const charBefore = db.characters.find(c => c.id === char.id) || char;
                    const lastMsgNow = charBefore.history && charBefore.history.length > 0
                        ? charBefore.history[charBefore.history.length - 1]
                        : null;
                    if (lastMsgNow && lastMsgIdBefore && lastMsgNow.id !== lastMsgIdBefore) {
                        console.log(`[AutoReply] 跳过 ${char.remarkName || char.realName}：检测到新消息插入，避免状态冲突与复读`);
                        continue;
                    }
                    await getAiReply(char.id, 'private', true);
                } catch (aiErr) {
                    console.error(`[AutoReply] AI 生成回复失败 (${char.remarkName || char.realName}):`, aiErr);
                }
                
                // 自动唤醒屏幕并发送系统通知
                try {
                    const charNow = db.characters.find(c => c.id === char.id) || char;
                    if (charNow.history && charNow.history.length > historyLenBefore) {
                        const newMsg = charNow.history[charNow.history.length - 1];
                        let notifyContent = newMsg.content || "发来了一条新消息";
                        // 清洗内部包装标签
                        notifyContent = notifyContent.replace(/\[.*?的消息[：:]([\s\S]*?)\]/, "$1")
                                                     .replace(/\[.*?\]/g, "").trim();
                        if (!notifyContent) notifyContent = "发来了一条新消息";
                        
                        const senderName = charNow.remarkName || charNow.realName || "角色";
                        if (window.AndroidBridge && typeof window.AndroidBridge.wakeScreenAndNotify === "function") {
                            window.AndroidBridge.wakeScreenAndNotify(senderName, notifyContent);
                        } else if (typeof window.sendSystemNotification === "function") {
                            window.sendSystemNotification(senderName, notifyContent);
                        }
                    }
                } catch (notifyErr) {
                    console.error("[AutoReply] 发送系统通知失败:", notifyErr);
                }
            }
        } catch (charLoopErr) {
            console.error(`[AutoReply] 处理角色 ${char && (char.remarkName || char.realName)} 出错:`, charLoopErr);
        }
    }
}
window.checkAutoReply = checkAutoReply;

// === 主入口 ===
document.addEventListener('DOMContentLoaded', () => {
    initDatabase();
    init().then(() => {
        if (window.KeepAliveManager) {
            window.KeepAliveManager.init(Boolean(db.apiSettings && db.apiSettings.keepAliveEnabled));
        }
    });
});

// === 全局救援手势 (三击清空全局CSS) ===
// 将变量提升到顶层，防止混淆器错误处理闭包作用域
let globalRescueClickCount = 0;
let globalRescueLastClickTime = 0;

function setupGlobalRescueGesture() {
    const CLICK_TIMEOUT = 400; // 400ms 间隔

    document.addEventListener('click', (e) => {
        const now = Date.now();
        const gap = now - globalRescueLastClickTime;
        
        if (gap < CLICK_TIMEOUT) {
            globalRescueClickCount++;
        } else {
            globalRescueClickCount = 1;
        }
        
        
        globalRescueLastClickTime = now;

        if (globalRescueClickCount === 5) {
            console.log('[GlobalGesture] Triggering rescue panel!');
            showGlobalRescuePanel();
            globalRescueClickCount = 0;
        }
    }, true); // 使用捕获阶段，确保尽早触发
}

function showGlobalRescuePanel() {
    // 防止重复创建
    if (document.getElementById('global-rescue-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'global-rescue-panel';
    panel.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 999999;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        backdrop-filter: blur(5px);
    `;

    panel.innerHTML = `
        <div style="background: #fff; width: 85%; max-width: 320px; border-radius: 16px; padding: 25px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            <div style="width: 60px; height: 60px; background: #ffebee; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                <svg style="width: 32px; height: 32px; color: #d32f2f;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h3 style="margin: 0 0 10px; color: #333; font-size: 18px;">全局样式救援</h3>
            <p style="margin: 0 0 20px; color: #666; font-size: 14px; line-height: 1.5;">
                检测到您快速点击了五次屏幕。<br>
                如果因为错误的全局 CSS 导致界面错乱，您可以在这里一键清空。
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="rescue-clear-btn" style="background: #d32f2f; color: #fff; border: none; padding: 12px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">清空全局 CSS</button>
                <button id="rescue-cancel-btn" style="background: #f5f5f5; color: #666; border: none; padding: 12px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('rescue-clear-btn').onclick = async () => {
        if (confirm('确定要清空全局 CSS 吗？此操作不可撤销。')) {
            db.globalCss = '';
            await saveData();
            applyGlobalCss('');
            // 更新设置页面的文本框（如果存在）
            const textarea = document.getElementById('global-beautification-css');
            if (textarea) textarea.value = '';
            
            showToast('全局 CSS 已清空，界面应已恢复正常。');
            panel.remove();
        }
    };

    document.getElementById('rescue-cancel-btn').onclick = () => {
        panel.remove();
    };
}
