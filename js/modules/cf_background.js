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

    // 页面切回前台时，自动尝试拉取后台累积的消息
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const cfg = getConfig();
            if (cfg.enabled) {
                const msgs = await pullMessages();
                if (msgs.length > 0 && typeof window.handleReceivedPendingMessages === 'function') {
                    window.handleReceivedPendingMessages(msgs);
                }
            }
        }
    });

    window.CfBackend = {
        getConfig,
        saveConfig,
        testBackend,
        registerPush,
        testPush,
        submitAiJob,
        pullMessages
    };
})();
