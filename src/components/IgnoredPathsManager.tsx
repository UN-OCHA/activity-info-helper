import {Button, Popover, Tag} from "@blueprintjs/core";

interface IgnoredPathsManagerProps {
    ignoredPaths: string[];
    onToggleIgnorePath: (path: string) => void;
}

export const IgnoredPathsManager = ({ ignoredPaths, onToggleIgnorePath }: IgnoredPathsManagerProps) => {
    if (ignoredPaths.length === 0) return null;

    return (
        <Popover
            content={
                <div style={{ padding: '15px', maxWidth: '300px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Ignored Paths</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {ignoredPaths.map(path => (
                            <Tag
                                key={path}
                                onRemove={() => onToggleIgnorePath(path)}
                                minimal
                            >
                                {path}
                            </Tag>
                        ))}
                    </div>
                </div>
            }
        >
            <Button
                variant="minimal"
                size="small"
                icon="eye-off"
                intent="warning"
                text={`${ignoredPaths.length} Ignored`}
                style={{whiteSpace: 'nowrap'}}
            />
        </Popover>
    );
};
