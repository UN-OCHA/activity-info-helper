import {Button, Card, Checkbox, Collapse, Elevation, HTMLSelect, Icon, Tag} from "@blueprintjs/core";
import {Database, LogEntry, Resource} from "@/types.ts";
import CodeMirror from '@uiw/react-codemirror';
import {json} from '@codemirror/lang-json';
import {linter, lintGutter} from '@codemirror/lint';
import {syntaxTree} from "@codemirror/language";
import {HighlightedText} from "./HighlightedText";
import {useDbIdHighlighter} from "@/hooks/useDbIdHighlighter";
import {useResourceAutocomplete} from "@/hooks/useResourceAutocomplete";
import {useEffect, useMemo, useState} from "react";
import {getResourceMap} from "@/utils/mappingEngine";

interface LogItemProps {
    log: LogEntry;
    databases: Database[];
    selectedDbs: Database[];
    isSelected: boolean;
    selectionIndex?: number;
    isExpanded: boolean;
    onToggleSelect: () => void;
    onToggleExpand: () => void;
    onIgnore: () => void;
    onDelete: () => void;
    onUpdateBody: (newBody: any) => void;
    onFetchSchema: (formId: string) => void;
}

export const LogItem = ({
    log,
    databases,
    selectedDbs,
    isSelected,
    selectionIndex,
    isExpanded,
    onToggleSelect,
    onToggleExpand,
    onIgnore,
    onDelete,
    onUpdateBody,
    onFetchSchema
}: LogItemProps) => {
    const [currentText, setCurrentText] = useState(JSON.stringify(log.body, null, 2));
    const [overrideScopingFormId, setOverrideScopingFormId] = useState<string>("");

    const resourceMap = useMemo(() => {
        const path = new URL(log.url).pathname;
        const combined = path + " " + currentText;
        return getResourceMap(combined, databases, selectedDbs, overrideScopingFormId);
    }, [currentText, databases, selectedDbs, log.url, overrideScopingFormId]);

    const availableForms = useMemo(() => {
        const forms: Resource[] = [];
        resourceMap.forEach((info, id) => {
            if (info.type === 'FORM') forms.push({ id, label: info.label, type: 'FORM' } as Resource);
        });
        return forms;
    }, [resourceMap]);

    const activeScopingFormId = useMemo(() => {
        if (overrideScopingFormId) return overrideScopingFormId;
        return availableForms[0]?.id || "";
    }, [overrideScopingFormId, availableForms]);

    // Ensure we fetch the schema for the scoping form if it's missing
    useEffect(() => {
        if (activeScopingFormId && isExpanded) {
            const form = databases.flatMap(db => db.resources || []).find(r => r.id === activeScopingFormId);
            if (form && !form.schema) {
                console.log(`[LogItem] Schema missing for scoping form ${activeScopingFormId}. Fetching...`);
                onFetchSchema(activeScopingFormId);
            }
        }
    }, [activeScopingFormId, isExpanded, databases, onFetchSchema]);

    const highlighterExtensions = useDbIdHighlighter(databases, selectedDbs, activeScopingFormId);
    const autocompleteExtensions = useResourceAutocomplete(log, databases, activeScopingFormId);

    const jsonSyntaxLinter = linter((view) => {
        const diagnostics: any[] = [];
        syntaxTree(view.state).iterate({
            enter: (node) => {
                if (node.type.isError) {
                    diagnostics.push({ from: node.from, to: node.to, severity: "error", message: "Syntax error" });
                }
            },
        });
        return diagnostics;
    });

    const translationStats = useMemo(() => {
        const stats = { db: 0, folder: 0, form: 0, field: 0, potentialId: 0, unmapped: 0 };
        if (!selectedDbs.length) return stats;

        resourceMap.forEach((info) => {
            // Count based on translations
            const isFullyMapped = info.translations.length > 0 && info.translations.every(t => !t.error);
            
            if (isFullyMapped) {
                if (info.type === 'DATABASE') stats.db++;
                else if (info.type === 'FIELD') stats.field++;
                else if (info.type === 'FOLDER') stats.folder++;
                else if (info.type === 'FORM') stats.form++;
            } else if (info.type === 'POTENTIAL') {
                stats.potentialId++;
            } else {

                stats.unmapped++;
            }
        });

        return stats;
    }, [resourceMap, selectedDbs]);

    return (
        <Card
            elevation={isSelected ? Elevation.TWO : Elevation.ZERO}
            style={{ marginBottom: 8, padding: 0, border: isSelected ? '1px solid #106ba3' : '1px solid #d8e1e8' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Checkbox checked={isSelected} onChange={onToggleSelect} style={{ marginBottom: 0, marginRight: 12 }} />
                    {isSelected && selectionIndex !== undefined && selectionIndex !== -1 && (
                        <div style={{ position: 'absolute', left: 12, top: 12, backgroundColor: '#106ba3', color: 'white', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', pointerEvents: 'none', border: '1px solid white', zIndex: 10 }}>
                            {selectionIndex + 1}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer', overflow: 'hidden' }} onClick={onToggleExpand}>
                    <div style={{ flexShrink: 0 }}>
                        <Tag intent={log.method === 'POST' ? 'success' : 'warning'} minimal style={{ marginRight: 10 }}>{log.method}</Tag>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <HighlightedText
                            text={new URL(log.url).pathname}
                            databases={databases}
                            selectedDbs={selectedDbs}
                            overrideScopingFormId={activeScopingFormId}
                            style={{ fontSize: '12px', fontWeight: 600, wordBreak: 'break-all' }}
                        />
                    </div>
                </div>
                <Button icon="eye-off" variant="minimal" size="small" onClick={onIgnore} title="Ignore this path" />
                <Button icon="cross" variant="minimal" size="small" intent="danger" onClick={onDelete} />
            </div>
            <Collapse isOpen={isExpanded}>
                {availableForms.length > 1 && (
                    <div style={{ padding: '0px 12px', backgroundColor: '#f5f8fa', borderTop: '1px solid #d8e1e8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                        <Icon icon="form" size={12} intent="warning" />
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Scoping Form:</span>
                        <HTMLSelect 
                            minimal 
                            value={activeScopingFormId}
                            onChange={(e) => setOverrideScopingFormId(e.target.value)}
                            options={availableForms.map(f => ({ label: f.label, value: f.id }))}
                            fill
                        />
                        <span style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>({availableForms.length} options)</span>
                    </div>
                )}
                <CodeMirror
                    value={currentText}
                    height="auto"
                    extensions={[json(), jsonSyntaxLinter, lintGutter(), ...highlighterExtensions, ...autocompleteExtensions]}
                    onChange={(val) => {
                        setCurrentText(val);
                        try { onUpdateBody(JSON.parse(val)); } catch (e) {}
                    }}
                    theme="light"
                    basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
                    style={{ fontSize: '12px', borderBottom: '1px solid #d8e1e8', borderTop: '1px solid #d8e1e8' }}
                />
                <div style={{ display: 'flex', gap: '12px', padding: '4px 12px', backgroundColor: '#f5f8fa', fontSize: '10px', color: '#5c7080', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.7 }}>Mapped:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {translationStats.db > 0 && <span><Icon icon="database" size={10} style={{marginRight: 3}}/>{translationStats.db} DB</span>}
                        {translationStats.folder > 0 && <span><Icon icon="folder-close" size={10} style={{marginRight: 3}}/>{translationStats.folder} Folders</span>}
                        {translationStats.form > 0 && <span><Icon icon="form" size={10} style={{marginRight: 3}}/>{translationStats.form} Forms</span>}
                        {translationStats.field > 0 && <span><Icon icon="tag" size={10} style={{marginRight: 3}}/>{translationStats.field} Fields</span>}
                        {translationStats.potentialId > 0 && <span style={{color: '#db3737'}}><Icon icon="search" size={10} style={{marginRight: 3}}/>{translationStats.potentialId} Potential IDs</span>}
                        {translationStats.unmapped > 0 && <span style={{color: '#db3737', fontWeight: 'bold'}}><Icon icon="warning-sign" size={10} style={{marginRight: 3}}/>{translationStats.unmapped} Unmapped</span>}
                        {Object.values(translationStats).every(v => v === 0) && <span style={{opacity: 0.5}}>No IDs found</span>}
                    </div>
                </div>
            </Collapse>
        </Card>
    );
};
