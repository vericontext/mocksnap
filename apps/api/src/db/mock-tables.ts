import { db } from './connection.js';

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

function tableName(mockId: string, resourceName: string): string {
  return `mock_${sanitizeName(mockId)}_${sanitizeName(resourceName)}`;
}

export function createMockDataTable(mockId: string, resourceName: string) {
  const name = tableName(mockId, resourceName);
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${name}" (
      _row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      data    TEXT NOT NULL
    )
  `);
}

export function dropMockDataTables(mockId: string, resourceNames: string[]) {
  for (const resourceName of resourceNames) {
    const name = tableName(mockId, resourceName);
    db.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
}

export function insertRow(mockId: string, resourceName: string, data: unknown): { _row_id: number; data: unknown } {
  const name = tableName(mockId, resourceName);
  const stmt = db.prepare(`INSERT INTO "${name}" (data) VALUES (?)`);
  const result = stmt.run(JSON.stringify(data));
  return { _row_id: Number(result.lastInsertRowid), data };
}

export function getAllRows(mockId: string, resourceName: string): unknown[] {
  const name = tableName(mockId, resourceName);
  const rows = db.prepare(`SELECT _row_id, data FROM "${name}"`).all() as { _row_id: number; data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

const RESERVED_PARAMS = new Set(['sort', 'order', 'page', 'limit', 'q', '_expand', '_embed']);

export function queryRows(
  mockId: string,
  resourceName: string,
  options: {
    filters?: Record<string, string>;
    sort?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    q?: string;
    cursor?: string;
  }
): { data: unknown[]; total: number; nextCursor?: string; hasMore?: boolean } {
  const name = tableName(mockId, resourceName);
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Filtering
  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (RESERVED_PARAMS.has(key)) continue;

      let field = key;
      let op = '=';

      if (key.endsWith('_gte')) { field = key.slice(0, -4); op = '>='; }
      else if (key.endsWith('_lte')) { field = key.slice(0, -4); op = '<='; }
      else if (key.endsWith('_ne')) { field = key.slice(0, -3); op = '!='; }
      else if (key.endsWith('_like')) { field = key.slice(0, -5); op = 'LIKE'; }

      const safeField = field.replace(/[^a-zA-Z0-9_]/g, '');
      if (op === 'LIKE') {
        conditions.push(`CAST(json_extract(data, '$.${safeField}') AS TEXT) LIKE ?`);
        params.push(`%${value}%`);
      } else {
        // Try numeric comparison for gte/lte, fall back to string
        const numVal = Number(value);
        if (!isNaN(numVal) && (op === '>=' || op === '<=' || op === '!=' || op === '=')) {
          conditions.push(`CAST(json_extract(data, '$.${safeField}') AS REAL) ${op} ?`);
          params.push(numVal);
        } else {
          conditions.push(`json_extract(data, '$.${safeField}') ${op} ?`);
          params.push(value);
        }
      }
    }
  }

  // Full-text search
  if (options.q) {
    conditions.push(`CAST(data AS TEXT) LIKE ?`);
    params.push(`%${options.q}%`);
  }

  // Cursor-based pagination
  if (options.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
      if (decoded.id !== undefined) {
        conditions.push(`json_extract(data, '$.id') > ?`);
        params.push(decoded.id);
      }
    } catch { /* invalid cursor, ignore */ }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count (without cursor filter for accurate total)
  const countParams = options.cursor ? params.slice(0, -1) : params;
  const countWhere = options.cursor && conditions.length > 1
    ? `WHERE ${conditions.slice(0, -1).join(' AND ')}`
    : options.cursor ? '' : whereClause;
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM "${name}" ${countWhere}`).get(...countParams) as { cnt: number };
  const total = countRow.cnt;

  // Sorting
  let orderClause = '';
  if (options.sort) {
    const safeSort = options.sort.replace(/[^a-zA-Z0-9_]/g, '');
    const dir = options.order === 'desc' ? 'DESC' : 'ASC';
    orderClause = `ORDER BY json_extract(data, '$.${safeSort}') ${dir}`;
  } else if (options.cursor) {
    orderClause = 'ORDER BY json_extract(data, \'$.id\') ASC';
  }

  // Pagination
  let limitClause = '';
  const limitParams: unknown[] = [];
  if (options.page && options.limit && !options.cursor) {
    limitClause = 'LIMIT ? OFFSET ?';
    limitParams.push(options.limit, (options.page - 1) * options.limit);
  } else if (options.limit) {
    // Fetch one extra to determine has_more
    limitClause = 'LIMIT ?';
    limitParams.push(options.cursor ? options.limit + 1 : options.limit);
  }

  const rows = db.prepare(
    `SELECT _row_id, data FROM "${name}" ${whereClause} ${orderClause} ${limitClause}`
  ).all(...params, ...limitParams) as { _row_id: number; data: string }[];

  const parsed = rows.map((r) => JSON.parse(r.data));

  // Cursor pagination result
  if (options.cursor && options.limit) {
    const hasMore = parsed.length > options.limit;
    const items = hasMore ? parsed.slice(0, options.limit) : parsed;
    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = hasMore && lastItem?.id !== undefined
      ? Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64')
      : undefined;
    return { data: items, total, hasMore, nextCursor };
  }

  return { data: parsed, total };
}

export function getRowById(mockId: string, resourceName: string, id: string): unknown | null {
  const name = tableName(mockId, resourceName);
  // Try matching by JSON id field first, then by _row_id
  const row = db.prepare(
    `SELECT _row_id, data FROM "${name}" WHERE json_extract(data, '$.id') = ? OR CAST(json_extract(data, '$.id') AS TEXT) = ? OR _row_id = ?`
  ).get(id, id, Number(id) || 0) as { _row_id: number; data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function updateRow(mockId: string, resourceName: string, id: string, newData: unknown, partial: boolean): unknown | null {
  const name = tableName(mockId, resourceName);
  const row = db.prepare(
    `SELECT _row_id, data FROM "${name}" WHERE json_extract(data, '$.id') = ? OR CAST(json_extract(data, '$.id') AS TEXT) = ? OR _row_id = ?`
  ).get(id, id, Number(id) || 0) as { _row_id: number; data: string } | undefined;

  if (!row) return null;

  const existing = JSON.parse(row.data);
  const updated = partial ? { ...existing, ...(newData as Record<string, unknown>) } : newData;

  db.prepare(`UPDATE "${name}" SET data = ? WHERE _row_id = ?`).run(JSON.stringify(updated), row._row_id);
  return updated;
}

export function resetTable(mockId: string, resourceName: string, seedData: unknown[]) {
  const name = tableName(mockId, resourceName);
  db.exec(`DELETE FROM "${name}"`);
  const stmt = db.prepare(`INSERT INTO "${name}" (data) VALUES (?)`);
  for (const item of seedData) {
    stmt.run(JSON.stringify(item));
  }
}

export function deleteRow(mockId: string, resourceName: string, id: string): boolean {
  const name = tableName(mockId, resourceName);
  const result = db.prepare(
    `DELETE FROM "${name}" WHERE json_extract(data, '$.id') = ? OR CAST(json_extract(data, '$.id') AS TEXT) = ? OR _row_id = ?`
  ).run(id, id, Number(id) || 0);
  return result.changes > 0;
}
