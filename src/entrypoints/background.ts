export default defineBackground(() => {
    // --- HELPER FOR LOGGING ---
    const saveLogEntry = (entry: any) => {
        browser.storage.local.get("logs").then((res) => {
            const logs = Array.isArray(res.logs) ? res.logs : [];
            browser.storage.local.set({ logs: [entry, ...logs].slice(0, 50) });
        });
    };

    // --- 1. CAPTURE LOGS (Body) ---
    browser.webRequest.onBeforeRequest.addListener(
        (details) => {
            if (details.url.includes("wxtReplay=1")) {
                return undefined;
            }

            // Check ignore list
            browser.storage.local.get("ignoredPaths").then((res) => {
                const ignoredPaths = Array.isArray(res.ignoredPaths) ? res.ignoredPaths : [];
                const url = new URL(details.url);
                if (ignoredPaths.some(path => url.pathname.includes(path))) {
                    return;
                }

                const methodsToRecord = ["POST", "PUT", "PATCH", "DELETE"];
                if (methodsToRecord.includes(details.method)) {
                    let capturedBody = null;
                    if (details.method !== "DELETE" && details.requestBody?.raw?.[0]?.bytes) {
                        try {
                            const decoder = new TextDecoder("utf-8");
                            const rawString = decoder.decode(details.requestBody.raw[0].bytes);
                            capturedBody = JSON.parse(rawString);
                        } catch (e) {
                            capturedBody = "Could not parse body (likely not JSON)";
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
        { urls: ["https://3w.humanitarianaction.info/*"] },
        ["requestBody"]
    );

    // --- 2. CAPTURE TOKENS (Headers) ---
    browser.webRequest.onBeforeSendHeaders.addListener(
        (details) => {
            const headers = details.requestHeaders || [];
            const userIdHeader = headers.find(h => h.name.toLowerCase() === 'x-frontend-user');
            const cookieHeader = headers.find(h => h.name.toLowerCase() === "cookie");

            if (userIdHeader?.value) {
                browser.storage.local.set({ activityUserId: userIdHeader.value });
            }
            if (cookieHeader?.value) {
                const authMatch = cookieHeader.value.match(/auth=([^;]+)/);
                if (authMatch) browser.storage.local.set({ apiToken: authMatch[1] });

                const userIdMatch = cookieHeader.value.match(/userId=([^;]+)/);
                if (userIdMatch) browser.storage.local.set({ activityUserId: userIdMatch[1] });
            }
            return undefined;
        },
        { urls: ["https://3w.humanitarianaction.info/*"] },
        ["requestHeaders", "extraHeaders"] // NO "blocking" needed here
    );

    // --- 3. SPOOFING (DNR Session Rule) ---
    // This fixes the 403 by setting Origin/Referer natively
    browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'origin', operation: 'set', value: 'https://3w.humanitarianaction.info' },
                    { header: 'referer', operation: 'set', value: 'https://3w.humanitarianaction.info/' }
                ]
            },
            condition: {
                urlFilter: "*wxtReplay=1*", // Triggered by our flag
                resourceTypes: ["xmlhttprequest"]
            }
        }]
    });
});