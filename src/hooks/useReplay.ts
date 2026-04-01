import {useState} from 'react';
import {Database, LogEntry, ReplayResult, ReplayRun, MappingInfo} from "@/types.ts";
import {getResourceMap} from "@/utils/mappingEngine";

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
    const [manualSourceId, setManualSourceId] = useState("");

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
        setShowResultsDialog(true);
    };

    const applyReplacementsFromMap = (text: string, resourceMap: Map<string, MappingInfo>, targetDbId: string): string => {
        if (!text || resourceMap.size === 0) return text;
        const sortedIds = Array.from(resourceMap.keys()).sort((a, b) => b.length - a.length);
        let result = text;
        for (const sId of sortedIds) {
            const info = resourceMap.get(sId);
            const translation = info?.translations.find(t => t.targetDbId === targetDbId);
            if (translation && translation.targetId !== sId) {
                result = result.split(sId).join(translation.targetId);
            }
        }
        return result;
    };

    const translateFormulaChain = (
        value: string, 
        databases: Database[], 
        resourceMap: Map<string, MappingInfo>,
        targetDbId: string,
        scopingFormId?: string
    ): string => {
        if (!value) return value;
        
        const idChainRegex = /\b(?=[a-z0-9.]*[a-z])(?=[a-z0-9.]*[0-9])[a-z0-9.]+(?:\.[a-z0-9.]+)*\b/g;
        const chains = Array.from(new Set(value.match(idChainRegex) || []));
        
        let result = value;
        
        const allResources = databases.flatMap(db => db.resources || []);
        const targetDb = databases.find(db => db.databaseId === targetDbId);

        chains.forEach(chain => {
            const segments = chain.split('.');
            let currentSourceFormId: string | undefined = scopingFormId;
            
            const translatedSegments: string[] = [];
            let possible = true;

            for (const segment of segments) {
                if (!currentSourceFormId) {
                    possible = false;
                    break;
                }

                const sourceForm = allResources.find(r => r.id === currentSourceFormId);
                const sourceField = sourceForm?.schema?.elements.find(f => f.id === segment);
                
                if (!sourceField) {
                    const info = resourceMap.get(segment);
                    if (info?.type === 'FIELD') {
                        const translation = info.translations.find(t => t.targetDbId === targetDbId);
                        if (translation?.targetCode) {
                            translatedSegments.push(translation.targetCode);
                            currentSourceFormId = undefined; 
                            continue;
                        }
                    }
                    possible = false;
                    break;
                }

                let targetCode = sourceField.code || segment;
                const targetForm = targetDb?.resources?.find(r => r.label === sourceForm?.label && r.type === 'FORM');
                const targetField = targetForm?.schema?.elements.find(f => f.label === sourceField.label);
                
                if (targetField?.code) {
                    targetCode = targetField.code;
                }
                
                translatedSegments.push(targetCode);
                currentSourceFormId = sourceField.typeParameters?.range?.[0]?.formId;
            }

            if (possible && translatedSegments.length === segments.length) {
                result = result.split(chain).join(translatedSegments.join('.'));
            } else if (segments.length === 1) {
                const info = resourceMap.get(chain);
                if (info) {
                    const translation = info.translations.find(t => t.targetDbId === targetDbId);
                    if (translation) result = result.split(chain).join(translation.targetId);
                }
            }
        });

        return result;
    };

    const translateBody = (
        obj: any, 
        targetDbId: string, 
        databases: Database[], 
        resourceMap: Map<string, MappingInfo>,
        scopingFormId?: string
    ): any => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => translateBody(item, targetDbId, databases, resourceMap, scopingFormId));

        const newObj: any = {};
        const formulaFields = ["prefixFormula", "formula", "relevanceCondition", "defaultValueFormula", "validationCondition"];

        if (!scopingFormId) {
            scopingFormId = Array.from(resourceMap.values()).find(info => info.type === 'FORM')?.sourceId;
        }

        for (const key in obj) {
            let value = obj[key];
            
            if (formulaFields.includes(key) && typeof value === 'string') {
                value = translateFormulaChain(value, databases, resourceMap, targetDbId, scopingFormId);
            } else if (typeof value === 'string') {
                const info = resourceMap.get(value);
                if (info) {
                    const translation = info.translations.find(t => t.targetDbId === targetDbId);
                    if (translation) value = translation.targetId;
                }
            } else if (typeof value === 'object') {
                value = translateBody(value, targetDbId, databases, resourceMap, scopingFormId);
            }
            newObj[key] = value;
        }
        return newObj;
    };

    const executeReplay = async () => {
        const storage = await browser.storage.local.get(["apiToken", "activityUserId"]);
        const userId = (storage.activityUserId as string) || "";
        const apiToken = (storage.apiToken as string) || "";
        if (!apiToken) return;

        setIsReplaying(true);
        setIsConfiguring(false);

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
                
                const combinedText = new URL(log.url).pathname + " " + JSON.stringify(log.body);
                const resourceMap = getResourceMap(combinedText, databases, [targetDbMetadata]);
                
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

    return { isReplaying, currentRun, showResultsDialog, setShowResultsDialog, isConfiguring, manualSourceId, setManualSourceId, handleReplayClick, executeReplay };
};
