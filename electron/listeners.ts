import { ipcMain, BrowserWindow } from 'electron';
import { getDb } from './database';
import { getToken } from './oauth';
import { executeFlow, ActionFlow } from './actions-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListenerConfig {
  id: string;
  type: ListenerType;
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  interval: number; // ms
  lastCheck: string | null;
  lastData: string | null;
}

type ListenerType = 'gmail' | 'calendar' | 'sheets' | 'uptime' | 'slack' | 'webhook';

interface ListenerEvent {
  listenerId: string;
  type: ListenerType;
  event: string;
  data: any;
  timestamp: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

let listeners: Map<string, NodeJS.Timeout> = new Map();
let mainWindow: BrowserWindow | null = null;

// ─── Gmail Listener ──────────────────────────────────────────────────────────

async function checkGmail(config: ListenerConfig): Promise<ListenerEvent[]> {
  const token = getToken('google');
  if (!token) return [];

  const query = config.config.query || 'is:unread';
  const maxResults = config.config.maxResults || 10;

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const messages = data.messages || [];

  // Compare with last known state
  const lastIds: string[] = config.lastData ? JSON.parse(config.lastData) : [];
  const newMessages = messages.filter((m: any) => !lastIds.includes(m.id));

  if (newMessages.length === 0) return [];

  // Fetch details of new messages
  const events: ListenerEvent[] = [];
  for (const msg of newMessages.slice(0, 5)) {
    try {
      const detailRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token.accessToken}` } }
      );
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();

      const headers = detail.payload?.headers || [];
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      events.push({
        listenerId: config.id,
        type: 'gmail',
        event: 'new_email',
        data: { id: msg.id, from, subject, date, snippet: detail.snippet },
        timestamp: new Date().toISOString(),
      });
    } catch {}
  }

  // Update last known state
  const db = getDb();
  if (db) {
    const currentIds = JSON.stringify(messages.map((m: any) => m.id));
    db.run("UPDATE listeners SET last_check = datetime('now'), last_data = ? WHERE id = ?", [currentIds, config.id]);
  }

  return events;
}

// ─── Calendar Listener ───────────────────────────────────────────────────────

async function checkCalendar(config: ListenerConfig): Promise<ListenerEvent[]> {
  const token = getToken('google');
  if (!token) return [];

  const calendarId = config.config.calendarId || 'primary';
  const lookAheadMinutes = config.config.lookAheadMinutes || 30;

  const now = new Date();
  const ahead = new Date(now.getTime() + lookAheadMinutes * 60 * 1000);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${now.toISOString()}&timeMax=${ahead.toISOString()}&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const events: ListenerEvent[] = [];

  const lastEventIds: string[] = config.lastData ? JSON.parse(config.lastData) : [];

  for (const event of (data.items || [])) {
    if (lastEventIds.includes(event.id)) continue;

    const startTime = event.start?.dateTime || event.start?.date;
    const minutesUntil = startTime ? Math.round((new Date(startTime).getTime() - now.getTime()) / 60000) : 0;

    events.push({
      listenerId: config.id,
      type: 'calendar',
      event: 'upcoming_event',
      data: {
        id: event.id,
        summary: event.summary,
        start: startTime,
        end: event.end?.dateTime || event.end?.date,
        attendees: (event.attendees || []).map((a: any) => a.email),
        minutesUntil,
        location: event.location,
        description: event.description?.slice(0, 200),
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (events.length > 0) {
    const db = getDb();
    if (db) {
      const ids = JSON.stringify([...lastEventIds, ...events.map(e => e.data.id)].slice(-50));
      db.run("UPDATE listeners SET last_check = datetime('now'), last_data = ? WHERE id = ?", [ids, config.id]);
    }
  }

  return events;
}

// ─── Sheets Listener ─────────────────────────────────────────────────────────

async function checkSheets(config: ListenerConfig): Promise<ListenerEvent[]> {
  const token = getToken('google');
  if (!token) return [];

  const spreadsheetId = config.config.spreadsheetId;
  const range = config.config.range || 'Sheet1!A1:Z1000';

  if (!spreadsheetId) return [];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const currentValues = JSON.stringify(data.values || []);

  const events: ListenerEvent[] = [];

  if (config.lastData && config.lastData !== currentValues) {
    // Detect what changed
    const previous = JSON.parse(config.lastData);
    const current = data.values || [];

    const newRows = current.length - previous.length;
    let changedCells = 0;

    const minRows = Math.min(previous.length, current.length);
    for (let i = 0; i < minRows; i++) {
      const prevRow = previous[i] || [];
      const currRow = current[i] || [];
      const maxCols = Math.max(prevRow.length, currRow.length);
      for (let j = 0; j < maxCols; j++) {
        if ((prevRow[j] || '') !== (currRow[j] || '')) changedCells++;
      }
    }

    events.push({
      listenerId: config.id,
      type: 'sheets',
      event: 'data_changed',
      data: {
        spreadsheetId,
        range,
        newRows,
        changedCells,
        totalRows: current.length,
        lastRow: current[current.length - 1],
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Update stored state
  const db = getDb();
  if (db) {
    db.run("UPDATE listeners SET last_check = datetime('now'), last_data = ? WHERE id = ?", [currentValues, config.id]);
  }

  return events;
}

// ─── Uptime Listener ─────────────────────────────────────────────────────────

async function checkUptime(config: ListenerConfig): Promise<ListenerEvent[]> {
  const urls: string[] = config.config.urls || [];
  if (!urls.length) return [];

  const events: ListenerEvent[] = [];
  const previousStatuses: Record<string, boolean> = config.lastData ? JSON.parse(config.lastData) : {};

  const currentStatuses: Record<string, boolean> = {};

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const start = Date.now();
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);
      const responseTime = Date.now() - start;
      const isUp = res.ok;
      currentStatuses[url] = isUp;

      // Detect state change
      if (previousStatuses[url] !== undefined && previousStatuses[url] !== isUp) {
        events.push({
          listenerId: config.id,
          type: 'uptime',
          event: isUp ? 'site_recovered' : 'site_down',
          data: { url, status: res.status, responseTime, isUp },
          timestamp: new Date().toISOString(),
        });
      } else if (isUp && responseTime > (config.config.slowThreshold || 5000)) {
        events.push({
          listenerId: config.id,
          type: 'uptime',
          event: 'site_slow',
          data: { url, status: res.status, responseTime, threshold: config.config.slowThreshold || 5000 },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      currentStatuses[url] = false;
      if (previousStatuses[url] !== false) {
        events.push({
          listenerId: config.id,
          type: 'uptime',
          event: 'site_down',
          data: { url, error: err.message, isUp: false },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  const db = getDb();
  if (db) {
    db.run("UPDATE listeners SET last_check = datetime('now'), last_data = ? WHERE id = ?", [JSON.stringify(currentStatuses), config.id]);
  }

  return events;
}

// ─── Slack Listener ──────────────────────────────────────────────────────────

async function checkSlack(config: ListenerConfig): Promise<ListenerEvent[]> {
  const token = getToken('slack');
  if (!token) return [];

  const channels: string[] = config.config.channels || [];
  const events: ListenerEvent[] = [];
  const lastTimestamps: Record<string, string> = config.lastData ? JSON.parse(config.lastData) : {};

  for (const channel of channels) {
    const oldest = lastTimestamps[channel] || String(Date.now() / 1000 - 300); // last 5 min if first run
    try {
      const res = await fetch('https://slack.com/api/conversations.history', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, oldest, limit: 20 }),
      });
      const data = await res.json();
      if (!data.ok) continue;

      for (const msg of (data.messages || []).reverse()) {
        if (msg.subtype) continue; // skip system messages
        events.push({
          listenerId: config.id,
          type: 'slack',
          event: 'new_message',
          data: { channel, user: msg.user, text: msg.text, ts: msg.ts },
          timestamp: new Date().toISOString(),
        });
        lastTimestamps[channel] = msg.ts;
      }
    } catch {}
  }

  if (events.length > 0) {
    const db = getDb();
    if (db) {
      db.run("UPDATE listeners SET last_check = datetime('now'), last_data = ? WHERE id = ?", [JSON.stringify(lastTimestamps), config.id]);
    }
  }

  return events;
}

// ─── Listener Orchestrator ───────────────────────────────────────────────────

async function runListener(config: ListenerConfig) {
  let events: ListenerEvent[] = [];

  try {
    switch (config.type) {
      case 'gmail': events = await checkGmail(config); break;
      case 'calendar': events = await checkCalendar(config); break;
      case 'sheets': events = await checkSheets(config); break;
      case 'uptime': events = await checkUptime(config); break;
      case 'slack': events = await checkSlack(config); break;
    }
  } catch (err: any) {
    if (mainWindow) {
      mainWindow.webContents.send('listener:error', { listenerId: config.id, error: err.message });
    }
    return;
  }

  if (events.length > 0) {
    // Notify UI
    if (mainWindow) {
      mainWindow.webContents.send('listener:events', events);
    }

    // Persist events
    const db = getDb();
    if (db) {
      for (const event of events) {
        db.run(
          "INSERT INTO listener_events (listener_id, type, event, data, timestamp) VALUES (?, ?, ?, ?, ?)",
          [event.listenerId, event.type, event.event, JSON.stringify(event.data), event.timestamp]
        );
      }
    }

    // Trigger connected flows
    triggerConnectedFlows(config, events);
  }
}

async function triggerConnectedFlows(config: ListenerConfig, events: ListenerEvent[]) {
  const db = getDb();
  if (!db) return;

  const rows = db.exec(`SELECT id, name, description, trigger_type, trigger_config, nodes, variables, enabled, created_at, last_run, run_count FROM action_flows WHERE trigger_type = 'listener' AND enabled = 1`);
  if (!rows.length) return;

  for (const r of rows[0].values) {
    const triggerConfig = JSON.parse((r[4] as string) || '{}');
    if (triggerConfig.listenerId !== config.id) continue;

    const flow: ActionFlow = {
      id: r[0] as string,
      name: r[1] as string,
      description: r[2] as string,
      trigger: { type: 'listener', config: triggerConfig },
      nodes: JSON.parse((r[5] as string) || '[]'),
      variables: JSON.parse((r[6] as string) || '{}'),
      enabled: true,
      createdAt: r[8] as string,
      lastRun: r[9] as string | null,
      runCount: r[10] as number,
    };

    for (const event of events) {
      if (!triggerConfig.eventFilter || triggerConfig.eventFilter === event.event) {
        await executeFlow(flow, event.data);
      }
    }
  }
}

// ─── Listener CRUD & Lifecycle ───────────────────────────────────────────────

function loadListeners(): ListenerConfig[] {
  const db = getDb();
  if (!db) return [];
  const rows = db.exec('SELECT id, type, name, config, enabled, interval_ms, last_check, last_data FROM listeners WHERE enabled = 1');
  if (!rows.length) return [];

  return rows[0].values.map((r: any[]) => ({
    id: r[0],
    type: r[1] as ListenerType,
    name: r[2],
    config: JSON.parse(r[3] || '{}'),
    enabled: !!r[4],
    interval: r[5] || 60000,
    lastCheck: r[6],
    lastData: r[7],
  }));
}

function startListener(config: ListenerConfig) {
  if (listeners.has(config.id)) return;

  // Run immediately once
  runListener(config);

  // Then on interval
  const timer = setInterval(() => runListener(config), config.interval);
  listeners.set(config.id, timer);
}

function stopListener(id: string) {
  const timer = listeners.get(id);
  if (timer) {
    clearInterval(timer);
    listeners.delete(id);
  }
}

function stopAllListeners() {
  for (const [id, timer] of listeners) {
    clearInterval(timer);
  }
  listeners.clear();
}

// ─── Database Schema ─────────────────────────────────────────────────────────

export function initListenersSchema() {
  const db = getDb();
  if (!db) return;

  db.run(`CREATE TABLE IF NOT EXISTS listeners (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    enabled INTEGER DEFAULT 1,
    interval_ms INTEGER DEFAULT 60000,
    last_check TEXT,
    last_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS listener_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listener_id TEXT NOT NULL,
    type TEXT NOT NULL,
    event TEXT NOT NULL,
    data TEXT,
    timestamp TEXT NOT NULL
  )`);
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

export function registerListenerHandlers(win?: BrowserWindow | null) {
  mainWindow = win || null;

  ipcMain.handle('listeners:list', async () => {
    const db = getDb();
    if (!db) return { success: true, listeners: [] };
    const rows = db.exec('SELECT id, type, name, config, enabled, interval_ms, last_check FROM listeners ORDER BY created_at DESC');
    if (!rows.length) return { success: true, listeners: [] };
    return {
      success: true,
      listeners: rows[0].values.map((r: any[]) => ({
        id: r[0], type: r[1], name: r[2], config: JSON.parse(r[3] || '{}'), enabled: !!r[4], interval: r[5], lastCheck: r[6],
      })),
    };
  });

  ipcMain.handle('listeners:create', async (_event, data: { type: ListenerType; name: string; config: Record<string, any>; interval?: number }) => {
    const db = getDb();
    if (!db) return { error: 'Database not available' };

    const id = `lst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const interval = data.interval || getDefaultInterval(data.type);

    db.run(
      'INSERT INTO listeners (id, type, name, config, enabled, interval_ms) VALUES (?, ?, ?, ?, 1, ?)',
      [id, data.type, data.name, JSON.stringify(data.config), interval]
    );

    const config: ListenerConfig = { id, type: data.type, name: data.name, config: data.config, enabled: true, interval, lastCheck: null, lastData: null };
    startListener(config);

    return { success: true, id };
  });

  ipcMain.handle('listeners:update', async (_event, id: string, updates: Partial<ListenerConfig>) => {
    const db = getDb();
    if (!db) return { error: 'Database not available' };

    const sets: string[] = [];
    const params: any[] = [];
    if (updates.name) { sets.push('name = ?'); params.push(updates.name); }
    if (updates.config) { sets.push('config = ?'); params.push(JSON.stringify(updates.config)); }
    if (updates.interval) { sets.push('interval_ms = ?'); params.push(updates.interval); }
    if (updates.enabled !== undefined) { sets.push('enabled = ?'); params.push(updates.enabled ? 1 : 0); }

    if (sets.length) {
      params.push(id);
      db.run(`UPDATE listeners SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    // Restart listener with new config
    stopListener(id);
    if (updates.enabled !== false) {
      const configs = loadListeners();
      const cfg = configs.find(c => c.id === id);
      if (cfg) startListener(cfg);
    }

    return { success: true };
  });

  ipcMain.handle('listeners:delete', async (_event, id: string) => {
    const db = getDb();
    if (!db) return { error: 'Database not available' };

    stopListener(id);
    db.run('DELETE FROM listeners WHERE id = ?', [id]);
    db.run('DELETE FROM listener_events WHERE listener_id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('listeners:toggle', async (_event, id: string, enabled: boolean) => {
    const db = getDb();
    if (!db) return { error: 'Database not available' };

    db.run('UPDATE listeners SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    if (enabled) {
      const configs = loadListeners();
      const cfg = configs.find(c => c.id === id);
      if (cfg) startListener(cfg);
    } else {
      stopListener(id);
    }
    return { success: true };
  });

  ipcMain.handle('listeners:events', async (_event, listenerId: string, limit = 50) => {
    const db = getDb();
    if (!db) return { success: true, events: [] };
    const rows = db.exec(`SELECT listener_id, type, event, data, timestamp FROM listener_events WHERE listener_id = '${listenerId}' ORDER BY timestamp DESC LIMIT ${limit}`);
    if (!rows.length) return { success: true, events: [] };
    return {
      success: true,
      events: rows[0].values.map((r: any[]) => ({
        listenerId: r[0], type: r[1], event: r[2], data: JSON.parse(r[3] || '{}'), timestamp: r[4],
      })),
    };
  });

  ipcMain.handle('listeners:recent-events', async (_event, limit = 30) => {
    const db = getDb();
    if (!db) return { success: true, events: [] };
    const rows = db.exec(`SELECT listener_id, type, event, data, timestamp FROM listener_events ORDER BY timestamp DESC LIMIT ${limit}`);
    if (!rows.length) return { success: true, events: [] };
    return {
      success: true,
      events: rows[0].values.map((r: any[]) => ({
        listenerId: r[0], type: r[1], event: r[2], data: JSON.parse(r[3] || '{}'), timestamp: r[4],
      })),
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDefaultInterval(type: ListenerType): number {
  switch (type) {
    case 'gmail': return 60000;       // 1 min
    case 'calendar': return 300000;   // 5 min
    case 'sheets': return 120000;     // 2 min
    case 'uptime': return 300000;     // 5 min
    case 'slack': return 30000;       // 30 sec
    case 'webhook': return 0;         // event-driven
    default: return 60000;
  }
}

// ─── Startup ─────────────────────────────────────────────────────────────────

export function startListeners(win?: BrowserWindow | null) {
  mainWindow = win || null;
  const configs = loadListeners();
  for (const config of configs) {
    startListener(config);
  }
}

export function stopListeners() {
  stopAllListeners();
}
