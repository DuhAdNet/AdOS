import { app, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { openBrowserUrl, getBrowserText, getBrowserTitle } from './browser';

const DOCUMENTS_ROOT = path.join(app.getPath('documents'), 'AdOS');

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
      description: 'Read the contents of a file. Use absolute path or relative to ~/Documents/AdOS/',
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
      description: 'Write content to a file. Creates directories if needed. Use for HTML, dashboards, reports, code, etc. Relative paths go to ~/Documents/AdOS/',
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
      description: 'List files and folders in a directory. Relative paths go to ~/Documents/AdOS/',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: ~/Documents/AdOS/)' },
        },
        required: [],
      },
    },
    {
      name: 'create_directory',
      description: 'Create a directory (and parent dirs). Relative paths go to ~/Documents/AdOS/',
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
          cwd: { type: 'string', description: 'Working directory (optional, default ~/Documents/AdOS/)' },
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
