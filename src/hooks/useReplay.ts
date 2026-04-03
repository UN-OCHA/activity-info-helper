import {useState, useMemo} from 'react';
import {Database, LogEntry, ReplayResult, ReplayRun, MappingInfo} from "@/types.ts";
import {getResourceMap, getMappingMetadata} from "@/utils/mappingEngine";
import {applyReplacementsFromMap, translateBody} from "@/utils/translationEngine";

export const useReplay = (
    logs: LogEntry[], 
    databases: Database[], 
    selectedIds: Set<string>, 
    selectedDbs: Database[], 
    replayHistory: ReplayRun[], 
    setReplayHistory: (history: ReplayRun[]) => void,
    onReplayClick?: (dbId: string) => void
) => {
    const [isReplaying, setIsReplaying] = useState(false);
    const [currentRun, setCurrentRun] = useState<ReplayRun | null>(null);
    const [showResultsDialog, setShowResultsDialog] = useState(false);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false);
    const [manualSourceId, setManualSourceId] = useState("");
    const [globalResourceMap, setGlobalResourceMap] = useState<Map<string, MappingInfo>>(new Map());

    const mappingMetadata = useMemo(() => getMappingMetadata(databases), [databases]);

    const autoDetectSourceId = () => {
        const firstSelected = logs.find(l => selectedIds.has(l.id));
        if (!firstSelected) return "";
        const pathMatch = firstSelected.url.match(/databases\/([a-zA-Z0-9]+)/);
        if (pathMatch && pathMatch[1]) return pathMatch[1];
        const found = databases.find(db => JSON.stringify(firstSelected.body).includes(db.databaseId));
        return found ? found.databaseId : "";
    };

    const handleReplayClick = () => {
        setManualSourceId(autoDetectSourceId());
        if (onReplayClick) onReplayClick(autoDetectSourceId());
        setIsConfiguring(true);
        setIsReviewing(false);
        setShowResultsDialog(true);
    };

    const prepareMapping = () => {
        const selectedLogs = logs.filter(l => selectedIds.has(l.id));
        const allText = selectedLogs.map(l => new URL(l.url).pathname + " " + JSON.stringify(l.body)).join(" ");
        const map = getResourceMap(allText, databases, selectedDbs, manualSourceId, mappingMetadata);
        setGlobalResourceMap(map);
        setIsConfiguring(false);
        setIsReviewing(true);
        return map;
    };

    const goToConfig = () => {
        setIsConfiguring(true);
        setIsReviewing(false);
    };

    const updateMapping = (sourceId: string, targetDbId: string, newTargetId: string) => {
        setGlobalResourceMap(prev => {
            const next = new Map(prev);
            const info = next.get(sourceId);
            if (info) {
                const updatedTranslations = info.translations.map(t => 
                    t.targetDbId === targetDbId ? { ...t, targetId: newTargetId, error: false } : t
                );
                next.set(sourceId, { ...info, translations: updatedTranslations });
            }
            return next;
        });
    };

    const executeReplay = async (overrideMap?: Map<string, MappingInfo>) => {
        const storage = await browser.storage.local.get(["apiToken", "activityUserId"]);
        const userId = (storage.activityUserId as string) || "";
        const apiToken = (storage.apiToken as string) || "";
        if (!apiToken) return;

        setIsReplaying(true);
        setIsConfiguring(false);
        setIsReviewing(false);

        const sourceDb = databases.find(db => db.databaseId === manualSourceId);
        const newRun: ReplayRun = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            sourceDbId: manualSourceId,
            sourceDbName: sourceDb?.name || "Unknown",
            targetDbs: selectedDbs,
            results: []
        };
        setCurrentRun(newRun);

        const selectedLogs = logs.filter(l => selectedIds.has(l.id));

        for (const log of selectedLogs) {
            for (const targetDb of selectedDbs) {
                const targetDbMetadata = databases.find(db => db.databaseId === targetDb.databaseId) || targetDb;
                const tId = String(targetDbMetadata.databaseId);
                
                // Use the global map that user might have reviewed
                const resourceMap = overrideMap || globalResourceMap;
                
                const scopingFormId = Array.from(resourceMap.values()).find(info => info.type === 'FORM')?.sourceId;
                const replayedBody = translateBody(log.body, tId, databases, resourceMap, scopingFormId);
                const finalUrlPath = applyReplacementsFromMap(log.url, resourceMap, tId);

                const resultKey: Omit<ReplayResult, 'status'> = {
                    logId: log.id,
                    logPath: applyReplacementsFromMap(new URL(log.url).pathname, resourceMap, tId),
                    method: log.method,
                    dbId: tId,
                    dbName: targetDbMetadata.name,
                    timestamp: Date.now(),
                    requestBody: log.method !== 'DELETE' ? replayedBody : undefined
                };

                setCurrentRun(prev => prev ? {
                    ...prev,
                    results: [...prev.results, { ...resultKey, status: 'loading' } as ReplayResult]
                } : null);

                try {
                    const finalUrl = `${finalUrlPath}${finalUrlPath.includes('?') ? '&' : '?'}wxtReplay=1`;

                    const res = await fetch(finalUrl, {
                        method: log.method,
                        headers: {
                            "Content-Type": "application/json",
                            "x-frontend-user": userId,
                            "X-Requested-With": "XMLHttpRequest",
                        } as Record<string, string>,
                        credentials: "include",
                        body: log.method !== 'DELETE' ? JSON.stringify(resultKey.requestBody) : undefined
                    });

                    const responseText = await res.text();

                    setCurrentRun(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            results: prev.results.map(r =>
                                (r.logId === log.id && r.dbId === tId)
                                    ? { ...r, status: res.ok ? 'success' : 'error', statusCode: res.status, responseBody: responseText, error: res.ok ? undefined : responseText }
                                    : r
                            )
                        };
                    });
                } catch (e: any) {
                    setCurrentRun(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            results: prev.results.map(r => (r.logId === log.id && r.dbId === tId) ? { ...r, status: 'error', error: e.message, responseBody: e.message } : r)
                        };
                    });
                }
            }
        }

        setCurrentRun(prev => {
            if (prev) {
                const updatedHistory = [prev, ...replayHistory].slice(0, 20);
                browser.storage.local.set({ replayHistory: updatedHistory });
                setReplayHistory(updatedHistory);
            }
            return prev;
        });
        setIsReplaying(false);
    };

    return { 
        isReplaying, 
        currentRun, 
        showResultsDialog, 
        setShowResultsDialog, 
        isConfiguring, 
        isReviewing,
        setIsReviewing,
        manualSourceId, 
        setManualSourceId, 
        handleReplayClick, 
        prepareMapping,
        goToConfig,
        updateMapping,
        globalResourceMap,
        executeReplay 
    };
};
