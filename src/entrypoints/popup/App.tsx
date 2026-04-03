import {useEffect, useState} from 'react';
import {
    Alignment,
    Button,
    Callout,
    Checkbox,
    FormGroup,
    InputGroup,
    Intent,
    Navbar,
    NonIdealState,
    Tab,
    Tabs
} from "@blueprintjs/core";
import {Database, LogEntry, ReplayRun} from "@/types.ts";
import {LogItem} from "@/components/LogItem";
import {HistoryItem} from "@/components/HistoryItem";
import {DatabaseMultiSelect} from "@/components/DatabaseMultiSelect";
import {ReplayDialog} from "@/components/ReplayDialog";
import {useReplay} from "@/hooks/useReplay";
import {IgnoredPathsManager} from "@/components/IgnoredPathsManager";
import {useActivityInfoData} from "@/hooks/useActivityInfoData";
import {useSettings} from "@/hooks/useSettings";

export default function App() {
    // --- State Management ---
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [apiToken, setApiToken] = useState<string | undefined>();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterText, setFilterText] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [selectedDbs, setSelectedDbs] = useState<Database[]>([]);
    const [ignoredPaths, setIgnoredPaths] = useState<string[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>("logs");
    const [replayHistory, setReplayHistory] = useState<ReplayRun[]>([]);

    const { baseUrl, updateBaseUrl, grantPermission, hasPermission } = useSettings();

    const {
        databases,
        loading,
        fetchDatabaseTree,
        fetchFormSchema
    } = useActivityInfoData(apiToken, logs, baseUrl);

    const {
        isReplaying,
        currentRun,
        showResultsDialog,
        setShowResultsDialog,
        isConfiguring,
        isReviewing,
        manualSourceId,
        setManualSourceId,
        handleReplayClick,
        prepareMapping,
        goToConfig,
        updateMapping,
        globalResourceMap,
        executeReplay
    } = useReplay(logs, databases, selectedIds, selectedDbs, replayHistory, setReplayHistory, fetchDatabaseTree);

    useEffect(() => {
        browser.storage.local.get(["logs", "savedDbs", "apiToken", "replayHistory", "ignoredPaths"]).then(async (res) => {
            if (res.logs) setLogs(res.logs as LogEntry[]);
            if (res.savedDbs) setSelectedDbs(res.savedDbs as Database[]);
            if (res.replayHistory) setReplayHistory(res.replayHistory as ReplayRun[]);
            if (res.ignoredPaths) setIgnoredPaths(res.ignoredPaths as string[]);
            if (res.apiToken) setApiToken(res.apiToken as string);
        });

        const handleStorageChange = async (changes: any) => {
            if (changes.apiToken?.newValue) setApiToken(changes.apiToken.newValue);
            if (changes.logs) setLogs(changes.logs.newValue || []);
            if (changes.replayHistory) setReplayHistory(changes.replayHistory.newValue || []);
            if (changes.ignoredPaths) setIgnoredPaths(changes.ignoredPaths.newValue || []);
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

    const filteredLogs = logs.filter(log => {
        if (!filterText) return true;
        const search = filterText.toLowerCase();
        return (
            log.url.toLowerCase().includes(search) ||
            log.method.toLowerCase().includes(search) ||
            JSON.stringify(log.body).toLowerCase().includes(search)
        );
    });

    return (
        <div style={{ minWidth: '450px', height: '100vh', minHeight: '600px', backgroundColor: '#f5f8fa', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <style>{`
                html, body, #root {
                    height: 100% !important;
                    min-height: 600px !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                }
            `}</style>
            <Navbar>
                <Navbar.Group align={Alignment.START}>
                    <img src="icon.png" style={{width: '24px', height: '24px', borderRadius: '8px'}} alt="logo" />
                    <Navbar.Heading style={{ fontWeight: 'bold', paddingLeft: '10px', marginRight: '4px' }}>ActivityInfo Helper</Navbar.Heading>
                    <Navbar.Divider style={{marginRight: '12px'}}/>
                    <Tabs id="MainTabs" selectedTabId={activeTabId} onChange={(id) => setActiveTabId(id as string)}>
                        <Tab id="logs" title="Logs" />
                        <Tab id="history" title="History" />
                        <Tab id="settings" title="Settings" />
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

            {/* STICKY HEADER FOR LOGS (Filters) */}
            {activeTabId === 'logs' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '15px 15px 0 15px' }}>
                    <Checkbox
                        checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.has(l.id))}
                        indeterminate={filteredLogs.some(l => selectedIds.has(l.id)) && !filteredLogs.every(l => selectedIds.has(l.id))}
                        onChange={() => {
                            const next = new Set(selectedIds);
                            const allVisibleSelected = filteredLogs.every(l => next.has(l.id));
                            if (allVisibleSelected) {
                                filteredLogs.forEach(l => next.delete(l.id));
                            } else {
                                filteredLogs.forEach(l => next.add(l.id));
                            }
                            setSelectedIds(next);
                        }}
                        style={{ marginBottom: 0 }}
                        title={`Select visible (${filteredLogs.length})`}
                    />
                    
                    <InputGroup
                        leftIcon="search"
                        placeholder="Filter logs..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        style={{ flex: 1 }}
                        size="small"
                        fill
                        rightElement={filterText ? <Button icon="cross" variant="minimal" size="small" onClick={() => setFilterText("")} /> : undefined}
                    />

                    <div style={{ display: 'flex', gap: '4px' }}>
                        <IgnoredPathsManager 
                            ignoredPaths={ignoredPaths} 
                            onToggleIgnorePath={toggleIgnorePath} 
                        />
                        <Button
                            icon="trash"
                            variant="minimal"
                            intent="danger"
                            size="small"
                            onClick={() => browser.storage.local.set({ logs: [] })}
                            title="Clear Logs"
                        />
                    </div>
                </div>
            )}

            {/* STICKY HEADER FOR HISTORY */}
            {activeTabId === 'history' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px 15px 0 15px' }}>
                    <Button
                        icon="trash"
                        variant="minimal"
                        intent="danger"
                        size="small"
                        text="Clear History"
                        onClick={() => browser.storage.local.set({ replayHistory: [] })}
                    />
                </div>
            )}

            {/* TAB CONTENT (SCROLLABLE) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {activeTabId === 'logs' && (
                    <>
                        {!hasPermission && (
                            <Callout intent={Intent.WARNING} icon="warning-sign" title="Permission Needed" style={{marginBottom: '10px'}}>
                                Please grant access to <strong>{baseUrl}</strong> in the Settings tab to start recording logs.
                            </Callout>
                        )}
                        {!apiToken && hasPermission ? (
                            <NonIdealState 
                                icon="user" 
                                title="Not Logged In" 
                                description={`We haven't intercepted your ActivityInfo session yet. Please log in to ${baseUrl} to start.`}
                                action={
                                    <Button 
                                        intent="primary" 
                                        text="Open ActivityInfo Login" 
                                        onClick={() => {
                                            browser.tabs.create({ url: `${baseUrl}/login` });
                                        }} 
                                    />
                                }
                            />
                        ) : filteredLogs.length === 0 ? (
                            <NonIdealState 
                                icon={filterText ? "search" : "info-sign"} 
                                title={filterText ? "No matches" : "No requests intercepted"} 
                                description={filterText ? "Try a different search term" : "Perform actions in ActivityInfo to see requests here"} 
                            />
                        ) : (
                            filteredLogs.map((log) => (
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
                                        next.has(log.id) ? next.delete(log.id) : next.add(log.id);
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
                )}

                {activeTabId === 'history' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {replayHistory.length === 0 ? (
                            <NonIdealState icon="history" title="No history yet" description="Your replayed runs will appear here."/>
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

                {activeTabId === 'settings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
                        <FormGroup
                            label="ActivityInfo Base URL"
                            helperText="Example: https://activityinfo.org or your private instance URL"
                        >
                            <InputGroup
                                value={baseUrl}
                                onChange={(e) => updateBaseUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </FormGroup>

                        <Callout
                            intent={hasPermission ? Intent.SUCCESS : Intent.WARNING}
                            icon={hasPermission ? "tick" : "warning-sign"}
                            title={hasPermission ? "Permission Granted" : "Permission Missing"}
                        >
                            <div style={{marginBottom: '10px'}}>
                                Access to <strong>{baseUrl}</strong> is required to intercept requests and fetch database information.
                            </div>
                            {!hasPermission && (
                                <Button
                                    intent={Intent.PRIMARY}
                                    text="Grant Permission"
                                    onClick={grantPermission}
                                />
                            )}
                        </Callout>

                        <div style={{ fontSize: '12px', color: '#5c7080' }}>
                            <p><strong>Note:</strong> Changing the Base URL will reload the extension background script to re-register network listeners.</p>
                        </div>
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
                        disabled={selectedIds.size === 0 || selectedDbs.length === 0 || loading || !hasPermission}
                        style={{whiteSpace: 'nowrap', paddingInline: '16px'}}
                    />
                </div>
            )}

            <ReplayDialog
                isOpen={showResultsDialog}
                onClose={() => setShowResultsDialog(false)}
                isConfiguring={isConfiguring}
                isReviewing={isReviewing}
                isReplaying={isReplaying}
                databases={databases}
                selectedDbs={selectedDbs}
                selectedLogs={logs.filter(l => selectedIds.has(l.id))}
                manualSourceId={manualSourceId}
                onSourceIdChange={(id) => {
                    setManualSourceId(id);
                    fetchDatabaseTree(id);
                }}
                onPrepareMapping={prepareMapping}
                onBack={goToConfig}
                globalResourceMap={globalResourceMap}
                onUpdateMapping={updateMapping}
                onStartReplay={executeReplay}
                currentRun={currentRun}
            />
        </div>
    );
}
