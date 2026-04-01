import {useEffect, useRef, useState} from 'react';
import {Alignment, Button, Checkbox, Navbar, NonIdealState, Tab, Tabs} from "@blueprintjs/core";
import {Database, LogEntry, ReplayRun} from "@/types.ts";
import {LogItem} from "@/components/LogItem";
import {HistoryItem} from "@/components/HistoryItem";
import {DatabaseMultiSelect} from "@/components/DatabaseMultiSelect";
import {ReplayDialog} from "@/components/ReplayDialog";
import {useReplay} from "@/hooks/useReplay";
import {IgnoredPathsManager} from "@/components/IgnoredPathsManager";

export default function App() {
    // --- State Management ---
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [databases, setDatabases] = useState<Database[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [selectedDbs, setSelectedDbs] = useState<Database[]>([]);
    const [ignoredPaths, setIgnoredPaths] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTabId, setActiveTabId] = useState<string>("logs");
    const [replayHistory, setReplayHistory] = useState<ReplayRun[]>([]);
    
    // Track in-flight requests to avoid redundant network calls
    const fetchingTrees = useRef<Set<string>>(new Set());

    const fetchFormSchema = async (formId: string) => {
        if (!formId || fetchingTrees.current.has(formId)) return;
        
        const storage = await browser.storage.local.get("apiToken");
        const token = storage.apiToken as string;
        if (!token) return;

        fetchingTrees.current.add(formId);
        try {
            const baseUrl = "https://3w.humanitarianaction.info";
            const response = await fetch(`${baseUrl}/resources/form/${formId}/schema`, {
                method: 'GET',
                headers: {
                    "X-ActivityInfo-Auth": token,
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

    // --- Data Loading ---
    const fetchDatabaseTree = async (dbId: string) => {
        if (!dbId || fetchingTrees.current.has(dbId)) return;
        
        fetchingTrees.current.add(dbId);
        
        const storage = await browser.storage.local.get("apiToken");
        const token = storage.apiToken as string;
        if (!token) {
            fetchingTrees.current.delete(dbId);
            return;
        }

        try {
            const baseUrl = "https://3w.humanitarianaction.info";
            const response = await fetch(`${baseUrl}/resources/databases/${dbId}`, {
                method: 'GET',
                headers: {
                    "X-ActivityInfo-Auth": token,
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

    const {
        isReplaying,
        currentRun,
        showResultsDialog,
        setShowResultsDialog,
        isConfiguring,
        manualSourceId,
        setManualSourceId,
        handleReplayClick,
        executeReplay
    } = useReplay(logs, databases, selectedIds, selectedDbs, replayHistory, setReplayHistory, fetchDatabaseTree);

    // Auto-fetch trees for databases seen in logs
    useEffect(() => {
        if (logs.length > 0 && databases.length > 0) {
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
    }, [logs, databases.length]); 

    const loadDatabases = async (token: string) => {
        setLoading(true);
        try {
            const baseUrl = "https://3w.humanitarianaction.info";
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
            
            // Critical fix: Merge with existing resources from state and storage
            const cachedTrees = await browser.storage.local.get(null); 

            setDatabases(prev => {
                return newDbs.map((newDb: { databaseId: any; }) => {
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

    useEffect(() => {
        browser.storage.local.get(["logs", "savedDbs", "apiToken", "replayHistory", "ignoredPaths"]).then(async (res) => {
            if (res.logs) setLogs(res.logs as LogEntry[]);
            if (res.savedDbs) {
                const dbs = res.savedDbs as Database[];
                setSelectedDbs(dbs);
                dbs.forEach(db => fetchDatabaseTree(db.databaseId));
            }
            if (res.replayHistory) setReplayHistory(res.replayHistory as ReplayRun[]);
            if (res.ignoredPaths) setIgnoredPaths(res.ignoredPaths as string[]);
            if (res.apiToken) await loadDatabases(res.apiToken as string);
        });

        const handleStorageChange = async (changes: any) => {
            if (changes.apiToken?.newValue) await loadDatabases(changes.apiToken.newValue);
            if (changes.logs) {
                const newLogs = changes.logs.newValue || [];
                setLogs(newLogs);
            }
            if (changes.replayHistory) {
                setReplayHistory(changes.replayHistory.newValue || []);
            }
            if (changes.ignoredPaths) {
                setIgnoredPaths(changes.ignoredPaths.newValue || []);
            }
        };

        browser.storage.onChanged.addListener(handleStorageChange);
        return () => browser.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const toggleIgnorePath = (path: string) => {
        const next = ignoredPaths.includes(path) 
            ? ignoredPaths.filter(p => p !== path) 
            : [...ignoredPaths, path];
        setIgnoredPaths(next);
        browser.storage.local.set({ ignoredPaths: next });
    };

    return (
        <div style={{ width: '450px', height: '600px', backgroundColor: '#f5f8fa', display: 'flex', flexDirection: 'column' }}>
            <Navbar>
                <Navbar.Group align={Alignment.START}>
                    <img src="icon.png" style={{width: '24px', height: '24px', borderRadius: '8px'}} alt="logo" />
                    <Navbar.Heading style={{ fontWeight: 'bold', paddingLeft: '10px', marginRight: '4px' }}>ActivityInfo Helper</Navbar.Heading>
                    <Navbar.Divider style={{marginRight: '12px'}}/>
                    <Tabs id="MainTabs" selectedTabId={activeTabId} onChange={(id) => setActiveTabId(id as string)}>
                        <Tab id="logs" title="Logs" />
                        <Tab id="history" title="History" />
                    </Tabs>
                </Navbar.Group>
                <Navbar.Group align={Alignment.END}>
                    <Button
                        icon="share"
                        variant="minimal"
                        size="small"
                        onClick={() => {
                            browser.windows.create({
                                url: browser.runtime.getURL("/popup.html"),
                                type: "popup",
                                width: 480,
                                height: 640
                            }).then(() => {
                                window.close();
                            });
                        }}

                        title="Open in new window"
                    />
                </Navbar.Group>
            </Navbar>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {activeTabId === 'logs' ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <Checkbox
                                checked={selectedIds.size === logs.length && logs.length > 0}
                                indeterminate={selectedIds.size > 0 && selectedIds.size < logs.length}
                                onChange={() => setSelectedIds(selectedIds.size === logs.length ? new Set() : new Set(logs.map(l => l.id)))}
                                style={{ marginBottom: 0, marginRight: 10 }}
                                label="Select all logs"
                            />
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <IgnoredPathsManager 
                                    ignoredPaths={ignoredPaths} 
                                    onToggleIgnorePath={toggleIgnorePath} 
                                />
                                <Button
                                    icon="trash"
                                    variant="minimal"
                                    intent="danger"
                                    small
                                    onClick={() => browser.storage.local.set({ logs: [] })}
                                    title="Clear Logs"
                                />
                            </div>
                        </div>
                        {logs.length === 0 ? (
                            <NonIdealState icon="info-sign" title="No requests intercepted" description="Perform actions in ActivityInfo to see requests here" />
                        ) : (
                            logs.map((log) => (
                                <LogItem
                                    key={log.id}
                                    log={log}
                                    databases={databases}
                                    selectedDbs={selectedDbs}
                                    isSelected={selectedIds.has(log.id)}
                                    selectionIndex={Array.from(selectedIds).indexOf(log.id)}
                                    isExpanded={expandedIds.has(log.id)}
                                    onFetchSchema={fetchFormSchema}
                                    onToggleSelect={() => {
                                        const next = new Set(selectedIds);
                                        if (next.has(log.id)) {
                                            next.delete(log.id);
                                        } else {
                                            // Set preserves insertion order, so this naturally works
                                            next.add(log.id);
                                        }
                                        setSelectedIds(next);
                                    }}
                                    onToggleExpand={() => {
                                        const next = new Set(expandedIds);
                                        next.has(log.id) ? next.delete(log.id) : next.add(log.id);
                                        setExpandedIds(next);
                                    }}
                                    onIgnore={() => {
                                        const path = new URL(log.url).pathname;
                                        toggleIgnorePath(path);
                                        const updated = logs.filter(l => !new URL(l.url).pathname.includes(path));
                                        browser.storage.local.set({ logs: updated });
                                    }}
                                    onDelete={() => {
                                        const updated = logs.filter(l => l.id !== log.id);
                                        browser.storage.local.set({ logs: updated });
                                    }}
                                    onUpdateBody={(newBody) => {
                                        const updated = logs.map(l => l.id === log.id ? { ...l, body: newBody } : l);
                                        browser.storage.local.set({ logs: updated });
                                    }}
                                />
                            ))
                        )}
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
                            <Button
                                icon="trash"
                                variant="minimal"
                                intent="danger"
                                small
                                text="Clear History"
                                onClick={() => browser.storage.local.set({ replayHistory: [] })}
                            />
                        </div>
                        {replayHistory.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', height: '100%' }}>
                                <NonIdealState icon="history" title="No history yet" description="Your replayed runs will appear here."/>
                            </div>
                        ) : (
                            replayHistory.map((run) => (
                                <HistoryItem
                                    key={run.id}
                                    run={run}
                                    databases={databases}
                                    isExpanded={expandedIds.has(run.id)}
                                    onToggleExpand={() => {
                                        const next = new Set(expandedIds);
                                        next.has(run.id) ? next.delete(run.id) : next.add(run.id);
                                        setExpandedIds(next);
                                    }}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* FOOTER - Only show on Logs tab */}
            {activeTabId === 'logs' && (
                <div style={{ padding: '12px 15px', backgroundColor: '#ffffff', borderTop: '1px solid #d8e1e8', display: 'flex', gap: 10 }}>
                    <DatabaseMultiSelect
                        databases={databases}
                        selectedDbs={selectedDbs}
                        onSelectionChange={(next) => {
                            setSelectedDbs(next);
                            browser.storage.local.set({ savedDbs: next });
                            next.forEach(db => fetchDatabaseTree(db.databaseId));
                        }}
                    />
                    <Button
                        intent="primary"
                        icon="repeat"
                        text={`Replay${selectedIds.size > 0 ? " (" + selectedIds.size + ")" : ""}`}
                        onClick={handleReplayClick}
                        disabled={selectedIds.size === 0 || selectedDbs.length === 0}
                        style={{whiteSpace: 'nowrap', paddingInline: '16px'}}
                    />
                </div>
            )}

            <ReplayDialog
                isOpen={showResultsDialog}
                onClose={() => setShowResultsDialog(false)}
                isConfiguring={isConfiguring}
                isReplaying={isReplaying}
                databases={databases}
                selectedDbs={selectedDbs}
                selectedLogs={logs.filter(l => selectedIds.has(l.id))}
                manualSourceId={manualSourceId}
                onSourceIdChange={(id) => {
                    setManualSourceId(id);
                    fetchDatabaseTree(id);
                }}
                onStartReplay={executeReplay}
                currentRun={currentRun}
            />
        </div>
    );
}
