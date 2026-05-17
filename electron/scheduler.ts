import { BrowserWindow } from 'electron';
import { getSetting } from './database';
import { notifyAutomationComplete } from './notifications';

interface Automation {
  id: string;
  name: string;
  description: string;
  schedule: string;
  sources: string;
  enabled: number;
  lastRun: string | null;
  actionType: string | null;
  skillSlug: string | null;
  prompt: string | null;
}

let schedulerInterval: NodeJS.Timeout | null = null;
let db: any = null;

function parseSchedule(schedule: string): { hours: number; minutes: number; daysOfWeek: number[] } | null {
  const timeMatch = schedule.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);

  let daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
  const lower = schedule.toLowerCase();
  if (lower.includes('dias úteis') || lower.includes('weekdays')) {
    daysOfWeek = [1, 2, 3, 4, 5];
  } else if (lower.includes('segunda') || lower.includes('monday')) {
    daysOfWeek = [1];
  } else if (lower.includes('diariamente') || lower.includes('daily') || lower.includes('todos os dias')) {
    daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
  }

  return { hours, minutes, daysOfWeek };
}

function shouldRunNow(schedule: string, lastRun: string | null): boolean {
  const parsed = parseSchedule(schedule);
  if (!parsed) return false;

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (!parsed.daysOfWeek.includes(currentDay)) return false;
  if (currentHour !== parsed.hours || currentMinute !== parsed.minutes) return false;

  if (lastRun) {
    const lastRunDate = new Date(lastRun);
    const diffMs = now.getTime() - lastRunDate.getTime();
    if (diffMs < 60000) return false;
  }

  return true;
}

async function executeAutomation(automation: Automation, win: BrowserWindow | null) {
  if (win) {
    win.webContents.send('automation:triggered', {
      id: automation.id,
      name: automation.name,
      description: automation.description,
      sources: automation.sources,
      actionType: automation.actionType,
      skillSlug: automation.skillSlug,
      prompt: automation.prompt,
    });
  }

  notifyAutomationComplete(automation.name);

  if (db) {
    db.run("UPDATE automations SET last_run = datetime('now') WHERE id = ?", [automation.id]);
  }
}

function checkAutomations(win: BrowserWindow | null) {
  if (!db) return;
  const rows = db.exec('SELECT id, name, description, schedule, sources, enabled, last_run, action_type, skill_slug, prompt FROM automations WHERE enabled = 1');
  if (!rows.length) return;

  for (const r of rows[0].values) {
    const automation: Automation = {
      id: r[0] as string,
      name: r[1] as string,
      description: r[2] as string,
      schedule: r[3] as string,
      sources: r[4] as string,
      enabled: r[5] as number,
      lastRun: r[6] as string | null,
      actionType: r[7] as string | null,
      skillSlug: r[8] as string | null,
      prompt: r[9] as string | null,
    };

    if (shouldRunNow(automation.schedule, automation.lastRun)) {
      executeAutomation(automation, win);
    }
  }
}

export function startScheduler(database: any, win: BrowserWindow | null) {
  db = database;
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(() => checkAutomations(win), 30000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
