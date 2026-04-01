import {Database, Field, MappingInfo, Resource} from "@/types.ts";
import {getGeneratedId} from "./idGenerator.ts";

export const getResourceMap = (
    text: string, 
    databases: Database[], 
    targetDbs: Database[], 
    overrideScopingFormId?: string
): Map<string, MappingInfo> => {
    const resourceMap = new Map<string, MappingInfo>();

    // 1. Prepare Metadata Candidates
    const dbIds = new Set(databases.map(db => db.databaseId));
    const resourceMetadata = new Map<string, Resource & { dbId: string }>();
    databases.forEach(db => {
        db.resources?.forEach(res => {
            resourceMetadata.set(res.id, { ...res, dbId: db.databaseId });
            // Also index fields globally if the schema is available
            if (res.schema) {
                res.schema.elements.forEach(f => {
                    if (!resourceMetadata.has(f.id)) {
                        resourceMetadata.set(f.id, { 
                            id: f.id, label: f.label, type: 'FIELD', dbId: db.databaseId, 
                            parentId: res.id, code: f.code 
                        } as any);
                    }
                });
            }
        });
    });

    // 2. Stage 1: Finding the referenced resource in the source ID
    
    // B) Find all IDs using regex that requires BOTH lowercase letters AND numbers
    const idRegex = /\b(?=[a-z0-9.]*[a-z])(?=[a-z0-9.]*[0-9])[a-z0-9.]+\b/g;
    const matches = Array.from(new Set(text.match(idRegex) || []));

    // C) Check for Database IDs
    matches.forEach(id => {
        if (dbIds.has(id)) {
            const db = databases.find(d => d.databaseId === id)!;
            resourceMap.set(id, { 
                sourceId: id, label: db.name, type: 'DATABASE', dbId: id, translations: [] 
            });
        }
    });

    // D) Check for Resource IDs (Form, Folder, or Field)
    matches.forEach(id => {
        if (!resourceMap.has(id) && resourceMetadata.has(id)) {
            const res = resourceMetadata.get(id)!;
            if (res.type === 'FORM' || res.type === 'FOLDER' || res.type === 'FIELD') {
                resourceMap.set(id, {
                    sourceId: id, 
                    label: res.label, 
                    type: res.type as any, 
                    dbId: res.dbId, 
                    formId: res.parentId, // For fields
                    code: (res as any).code, // For fields
                    translations: [] 
                });
            }
        }
    });

    // E) Scoping Form & Field IDs
    const scopingFormId = overrideScopingFormId || Array.from(resourceMap.values()).find(info => info.type === 'FORM')?.sourceId;
    if (scopingFormId) {
        const scopingForm = resourceMetadata.get(scopingFormId);
        if (scopingForm?.schema) {
            const fieldMetadata = new Map<string, Field>();
            scopingForm.schema.elements.forEach(f => fieldMetadata.set(f.id, f));
            matches.forEach(id => {
                if (!resourceMap.has(id) && fieldMetadata.has(id)) {
                    const f = fieldMetadata.get(id)!;
                    resourceMap.set(id, { 
                        sourceId: id, label: f.label, type: 'FIELD', dbId: scopingForm.dbId, 
                        formId: scopingFormId, code: f.code, translations: [] 
                    });
                }
            });
        } else {
            console.log("[MappingEngine] Scoping Form has NO schema in metadata");
        }
    }

    // F) Potential IDs
    matches.forEach(id => {
        if (!resourceMap.has(id) && id.length > 3) { 
            resourceMap.set(id, { 
                sourceId: id, label: id, type: 'POTENTIAL', dbId: 'unknown', translations: [] 
            });
        }
    });

    // 3. Stage 2: Mapping the ID to the same resource in each of the target DBs
    resourceMap.forEach((info, sId) => {
        info.translations = targetDbs.map(targetDb => {
            const tDbId = targetDb.databaseId;
            const targetMetadata = databases.find(d => d.databaseId === tDbId);

            // SPECIAL CASE: If Source DB == Target DB, keep the ID (Identity Mapping)
            // We use info.dbId to check if we know the source DB
            if (tDbId === info.dbId) {
                return { 
                    targetDbId: tDbId, 
                    targetDbName: targetMetadata?.name || "Unknown", 
                    targetId: sId, 
                    targetCode: info.code 
                };
            }

            // A) Database Mapping
            if (info.type === 'DATABASE') {
                return { targetDbId: tDbId, targetDbName: targetMetadata?.name || "Unknown", targetId: tDbId };
            }

            // B) Resource Mapping (Form/Folder)
            if (info.type === 'FORM' || info.type === 'FOLDER') {
                const match = targetMetadata?.resources?.find(r => r.label === info.label && r.type === info.type);
                if (match) return { targetDbId: tDbId, targetDbName: targetMetadata?.name || "Unknown", targetId: match.id };
            }

            // C) Field Mapping
            if (info.type === 'FIELD') {
                const sourceFormLabel = resourceMetadata.get(info.formId!)?.label;
                const targetForm = targetMetadata?.resources?.find(r => r.label === sourceFormLabel && r.type === 'FORM');
                if (targetForm?.schema) {
                    const tf = targetForm.schema.elements.find(f => f.label === info.label);
                    if (tf) return { targetDbId: tDbId, targetDbName: targetMetadata?.name || "Unknown", targetId: tf.id, targetCode: tf.code };
                }
            }

            // D) Potential or Fallback
            // If Source DB is unknown but target is source, we should still try to be smart,
            // but for now we follow the spec.
            return { 
                targetDbId: tDbId, 
                targetDbName: targetMetadata?.name || "Unknown",
                targetId: getGeneratedId(sId, tDbId), 
                error: info.type !== 'POTENTIAL' 
            };
        });
    });

    return resourceMap;
};
