import {Button, Dialog, FormGroup, Intent, MenuItem, Tag, Icon} from "@blueprintjs/core";
import {Select, ItemRenderer} from "@blueprintjs/select";
import {Database, LogEntry, ReplayRun, MappingInfo} from "@/types.ts";
import {ReplayRunResults} from "./ReplayRunResults";
import {HighlightedText} from "./HighlightedText";
import {MappingReview} from "./MappingReview";

interface ReplayDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isConfiguring: boolean;
    isReviewing: boolean;
    isReplaying: boolean;
    databases: Database[];
    selectedDbs: Database[];
    selectedLogs: LogEntry[];
    manualSourceId: string;
    onSourceIdChange: (id: string) => void;
    onPrepareMapping: () => Map<string, MappingInfo>;
    onBack: () => void;
    globalResourceMap: Map<string, MappingInfo>;
    onUpdateMapping: (sourceId: string, targetDbId: string, newTargetId: string) => void;
    onStartReplay: (overrideMap?: Map<string, MappingInfo>) => void;
    currentRun: ReplayRun | null;
}

export const ReplayDialog = ({
    isOpen,
    onClose,
    isConfiguring,
    isReviewing,
    isReplaying,
    databases,
    selectedDbs,
    selectedLogs,
    manualSourceId,
    onSourceIdChange,
    onPrepareMapping,
    onBack,
    globalResourceMap,
    onUpdateMapping,
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

    const getTitle = () => {
        if (isConfiguring) return "Replay Configuration";
        if (isReviewing) return "Review Mappings";
        return "Replay Status";
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={() => !isReplaying && onClose()}
            title={getTitle()}
            style={{ width: '430px' }} // Fixed width to fit in popup
        >
            <div style={{ padding: '15px' }}>
                {isConfiguring && (
                    <>
                        <FormGroup label="Source Database to replace" helperText="Requests containing this ID will have it replaced with target IDs.">
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
                                    small
                                />
                            </Select>
                        </FormGroup>

                        <div style={{ marginTop: '15px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icon icon="list" size={14} />
                                Selected Requests ({selectedLogs.length})
                            </div>
                            <div style={{ 
                                maxHeight: '150px', 
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
                                        padding: '4px 8px',
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                            <Button text="Review Mappings" variant="minimal" onClick={onPrepareMapping} disabled={!manualSourceId} />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button text="Cancel" variant="minimal" onClick={onClose} />
                                <Button
                                    intent="primary"
                                    text="Start Replay"
                                    onClick={() => {
                                        const map = onPrepareMapping(); // Prepare map first (sync)
                                        onStartReplay(map); // Then start immediately with that map
                                    }}
                                    disabled={!manualSourceId}
                                />
                            </div>
                        </div>
                    </>
                )}

                {isReviewing && (
                    <>
                        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#5c7080' }}>
                            Check that all detected resources are correctly mapped. You can manually edit any ID.
                        </div>
                        <div style={{ 
                            maxHeight: '300px', 
                            overflow: 'auto', // Handle horizontal and vertical overflow
                            border: '1px solid #d8e1e8', 
                            borderRadius: '4px',
                            backgroundColor: '#fff' 
                        }}>
                            <MappingReview 
                                resourceMap={globalResourceMap} 
                                targetDbs={selectedDbs} 
                                onUpdateMapping={onUpdateMapping} 
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px', gap: '8px' }}>
                            <Button text="Back" variant="minimal" onClick={onBack} />
                            <Button
                                intent="primary"
                                text="Confirm & Start"
                                onClick={() => onStartReplay()}
                            />
                        </div>
                    </>
                )}

                {!isConfiguring && !isReviewing && (
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
