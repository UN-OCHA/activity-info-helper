export interface Field {
    id: string;
    label: string;
    type: string;
    code?: string;
    typeParameters?: {
        cardinality?: string;
        range?: { formId: string }[];
    };
}

export interface FormSchema {
    id: string;
    label: string;
    elements: Field[];
}

export interface Resource {
    id: string;
    label: string;
    type: 'FORM' | 'FOLDER' | 'DATABASE' | 'FIELD' | 'POTENTIAL';
    schema?: FormSchema;
    parentId?: string;
}

export interface Database {
    databaseId: string;
    name: string;
    resources?: Resource[];
}

export interface MappingInfo {
    sourceId: string;
    label: string;
    type: 'DATABASE' | 'FORM' | 'FOLDER' | 'FIELD' | 'POTENTIAL';
    dbId: string;
    formId?: string; // For fields
    code?: string;   // For fields
    translations: {
        targetDbId: string;
        targetDbName: string;
        targetId: string;
        targetCode?: string; // For formula mapping
        error?: boolean;
    }[];
}

export interface LogEntry {
    id: string;
    url: string;
    method: string;
    timestamp: number;
    body?: string;
}

export interface ReplayResult {
    logId: string;
    logPath: string;
    method: string;
    dbId: string;
    dbName: string;
    status: 'loading' | 'success' | 'error';
    statusCode?: number;
    error?: string;
    requestBody?: any;
    responseBody?: string;
    timestamp: number;
}

export interface ReplayRun {
    id: string;
    timestamp: number;
    sourceDbId: string;
    sourceDbName: string;
    targetDbs: { databaseId: string, name: string }[];
    results: ReplayResult[];
}