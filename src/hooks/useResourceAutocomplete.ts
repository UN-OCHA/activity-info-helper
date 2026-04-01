import {useMemo} from "react";
import {autocompletion, CompletionContext, CompletionResult} from "@codemirror/autocomplete";
import {Database, LogEntry, Resource} from "@/types.ts";

export const useResourceAutocomplete = (log: LogEntry, databases: Database[], overrideScopingFormId?: string) => {
    return useMemo(() => {
        const buildCompletions = (docText: string) => {
            const dbMatch = log.url.match(/databases\/([a-zA-Z0-9]+)/);
            const sourceDbId = dbMatch ? dbMatch[1] : null;
            
            const sourceDb = databases.find(db => db.databaseId === sourceDbId);
            const completions: any[] = [];

            // 1. From Metadata
            if (sourceDb && sourceDb.resources) {
                sourceDb.resources.forEach(res => {
                    completions.push({
                        label: res.label,
                        displayLabel: res.label,
                        type: res.type === 'FOLDER' ? 'namespace' : 'class',
                        detail: res.type,
                        apply: res.id,
                        info: `ID: ${res.id}`
                    });

                    const isScopingForm = overrideScopingFormId 
                        ? res.id === overrideScopingFormId 
                        : (res.type === 'FORM' && docText.includes(res.id));

                    if (res.type === 'FORM' && res.schema && isScopingForm) {
                        res.schema.elements.forEach(field => {
                            completions.push({
                                label: `${res.label}: ${field.label}`,
                                displayLabel: field.label,
                                type: 'property',
                                detail: `FIELD (${res.label})`,
                                apply: field.id,
                                info: `ID: ${field.id}${field.code ? `\nCode: ${field.code}` : ''}`
                            });
                        });
                    }
                });

                completions.push({
                    label: sourceDb.name,
                    displayLabel: sourceDb.name,
                    type: 'keyword',
                    detail: 'DATABASE',
                    apply: sourceDb.databaseId,
                    info: `ID: ${sourceDb.databaseId}`
                });
            }

            // 2. From Document Discovery
            const resourceDiscoveryRegex = /"id"\s*:\s*"([a-z0-9]{4,})"[^}]*"label"\s*:\s*"([^"]+)"/gi;
            let match;
            const seenIds = new Set(completions.map(c => c.apply));
            
            while ((match = resourceDiscoveryRegex.exec(docText)) !== null) {
                const id = match[1];
                const label = match[2];
                if (!seenIds.has(id)) {
                    completions.push({
                        label: label,
                        displayLabel: label,
                        type: 'class',
                        detail: 'DISCOVERED',
                        apply: id,
                        info: `Discovered ID: ${id}`
                    });
                    seenIds.add(id);
                }
            }

            return completions;
        };

        const myCompletions = (context: CompletionContext): CompletionResult | null => {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit)) return null;
            
            const docText = context.state.doc.toString();
            const options = buildCompletions(docText);

            return {
                from: word.from,
                options: options,
                filter: true
            };
        };

        return [autocompletion({ override: [myCompletions] })];
    }, [log.url, databases, overrideScopingFormId]);
};
