import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

let db: any = null;

const DB_PATH = path.join(app.getPath('userData'), 'ados.db');

export async function initDatabase() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Nova Sessão',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'api_key',
      status TEXT NOT NULL DEFAULT 'disconnected',
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      schedule TEXT NOT NULL DEFAULT '',
      sources TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 0,
      last_run TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  saveDb();
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function getSetting(key: string): string | null {
  if (!db) return null;
  const rows = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
  if (!rows.length || !rows[0].values.length) return null;
  return rows[0].values[0][0] as string;
}

export function registerDatabaseHandlers() {
  ipcMain.handle('db:create-session', (_event, id: string, title: string) => {
    db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [id, title]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-sessions', () => {
    const rows = db.exec('SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0],
      title: r[1],
      createdAt: r[2],
      updatedAt: r[3],
    }));
  });

  ipcMain.handle('db:update-session-title', (_event, id: string, title: string) => {
    db.run('UPDATE sessions SET title = ?, updated_at = datetime("now") WHERE id = ?', [title, id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-session', (_event, id: string) => {
    db.run('DELETE FROM messages WHERE session_id = ?', [id]);
    db.run('DELETE FROM sessions WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:add-message', (_event, id: string, sessionId: string, role: string, content: string) => {
    db.run('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)', [id, sessionId, role, content]);
    db.run('UPDATE sessions SET updated_at = datetime("now") WHERE id = ?', [sessionId]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-messages', (_event, sessionId: string) => {
    const rows = db.exec('SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0],
      role: r[1],
      content: r[2],
      createdAt: r[3],
    }));
  });

  ipcMain.handle('db:get-skills', () => {
    const rows = db.exec('SELECT id, name, slug, description, instructions FROM skills ORDER BY name');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], name: r[1], slug: r[2], description: r[3], instructions: r[4] }));
  });

  ipcMain.handle('db:add-skill', (_event, id: string, name: string, slug: string, description: string, instructions: string) => {
    db.run('INSERT INTO skills (id, name, slug, description, instructions) VALUES (?, ?, ?, ?, ?)', [id, name, slug, description, instructions]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-skill', (_event, id: string) => {
    db.run('DELETE FROM skills WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-workflows', () => {
    const rows = db.exec('SELECT id, name, slug, description, instructions FROM workflows ORDER BY name');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], name: r[1], slug: r[2], description: r[3], instructions: r[4] }));
  });

  ipcMain.handle('db:add-workflow', (_event, id: string, name: string, slug: string, description: string, instructions: string) => {
    db.run('INSERT INTO workflows (id, name, slug, description, instructions) VALUES (?, ?, ?, ?, ?)', [id, name, slug, description, instructions]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-workflow', (_event, id: string) => {
    db.run('DELETE FROM workflows WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-connections', () => {
    const rows = db.exec('SELECT id, name, type, status, config, created_at, updated_at FROM connections ORDER BY updated_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0], name: r[1], type: r[2], status: r[3], config: JSON.parse(r[4] || '{}'), createdAt: r[5], updatedAt: r[6],
    }));
  });

  ipcMain.handle('db:add-connection', (_event, id: string, name: string, type: string, config: string) => {
    db.run('INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)', [id, name, type, config]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:update-connection', (_event, id: string, fields: { name?: string; type?: string; status?: string; config?: string }) => {
    const sets: string[] = [];
    const vals: any[] = [];
    if (fields.name) { sets.push('name = ?'); vals.push(fields.name); }
    if (fields.type) { sets.push('type = ?'); vals.push(fields.type); }
    if (fields.status) { sets.push('status = ?'); vals.push(fields.status); }
    if (fields.config) { sets.push('config = ?'); vals.push(fields.config); }
    sets.push('updated_at = datetime("now")');
    vals.push(id);
    db.run(`UPDATE connections SET ${sets.join(', ')} WHERE id = ?`, vals);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-connection', (_event, id: string) => {
    db.run('DELETE FROM connections WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-automations', () => {
    const rows = db.exec('SELECT id, name, description, schedule, sources, enabled, last_run, created_at FROM automations ORDER BY created_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0], name: r[1], description: r[2], schedule: r[3],
      sources: JSON.parse(r[4] || '[]'), enabled: !!r[5], lastRun: r[6], createdAt: r[7],
    }));
  });

  ipcMain.handle('db:add-automation', (_event, id: string, name: string, description: string, schedule: string, sources: string) => {
    db.run('INSERT INTO automations (id, name, description, schedule, sources) VALUES (?, ?, ?, ?, ?)', [id, name, description, schedule, sources]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:toggle-automation', (_event, id: string, enabled: boolean) => {
    db.run('UPDATE automations SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-automation', (_event, id: string) => {
    db.run('DELETE FROM automations WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-setting', (_event, key: string) => {
    const rows = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
    if (!rows.length || !rows[0].values.length) return null;
    return rows[0].values[0][0];
  });

  ipcMain.handle('db:set-setting', (_event, key: string, value: string) => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    saveDb();
    return { success: true };
  });
}
