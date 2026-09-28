/**
 * Android WebView 下载与系统通知桥接助手 (android_download_bridge.js)
 * 
 * 作用：
 * 1. 提供全局 downloadFile(data, filename, mimeType) 方法。
 * 2. 自动劫持拦截页面内所有的 <a download> 标签点击以及 Blob/DataURL 下载。
 * 3. 提供全局 sendSystemNotification(title, message) 方法，跨平台发送系统消息通知（支持锁屏亮屏弹窗）。
 */

(function (window) {
    'use strict';

    /**
     * 将 Blob / File 转换为 Base64
     */
    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 核心统一保存方法
     * @param {Blob|File|string} data 要保存的数据（可为 Blob、File、DataURL 或纯文本字符串）
     * @param {string} filename 文件名（如 "backup.json"）
     * @param {string} [mimeType] MIME类型（可选，默认根据文件名或数据推断）
     */
    async function downloadFile(data, filename, mimeType) {
        filename = filename || ('download_' + Date.now());

        // 如果在注入了 AndroidBridge 的 Android App 环境下
        if (window.AndroidBridge && typeof window.AndroidBridge.requestSaveFile === 'function') {
            try {
                var base64Str = '';
                var inferredType = mimeType || 'application/octet-stream';

                if (data instanceof Blob) {
                    inferredType = mimeType || data.type || inferredType;
                    base64Str = await blobToBase64(data);
                } else if (typeof data === 'string') {
                    if (data.startsWith('data:')) {
                        base64Str = data;
                        if (!mimeType) {
                            var match = data.match(/^data:([^;]+);/);
                            if (match) inferredType = match[1];
                        }
                    } else if (data.startsWith('blob:')) {
                        var res = await fetch(data);
                        var b = await res.blob();
                        inferredType = mimeType || b.type || inferredType;
                        base64Str = await blobToBase64(b);
                    } else {
                        // 纯文本内容
                        inferredType = mimeType || 'text/plain;charset=utf-8';
                        var textBlob = new Blob([data], { type: inferredType });
                        base64Str = await blobToBase64(textBlob);
                    }
                }

                // 调用原生接口
                window.AndroidBridge.requestSaveFile(base64Str, filename, inferredType);
                return;
            } catch (err) {
                console.error('[AndroidBridge] 保存失败，降级回常规下载:', err);
            }
        }

        // 默认浏览器环境或降级处理
        var downloadUrl = '';
        var needRevoke = false;

        if (data instanceof Blob) {
            downloadUrl = URL.createObjectURL(data);
            needRevoke = true;
        } else if (typeof data === 'string') {
            downloadUrl = data;
        }

        var a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (needRevoke) {
            setTimeout(function () {
                URL.revokeObjectURL(downloadUrl);
            }, 1000);
        }
    }

    /**
     * 发送系统原生通知（锁屏、横幅）
     * @param {string} title 标题（如角色名、群名称）
     * @param {string} message 消息摘要内容
     */
    function sendSystemNotification(title, message) {
        if (!title && !message) return;
        title = title || '新消息';
        message = message || '';

        // 1. 如果在 Android App 原生环境，直接走原生最高优先级通知通道
        if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === 'function') {
            try {
                window.AndroidBridge.showNotification(String(title), String(message));
                return;
            } catch (err) {
                console.error('[AndroidBridge] 发送系统通知失败:', err);
            }
        }

        // 2. 如果在普通浏览器环境，尝试走 HTML5 Notification API 降级
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: 'icon.png'
                });
            }
        } catch (e) {
            // 忽略浏览器不支持或受限
        }
    }

    // 暴露到全局，方便业务调用
    window.downloadFile = downloadFile;
    window.sendSystemNotification = sendSystemNotification;

    /**
     * 全局事件代理（零侵入拦截）：
     * 拦截整个网页中所有第三方模块、动态生成的 a[download] 点击事件。
     * 当处于 AndroidBridge 环境中时，自动接管并转为原生保存。
     */
    document.addEventListener('click', function (e) {
        if (!window.AndroidBridge || typeof window.AndroidBridge.requestSaveFile !== 'function') {
            return; // 普通浏览器环境不拦截，让浏览器原生处理
        }

        var link = e.target.closest('a[download]');
        if (!link) return;

        var href = link.getAttribute('href');
        var downloadName = link.getAttribute('download') || 'download_file';

        if (!href) return;

        // 如果是 blob: 或 data: 或同源文件
        if (href.startsWith('blob:') || href.startsWith('data:')) {
            e.preventDefault();
            e.stopPropagation();
            downloadFile(href, downloadName);
        }
    }, true);

})(window);