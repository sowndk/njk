/**
 * Android WebView 下载与系统通知桥接助手 (android_download_bridge.js)
 *
 * 核心修复：
 * 1. 严格剥离 DataURL 前缀 (data:image/png;base64,)，确保传给 Android 原生的均为纯 Base64 字节串，解决 0KB 损坏问题。
 * 2. 劫持 window.URL.revokeObjectURL，在检测到 AndroidBridge 环境时延迟 8 秒释放，防止业务模块同步注销 Blob 导致 fetch 失败、无法唤起文件管理器。
 * 3. 增强全局 a[download] 拦截，无缝覆盖所有第三方与业务导出的导出请求。
 */
(function () {
    "use strict";

    console.log("[Bridge] android_download_bridge.js 已加载");

    // ==========================================
    // 0. 防早期释放：劫持 URL.revokeObjectURL
    // ==========================================
    if (window.URL && typeof window.URL.revokeObjectURL === "function") {
        var _rawRevoke = window.URL.revokeObjectURL;
        window.URL.revokeObjectURL = function (url) {
            if (window.AndroidBridge) {
                // Android 桥接环境下延迟释放，为异步 fetch/读取预留充裕时间
                setTimeout(function () {
                    try {
                        _rawRevoke.call(window.URL, url);
                    } catch (e) {}
                }, 8000);
            } else {
                _rawRevoke.call(window.URL, url);
            }
        };
    }

    // ==========================================
    // 1. 辅助函数：纯 Base64 提取与转换
    // ==========================================

    /**
     * 剥离可能存在的 "data:...;base64," 前缀
     */
    function cleanBase64(str) {
        if (typeof str !== "string") return "";
        var commaIdx = str.indexOf(",");
        if (commaIdx !== -1) {
            return str.substring(commaIdx + 1);
        }
        return str.trim();
    }

    /**
     * 将 Blob/File 转换为纯 Base64 字符串 (无前缀)
     */
    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () {
                var res = reader.result;
                if (typeof res === "string") {
                    resolve(cleanBase64(res));
                } else {
                    reject(new Error("FileReader 返回非字符串结果"));
                }
            };
            reader.onerror = function (err) {
                reject(err);
            };
            reader.readAsDataURL(blob);
        });
    }

    // ==========================================
    // 2. 核心保存入口：window.downloadFile
    // ==========================================
    window.downloadFile = async function (data, filename, mimeType) {
        filename = filename || ("download_" + Date.now() + ".bin");
        mimeType = mimeType || "application/octet-stream";

        console.log("[Bridge] downloadFile 调用:", filename, mimeType, typeof data);

        // 如果在非 AndroidBridge 环境 (如桌面浏览器开发测试)，优雅降级
        if (!window.AndroidBridge || typeof window.AndroidBridge.requestSaveFile !== "function") {
            console.log("[Bridge] 未检测到 AndroidBridge.requestSaveFile，回退到浏览器默认下载");
            fallbackBrowserDownload(data, filename, mimeType);
            return;
        }

        try {
            var base64Data = "";

            if (data instanceof Blob) {
                base64Data = await blobToBase64(data);
            } else if (typeof data === "string") {
                if (data.indexOf("data:") === 0) {
                    base64Data = cleanBase64(data);
                } else if (data.indexOf("blob:") === 0 || data.indexOf("http://") === 0 || data.indexOf("https://") === 0) {
                    var resp = await fetch(data);
                    var fetchedBlob = await resp.blob();
                    base64Data = await blobToBase64(fetchedBlob);
                } else {
                    // 普通文本内容字符串
                    var textBlob = new Blob([data], { type: mimeType });
                    base64Data = await blobToBase64(textBlob);
                }
            } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
                var bufferBlob = new Blob([data], { type: mimeType });
                base64Data = await blobToBase64(bufferBlob);
            } else {
                throw new Error("不支持的数据格式: " + typeof data);
            }

            if (!base64Data) {
                throw new Error("Base64 提取结果为空");
            }

            console.log("[Bridge] 请求 AndroidBridge.requestSaveFile, 文件名:", filename, "数据长度:", base64Data.length);
            window.AndroidBridge.requestSaveFile(base64Data, filename, mimeType);

        } catch (err) {
            console.error("[Bridge] downloadFile 处理失败:", err);
            // 失败时尝试回退
            fallbackBrowserDownload(data, filename, mimeType);
        }
    };

    /**
     * 降级浏览器原生下载逻辑
     */
    function fallbackBrowserDownload(data, filename, mimeType) {
        try {
            var blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () {
                window.URL.revokeObjectURL(url);
            }, 3000);
        } catch (e) {
            console.error("[Bridge] 回退下载异常:", e);
        }
    }

    // ==========================================
    // 3. 全局点击代理拦截 a[download]
    // ==========================================
    document.addEventListener("click", function (e) {
        var target = e.target;
        var link = target ? target.closest("a") : null;
        if (!link) return;

        var hasDownloadAttr = link.hasAttribute("download");
        var href = link.getAttribute("href") || "";

        var isBlob = href.indexOf("blob:") === 0;
        var isData = href.indexOf("data:") === 0;

        // 如果是带 download 属性的 a 标签，或者指向 blob/data 的下载链接
        if (hasDownloadAttr || isBlob || isData) {
            if (window.AndroidBridge && typeof window.AndroidBridge.requestSaveFile === "function") {
                console.log("[Bridge] 拦截到下载点击事件:", href.substring(0, 50), "downloadAttr:", link.getAttribute("download"));
                e.preventDefault();
                e.stopPropagation();

                var filename = link.getAttribute("download") || ("export_" + Date.now() + ".bin");
                window.downloadFile(href, filename, "application/octet-stream");
            }
        }
    }, true);

    // ==========================================
    // 4. 系统通知兼容方法
    // ==========================================
    window.sendSystemNotification = function (title, message) {
        if (!title && !message) return;
        if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === "function") {
            try {
                window.AndroidBridge.showNotification(title || "通知", message || "");
            } catch (e) {
                console.error("[Bridge] 原生通知调用失败:", e);
            }
        } else if ("Notification" in window && Notification.permission === "granted") {
            try {
                new Notification(title, { body: message });
            } catch (e) {}
        }
    };

})();
