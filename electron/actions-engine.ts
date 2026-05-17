import { ipcMain, BrowserWindow } from 'electron';
import { getDb } from './database';
import { getToken } from './oauth';
import { notifyAutomationComplete } from './notifications';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionNode {
  id: string;
  type: ActionType;
  config: Record<string, any>;
  next?: string | null;
  onError?: string | null;
}

export type ActionType =
  | 'http_request'
  | 'send_email'
  | 'send_slack'
  | 'update_sheet'
  | 'read_sheet'
  | 'create_file'
  | 'read_file'
  | 'run_command'
  | 'delay'
  | 'condition'
  | 'loop'
  | 'set_variable'
  | 'notify'
  | 'save_memory'
  | 'calendar_create'
  | 'calendar_read'
  | 'transform_data'
  | 'webhook_listen'
  | 'ping_url';

export interface ActionFlow {
  id: string;
  name: string;
  description: string;
  trigger: FlowTrigger;
  nodes: ActionNode[];
  variables: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  lastRun: string | null;
  runCount: number;
}

export interface FlowTrigger {
  type: 'schedule' | 'webhook' | 'event' | 'manual' | 'listener';
  config: Record<string, any>;
}

export interface ExecutionLog {
  flowId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'error';
  nodesExecuted: number;
  tokensUsed: number;
  error?: string;
  output?: any;
}

// ─── Action Executors (Zero Tokens) ──────────────────────────────────────────

async function executeHttpRequest(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const url = interpolate(config.url, vars);
  const method = config.method || 'GET';
  const headers = config.headers ? JSON.parse(interpolate(JSON.stringify(config.headers), vars)) : {};
  const body = config.body ? interpolate(config.body, vars) : undefined;

  const res = await fetch(url, { method, headers, body });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : await res.text();

  return { status: res.status, data, ok: res.ok };
}

async function executeSendEmail(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const token = getToken('google');
  if (!token) throw new Error('Google not authenticated — cannot send email');

  const to = interpolate(config.to, vars);
  const subject = interpolate(config.subject, vars);
  const body = interpolate(config.body, vars);

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}`
  ).toString('base64url');

  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) throw new Error(`Gmail send failed: ${res.status}`);
  const data = await res.json();
  return { id: data.id, sent: true };
}

async function executeSendSlack(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const token = getToken('slack');
  if (!token) throw new Error('Slack not authenticated');

  const channel = interpolate(config.channel, vars);
  const text = interpolate(config.text, vars);

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, text }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return { ts: data.ts, channel };
}

async function executeReadSheet(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const token = getToken('google');
  if (!token) throw new Error('Google not authenticated');

  const spreadsheetId = interpolate(config.spreadsheetId, vars);
  const range = interpolate(config.range || 'Sheet1', vars);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );

  if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`);
  const data = await res.json();
  return { values: data.values || [], range: data.range };
}

async function executeUpdateSheet(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const token = getToken('google');
  if (!token) throw new Error('Google not authenticated');

  const spreadsheetId = interpolate(config.spreadsheetId, vars);
  const range = interpolate(config.range, vars);
  const values = config.values || vars._lastOutput?.values || [];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) throw new Error(`Sheets update failed: ${res.status}`);
  return await res.json();
}

async function executeCalendarRead(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const token = getToken('google');
  if (!token) throw new Error('Google not authenticated');

  const calendarId = config.calendarId || 'primary';
  const now = new Date();
  const timeMin = config.timeMin || now.toISOString();
  const timeMax = config.timeMax || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });

  if (!res.ok) throw new Error(`Calendar read failed: ${res.status}`);
  const data = await res.json();
  return { events: (data.items || []).map((e: any) => ({ id: e.id, summary: e.summary, start: e.start, end: e.end, attendees: e.attendees })) };
}

async function executeCalendarCreate(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const token = getToken('google');
  if (!token) throw new Error('Google not authenticated');

  const calendarId = config.calendarId || 'primary';
  const event = {
    summary: interpolate(config.summary, vars),
    description: config.description ? interpolate(config.description, vars) : undefined,
    start: config.start,
    end: config.end,
    attendees: config.attendees,
  };

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  if (!res.ok) throw new Error(`Calendar create failed: ${res.status}`);
  return await res.json();
}

async function executeCreateFile(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const fs = require('fs');
  const path = require('path');
  const filePath = interpolate(config.path, vars);
  const content = interpolate(config.content, vars);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return { path: filePath, size: Buffer.byteLength(content) };
}

async function executeReadFile(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const fs = require('fs');
  const filePath = interpolate(config.path, vars);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return { path: filePath, content, size: content.length };
}

async function executeRunCommand(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const { execSync } = require('child_process');
  const command = interpolate(config.command, vars);
  const cwd = config.cwd ? interpolate(config.cwd, vars) : undefined;
  const timeout = config.timeout || 30000;

  const output = execSync(command, { cwd, timeout, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  return { output: output.trim(), exitCode: 0 };
}

async function executeDelay(config: Record<string, any>): Promise<any> {
  const ms = config.ms || config.seconds ? (config.seconds * 1000) : 1000;
  await new Promise(resolve => setTimeout(resolve, ms));
  return { delayed: ms };
}

async function executeCondition(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const left = interpolate(String(config.left || ''), vars);
  const right = interpolate(String(config.right || ''), vars);
  const operator = config.operator || 'equals';

  let result = false;
  switch (operator) {
    case 'equals': result = left === right; break;
    case 'not_equals': result = left !== right; break;
    case 'contains': result = left.includes(right); break;
    case 'greater_than': result = parseFloat(left) > parseFloat(right); break;
    case 'less_than': result = parseFloat(left) < parseFloat(right); break;
    case 'is_empty': result = !left || left.trim() === ''; break;
    case 'is_not_empty': result = !!left && left.trim() !== ''; break;
  }

  return { result, branch: result ? 'true' : 'false' };
}

async function executeTransformData(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const input = vars._lastOutput || config.input;
  const operation = config.operation || 'passthrough';

  switch (operation) {
    case 'filter': {
      if (!Array.isArray(input)) return { data: input };
      const field = config.field;
      const value = config.value;
      return { data: input.filter((item: any) => item[field] === value) };
    }
    case 'map': {
      if (!Array.isArray(input)) return { data: input };
      const fields = config.fields || [];
      return { data: input.map((item: any) => {
        const mapped: any = {};
        for (const f of fields) mapped[f] = item[f];
        return mapped;
      })};
    }
    case 'sort': {
      if (!Array.isArray(input)) return { data: input };
      const sortField = config.field;
      const order = config.order || 'asc';
      return { data: [...input].sort((a: any, b: any) => order === 'asc' ? (a[sortField] > b[sortField] ? 1 : -1) : (a[sortField] < b[sortField] ? 1 : -1)) };
    }
    case 'count': return { data: Array.isArray(input) ? input.length : 0 };
    case 'sum': {
      if (!Array.isArray(input)) return { data: 0 };
      const sumField = config.field;
      return { data: input.reduce((acc: number, item: any) => acc + (parseFloat(item[sumField]) || 0), 0) };
    }
    case 'json_parse': return { data: typeof input === 'string' ? JSON.parse(input) : input };
    case 'json_stringify': return { data: JSON.stringify(input, null, 2) };
    case 'template': return { data: interpolate(config.template, { ...vars, input }) };
    default: return { data: input };
  }
}

async function executeNotify(config: Record<string, any>, vars: Record<string, any>, win: BrowserWindow | null): Promise<any> {
  const title = interpolate(config.title || 'JVOS', vars);
  const message = interpolate(config.message, vars);

  if (win) {
    win.webContents.send('actions:notification', { title, message, type: config.type || 'info' });
  }
  return { notified: true, title, message };
}

async function executeSaveMemory(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not available');

  const content = interpolate(config.content, vars);
  const category = config.category || 'action-engine';
  const id = `mem_${Date.now()}`;

  db.run("INSERT INTO memories (id, content, category, created_at) VALUES (?, ?, ?, datetime('now'))", [id, content, category]);
  return { id, saved: true };
}

async function executePingUrl(config: Record<string, any>, vars: Record<string, any>): Promise<any> {
  const url = interpolate(config.url, vars);
  const timeout = config.timeout || 10000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const start = Date.now();
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const responseTime = Date.now() - start;
    clearTimeout(timer);
    return { url, status: res.status, ok: res.ok, responseTime };
  } catch (err: any) {
    clearTimeout(timer);
    return { url, status: 0, ok: false, responseTime: timeout, error: err.message };
  }
}

// ─── Variable Interpolation ──────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    const parts = trimmed.split('.');
    let value: any = vars;
    for (const p of parts) {
      if (value == null) return '';
      value = value[p];
    }
    return value != null ? String(value) : '';
  });
}

// ─── Flow Executor ───────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

async function executeNode(node: ActionNode, vars: Record<string, any>): Promise<any> {
  switch (node.type) {
    case 'http_request': return executeHttpRequest(node.config, vars);
    case 'send_email': return executeSendEmail(node.config, vars);
    case 'send_slack': return executeSendSlack(node.config, vars);
    case 'read_sheet': return executeReadSheet(node.config, vars);
    case 'update_sheet': return executeUpdateSheet(node.config, vars);
    case 'calendar_read': return executeCalendarRead(node.config, vars);
    case 'calendar_create': return executeCalendarCreate(node.config, vars);
    case 'create_file': return executeCreateFile(node.config, vars);
    case 'read_file': return executeReadFile(node.config, vars);
    case 'run_command': return executeRunCommand(node.config, vars);
    case 'delay': return executeDelay(node.config);
    case 'condition': return executeCondition(node.config, vars);
    case 'transform_data': return executeTransformData(node.config, vars);
    case 'notify': return executeNotify(node.config, vars, mainWindow);
    case 'save_memory': return executeSaveMemory(node.config, vars);
    case 'ping_url': return executePingUrl(node.config, vars);
    case 'loop': return executeLoop(node, vars);
    case 'set_variable': {
      const key = node.config.key;
      const value = interpolate(node.config.value || '', vars);
      vars[key] = value;
      return { set: key, value };
    }
    default: throw new Error(`Unknown action type: ${node.type}`);
  }
}

async function executeLoop(node: ActionNode, vars: Record<string, any>): Promise<any> {
  const items = vars[node.config.iterateOver] || vars._lastOutput?.data || [];
  if (!Array.isArray(items)) return { iterations: 0 };

  const results: any[] = [];
  const maxIterations = node.config.maxIterations || 100;

  for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
    vars._loopItem = items[i];
    vars._loopIndex = i;
    results.push(items[i]);
  }

  return { iterations: results.length, items: results };
}

export async function executeFlow(flow: ActionFlow, triggerData?: any): Promise<ExecutionLog> {
  const startedAt = new Date().toISOString();
  const vars: Record<string, any> = { ...flow.variables, _trigger: triggerData || {} };
  let nodesExecuted = 0;
  let error: string | undefined;

  const nodeMap = new Map(flow.nodes.map(n => [n.id, n]));
  let currentNode = flow.nodes[0];

  try {
    while (currentNode) {
      const output = await executeNode(currentNode, vars);
      vars._lastOutput = output;
      vars[`_node_${currentNode.id}`] = output;
      nodesExecuted++;

      if (mainWindow) {
        mainWindow.webContents.send('actions:node-executed', {
          flowId: flow.id,
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          output,
        });
      }

      // Branching for condition nodes
      if (currentNode.type === 'condition' && output.branch === 'false' && currentNode.onError) {
        currentNode = nodeMap.get(currentNode.onError) as ActionNode;
      } else if (currentNode.next) {
        currentNode = nodeMap.get(currentNode.next) as ActionNode;
      } else {
        break;
      }
    }
  } catch (err: any) {
    error = err.message;
  }

  const log: ExecutionLog = {
    flowId: flow.id,
    startedAt,
    completedAt: new Date().toISOString(),
    status: error ? 'error' : 'success',
    nodesExecuted,
    tokensUsed: 0,
    error,
    output: vars._lastOutput,
  };

  // Persist execution log
  const db = getDb();
  if (db) {
    try {
      db.run(`INSERT INTO action_logs (flow_id, started_at, completed_at, status, nodes_executed, tokens_used, error, output)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [log.flowId, log.startedAt, log.completedAt, log.status, log.nodesExecuted, log.tokensUsed, log.error || null, JSON.stringify(log.output)]);
      db.run("UPDATE action_flows SET last_run = ?, run_count = run_count + 1 WHERE id = ?", [log.completedAt, flow.id]);
    } catch {}
  }

  if (mainWindow) {
    mainWindow.webContents.send('actions:flow-completed', log);
  }

  return log;
}

// ─── Database Schema ─────────────────────────────────────────────────────────

export function initActionsSchema() {
  const db = getDb();
  if (!db) return;

  db.run(`CREATE TABLE IF NOT EXISTS action_flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_config TEXT DEFAULT '{}',
    nodes TEXT NOT NULL DEFAULT '[]',
    variables TEXT DEFAULT '{}',
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_run TEXT,
    run_count INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    nodes_executed INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    error TEXT,
    output TEXT
  )`);
}

// ─── Flow CRUD ───────────────────────────────────────────────────────────────

export function getFlows(): ActionFlow[] {
  const db = getDb();
  if (!db) return [];
  const rows = db.exec('SELECT id, name, description, trigger_type, trigger_config, nodes, variables, enabled, created_at, last_run, run_count FROM action_flows ORDER BY created_at DESC');
  if (!rows.length) return [];

  return rows[0].values.map((r: any[]) => ({
    id: r[0],
    name: r[1],
    description: r[2],
    trigger: { type: r[3], config: JSON.parse(r[4] || '{}') },
    nodes: JSON.parse(r[5] || '[]'),
    variables: JSON.parse(r[6] || '{}'),
    enabled: !!r[7],
    createdAt: r[8],
    lastRun: r[9],
    runCount: r[10],
  }));
}

export function getFlow(id: string): ActionFlow | null {
  const db = getDb();
  if (!db) return null;
  const rows = db.exec(`SELECT id, name, description, trigger_type, trigger_config, nodes, variables, enabled, created_at, last_run, run_count FROM action_flows WHERE id = '${id}'`);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    id: r[0] as string,
    name: r[1] as string,
    description: r[2] as string,
    trigger: { type: r[3] as any, config: JSON.parse((r[4] as string) || '{}') },
    nodes: JSON.parse((r[5] as string) || '[]'),
    variables: JSON.parse((r[6] as string) || '{}'),
    enabled: !!(r[7]),
    createdAt: r[8] as string,
    lastRun: r[9] as string | null,
    runCount: r[10] as number,
  };
}

export function createFlow(flow: Partial<ActionFlow>): string {
  const db = getDb();
  if (!db) throw new Error('Database not available');

  const id = `flow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.run(
    `INSERT INTO action_flows (id, name, description, trigger_type, trigger_config, nodes, variables, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, flow.name || 'Untitled Flow', flow.description || '', flow.trigger?.type || 'manual', JSON.stringify(flow.trigger?.config || {}), JSON.stringify(flow.nodes || []), JSON.stringify(flow.variables || {}), flow.enabled !== false ? 1 : 0]
  );
  return id;
}

function updateFlow(id: string, updates: Partial<ActionFlow>): boolean {
  const db = getDb();
  if (!db) return false;

  const sets: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
  if (updates.trigger !== undefined) { sets.push('trigger_type = ?, trigger_config = ?'); params.push(updates.trigger.type, JSON.stringify(updates.trigger.config)); }
  if (updates.nodes !== undefined) { sets.push('nodes = ?'); params.push(JSON.stringify(updates.nodes)); }
  if (updates.variables !== undefined) { sets.push('variables = ?'); params.push(JSON.stringify(updates.variables)); }
  if (updates.enabled !== undefined) { sets.push('enabled = ?'); params.push(updates.enabled ? 1 : 0); }

  if (sets.length === 0) return false;
  params.push(id);
  db.run(`UPDATE action_flows SET ${sets.join(', ')} WHERE id = ?`, params);
  return true;
}

function deleteFlow(id: string): boolean {
  const db = getDb();
  if (!db) return false;
  db.run('DELETE FROM action_flows WHERE id = ?', [id]);
  db.run('DELETE FROM action_logs WHERE flow_id = ?', [id]);
  return true;
}

function getFlowLogs(flowId: string, limit = 20): any[] {
  const db = getDb();
  if (!db) return [];
  const rows = db.exec(`SELECT flow_id, started_at, completed_at, status, nodes_executed, tokens_used, error FROM action_logs WHERE flow_id = '${flowId}' ORDER BY started_at DESC LIMIT ${limit}`);
  if (!rows.length) return [];
  return rows[0].values.map((r: any[]) => ({
    flowId: r[0], startedAt: r[1], completedAt: r[2], status: r[3], nodesExecuted: r[4], tokensUsed: r[5], error: r[6],
  }));
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

export function registerActionsEngineHandlers(win?: BrowserWindow | null) {
  mainWindow = win || null;

  ipcMain.handle('actions:list-flows', async () => {
    try { return { success: true, flows: getFlows() }; }
    catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:get-flow', async (_event, id: string) => {
    try {
      const flow = getFlow(id);
      if (!flow) return { error: 'Flow not found' };
      return { success: true, flow };
    } catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:create-flow', async (_event, flowData: Partial<ActionFlow>) => {
    try {
      const id = createFlow(flowData);
      return { success: true, id };
    } catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:update-flow', async (_event, id: string, updates: Partial<ActionFlow>) => {
    try {
      updateFlow(id, updates);
      return { success: true };
    } catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:delete-flow', async (_event, id: string) => {
    try {
      deleteFlow(id);
      return { success: true };
    } catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:execute-flow', async (_event, id: string, triggerData?: any) => {
    try {
      const flow = getFlow(id);
      if (!flow) return { error: 'Flow not found' };
      if (!flow.enabled) return { error: 'Flow is disabled' };
      const log = await executeFlow(flow, triggerData);
      return { success: true, log };
    } catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:get-logs', async (_event, flowId: string, limit?: number) => {
    try { return { success: true, logs: getFlowLogs(flowId, limit) }; }
    catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle('actions:list-action-types', async () => {
    return {
      success: true,
      types: [
        { type: 'http_request', label: 'HTTP Request', description: 'Make any API call', category: 'network', tokensUsed: false },
        { type: 'send_email', label: 'Send Email', description: 'Send email via Gmail', category: 'communication', tokensUsed: false },
        { type: 'send_slack', label: 'Send Slack', description: 'Post message to Slack channel', category: 'communication', tokensUsed: false },
        { type: 'read_sheet', label: 'Read Sheet', description: 'Read data from Google Sheets', category: 'data', tokensUsed: false },
        { type: 'update_sheet', label: 'Update Sheet', description: 'Write data to Google Sheets', category: 'data', tokensUsed: false },
        { type: 'calendar_read', label: 'Read Calendar', description: 'Get events from Google Calendar', category: 'productivity', tokensUsed: false },
        { type: 'calendar_create', label: 'Create Event', description: 'Create event in Google Calendar', category: 'productivity', tokensUsed: false },
        { type: 'create_file', label: 'Create File', description: 'Write content to a file', category: 'filesystem', tokensUsed: false },
        { type: 'read_file', label: 'Read File', description: 'Read content from a file', category: 'filesystem', tokensUsed: false },
        { type: 'run_command', label: 'Run Command', description: 'Execute shell command', category: 'system', tokensUsed: false },
        { type: 'ping_url', label: 'Ping URL', description: 'Check if URL is alive + response time', category: 'monitoring', tokensUsed: false },
        { type: 'condition', label: 'Condition', description: 'If/else branching', category: 'logic', tokensUsed: false },
        { type: 'loop', label: 'Loop', description: 'Iterate over items', category: 'logic', tokensUsed: false },
        { type: 'delay', label: 'Delay', description: 'Wait before next step', category: 'logic', tokensUsed: false },
        { type: 'set_variable', label: 'Set Variable', description: 'Store value for later use', category: 'logic', tokensUsed: false },
        { type: 'transform_data', label: 'Transform Data', description: 'Filter, map, sort, count, sum data', category: 'data', tokensUsed: false },
        { type: 'notify', label: 'Notify', description: 'Send notification in JVOS', category: 'system', tokensUsed: false },
        { type: 'save_memory', label: 'Save Memory', description: 'Store info in workspace memory', category: 'system', tokensUsed: false },
      ],
    };
  });

  // Tool callable by LLM to create flows from natural language
  ipcMain.handle('actions:create-from-description', async (_event, description: string, nodes: ActionNode[], trigger: FlowTrigger) => {
    try {
      const id = createFlow({ name: description.slice(0, 60), description, nodes, trigger, enabled: true });
      return { success: true, id, message: `Flow "${description.slice(0, 60)}" created and active.` };
    } catch (err: any) { return { error: err.message }; }
  });
}
