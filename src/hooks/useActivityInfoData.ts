import { useState, useRef, useEffect } from 'react';
import { Database, LogEntry } from "@/types.ts";

export const useActivityInfoData = (apiToken: string | undefined, logs: LogEntry[], baseUrl: string) => {
    const [databases, setDatabases] = useState<Database[]>([]);
    const [loading, setLoading] = useState(false);
    const fetchingTrees = useRef<Set<string>>(new Set());

    const fetchFormSchema = async (formId: string) => {
        if (!formId || !apiToken || fetchingTrees.current.has(formId)) return;
        
        fetchingTrees.current.add(formId);
        try {
            const response = await fetch(`${baseUrl}/resources/form/${formId}/schema`, {
                method: 'GET',
                headers: {
                    "X-ActivityInfo-Auth": apiToken,
                    "Accept": "application/json"
                }
            });

            if (!response.ok) return;
            const data = await response.json();

            // Cache in storage
            browser.storage.local.set({ [`schema_${formId}`]: data });

            setDatabases(prev => prev.map(db => ({
                ...db,
                resources: db.resources?.map(res => 
                    res.id === formId ? { ...res, schema: data } : res
                )
            })));
        } catch (error) {
            console.error("Error fetching form schema:", error);
        } finally {
            fetchingTrees.current.delete(formId);
        }
    };

    const fetchDatabaseTree = async (dbId: string) => {
        if (!dbId || !apiToken || fetchingTrees.current.has(dbId)) return;
        
        fetchingTrees.current.add(dbId);
        
        try {
            const response = await fetch(`${baseUrl}/resources/databases/${dbId}`, {
                method: 'GET',
                headers: {
                    "X-ActivityInfo-Auth": apiToken,
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                fetchingTrees.current.delete(dbId);
                return;
            }
            const data = await response.json();
            const resources = data.resources || [];

            // Cache in storage for instant availability next time
            browser.storage.local.set({ [`tree_${dbId}`]: resources });

            setDatabases(prev => prev.map(db => 
                db.databaseId === dbId 
                ? { ...db, resources } 
                : db
            ));

            // Auto-fetch schemas for forms in this DB if they are mentioned in logs
            const formIds = resources.filter((r: any) => r.type === 'FORM').map((r: any) => r.id);
            formIds.forEach((fId: string) => {
                const isMentioned = logs.some(l => l.url.includes(fId) || JSON.stringify(l.body).includes(fId));
                if (isMentioned) fetchFormSchema(fId);
            });
        } catch (error) {
            console.error("Error fetching database tree:", error);
        } finally {
            fetchingTrees.current.delete(dbId);
        }
    };

    const loadDatabases = async (token: string) => {
        setLoading(true);
        try {
            const response = await fetch(`${baseUrl}/resources/databases`, {
                method: 'GET',
                headers: {
                    "X-ActivityInfo-Auth": token,
                    "Accept": "application/json"
                }
            });

            if (!response.ok) return;
            const data = await response.json();

            const newDbs = data.map((db: any) => ({
                databaseId: String(db.databaseId || ""),
                name: db.label || db.name || "Unknown"
            }));
            
            // Merge with existing resources from storage
            const cachedTrees = await browser.storage.local.get(null); 

            setDatabases(prev => {
                return newDbs.map((newDb: { databaseId: string }) => {
                    const existingInState = prev.find(p => p.databaseId === newDb.databaseId);
                    const cachedResources = cachedTrees[`tree_${newDb.databaseId}`] as any[];
                    
                    const resources = existingInState?.resources || cachedResources || undefined;
                    const resourcesWithSchemas = resources?.map(res => {
                        if (res.type === 'FORM') {
                            const cachedSchema = cachedTrees[`schema_${res.id}`];
                            return { ...res, schema: res.schema || cachedSchema };
                        }
                        return res;
                    });

                    return { 
                        ...newDb, 
                        resources: resourcesWithSchemas
                    };
                });
            });
        } catch (error) {
            console.error("Network error fetching databases:", error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch trees for databases seen in logs
    useEffect(() => {
        if (logs.length > 0 && databases.length > 0 && apiToken) {
            const seenDbIds = new Set<string>();
            logs.forEach(log => {
                const match = log.url.match(/databases\/([a-zA-Z0-9]+)/);
                if (match && match[1]) seenDbIds.add(match[1]);
            });

            seenDbIds.forEach(id => {
                const db = databases.find(d => d.databaseId === id);
                if (db && !db.resources && !fetchingTrees.current.has(id)) {
                    fetchDatabaseTree(id);
                }
            });
        }
    }, [logs, databases.length, apiToken, baseUrl]);

    useEffect(() => {
        if (apiToken && baseUrl) {
            loadDatabases(apiToken);
        }
    }, [apiToken, baseUrl]);

    return {
        databases,
        loading,
        fetchDatabaseTree,
        fetchFormSchema,
        refreshDatabases: () => apiToken && loadDatabases(apiToken)
    };
};
