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
