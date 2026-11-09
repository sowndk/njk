// Cloudflare 后台消息与 Web Push 调度模块
(function () {
    const STORAGE_KEY = 'uwu_cf_backend_config';
    const DEFAULT_CONFIG = {
        enabled: false,
        workerUrl: '',
        backendToken: '',
        userId: ''
    };

    function getConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
        } catch (e) {
            return { ...DEFAULT_CONFIG };
        }
    }

    function saveConfig(cfg) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
        } catch (e) {
            console.error('[CF Backend] 保存设置失败', e);
        }
    }

    function getOrCreateUserId() {
        let cfg = getConfig();
        if (!cfg.userId) {
            cfg.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            saveConfig(cfg);
        }
        return cfg.userId;
    }

    function cleanUrl(url) {
        if (!url) return '';
        let cleaned = url.trim().replace(/\/+$/, '');
        cleaned = cleaned.replace(/\/setup\/?$/, '');
        return cleaned;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function testBackend() {
        const cfg = getConfig();
        const base = cleanUrl(cfg.workerUrl);
        if (!base) throw new Error('请先填写 Worker 地址');
        if (!cfg.backendToken) throw new Error('请先填写后台访问 Token');

        const uid = getOrCreateUserId();
        const res = await fetch(`${base}/v1/status?userId=${encodeURIComponent(uid)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cfg.backendToken.trim()}`
            }
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`连接失败 (${res.status}): ${text.slice(0, 100)}`);
        }
        return await res.json();
    }

    async function registerPush(force = false) {
        const cfg = getConfig();
        const base = cleanUrl(cfg.workerUrl);
        if (!base || !cfg.backendToken) throw new Error('请先配置 Worker 地址与 Token');

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            throw new Error('当前浏览器不支持 Web Push 通知');
        }

        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            throw new Error('未取得通知权限，请在浏览器或系统设置中允许通知');
        }

        const swReg = await navigator.serviceWorker.ready;
        const configRes = await fetch(`${base}/v1/push/config`, {
            headers: { 'Authorization': `Bearer ${cfg.backendToken.trim()}` }
        });
        if (!configRes.ok) throw new Error('获取 Worker 公钥失败，请确认后端已配置 VAPID_PUBLIC_KEY');
        const { publicKey } = await configRes.json();
        if (!publicKey) throw new Error('Worker 尚未配置 VAPID_PUBLIC_KEY，请在 Cloudflare 中设置');

        let sub = await swReg.pushManager.getSubscription();
        if (sub && force) {
            try { await sub.unsubscribe(); } catch(e){}
            sub = null;
        }
        if (!sub) {
            sub = await swReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }

        const regRes = await fetch(`${base}/v1/push/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.backendToken.trim()}`
            },
            body: JSON.stringify({
                userId: getOrCreateUserId(),
                subscription: sub.toJSON(),
                appUrl: window.location.href,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            })
        });

        if (!regRes.ok) {
            const err = await regRes.text();
            throw new Error(`注册设备到 Worker 失败: ${err.slice(0, 100)}`);
        }
        return true;
    }

    async function testPush() {
        const cfg = getConfig();
        const base = cleanUrl(cfg.workerUrl);
        if (!base || !cfg.backendToken) throw new Error('请先配置 Worker 地址与 Token');

        const res = await fetch(`${base}/v1/push/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.backendToken.trim()}`
            },
            body: JSON.stringify({
                userId: getOrCreateUserId(),
                title: 'UwU 测试通知',
                body: '这是一条后台推送测试通知，说明你的 Worker 和推送链路完全畅通！',
                url: window.location.href
            })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`发送测试失败: ${err.slice(0, 100)}`);
        }
        return await res.json();
    }

    async function submitAiJob(params) {
        const cfg = getConfig();
        const base = cleanUrl(cfg.workerUrl);
        if (!cfg.enabled || !base || !cfg.backendToken) return null;

        const {
            chatId,
            chatType,
            chatName,
            chatStatusRegex,
            requestBody,
            aiConfig
        } = params;

        const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        const res = await fetch(`${base}/v1/ai/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.backendToken.trim()}`
            },
            body: JSON.stringify({
                userId: getOrCreateUserId(),
                jobId,
                chatId,
                chatType,
                chatName,
                chatStatusRegex: chatStatusRegex || '',
                aiConfig,
                requestBody,
                appUrl: window.location.href
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`提交后台任务失败 (${res.status}): ${err.slice(0, 120)}`);
        }
        return await res.json();
    }

    async function pullMessages() {
        const cfg = getConfig();
        const base = cleanUrl(cfg.workerUrl);
        if (!cfg.enabled || !base || !cfg.backendToken) return [];

        try {
            const uid = getOrCreateUserId();
            const res = await fetch(`${base}/v1/messages/pull?userId=${encodeURIComponent(uid)}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${cfg.backendToken.trim()}` }
            });
            if (!res.ok) return [];
            const data = await res.json();
            const msgs = data.messages || [];
            if (msgs.length > 0) {
                const ids = msgs.map(m => m.id);
                await fetch(`${base}/v1/messages/ack`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cfg.backendToken.trim()}`
                    },
                    body: JSON.stringify({ userId: getOrCreateUserId(), ids })
                });
            }
            return msgs;
        } catch (e) {
            console.warn('[CF Backend] 拉取未读消息失败', e);
            return [];
        }
    }

    // 监听来自 Service Worker 点击通知后的唤醒指令
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NAVIGATE_CHAT') {
                const { chatId, chatType } = event.data;
                if (chatId && typeof window.openChat === 'function') {
                    window.openChat(chatId, chatType);
                }
            }
        });
    }

    // 处理从 Cloudflare 拉取回来的后台未读消息
    async function handleReceivedPendingMessages(msgs) {
        if (!Array.isArray(msgs) || msgs.length === 0) return;
        let hasNew = false;
        for (const item of msgs) {
            const chatId = item.chatId;
            const chatType = item.chatType || 'private';
            const chat = (chatType === 'private')
                ? db.characters.find(c => c.id === chatId)
                : db.groups.find(g => g.id === chatId);
            
            if (!chat) continue;
            if (!chat.history) chat.history = [];

            // 避免重复追加：检查是否已经存过该消息
            const isAlreadyAdded = chat.history.some(m => m.id === item.id || (m.timestamp === item.timestamp && m.content === item.content));
            if (!isAlreadyAdded) {
                if (typeof handleAiReplyContent === 'function') {
                    // 交给 handleAiReplyContent 进行完整的思维链/状态栏/朋友圈/气泡解析
                    await handleAiReplyContent(item.content, chat, chatId, chatType, false);
                } else {
                    const newMsg = {
                        id: item.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        role: item.role || 'assistant',
                        content: item.content,
                        timestamp: item.timestamp || Date.now()
                    };
                    chat.history.push(newMsg);
                    if (typeof addMessageBubble === 'function') {
                        addMessageBubble(newMsg, chatId, chatType);
                    }
                }
                hasNew = true;
            }
        }

        if (hasNew) {
            if (typeof saveData === 'function') await saveData();
            if (typeof renderChatList === 'function') renderChatList();
            if (typeof renderMessages === 'function' && typeof currentChatId !== 'undefined') {
                renderMessages(false, true);
            }
        }
    }
    window.handleReceivedPendingMessages = handleReceivedPendingMessages;

    // 页面切回前台时，自动尝试拉取后台累积的消息
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const cfg = getConfig();
            if (cfg.enabled) {
                const msgs = await pullMessages();
                if (msgs.length > 0) {
                    await handleReceivedPendingMessages(msgs);
                }
            }
        }
    });

    // 页面初始化加载时也尝试拉取一次
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            const cfg = getConfig();
            if (cfg.enabled) {
                const msgs = await pullMessages();
                if (msgs.length > 0) await handleReceivedPendingMessages(msgs);
            }
        });
    } else {
        setTimeout(async () => {
            const cfg = getConfig();
            if (cfg.enabled) {
                const msgs = await pullMessages();
                if (msgs.length > 0) await handleReceivedPendingMessages(msgs);
            }
        }, 1000);
    }


    // 同步角色上下文与自动消息设置到 Cloudflare Worker
    async function syncChat(params) {
        const cfg = getConfig();
        const base = cleanUrl(cfg.workerUrl);
        if (!cfg.enabled || !base || !cfg.backendToken) return false;

        const {
            chatId,
            chatType,
            realName,
            remarkName,
            chatStatusRegex,
            myName,
            autoReply,
            requestBody,
            aiConfig
        } = params;

        try {
            const uid = getOrCreateUserId();
            const res = await fetch(`${base}/v1/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.backendToken.trim()}`
                },
                body: JSON.stringify({
                    userId: uid,
                    chatId,
                    chatType: chatType || 'private',
                    realName: realName || '',
                    remarkName: remarkName || realName || '',
                    chatStatusRegex: chatStatusRegex || '',
                    myName: myName || '用户',
                    autoReply: autoReply || { enabled: false },
                    requestBody: requestBody || null,
                    aiConfig: aiConfig || null,
                    appUrl: window.location.href
                })
            });
            if (!res.ok) {
                const err = await res.text();
                console.warn('[CF Backend] 同步角色上下文失败:', err);
                return false;
            }
            console.log('[CF Backend] 角色上下文及主动消息设置已同步到云端:', chatId);
            return true;
        } catch (e) {
            console.warn('[CF Backend] 同步请求异常:', e);
            return false;
        }
    }

    window.CfBackend = {
        syncChat,
        getConfig,
        saveConfig,
        testBackend,
        registerPush,
        testPush,
        submitAiJob,
        pullMessages
    };
})();
