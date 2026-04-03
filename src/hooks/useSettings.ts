import { useState, useEffect } from 'react';

export const useSettings = () => {
    const [baseUrl, setBaseUrl] = useState<string>("https://3w.humanitarianaction.info");
    const [hasPermission, setHasPermission] = useState<boolean>(false);

    useEffect(() => {
        browser.storage.local.get("baseUrl").then((res) => {
            if (res.baseUrl) setBaseUrl(res.baseUrl);
        });
    }, []);

    useEffect(() => {
        const origin = new URL(baseUrl).origin + "/*";
        browser.permissions.contains({ origins: [origin] }).then(setHasPermission);
    }, [baseUrl]);

    const updateBaseUrl = async (newUrl: string) => {
        try {
            const parsed = new URL(newUrl);
            const cleanUrl = parsed.origin;
            setBaseUrl(cleanUrl);
            await browser.storage.local.set({ baseUrl: cleanUrl });
            
            // Re-check permission
            const origin = cleanUrl + "/*";
            const exists = await browser.permissions.contains({ origins: [origin] });
            setHasPermission(exists);
        } catch (e) {
            console.error("Invalid URL", e);
        }
    };

    const grantPermission = async () => {
        const origin = new URL(baseUrl).origin + "/*";
        const granted = await browser.permissions.request({ origins: [origin] });
        if (granted) {
            setHasPermission(true);
            // Reload extension to re-register listeners with new permissions?
            // Actually webRequest listeners can be re-registered in background.
            // But we might want to tell background to re-init.
        }
        return granted;
    };

    return { baseUrl, updateBaseUrl, grantPermission, hasPermission };
};
