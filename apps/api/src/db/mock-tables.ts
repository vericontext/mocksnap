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

export function deleteRow(mockId: string, resourceName: string, id: string): boolean {
  const name = tableName(mockId, resourceName);
  const result = db.prepare(
    `DELETE FROM "${name}" WHERE json_extract(data, '$.id') = ? OR CAST(json_extract(data, '$.id') AS TEXT) = ? OR _row_id = ?`
  ).run(id, id, Number(id) || 0);
  return result.changes > 0;
}
