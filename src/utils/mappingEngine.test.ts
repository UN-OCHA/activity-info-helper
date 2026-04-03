import { describe, it, expect, vi } from 'vitest';
import { getResourceMap } from './mappingEngine';
import { translateFormulaChain, translateBody } from './translationEngine';
import { Database } from '@/types';

// Mock getGeneratedId to keep tests predictable
vi.mock('./idGenerator.ts', () => ({
    getGeneratedId: (sId: string, tDbId: string) => `gen_${sId}_${tDbId}`
}));

const mockDatabases: Database[] = [
    {
        databaseId: 'db1source',
        name: 'Source DB',
        resources: [
            {
                id: 'f1main',
                label: 'Main Form',
                type: 'FORM',
                schema: {
                    id: 'f1main',
                    label: 'Main Form',
                    elements: [
                        { id: 'fld1name', label: 'First Name', type: 'TEXT', code: 'fn1' },
                        { id: 'fld2last', label: 'Last Name', type: 'TEXT', code: 'ln1' }
                    ]
                }
            },
            {
                id: 'fol1data',
                label: 'Data Folder',
                type: 'FOLDER'
            }
        ]
    },
    {
        databaseId: 'db2target',
        name: 'Target DB',
        resources: [
            {
                id: 'f1target',
                label: 'Main Form',
                type: 'FORM',
                schema: {
                    id: 'f1target',
                    label: 'Main Form',
                    elements: [
                        { id: 'fld1target', label: 'First Name', type: 'TEXT', code: 'tf_fn1' },
                        { id: 'fld2target', label: 'Last Name', type: 'TEXT', code: 'tf_ln1' }
                    ]
                }
            },
            {
                id: 'fol2target',
                label: 'Data Folder',
                type: 'FOLDER'
            }
        ]
    }
];

describe('mappingEngine', () => {
    describe('getResourceMap', () => {
        it('should map database IDs correctly', () => {
            const text = 'Replaying db1source';
            const targetDbs = [mockDatabases[1]];
            const map = getResourceMap(text, mockDatabases, targetDbs);

            expect(map.has('db1source')).toBe(true);
            const info = map.get('db1source')!;
            expect(info.type).toBe('DATABASE');
            expect(info.translations[0].targetId).toBe('db2target');
        });

        it('should map form IDs based on label matching', () => {
            const text = 'Updating f1main in db1source';
            const targetDbs = [mockDatabases[1]];
            const map = getResourceMap(text, mockDatabases, targetDbs);

            expect(map.has('f1main')).toBe(true);
            const info = map.get('f1main')!;
            expect(info.type).toBe('FORM');
            expect(info.translations[0].targetId).toBe('f1target');
        });

        it('should map field IDs based on label and form matching', () => {
            const text = 'fld1name value updated';
            const targetDbs = [mockDatabases[1]];
            // We provide overrideScopingFormId to simulate context
            const map = getResourceMap(text, mockDatabases, targetDbs, 'f1main');

            expect(map.has('fld1name')).toBe(true);
            const info = map.get('fld1name')!;
            expect(info.type).toBe('FIELD');
            expect(info.translations[0].targetId).toBe('fld1target');
            expect(info.translations[0].targetCode).toBe('tf_fn1');
        });

        it('should generate fallback IDs for potential matches', () => {
            const text = 'Unknown resource x1y2z3';
            const targetDbs = [mockDatabases[1]];
            const map = getResourceMap(text, mockDatabases, targetDbs);

            expect(map.has('x1y2z3')).toBe(true);
            const info = map.get('x1y2z3')!;
            expect(info.type).toBe('POTENTIAL');
            expect(info.translations[0].targetId).toBe('gen_x1y2z3_db2target');
        });
    });

    describe('translateFormulaChain', () => {
        it('should translate complex formula chains', () => {
            const formula = 'fld1name.fld2last';
            const targetDbs = [mockDatabases[1]];
            const resourceMap = getResourceMap(formula, mockDatabases, targetDbs, 'f1main');
            
            const result = translateFormulaChain(formula, mockDatabases, resourceMap, 'db2target', 'f1main');
            
            // Expected: tf_fn1.tf_ln1 (based on codes in target schema)
            expect(result).toBe('tf_fn1.tf_ln1');
        });

        it('should fallback to targetId for unknown chains', () => {
            const formula = 'x1y2z3';
            const targetDbs = [mockDatabases[1]];
            const resourceMap = getResourceMap(formula, mockDatabases, targetDbs);
            
            const result = translateFormulaChain(formula, mockDatabases, resourceMap, 'db2target');
            
            expect(result).toBe('gen_x1y2z3_db2target');
        });
    });

    describe('translateBody', () => {
        it('should translate formula fields in objects', () => {
            const body = {
                formula: 'fld1name',
                otherField: 'f1main'
            };
            const targetDbs = [mockDatabases[1]];
            const resourceMap = getResourceMap(JSON.stringify(body), mockDatabases, targetDbs);
            
            const result = translateBody(body, 'db2target', mockDatabases, resourceMap);
            
            expect(result.formula).toBe('tf_fn1');
            expect(result.otherField).toBe('f1target');
        });

        it('should handle nested objects and arrays', () => {
            const body = {
                rules: [
                    { relevanceCondition: 'fld1name == "test"' }
                ]
            };
            const targetDbs = [mockDatabases[1]];
            const resourceMap = getResourceMap(JSON.stringify(body), mockDatabases, targetDbs, 'f1main');
            
            const result = translateBody(body, 'db2target', mockDatabases, resourceMap, 'f1main');
            
            expect(result.rules[0].relevanceCondition).toBe('tf_fn1 == "test"');
        });
    });
});
