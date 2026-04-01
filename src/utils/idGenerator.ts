import { init } from '@paralleldrive/cuid2';

const createStableCuid = (seed: string, length: number) => {
    // Generate a numeric seed from the string
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    
    // Deterministic random generator based on hash
    const random = () => {
        hash = (hash * 16807) % 2147483647;
        return Math.abs(hash) / 2147483647;
    };

    const generate = init({
        length,
        fingerprint: seed,
        // Override random to be deterministic based on seed
        random
    });

    return generate();
};

const idCache = new Map<string, string>();

export const getGeneratedId = (sourceId: string, targetDbId: string) => {
    const key = `${sourceId}:${targetDbId}`;
    if (idCache.has(key)) return idCache.get(key)!;
    
    const id = createStableCuid(key, 16);
    idCache.set(key, id);
    return id;
};
