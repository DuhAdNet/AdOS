import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let configDb: any = null;
let lastChecked: string | null = null;

function getConfigDbPath(): string {
  const userData = app.getPath('userData');
  const jvossysDir = userData.replace(/ados$/i, 'jvossys');
  return path.join(jvossysDir, 'jvossys-config.db');
}

function loadConfigDb(): boolean {
  const dbPath = getConfigDbPath();
  if (!fs.existsSync(dbPath)) return false;

  try {
    const initSqlJs = require('sql.js');
    const SQL = initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    configDb = new SQL.Database(buffer);
    return true;
  } catch {
    return false;
  }
}

export function getJvosSysBots(): any[] {
  if (!configDb && !loadConfigDb()) return [];
  try {
    const rows = configDb.exec('SELECT * FROM bots WHERE enabled = 1 ORDER BY priority ASC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0], name: r[1], slug: r[2], role: r[3], description: r[4],
      model: r[5], provider: r[6], system_prompt: r[7], tier: r[8],
      cost_multiplier: r[9], max_iterations: r[10], tools_enabled: r[11],
      enabled: r[12], priority: r[13], parent_id: r[14],
    }));
  } catch {
    return [];
  }
}

export function getJvosSysRules(): any[] {
  if (!configDb && !loadConfigDb()) return [];
  try {
    const rows = configDb.exec('SELECT * FROM delegation_rules WHERE enabled = 1 ORDER BY priority DESC');
    if (!rows.length) return [];
    return rows[0].values.map((r: any[]) => ({
      id: r[0], from_bot_id: r[1], to_bot_id: r[2], condition_type: r[3],
      condition_value: r[4], priority: r[5], enabled: r[6],
    }));
  } catch {
    return [];
  }
}

export function getJvosSysConfig(key: string): string | null {
  if (!configDb && !loadConfigDb()) return null;
  try {
    const rows = configDb.exec('SELECT value FROM global_config WHERE key = ?', [key]);
    if (!rows.length || !rows[0].values.length) return null;
    return rows[0].values[0][0] as string;
  } catch {
    return null;
  }
}

export function getJvosSysFlag(key: string): boolean {
  if (!configDb && !loadConfigDb()) return false;
  try {
    const rows = configDb.exec('SELECT enabled FROM feature_flags WHERE key = ?', [key]);
    if (!rows.length || !rows[0].values.length) return false;
    return rows[0].values[0][0] === 1;
  } catch {
    return false;
  }
}

export function getFallbackModel(primaryModel: string): string | null {
  if (!configDb && !loadConfigDb()) return null;
  try {
    const rows = configDb.exec(`
      SELECT m.model_id FROM fallback_chains fc
      JOIN models m ON fc.fallback_model_id = m.id
      JOIN models pm ON fc.primary_model_id = pm.id
      WHERE pm.model_id = ? ORDER BY fc.priority LIMIT 1
    `, [primaryModel]);
    if (!rows.length || !rows[0].values.length) return null;
    return rows[0].values[0][0] as string;
  } catch {
    return null;
  }
}

export function logUsage(sessionId: string, botId: string, modelId: string, inputTokens: number, outputTokens: number, costUsd: number, durationMs: number) {
  if (!configDb && !loadConfigDb()) return;
  try {
    const id = `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    configDb.run(
      `INSERT INTO usage_log (id, session_id, bot_id, model_id, input_tokens, output_tokens, cost_usd, duration_ms) VALUES (?,?,?,?,?,?,?,?)`,
      [id, sessionId, botId, modelId, inputTokens, outputTokens, costUsd, durationMs]
    );
    const data = configDb.export();
    const dbPath = getConfigDbPath();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch {}
}

export function hasConfigChanged(): boolean {
  const current = getJvosSysConfig('last_updated');
  if (!current) return false;
  if (current !== lastChecked) {
    lastChecked = current;
    return true;
  }
  return false;
}

export function reloadConfigDb(): boolean {
  configDb = null;
  return loadConfigDb();
}
