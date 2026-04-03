import {Collapse, Icon, Spinner, Tag} from "@blueprintjs/core";
import {Database, ReplayResult, ReplayRun} from "@/types.ts";
import {useState} from "react";
import CodeMirror from '@uiw/react-codemirror';
import {json} from '@codemirror/lang-json';
import {useDbIdHighlighter} from "@/hooks/useDbIdHighlighter";

interface ReplayRunResultsProps {
    run: ReplayRun;
    databases: Database[];
}

export const ReplayRunResults = ({ run, databases }: ReplayRunResultsProps) => {
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
    const highlighterExtensions = useDbIdHighlighter(databases);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedResults);
        next.has(id) ? next.delete(id) : next.add(id);
        setExpandedResults(next);
    };

    const grouped = run.results.reduce((acc, res) => {
        if (!acc[res.dbId]) acc[res.dbId] = { name: res.dbName, results: [] };
        acc[res.dbId].results.push(res);
        return acc;
    }, {} as Record<string, { name: string, results: ReplayResult[] }>);

    const formatJson = (val: any) => {
        if (!val) return "";
        if (typeof val === 'string') {
            try {
                return JSON.stringify(JSON.parse(val), null, 2);
            } catch (e) {
                return val;
            }
        }
        return JSON.stringify(val, null, 2);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {Object.entries(grouped).map(([dbId, group]) => (
                <div key={dbId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid #e1e8ed', paddingBottom: '4px' }}>
                        <Icon icon="database" size={14} intent="primary" />
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{group.name}</span>
                        <Tag minimal round style={{ fontSize: '10px' }}>{dbId}</Tag>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {group.results.map((res, i) => {
                            const resultId = `${res.logId}-${res.dbId}`;
                            const isExpanded = expandedResults.has(resultId);
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div 
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer' }}
                                        onClick={() => toggleExpand(resultId)}
                                    >
                                        {res.status === 'loading' ? <Spinner size={14} /> :
                                            <Icon icon={res.status === 'success' ? "tick-circle" : "error"}
                                                  intent={res.status === 'success' ? "success" : "danger"}
                                                  size={14} />
                                        }
                                        <Tag minimal intent={res.method === 'POST' ? 'success' : 'warning'}>{res.method}</Tag>
                                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.logPath}</span>
                                        {res.statusCode && <span style={{ opacity: 0.6, fontSize: '10px' }}>{res.statusCode}</span>}
                                        <Icon icon={isExpanded ? "chevron-up" : "chevron-down"} size={12} />
                                    </div>
                                    <Collapse isOpen={isExpanded}>
                                        <div style={{ padding: '8px', backgroundColor: '#f0f4f7', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}>
                                            {res.requestBody && (
                                                <div style={{ marginBottom: '8px' }}>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#5c7080' }}>Request Body:</div>
                                                    <CodeMirror
                                                        value={formatJson(res.requestBody)}
                                                        editable={false}
                                                        extensions={[json(), ...highlighterExtensions]}
                                                        theme="light"
                                                        basicSetup={{ lineNumbers: true, foldGutter: true }}
                                                        style={{ border: '1px solid #d8e1e8' }}
                                                    />
                                                </div>
                                            )}
                                            {res.responseBody && (
                                                <div>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#5c7080' }}>Response:</div>
                                                    <CodeMirror
                                                        value={formatJson(res.responseBody)}
                                                        editable={false}
                                                        extensions={[json(), ...highlighterExtensions]}
                                                        theme="light"
                                                        basicSetup={{ lineNumbers: true, foldGutter: true }}
                                                        style={{ border: '1px solid #d8e1e8' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </Collapse>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};
