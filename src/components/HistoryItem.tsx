import {Button, Card, Elevation, Icon, Tag, Collapse} from "@blueprintjs/core";
import {Database, ReplayRun} from "@/types.ts";
import {ReplayRunResults} from "./ReplayRunResults";

interface HistoryItemProps {
    run: ReplayRun;
    databases: Database[];
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export const HistoryItem = ({ run, databases, isExpanded, onToggleExpand }: HistoryItemProps) => {
    return (
        <Card elevation={Elevation.ONE} style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: '11px', color: '#5c7080', marginBottom: '2px' }}>
                        {new Date(run.timestamp).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon icon="arrow-right" size={12} />
                        <span style={{ fontWeight: 600 }}>{run.sourceDbName}</span>
                        <Icon icon="double-chevron-right" size={12} />
                        <span style={{ fontSize: '12px' }}>{run.targetDbs.length} targets</span>
                    </div>
                </div>
                <Tag intent={run.results.every(r => r.status === 'success') ? 'success' : 'warning'}>
                    {run.results.filter(r => r.status === 'success').length}/{run.results.length} Success
                </Tag>
            </div>
            <Collapse isOpen={isExpanded}>
                <div style={{ marginTop: '15px', borderTop: '1px solid #e1e8ed', paddingTop: '15px' }}>
                    <ReplayRunResults run={run} databases={databases} />
                </div>
            </Collapse>
            <Button
                fill
                minimal
                small
                icon={isExpanded ? "chevron-up" : "chevron-down"}
                text={isExpanded ? "Hide Details" : "Show Details"}
                onClick={onToggleExpand}
                style={{ marginTop: '8px' }}
            />
        </Card>
    );
};
