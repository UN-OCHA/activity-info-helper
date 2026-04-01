import {Button, Dialog, FormGroup, Intent, MenuItem, Tag, Icon} from "@blueprintjs/core";
import {Select, ItemRenderer} from "@blueprintjs/select";
import {Database, LogEntry, ReplayRun} from "@/types.ts";
import {ReplayRunResults} from "./ReplayRunResults";
import {HighlightedText} from "./HighlightedText";

interface ReplayDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isConfiguring: boolean;
    isReplaying: boolean;
    databases: Database[];
    selectedDbs: Database[];
    selectedLogs: LogEntry[];
    manualSourceId: string;
    onSourceIdChange: (id: string) => void;
    onStartReplay: () => void;
    currentRun: ReplayRun | null;
}

export const ReplayDialog = ({
    isOpen,
    onClose,
    isConfiguring,
    isReplaying,
    databases,
    selectedDbs,
    selectedLogs,
    manualSourceId,
    onSourceIdChange,
    onStartReplay,
    currentRun
}: ReplayDialogProps) => {
    const selectedSourceDb = databases.find(db => db.databaseId === manualSourceId);

    const renderDbItem: ItemRenderer<Database> = (db, { handleClick, modifiers }) => (
        <MenuItem
            active={modifiers.active}
            key={db.databaseId}
            onClick={handleClick}
            text={db.name}
            label={db.databaseId}
            shouldDismissPopover={true}
        />
    );

    return (
        <Dialog
            isOpen={isOpen}
            onClose={() => !isReplaying && onClose()}
            title={isConfiguring ? "Replay Configuration" : "Replay Status"}
            style={{ width: '450px' }}
        >
            <div style={{ padding: '20px' }}>
                {isConfiguring ? (
                    <>
                        <FormGroup label="Source Database to replace" helperText="Requests containing this ID will have it replaced with the target database IDs.">
                            <Select<Database>
                                items={databases}
                                itemRenderer={renderDbItem}
                                onItemSelect={(db) => onSourceIdChange(db.databaseId)}
                                filterable={true}
                                itemPredicate={(query, db) => db.name.toLowerCase().includes(query.toLowerCase()) || db.databaseId.toLowerCase().includes(query.toLowerCase())}
                            >
                                <Button
                                    text={selectedSourceDb ? selectedSourceDb.name : "Select source database..."}
                                    endIcon="double-caret-vertical"
                                    fill={true}
                                    intent={manualSourceId ? Intent.NONE : Intent.WARNING}
                                />
                            </Select>
                        </FormGroup>

                        <div style={{ marginTop: '20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icon icon="list" size={14} />
                                Selected Requests ({selectedLogs.length})
                            </div>
                            <div style={{ 
                                maxHeight: '200px', 
                                overflowY: 'auto', 
                                border: '1px solid #d8e1e8', 
                                borderRadius: '4px', 
                                backgroundColor: '#ffffff',
                                padding: '5px'
                            }}>
                                {selectedLogs.map((log) => (
                                    <div key={log.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px', 
                                        padding: '6px 8px',
                                        borderBottom: '1px solid #f0f0f0',
                                        fontSize: '11px'
                                    }}>
                                        <Tag minimal intent={log.method === 'POST' ? 'success' : 'warning'} style={{ fontSize: '9px', minWidth: '40px', textAlign: 'center' }}>
                                            {log.method}
                                        </Tag>
                                        <HighlightedText 
                                            text={new URL(log.url).pathname} 
                                            databases={databases}
                                            selectedDbs={selectedDbs}
                                            style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <Button text="Cancel" variant="minimal" onClick={onClose} />
                            <Button
                                intent="primary"
                                text="Start Replay"
                                onClick={onStartReplay}
                                style={{ marginLeft: '10px' }}
                                disabled={!manualSourceId}
                            />
                        </div>
                    </>
                ) : (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {currentRun && <ReplayRunResults run={currentRun} databases={databases} />}
                        {!isReplaying && (
                            <Button fill intent="primary" text="Close" onClick={onClose} style={{ marginTop: '20px' }} />
                        )}
                    </div>
                )}
            </div>
        </Dialog>
    );
};
