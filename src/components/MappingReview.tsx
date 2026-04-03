import { Database, MappingInfo } from "@/types.ts";
import { Button, ControlGroup, HTMLTable, Icon, InputGroup, Tag, Intent } from "@blueprintjs/core";

interface MappingReviewProps {
    resourceMap: Map<string, MappingInfo>;
    targetDbs: Database[];
    onUpdateMapping: (sourceId: string, targetDbId: string, newTargetId: string) => void;
}

export const MappingReview = ({ resourceMap, targetDbs, onUpdateMapping }: MappingReviewProps) => {
    const mappings = Array.from(resourceMap.values());

    if (mappings.length === 0) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>No resources detected for mapping.</div>;
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <HTMLTable condensed striped style={{ width: '100%' }}>
                <thead>
                    <tr>
                        <th>Source Resource</th>
                        {targetDbs.map(db => (
                            <th key={db.databaseId}>Target: {db.name}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {mappings.map((info) => (
                        <tr key={info.sourceId}>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 'bold' }}>{info.label}</span>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                                        <Tag minimal size="small">{info.type}</Tag>
                                        <code style={{ fontSize: '10px' }}>{info.sourceId}</code>
                                    </div>
                                </div>
                            </td>
                            {targetDbs.map(db => {
                                const translation = info.translations.find(t => t.targetDbId === db.databaseId);
                                const isError = translation?.error;
                                
                                return (
                                    <td key={db.databaseId}>
                                        <ControlGroup fill vertical>
                                            <InputGroup
                                                small
                                                value={translation?.targetId || ""}
                                                onChange={(e) => onUpdateMapping(info.sourceId, db.databaseId, e.target.value)}
                                                intent={isError ? Intent.DANGER : Intent.NONE}
                                                rightElement={isError ? <Icon icon="warning-sign" intent={Intent.DANGER} style={{ margin: '4px' }} /> : undefined}
                                            />
                                        </ControlGroup>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </HTMLTable>
        </div>
    );
};
