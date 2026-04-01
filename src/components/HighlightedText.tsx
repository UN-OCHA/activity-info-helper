import {HTMLTable, Tag, Tooltip} from "@blueprintjs/core";
import {Database} from "@/types.ts";
import React from "react";
import {getResourceMap} from "@/utils/mappingEngine";

interface HighlightedTextProps {
    text: string;
    databases: Database[];
    selectedDbs?: Database[];
    style?: React.CSSProperties;
    overrideScopingFormId?: string;
}

export const HighlightedText = ({ text, databases, selectedDbs = [], style, overrideScopingFormId }: HighlightedTextProps) => {
    if (!databases.length) return <span style={style}>{text}</span>;

    const resourceMap = getResourceMap(text, databases, selectedDbs, overrideScopingFormId);
    const ids = Array.from(resourceMap.keys()).filter(id => id.length > 3).sort((a, b) => b.length - a.length);
    if (ids.length === 0) return <span style={style}>{text}</span>;

    const regex = new RegExp(`(${ids.join('|')})`, 'g');
    const parts = text.split(regex);

    return (
        <span style={style}>
            {parts.map((part, i) => {
                const info = resourceMap.get(part);
                if (info) {
                    return (
                        <Tooltip 
                            key={i} 
                            content={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{info.label}</span>
                                        <div style={{opacity: '0.8', fontSize: '9px', backgroundColor: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)'}}>{info.type}</div>
                                        {info.code && <Tag minimal round intent="warning">Code: {info.code}</Tag>}
                                    </div>
                                    {info.translations.length > 0 && (
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px' }}>
                                            <div style={{ fontSize: '10px', opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>Target Mappings:</div>
                                            <HTMLTable compact style={{ width: '100%', backgroundColor: 'transparent', color: 'inherit' }}>
                                                <tbody>
                                                    {info.translations.map((t, idx) => (
                                                        <tr key={idx}>
                                                            <td style={{ padding: '4px 8px 4px 0', opacity: 0.8, wordBreak: 'break-word', verticalAlign: 'middle', border: 'none', color: 'inherit', fontSize: '11px' }}>
                                                                {t.targetDbName}
                                                            </td>
                                                            <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'middle', border: 'none' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                    <code style={{ 
                                                                        backgroundColor: t.error ? 'rgba(219, 55, 55, 0.25)' : 'rgba(0,0,0,0.3)', 
                                                                        padding: '2px 6px', 
                                                                        borderRadius: '3px',
                                                                        color: t.error ? '#ff7373' : '#a7ffeb',
                                                                        wordBreak: 'break-all',
                                                                        display: 'inline-block',
                                                                        maxWidth: '180px',
                                                                        fontSize: '10px',
                                                                        whiteSpace: 'nowrap',
                                                                        border: t.error ? '1px solid #db3737' : 'none'
                                                                    }}>
                                                                        {t.targetId}
                                                                    </code>
                                                                    {t.error && <span style={{ fontSize: '8px', color: '#ff7373', marginTop: '2px', fontWeight: 'bold' }}>NEW CUID</span>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </HTMLTable>
                                        </div>
                                    )}
                                </div>
                            } 
                            intent="primary"
                        >
                            <span style={{ 
                                color: info.type === 'DATABASE' ? '#106ba3' : (info.type === 'FIELD' ? '#37b24d' : '#d9822b'),
                                backgroundColor: info.type === 'POTENTIAL' ? 'rgba(219, 55, 55, 0.1)' : (info.type === 'DATABASE' ? 'rgba(16, 107, 163, 0.15)' : (info.type === 'FIELD' ? 'rgba(55, 178, 77, 0.15)' : 'rgba(217, 130, 43, 0.15)')),
                                borderBottom: info.type === 'POTENTIAL' ? '1px dashed #db3737' : (info.type === 'DATABASE' ? '1px dashed #106ba3' : (info.type === 'FIELD' ? '1px dashed #37b24d' : '1px dashed #d9822b')),

                                cursor: 'help',
                                fontWeight: 'bold'
                            }}>
                                {part}
                            </span>
                        </Tooltip>
                    );
                }
                return <React.Fragment key={i}>{part}</React.Fragment>;
            })}
        </span>
    );
};
