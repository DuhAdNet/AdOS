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
      favorite INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migration: add columns if table already exists without them
  try { db.run('ALTER TABLE sessions ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

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
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'bash',
      access TEXT NOT NULL DEFAULT 'ask',
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      auto_pattern TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS session_labels (
      session_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (session_id, label_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (label_id) REFERENCES labels(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shortcuts (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL UNIQUE,
      keys TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shared_sessions (
      session_id TEXT PRIMARY KEY,
      public_id TEXT NOT NULL UNIQUE,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_pairings (
      chat_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      chat_title TEXT NOT NULL DEFAULT '',
      direction TEXT NOT NULL DEFAULT 'both',
      paired_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (chat_id, session_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS session_settings (
      session_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (session_id, key),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      action_type TEXT NOT NULL DEFAULT 'new_session',
      skill_slug TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      working_dir TEXT NOT NULL DEFAULT '',
      schedule_type TEXT NOT NULL DEFAULT 'schedule',
      schedule_days TEXT NOT NULL DEFAULT '[]',
      schedule_time TEXT NOT NULL DEFAULT '08:00',
      selected_skills TEXT NOT NULL DEFAULT '[]'
    )
  `);

  // Migrations: add columns that may be missing from older databases
  const migrateCols = [
    { col: 'action_type', def: "TEXT NOT NULL DEFAULT 'new_session'" },
    { col: 'skill_slug', def: "TEXT NOT NULL DEFAULT ''" },
    { col: 'prompt', def: "TEXT NOT NULL DEFAULT ''" },
    { col: 'working_dir', def: "TEXT NOT NULL DEFAULT ''" },
    { col: 'schedule_type', def: "TEXT NOT NULL DEFAULT 'schedule'" },
    { col: 'schedule_days', def: "TEXT NOT NULL DEFAULT '[]'" },
    { col: 'schedule_time', def: "TEXT NOT NULL DEFAULT '08:00'" },
    { col: 'selected_skills', def: "TEXT NOT NULL DEFAULT '[]'" },
  ];
  for (const { col, def } of migrateCols) {
    try {
      db.run(`ALTER TABLE automations ADD COLUMN ${col} ${def}`);
    } catch { /* column already exists */ }
  }

  saveDb();
}

export function saveDb() {
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

export function setSetting(key: string, value: string): void {
  if (!db) return;
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  saveDb();
}

export function getDb() { return db; }

export function getPreferences(): Record<string, string> {
  if (!db) return {};
  const rows = db.exec('SELECT key, value FROM preferences');
  if (!rows.length) return {};
  const prefs: Record<string, string> = {};
  for (const r of rows[0].values) { prefs[r[0] as string] = r[1] as string; }
  return prefs;
}

export function getMemories(limit = 20): Array<{ content: string; category: string }> {
  if (!db) return [];
  const rows = db.exec(`SELECT content, category FROM memories ORDER BY created_at DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map((r: any[]) => ({ content: r[0], category: r[1] }));
}

function applyAutoLabels(sessionId: string, title: string) {
  if (!db) return;
  const rows = db.exec('SELECT id, auto_pattern FROM labels WHERE auto_pattern IS NOT NULL AND auto_pattern != ""');
  if (!rows.length) return;
  for (const r of rows[0].values) {
    const labelId = r[0] as string;
    const pattern = r[1] as string;
    try {
      if (new RegExp(pattern, 'i').test(title)) {
        db.run('INSERT OR IGNORE INTO session_labels (session_id, label_id) VALUES (?, ?)', [sessionId, labelId]);
      }
    } catch {}
  }
}

export function registerDatabaseHandlers() {
  ipcMain.handle('db:create-session', (_event, id: string, title: string) => {
    db.run('INSERT INTO sessions (id, title) VALUES (?, ?)', [id, title]);
    applyAutoLabels(id, title);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-sessions', () => {
    const rows = db.exec('SELECT id, title, favorite, archived, created_at, updated_at FROM sessions ORDER BY updated_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0],
      title: r[1],
      favorite: !!r[2],
      archived: !!r[3],
      createdAt: r[4],
      updatedAt: r[5],
    }));
  });

  ipcMain.handle('db:toggle-session-favorite', (_event, id: string) => {
    db.run('UPDATE sessions SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END, updated_at = datetime("now") WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:toggle-session-archived', (_event, id: string) => {
    db.run('UPDATE sessions SET archived = CASE WHEN archived = 0 THEN 1 ELSE 0 END, updated_at = datetime("now") WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:update-session-title', (_event, id: string, title: string) => {
    db.run('UPDATE sessions SET title = ?, updated_at = datetime("now") WHERE id = ?', [title, id]);
    applyAutoLabels(id, title);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-session', (_event, id: string) => {
    db.run('DELETE FROM messages WHERE session_id = ?', [id]);
    db.run('DELETE FROM session_settings WHERE session_id = ?', [id]);
    db.run('DELETE FROM session_labels WHERE session_id = ?', [id]);
    db.run('DELETE FROM telegram_pairings WHERE session_id = ?', [id]);
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

  ipcMain.handle('db:get-permissions', () => {
    const rows = db.exec('SELECT id, pattern, type, access, comment FROM permissions ORDER BY type, pattern');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], pattern: r[1], type: r[2], access: r[3], comment: r[4] }));
  });

  ipcMain.handle('db:add-permission', (_event, id: string, pattern: string, type: string, access: string, comment: string) => {
    db.run('INSERT INTO permissions (id, pattern, type, access, comment) VALUES (?, ?, ?, ?, ?)', [id, pattern, type, access, comment]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:update-permission', (_event, id: string, access: string) => {
    db.run('UPDATE permissions SET access = ? WHERE id = ?', [access, id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-permission', (_event, id: string) => {
    db.run('DELETE FROM permissions WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-memories', () => {
    const rows = db.exec('SELECT id, content, category, created_at FROM memories ORDER BY created_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], content: r[1], category: r[2], createdAt: r[3] }));
  });

  ipcMain.handle('db:add-memory', (_event, id: string, content: string, category: string) => {
    db.run('INSERT INTO memories (id, content, category) VALUES (?, ?, ?)', [id, content, category]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-memory', (_event, id: string) => {
    db.run('DELETE FROM memories WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:search-memories', (_event, query: string) => {
    const rows = db.exec('SELECT id, content, category, created_at FROM memories WHERE content LIKE ? ORDER BY created_at DESC', [`%${query}%`]);
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], content: r[1], category: r[2], createdAt: r[3] }));
  });

  ipcMain.handle('db:get-automations', () => {
    const rows = db.exec('SELECT id, name, description, schedule, sources, enabled, last_run, created_at, action_type, skill_slug, prompt, working_dir, schedule_type, schedule_days, schedule_time, selected_skills FROM automations ORDER BY created_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0], name: r[1], description: r[2], schedule: r[3],
      sources: JSON.parse(r[4] || '[]'), enabled: !!r[5], lastRun: r[6], createdAt: r[7],
      actionType: r[8] || 'new_session', skillSlug: r[9] || '', prompt: r[10] || '',
      workingDir: r[11] || '', scheduleType: r[12] || 'schedule',
      scheduleDays: JSON.parse(r[13] || '[]'), scheduleTime: r[14] || '08:00',
      selectedSkills: JSON.parse(r[15] || '[]'),
    }));
  });

  ipcMain.handle('db:add-automation', (_event, id: string, name: string, description: string, schedule: string, sources: string, extra?: any) => {
    if (extra) {
      db.run(`INSERT INTO automations (id, name, description, schedule, sources, action_type, skill_slug, prompt, working_dir, schedule_type, schedule_days, schedule_time, selected_skills)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, description, schedule, sources,
         extra.action_type || 'new_session',
         extra.skill_slug || '',
         extra.prompt || '',
         extra.working_dir || '',
         extra.schedule_type || 'schedule',
         extra.schedule_days || '[]',
         extra.schedule_time || '08:00',
         extra.selected_skills || '[]']);
    } else {
      db.run('INSERT INTO automations (id, name, description, schedule, sources) VALUES (?, ?, ?, ?, ?)', [id, name, description, schedule, sources]);
    }
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:update-automation', (_event, id: string, name: string, description: string, schedule: string, sources: string, extra?: any) => {
    if (extra) {
      db.run(`UPDATE automations SET name=?, description=?, schedule=?, sources=?, action_type=?, skill_slug=?, prompt=?, working_dir=?, schedule_type=?, schedule_days=?, schedule_time=?, selected_skills=? WHERE id=?`,
        [name, description, schedule, sources,
         extra.action_type || 'new_session',
         extra.skill_slug || '',
         extra.prompt || '',
         extra.working_dir || '',
         extra.schedule_type || 'schedule',
         extra.schedule_days || '[]',
         extra.schedule_time || '08:00',
         extra.selected_skills || '[]',
         id]);
    } else {
      db.run('UPDATE automations SET name=?, description=?, schedule=?, sources=? WHERE id=?', [name, description, schedule, sources, id]);
    }
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

  // Session-scoped settings
  ipcMain.handle('db:get-session-setting', (_event, sessionId: string, key: string) => {
    const rows = db.exec('SELECT value FROM session_settings WHERE session_id = ? AND key = ?', [sessionId, key]);
    if (!rows.length || !rows[0].values.length) return null;
    return rows[0].values[0][0];
  });

  ipcMain.handle('db:set-session-setting', (_event, sessionId: string, key: string, value: string) => {
    db.run('INSERT OR REPLACE INTO session_settings (session_id, key, value) VALUES (?, ?, ?)', [sessionId, key, value]);
    saveDb();
    return { success: true };
  });

  // Labels
  ipcMain.handle('db:get-labels', () => {
    const rows = db.exec('SELECT id, name, color, parent_id, sort_order, auto_pattern FROM labels ORDER BY sort_order');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], name: r[1], color: r[2], parentId: r[3], sortOrder: r[4], autoPattern: r[5] }));
  });

  ipcMain.handle('db:add-label', (_event, id: string, name: string, color: string, parentId: string | null, autoPattern: string | null) => {
    db.run('INSERT INTO labels (id, name, color, parent_id, auto_pattern) VALUES (?, ?, ?, ?, ?)', [id, name, color, parentId, autoPattern]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:update-label', (_event, id: string, fields: any) => {
    const sets: string[] = [];
    const vals: any[] = [];
    if (fields.name !== undefined) { sets.push('name = ?'); vals.push(fields.name); }
    if (fields.color !== undefined) { sets.push('color = ?'); vals.push(fields.color); }
    if (fields.parentId !== undefined) { sets.push('parent_id = ?'); vals.push(fields.parentId); }
    if (fields.autoPattern !== undefined) { sets.push('auto_pattern = ?'); vals.push(fields.autoPattern); }
    if (fields.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(fields.sortOrder); }
    if (sets.length) {
      vals.push(id);
      db.run(`UPDATE labels SET ${sets.join(', ')} WHERE id = ?`, vals);
      saveDb();
    }
    return { success: true };
  });

  ipcMain.handle('db:delete-label', (_event, id: string) => {
    db.run('DELETE FROM session_labels WHERE label_id = ?', [id]);
    db.run('DELETE FROM labels WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-session-labels', (_event, sessionId: string) => {
    const rows = db.exec('SELECT label_id FROM session_labels WHERE session_id = ?', [sessionId]);
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => r[0]);
  });

  ipcMain.handle('db:set-session-labels', (_event, sessionId: string, labelIds: string[]) => {
    db.run('DELETE FROM session_labels WHERE session_id = ?', [sessionId]);
    for (const lid of labelIds) {
      db.run('INSERT INTO session_labels (session_id, label_id) VALUES (?, ?)', [sessionId, lid]);
    }
    saveDb();
    return { success: true };
  });

  // Preferences
  ipcMain.handle('db:get-preferences', () => {
    const rows = db.exec('SELECT key, value FROM preferences');
    if (!rows.length) return {};
    const prefs: Record<string, string> = {};
    for (const r of rows[0].values) { prefs[r[0] as string] = r[1] as string; }
    return prefs;
  });

  ipcMain.handle('db:set-preference', (_event, key: string, value: string) => {
    db.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [key, value]);
    saveDb();
    return { success: true };
  });

  // Shortcuts
  ipcMain.handle('db:get-shortcuts', () => {
    const rows = db.exec('SELECT id, action, keys, enabled FROM shortcuts ORDER BY action');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ id: r[0], action: r[1], keys: r[2], enabled: !!r[3] }));
  });

  ipcMain.handle('db:set-shortcut', (_event, id: string, action: string, keys: string) => {
    db.run('INSERT OR REPLACE INTO shortcuts (id, action, keys) VALUES (?, ?, ?)', [id, action, keys]);
    saveDb();
    return { success: true };
  });

  // Shared Sessions (public sharing)
  ipcMain.handle('db:share-session', (_event, sessionId: string, publicId: string) => {
    db.run('INSERT OR REPLACE INTO shared_sessions (session_id, public_id, published_at, updated_at) VALUES (?, ?, datetime("now"), datetime("now"))', [sessionId, publicId]);
    saveDb();
    return { success: true, publicId };
  });

  ipcMain.handle('db:unshare-session', (_event, sessionId: string) => {
    db.run('DELETE FROM shared_sessions WHERE session_id = ?', [sessionId]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-shared-session', (_event, sessionId: string) => {
    const rows = db.exec('SELECT public_id, published_at, updated_at FROM shared_sessions WHERE session_id = ?', [sessionId]);
    if (!rows.length || !rows[0].values.length) return null;
    const r = rows[0].values[0];
    return { publicId: r[0], publishedAt: r[1], updatedAt: r[2] };
  });

  ipcMain.handle('db:get-shared-sessions', () => {
    const rows = db.exec('SELECT session_id, public_id, published_at, updated_at FROM shared_sessions ORDER BY updated_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ sessionId: r[0], publicId: r[1], publishedAt: r[2], updatedAt: r[3] }));
  });

  // Telegram Pairings
  ipcMain.handle('db:get-telegram-pairings', () => {
    const rows = db.exec('SELECT chat_id, session_id, direction, paired_at FROM telegram_pairings ORDER BY paired_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({ chatId: r[0], sessionId: r[1], direction: r[2], createdAt: r[3] }));
  });

  ipcMain.handle('db:pair-telegram', (_event, chatId: number, sessionId: string, direction: string) => {
    db.run('INSERT OR REPLACE INTO telegram_pairings (chat_id, session_id, direction) VALUES (?, ?, ?)', [chatId, sessionId, direction || 'both']);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:unpair-telegram', (_event, chatId: number) => {
    db.run('DELETE FROM telegram_pairings WHERE chat_id = ?', [chatId]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:get-dashboards', () => {
    const rows = db.exec('SELECT id, name, layout, created_at, updated_at FROM dashboards ORDER BY created_at DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any) => ({ id: r[0], name: r[1], layout: r[2], createdAt: r[3], updatedAt: r[4] }));
  });

  ipcMain.handle('db:create-dashboard', (_event, id: string, name: string, layout: string) => {
    db.run('INSERT INTO dashboards (id, name, layout) VALUES (?, ?, ?)', [id, name, layout]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:update-dashboard', (_event, id: string, layout: string) => {
    db.run("UPDATE dashboards SET layout = ?, updated_at = datetime('now') WHERE id = ?", [layout, id]);
    saveDb();
    return { success: true };
  });

  ipcMain.handle('db:delete-dashboard', (_event, id: string) => {
    db.run('DELETE FROM dashboards WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });
}
