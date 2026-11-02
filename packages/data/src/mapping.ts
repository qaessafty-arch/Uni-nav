/** Top-level camelCase ⇄ snake_case mapping between domain objects and table rows. Nested JSON is left untouched. */
export function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
export function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

const DB_ONLY = new Set(["created_at", "updated_at", "deleted_at", "created_by"]);

export function rowToDomain<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (DB_ONLY.has(k)) continue;
    out[toCamel(k)] = v;
  }
  return out as T;
}

export function domainToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[toSnake(k)] = v;
  }
  return out;
}
