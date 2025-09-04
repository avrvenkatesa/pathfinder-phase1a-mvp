// server/utils/validators.ts
export const isUUID = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export function assertUUID(id: string, name = 'id') {
    if (!isUUID(id)) throw Object.assign(new Error(`${name} must be a UUID`), { status: 400 });
}

export function pick<T extends object>(obj: T, keys: (keyof T)[]) {
    return keys.reduce((acc, k) => {
        if ((obj as any)[k] !== undefined) (acc as any)[k] = (obj as any)[k];
        return acc;
    }, {} as Partial<T>);
}
