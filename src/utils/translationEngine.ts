import { Database, MappingInfo } from "@/types.ts";

export const applyReplacementsFromMap = (text: string, resourceMap: Map<string, MappingInfo>, targetDbId: string): string => {
    if (!text || resourceMap.size === 0) return text;
    const sortedIds = Array.from(resourceMap.keys()).sort((a, b) => b.length - a.length);
    let result = text;
    for (const sId of sortedIds) {
        const info = resourceMap.get(sId);
        const translation = info?.translations.find(t => t.targetDbId === targetDbId);
        if (translation && translation.targetId !== sId) {
            result = result.split(sId).join(translation.targetId);
        }
    }
    return result;
};

export const translateFormulaChain = (
    value: string, 
    databases: Database[], 
    resourceMap: Map<string, MappingInfo>,
    targetDbId: string,
    scopingFormId?: string
): string => {
    if (!value) return value;
    
    const idChainRegex = /\b(?=[a-z0-9.]*[a-z])(?=[a-z0-9.]*[0-9])[a-z0-9.]+(?:\.[a-z0-9.]+)*\b/g;
    const chains = Array.from(new Set(value.match(idChainRegex) || []));
    
    let result = value;
    
    const allResources = databases.flatMap(db => db.resources || []);
    const targetDb = databases.find(db => db.databaseId === targetDbId);

    chains.forEach(chain => {
        const segments = chain.split('.');
        let currentSourceFormId: string | undefined = scopingFormId;
        
        const translatedSegments: string[] = [];
        let possible = true;

        for (const segment of segments) {
            if (!currentSourceFormId) {
                possible = false;
                break;
            }

            const sourceForm = allResources.find(r => r.id === currentSourceFormId);
            const sourceField = sourceForm?.schema?.elements.find(f => f.id === segment);
            
            if (!sourceField) {
                const info = resourceMap.get(segment);
                if (info?.type === 'FIELD') {
                    const translation = info.translations.find(t => t.targetDbId === targetDbId);
                    if (translation?.targetCode) {
                        translatedSegments.push(translation.targetCode);
                        // If it's a field mapped from global map, we don't know its range 
                        // from the map alone, so we might need to stop or assume same form.
                        // For now, let's keep it consistent with the loop's logic.
                        currentSourceFormId = undefined; 
                        continue;
                    }
                }
                possible = false;
                break;
            }

            let targetCode = sourceField.code || segment;
            const targetForm = targetDb?.resources?.find(r => r.label === sourceForm?.label && r.type === 'FORM');
            const targetField = targetForm?.schema?.elements.find(f => f.label === sourceField.label);
            
            if (targetField?.code) {
                targetCode = targetField.code;
            }
            
            translatedSegments.push(targetCode);
            
            // Advance to the linked form if this is a reference field
            const nextFormId = sourceField.typeParameters?.range?.[0]?.formId;
            if (nextFormId) {
                currentSourceFormId = nextFormId;
            } else {
                // If it's NOT a reference field, but there are more segments, 
                // they might be sub-fields or we might have a logic error in our expectation.
                // In ActivityInfo, chain segments usually imply reference hopping.
                // HOWEVER, for simple field access, we stay in the same form.
                // Optimization: if there are more segments, we STAY in the current form 
                // unless it was a reference field.
            }
        }

        if (possible && translatedSegments.length === segments.length) {
            result = result.split(chain).join(translatedSegments.join('.'));
        } else if (segments.length === 1) {
            const info = resourceMap.get(chain);
            if (info) {
                const translation = info.translations.find(t => t.targetDbId === targetDbId);
                if (translation) result = result.split(chain).join(translation.targetId);
            }
        }
    });

    return result;
};

export const translateBody = (
    obj: any, 
    targetDbId: string, 
    databases: Database[], 
    resourceMap: Map<string, MappingInfo>,
    scopingFormId?: string
): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => translateBody(item, targetDbId, databases, resourceMap, scopingFormId));

    const newObj: any = {};
    const formulaFields = ["prefixFormula", "formula", "relevanceCondition", "defaultValueFormula", "validationCondition"];

    if (!scopingFormId) {
        scopingFormId = Array.from(resourceMap.values()).find(info => info.type === 'FORM')?.sourceId;
    }

    for (const key in obj) {
        let value = obj[key];
        
        if (formulaFields.includes(key) && typeof value === 'string') {
            value = translateFormulaChain(value, databases, resourceMap, targetDbId, scopingFormId);
        } else if (typeof value === 'string') {
            const info = resourceMap.get(value);
            if (info) {
                const translation = info.translations.find(t => t.targetDbId === targetDbId);
                if (translation) value = translation.targetId;
            }
        } else if (typeof value === 'object') {
            value = translateBody(value, targetDbId, databases, resourceMap, scopingFormId);
        }
        newObj[key] = value;
    }
    return newObj;
};
