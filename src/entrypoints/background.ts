export default defineBackground(() => {
    let currentBaseUrl = "https://3w.humanitarianaction.info";

    const getUrlFilter = (url: string) => {
        try {
            return new URL(url).origin + "/*";
        } catch (e) {
            return "https://3w.humanitarianaction.info/*";
        }
    };

    // --- HELPER FOR LOGGING ---
    const saveLogEntry = (entry: any) => {
        browser.storage.local.get("logs").then((res) => {
            const logs = Array.isArray(res.logs) ? res.logs : [];
            browser.storage.local.set({ logs: [entry, ...logs].slice(0, 50) });
        });
    };

    const registerListeners = (baseUrl: string) => {
        // Remove existing listeners if possible (though we use specific filters)
        // In some browsers you might need to track the listener function references
        
        const filter = { urls: [getUrlFilter(baseUrl)] };
        console.log("[Background] Registering listeners for:", filter.urls);

        // 1. CAPTURE LOGS
        browser.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (details.url.includes("wxtReplay=1")) return undefined;

                browser.storage.local.get("ignoredPaths").then((res) => {
                    const ignoredPaths = Array.isArray(res.ignoredPaths) ? res.ignoredPaths : [];
                    const url = new URL(details.url);
                    if (ignoredPaths.some(path => url.pathname.includes(path))) return;

                    const methodsToRecord = ["POST", "PUT", "PATCH", "DELETE"];
                    if (methodsToRecord.includes(details.method)) {
                        let capturedBody = null;
                        if (details.method !== "DELETE" && details.requestBody?.raw?.[0]?.bytes) {
                            try {
                                const decoder = new TextDecoder("utf-8");
                                const rawString = decoder.decode(details.requestBody.raw[0].bytes);
                                capturedBody = JSON.parse(rawString);
                            } catch (e) {
                                capturedBody = "Could not parse body";
                            }
                        }
                        saveLogEntry({
                            id: crypto.randomUUID(),
                            url: details.url,
                            method: details.method,
                            timestamp: Date.now(),
                            body: capturedBody,
                        });
                    }
                });
                return undefined;
            },
            filter,
            ["requestBody"]
        );

        // 2. CAPTURE TOKENS
        browser.webRequest.onBeforeSendHeaders.addListener(
            (details) => {
                const headers = details.requestHeaders || [];
                const cookieHeader = headers.find(h => h.name.toLowerCase() === "cookie");
                if (cookieHeader?.value) {
                    const authMatch = cookieHeader.value.match(/auth=([^;]+)/);
                    if (authMatch) browser.storage.local.set({ apiToken: authMatch[1] });
                    const userIdMatch = cookieHeader.value.match(/userId=([^;]+)/);
                    if (userIdMatch) browser.storage.local.set({ activityUserId: userIdMatch[1] });
                }
                return undefined;
            },
            filter,
            ["requestHeaders", "extraHeaders"]
        );

        // 3. SPOOFING (DNR)
        const origin = new URL(baseUrl).origin;
        browser.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [1],
            addRules: [{
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'origin', operation: 'set', value: origin },
                        { header: 'referer', operation: 'set', value: origin + '/' }
                    ]
                },
                condition: {
                    urlFilter: "*wxtReplay=1*",
                    resourceTypes: ["xmlhttprequest"]
                }
            }]
        });
    };

    // Initial registration
    browser.storage.local.get("baseUrl").then((res) => {
        if (res.baseUrl) currentBaseUrl = res.baseUrl;
        registerListeners(currentBaseUrl);
    });

    // Handle updates
    browser.storage.onChanged.addListener((changes) => {
        if (changes.baseUrl?.newValue && changes.baseUrl.newValue !== currentBaseUrl) {
            currentBaseUrl = changes.baseUrl.newValue;
            // We can't easily "remove" anonymous listeners in webRequest without references, 
            // but for a simple extension like this, we'll just reload the extension or clear listeners
            // Better: use browser.runtime.reload() or track them. 
            // For simplicity in this demo, we'll just register again (note: this might duplicate logs if not careful)
            // A better way is to use a single listener that checks storage inside it, but webRequest filters are static.
            location.reload(); 
        }
    });
});
