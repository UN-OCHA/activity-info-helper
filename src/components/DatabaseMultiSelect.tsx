import {MenuItem} from "@blueprintjs/core";
import {MultiSelect} from "@blueprintjs/select";
import {Database} from "@/types.ts";

interface DatabaseMultiSelectProps {
    databases: Database[];
    selectedDbs: Database[];
    onSelectionChange: (selected: Database[]) => void;
}

export const DatabaseMultiSelect = ({
    databases,
    selectedDbs,
    onSelectionChange
}: DatabaseMultiSelectProps) => {
    return (
        <MultiSelect<Database>
            items={databases}
            itemPredicate={(query, db) =>
                db.name.toLowerCase().includes(query.toLowerCase()) ||
                db.databaseId.toLowerCase().includes(query.toLowerCase())
            }
            itemRenderer={(db, { handleClick, modifiers }) => {
                const isSelected = selectedDbs.some(s => s.databaseId === db.databaseId);
                return (
                    <MenuItem
                        active={modifiers.active}
                        icon={isSelected ? "tick" : "blank"}
                        key={db.databaseId}
                        onClick={handleClick}
                        text={db.name}
                        label={db.databaseId}
                        shouldDismissPopover={false}
                    />
                );
            }}
            onItemSelect={(db) => {
                const isSelected = selectedDbs.some(s => s.databaseId === db.databaseId);
                const next = isSelected
                    ? selectedDbs.filter(s => s.databaseId !== db.databaseId)
                    : [...selectedDbs, db];
                onSelectionChange(next);
            }}
            onRemove={(db) => {
                const next = selectedDbs.filter(s => s.databaseId !== db.databaseId);
                onSelectionChange(next);
            }}
            tagRenderer={(db) => db.name}
            selectedItems={selectedDbs}
            placeholder="Select target databases..."
            fill={true}
        />
    );
};
