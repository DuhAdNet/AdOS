import { app, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { openBrowserUrl, getBrowserText, getBrowserTitle } from './browser';
import { getDb, saveDb } from './database';

let DOCUMENTS_ROOT = path.join(app.getPath('documents'), 'JVOS');

export function setDocumentsRoot(customPath: string) {
  if (customPath && customPath.trim()) {
    DOCUMENTS_ROOT = customPath.trim();
  }
}

export function getDocumentsRoot(): string {
  return DOCUMENTS_ROOT;
}

function ensureDocumentsRoot() {
  if (!fs.existsSync(DOCUMENTS_ROOT)) {
    fs.mkdirSync(DOCUMENTS_ROOT, { recursive: true });
  }
  const subfolders = ['dashboards', 'reports', 'skills', 'projects', 'downloads'];
  for (const folder of subfolders) {
    const p = path.join(DOCUMENTS_ROOT, folder);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
}

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  if (!filePath.includes('/') && !filePath.includes('\\')) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.htm') return path.join(DOCUMENTS_ROOT, 'dashboards', filePath);
    if (ext === '.pdf' || ext === '.csv' || ext === '.xlsx') return path.join(DOCUMENTS_ROOT, 'reports', filePath);
    if (ext === '.py' || ext === '.js' || ext === '.ts' || ext === '.sh') return path.join(DOCUMENTS_ROOT, 'skills', filePath);
  }
  return path.join(DOCUMENTS_ROOT, filePath);
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export function getBuiltinTools(): ToolDefinition[] {
  return [
    {
      name: 'read_file',
      description: 'Read the contents of a file. Use absolute path or relative to ~/Documents/JVOS/',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file. Creates directories if needed. Use for HTML, dashboards, reports, code, etc. Relative paths go to ~/Documents/JVOS/',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list_directory',
      description: 'List files and folders in a directory. Relative paths go to ~/Documents/JVOS/',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: ~/Documents/JVOS/)' },
        },
        required: [],
      },
    },
    {
      name: 'create_directory',
      description: 'Create a directory (and parent dirs). Relative paths go to ~/Documents/JVOS/',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
        },
        required: ['path'],
      },
    },
    {
      name: 'run_command',
      description: 'Execute a shell command and return stdout/stderr. Use for system tasks, npm, git, python, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
          cwd: { type: 'string', description: 'Working directory (optional, default ~/Documents/JVOS/)' },
        },
        required: ['command'],
      },
    },
    {
      name: 'open_browser',
      description: 'Open a URL in the internal browser and return the page title and text content.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' },
        },
        required: ['url'],
      },
    },
    {
      name: 'search_web',
      description: 'Search the web using DuckDuckGo and return top results.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
    {
      name: 'browser_click',
      description: 'Click an element in the browser by text content or CSS selector. Use text: prefix for text matching, or a CSS selector.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Element to click. Use "text:Button Label" for text match or a CSS selector like "#id", ".class", "a[href*=url]"' },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_type',
      description: 'Type text into a focused input or a specific element in the browser.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input element (optional, uses focused element if omitted)' },
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['text'],
      },
    },
    {
      name: 'browser_get_elements',
      description: 'Get a list of interactive elements (links, buttons, inputs) visible on the current page with their text and selector.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Optional text filter to narrow results' },
        },
        required: [],
      },
    },
    // --- Admin tools: manage JVOS entities ---
    {
      name: 'create_skill',
      description: 'Create a new skill in JVOS. Skills are reusable AI prompts the user can invoke with /slug.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name of the skill' },
          slug: { type: 'string', description: 'Unique slug (lowercase, hyphens). User invokes with /slug' },
          description: { type: 'string', description: 'Short description of what the skill does' },
          instructions: { type: 'string', description: 'Full system prompt / instructions for the skill' },
        },
        required: ['name', 'slug', 'description', 'instructions'],
      },
    },
    {
      name: 'create_workflow',
      description: 'Create a new workflow in JVOS. Workflows are multi-step processes invoked with @slug.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name of the workflow' },
          slug: { type: 'string', description: 'Unique slug (lowercase, hyphens). User invokes with @slug' },
          description: { type: 'string', description: 'Short description of the workflow' },
          instructions: { type: 'string', description: 'Full step-by-step instructions for the workflow' },
        },
        required: ['name', 'slug', 'description', 'instructions'],
      },
    },
    {
      name: 'create_automation',
      description: 'Create a scheduled automation in JVOS. Automations run skills or prompts at specified times.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the automation' },
          description: { type: 'string', description: 'What this automation does' },
          schedule_type: { type: 'string', enum: ['once', 'schedule', 'interval', 'cron'], description: 'Type of schedule' },
          schedule_time: { type: 'string', description: 'Time in HH:MM format (for schedule type)' },
          schedule_days: { type: 'string', description: 'JSON array of day indices [0-6] where 0=Sunday' },
          action_type: { type: 'string', enum: ['new_session', 'send_message', 'run_skill'], description: 'What action to perform' },
          skill_slug: { type: 'string', description: 'Skill slug to run (if action_type is run_skill)' },
          prompt: { type: 'string', description: 'Prompt to send (if action_type is send_message)' },
        },
        required: ['name', 'schedule_type', 'action_type'],
      },
    },
    {
      name: 'add_mcp_server',
      description: 'Register a new MCP (Model Context Protocol) server connection in JVOS. Supports stdio, SSE, and HTTP transports.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name for the server' },
          transport: { type: 'string', enum: ['stdio', 'sse', 'http'], description: 'Transport type' },
          command: { type: 'string', description: 'Command to run (for stdio transport). E.g. "npx -y @modelcontextprotocol/server-filesystem"' },
          args: { type: 'string', description: 'JSON array of args for the command (for stdio)' },
          url: { type: 'string', description: 'URL endpoint (for sse/http transport)' },
          env: { type: 'string', description: 'JSON object of environment variables to pass' },
        },
        required: ['name', 'transport'],
      },
    },
    {
      name: 'list_skills',
      description: 'List all skills registered in JVOS.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'list_workflows',
      description: 'List all workflows registered in JVOS.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'list_automations',
      description: 'List all automations registered in JVOS with their schedule and status.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'save_memory',
      description: 'Save a piece of information to workspace memory for future reference.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The information to remember' },
          category: { type: 'string', description: 'Category: general, preference, project, contact, decision' },
        },
        required: ['content'],
      },
    },
    {
      name: 'create_action_flow',
      description: 'Create an automated workflow that executes WITHOUT using AI tokens. Use for repetitive tasks: send emails, update sheets, ping URLs, run commands, etc. The flow runs on schedule or triggered by events.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short name for the flow' },
          description: { type: 'string', description: 'What this flow does' },
          trigger: { type: 'object', description: '{"type": "schedule|manual|listener|event", "config": {...}}' },
          nodes: { type: 'array', description: 'Array of action nodes. Types: http_request, send_email, send_slack, read_sheet, update_sheet, calendar_read, calendar_create, create_file, read_file, run_command, ping_url, condition, loop, delay, set_variable, transform_data, notify, save_memory', items: { type: 'object', properties: { id: { type: 'string', description: 'Unique node ID' }, type: { type: 'string', description: 'Action type' }, config: { type: 'object', description: 'Node configuration' }, next: { type: 'string', description: 'Next node ID' } }, required: ['id', 'type', 'config'] } },
        },
        required: ['name', 'nodes'],
      },
    },
    {
      name: 'execute_action_flow',
      description: 'Run an existing action flow immediately by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          flow_id: { type: 'string', description: 'The flow ID to execute' },
          data: { type: 'object', description: 'Optional trigger data to pass to the flow' },
        },
        required: ['flow_id'],
      },
    },
    {
      name: 'list_action_flows',
      description: 'List all action flows (automated workflows) with their status and last run info.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'create_listener',
      description: 'Create a listener that monitors an external source and triggers actions when something changes. Zero tokens for monitoring. Types: gmail (new emails), calendar (upcoming events), sheets (data changes), uptime (site monitoring), slack (new messages).',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'gmail | calendar | sheets | uptime | slack' },
          name: { type: 'string', description: 'Descriptive name for this listener' },
          config: { type: 'object', description: 'Type-specific config. gmail: {query}. calendar: {calendarId, lookAheadMinutes}. sheets: {spreadsheetId, range}. uptime: {urls: [], slowThreshold}. slack: {channels: []}.' },
          interval: { type: 'number', description: 'Check interval in ms (default varies by type)' },
        },
        required: ['type', 'name', 'config'],
      },
    },
    {
      name: 'list_listeners',
      description: 'List all active listeners monitoring external sources.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
  ];
}

export async function executeBuiltinTool(name: string, args: Record<string, any>): Promise<string> {
  ensureDocumentsRoot();

  switch (name) {
    case 'read_file': {
      const filePath = resolvePath(args.path);
      if (!fs.existsSync(filePath)) return `Error: File not found: ${filePath}`;
      const stat = fs.statSync(filePath);
      if (stat.size > 1024 * 1024) return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max 1MB.`;
      return fs.readFileSync(filePath, 'utf-8');
    }

    case 'write_file': {
      const filePath = resolvePath(args.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, args.content, 'utf-8');
      return `File written successfully: ${filePath}`;
    }

    case 'list_directory': {
      const dirPath = args.path ? resolvePath(args.path) : DOCUMENTS_ROOT;
      if (!fs.existsSync(dirPath)) return `Error: Directory not found: ${dirPath}`;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const items = entries.map((e) => {
        const suffix = e.isDirectory() ? '/' : '';
        const size = e.isFile() ? ` (${formatSize(fs.statSync(path.join(dirPath, e.name)).size)})` : '';
        return `${e.name}${suffix}${size}`;
      });
      return `Directory: ${dirPath}\n\n${items.join('\n') || '(empty)'}`;
    }

    case 'create_directory': {
      const dirPath = resolvePath(args.path);
      fs.mkdirSync(dirPath, { recursive: true });
      return `Directory created: ${dirPath}`;
    }

    case 'run_command': {
      const cwd = args.cwd ? resolvePath(args.cwd) : DOCUMENTS_ROOT;
      return new Promise((resolve) => {
        exec(args.command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
          let result = '';
          if (stdout) result += stdout;
          if (stderr) result += (result ? '\n' : '') + `STDERR: ${stderr}`;
          if (error && !stdout && !stderr) result = `Error: ${error.message}`;
          resolve(result.slice(0, 10000) || '(no output)');
        });
      });
    }

    case 'open_browser': {
      await openBrowserUrl(args.url);
      await new Promise((r) => setTimeout(r, 3000));
      const title = await getBrowserTitle();
      const text = await getBrowserText();
      return `Opened: ${args.url}\nTitle: ${title}\n\n${text || '(page loading...)'}`;
    }

    case 'search_web': {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
      try {
        const { net } = require('electron');
        const response = await net.fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        const html = await response.text();
        const results: string[] = [];
        const regex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)<\/a>/g;
        let match;
        let count = 0;
        while ((match = regex.exec(html)) && count < 8) {
          const url = match[1];
          const title = match[2].replace(/<[^>]+>/g, '');
          results.push(`${count + 1}. ${title}\n   ${url}`);
          count++;
        }
        return results.length > 0 ? results.join('\n\n') : 'No results found.';
      } catch (err) {
        return `Search error: ${(err as Error).message}`;
      }
    }

    case 'browser_click': {
      const { getBrowserView } = require('./browser');
      const view = getBrowserView();
      if (!view) return 'Error: Browser not open';
      const target: string = args.target;
      try {
        let code: string;
        if (target.startsWith('text:')) {
          const text = target.slice(5).trim();
          code = `
            (function() {
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
              let node;
              while (node = walker.nextNode()) {
                if (node.offsetParent !== null && node.textContent.trim() === ${JSON.stringify(text)}) {
                  node.click();
                  return 'Clicked: ' + node.tagName + ' "' + node.textContent.trim().slice(0, 50) + '"';
                }
              }
              // Try partial match
              const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
              while (node = walker2.nextNode()) {
                if (node.offsetParent !== null && node.textContent.trim().includes(${JSON.stringify(text)}) && node.children.length === 0) {
                  node.click();
                  return 'Clicked (partial): ' + node.tagName + ' "' + node.textContent.trim().slice(0, 50) + '"';
                }
              }
              return 'Error: No element found with text "' + ${JSON.stringify(text)} + '"';
            })()
          `;
        } else {
          code = `
            (function() {
              const el = document.querySelector(${JSON.stringify(target)});
              if (!el) return 'Error: No element found for selector "${target}"';
              el.click();
              return 'Clicked: ' + el.tagName + ' "' + (el.textContent || '').trim().slice(0, 50) + '"';
            })()
          `;
        }
        const result = await view.webContents.executeJavaScript(code);
        return result;
      } catch (err) {
        return `Error clicking: ${(err as Error).message}`;
      }
    }

    case 'browser_type': {
      const { getBrowserView } = require('./browser');
      const view = getBrowserView();
      if (!view) return 'Error: Browser not open';
      try {
        const selector = args.selector;
        const text = args.text;
        let code: string;
        if (selector) {
          code = `
            (function() {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return 'Error: Element not found';
              el.focus();
              el.value = ${JSON.stringify(text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return 'Typed into ' + el.tagName + '[' + (el.id || el.className || '') + ']';
            })()
          `;
        } else {
          code = `
            (function() {
              const el = document.activeElement;
              if (!el || el === document.body) return 'Error: No element focused';
              el.value = ${JSON.stringify(text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return 'Typed into ' + el.tagName;
            })()
          `;
        }
        const result = await view.webContents.executeJavaScript(code);
        return result;
      } catch (err) {
        return `Error typing: ${(err as Error).message}`;
      }
    }

    case 'browser_get_elements': {
      const { getBrowserView } = require('./browser');
      const view = getBrowserView();
      if (!view) return 'Error: Browser not open';
      try {
        const filter = args.filter || '';
        const code = `
          (function() {
            const els = document.querySelectorAll('a, button, input, select, textarea, [onclick], [role="button"], [role="link"], [role="tab"], [role="menuitem"]');
            const results = [];
            for (let i = 0; i < els.length && results.length < 50; i++) {
              const el = els[i];
              if (el.offsetParent === null) continue;
              const text = (el.textContent || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim().slice(0, 60);
              if (!text) continue;
              const filterStr = ${JSON.stringify(filter)};
              if (filterStr && !text.toLowerCase().includes(filterStr.toLowerCase())) continue;
              const tag = el.tagName.toLowerCase();
              const id = el.id ? '#' + el.id : '';
              const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '';
              results.push(tag + id + cls + ' → "' + text + '"');
            }
            return results.join('\\n') || '(no interactive elements found)';
          })()
        `;
        const result = await view.webContents.executeJavaScript(code);
        return result;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    }

    case 'create_skill': {
      const db = getDb();
      if (!db) return 'Error: Database not initialized';
      const id = `skill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run('INSERT INTO skills (id, name, slug, description, instructions) VALUES (?, ?, ?, ?, ?)',
        [id, args.name, args.slug, args.description, args.instructions]);
      saveDb();
      return `Skill criada com sucesso!\n\nNome: ${args.name}\nSlug: /${args.slug}\nDescrição: ${args.description}\n\nO usuário já pode invocar com /${args.slug} no chat.`;
    }

    case 'create_workflow': {
      const db = getDb();
      if (!db) return 'Error: Database not initialized';
      const id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run('INSERT INTO workflows (id, name, slug, description, instructions) VALUES (?, ?, ?, ?, ?)',
        [id, args.name, args.slug, args.description, args.instructions]);
      saveDb();
      return `Workflow criado com sucesso!\n\nNome: ${args.name}\nSlug: @${args.slug}\nDescrição: ${args.description}\n\nO usuário já pode invocar com @${args.slug} no chat.`;
    }

    case 'create_automation': {
      const db = getDb();
      if (!db) return 'Error: Database not initialized';
      const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run(`INSERT INTO automations (id, name, description, schedule, sources, action_type, skill_slug, prompt, schedule_type, schedule_days, schedule_time)
              VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)`,
        [id, args.name, args.description || '', args.schedule_type === 'cron' ? (args.cron || '') : '',
         args.action_type, args.skill_slug || '', args.prompt || '',
         args.schedule_type, args.schedule_days || '[]', args.schedule_time || '08:00']);
      saveDb();
      return `Automação criada com sucesso!\n\nNome: ${args.name}\nTipo: ${args.schedule_type}\nAção: ${args.action_type}\nHorário: ${args.schedule_time || 'N/A'}\n\nA automação está desativada por padrão. O usuário pode ativá-la na página de Automações.`;
    }

    case 'add_mcp_server': {
      const config: any = { transport: args.transport };
      if (args.command) config.command = args.command;
      if (args.args) { try { config.args = JSON.parse(args.args); } catch { config.args = []; } }
      if (args.url) config.url = args.url;
      if (args.env) { try { config.env = JSON.parse(args.env); } catch { config.env = {}; } }
      const db = getDb();
      if (!db) return 'Error: Database not initialized';
      const id = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run('INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)',
        [id, args.name, 'mcp', JSON.stringify(config)]);
      saveDb();
      return `MCP Server registrado!\n\nNome: ${args.name}\nTransporte: ${args.transport}\n${args.command ? `Comando: ${args.command}` : `URL: ${args.url}`}\n\nPara conectar, vá em Configurações > MCP Servers e clique em Conectar.`;
    }

    case 'list_skills': {
      const db = getDb();
      if (!db) return 'Nenhuma skill cadastrada.';
      const rows = db.exec('SELECT name, slug, description FROM skills ORDER BY name');
      if (!rows.length || !rows[0].values.length) return 'Nenhuma skill cadastrada.';
      return rows[0].values.map((r: any[]) => `• /${r[1]} — ${r[0]}: ${r[2]}`).join('\n');
    }

    case 'list_workflows': {
      const db = getDb();
      if (!db) return 'Nenhum workflow cadastrado.';
      const rows = db.exec('SELECT name, slug, description FROM workflows ORDER BY name');
      if (!rows.length || !rows[0].values.length) return 'Nenhum workflow cadastrado.';
      return rows[0].values.map((r: any[]) => `• @${r[1]} — ${r[0]}: ${r[2]}`).join('\n');
    }

    case 'list_automations': {
      const db = getDb();
      if (!db) return 'Nenhuma automação cadastrada.';
      const rows = db.exec('SELECT name, schedule_type, schedule_time, action_type, enabled FROM automations ORDER BY created_at DESC');
      if (!rows.length || !rows[0].values.length) return 'Nenhuma automação cadastrada.';
      return rows[0].values.map((r: any[]) => `• ${r[0]} [${r[1]} ${r[2]}] → ${r[3]} ${r[4] ? '✓' : '○'}`).join('\n');
    }

    case 'save_memory': {
      const db = getDb();
      if (!db) return 'Error: Database not initialized';
      const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run('INSERT INTO memories (id, content, category) VALUES (?, ?, ?)',
        [id, args.content, args.category || 'general']);
      saveDb();
      return `Memória salva: "${args.content.slice(0, 80)}${args.content.length > 80 ? '...' : ''}" [${args.category || 'general'}]`;
    }

    case 'create_action_flow': {
      const { createFlow } = require('./actions-engine') as typeof import('./actions-engine');
      const flowId = createFlow({
        name: args.name,
        description: args.description || '',
        trigger: args.trigger || { type: 'manual', config: {} },
        nodes: args.nodes || [],
        enabled: true,
      });
      return `✅ Flow "${args.name}" criado (ID: ${flowId}). ${args.trigger?.type === 'manual' ? 'Execute manualmente ou conecte a um listener.' : `Trigger: ${args.trigger?.type}`}`;
    }

    case 'execute_action_flow': {
      const { executeFlow, getFlow } = require('./actions-engine') as any;
      const flow = getFlow(args.flow_id);
      if (!flow) return `Error: Flow not found: ${args.flow_id}`;
      const log = await executeFlow(flow, args.data);
      if (log.status === 'error') return `❌ Flow falhou: ${log.error}`;
      return `✅ Flow "${flow.name}" executado com sucesso. ${log.nodesExecuted} nodes processados. Tokens usados: 0.`;
    }

    case 'list_action_flows': {
      const { getFlows } = require('./actions-engine') as any;
      const flows = getFlows();
      if (!flows.length) return 'Nenhum action flow criado ainda. Use create_action_flow para criar.';
      return flows.map((f: any) => `• ${f.name} [${f.enabled ? '✅ ativo' : '⏸ pausado'}] — Trigger: ${f.trigger.type} — Runs: ${f.runCount}${f.lastRun ? ` — Último: ${f.lastRun}` : ''}`).join('\n');
    }

    case 'create_listener': {
      const db = getDb();
      if (!db) return 'Error: Database not initialized';
      const id = `lst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const intervalDefaults: Record<string, number> = { gmail: 60000, calendar: 300000, sheets: 120000, uptime: 300000, slack: 30000 };
      const interval = args.interval || intervalDefaults[args.type] || 60000;
      db.run('INSERT INTO listeners (id, type, name, config, enabled, interval_ms) VALUES (?, ?, ?, ?, 1, ?)',
        [id, args.type, args.name, JSON.stringify(args.config), interval]);
      saveDb();
      return `✅ Listener "${args.name}" criado e ativo (ID: ${id}). Monitorando ${args.type} a cada ${Math.round(interval / 1000)}s. Zero tokens por verificação.`;
    }

    case 'list_listeners': {
      const db = getDb();
      if (!db) return 'Nenhum listener ativo.';
      const rows = db.exec('SELECT id, type, name, enabled, interval_ms, last_check FROM listeners ORDER BY created_at DESC');
      if (!rows.length || !rows[0].values.length) return 'Nenhum listener ativo. Use create_listener para criar.';
      return rows[0].values.map((r: any[]) => `• ${r[2]} [${r[1]}] ${r[3] ? '✅' : '⏸'} — A cada ${Math.round(r[4] / 1000)}s${r[5] ? ` — Último check: ${r[5]}` : ''}`).join('\n');
    }

    default:
      return `Error: Unknown tool "${name}"`;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function registerToolHandlers() {
  ipcMain.handle('tools:list-builtin', () => getBuiltinTools());
  ipcMain.handle('tools:execute', async (_event, name: string, args: any) => {
    return await executeBuiltinTool(name, args);
  });
  ipcMain.handle('tools:get-documents-path', () => DOCUMENTS_ROOT);
}
