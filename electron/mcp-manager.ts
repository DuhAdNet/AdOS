import { ipcMain, app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface McpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  transport?: 'stdio' | 'sse' | 'streamable-http';
  headers?: Record<string, string>;
  enabled?: boolean;
  connectionTimeoutMs?: number;
}

interface McpTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: any;
}

interface McpSession {
  client: Client;
  transport: any;
  process?: ChildProcess;
  tools: McpTool[];
  status: 'connecting' | 'connected' | 'error' | 'disconnected';
  error?: string;
}

const sessions = new Map<string, McpSession>();
let configPath: string;

function getConfigPath(): string {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'mcp-servers.json');
  }
  return configPath;
}

function loadConfig(): McpServerConfig[] {
  try {
    const data = fs.readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveConfig(servers: McpServerConfig[]): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(servers, null, 2));
}

async function connectServer(config: McpServerConfig): Promise<McpSession> {
  const client = new Client({ name: 'jvos', version: '0.2.0' }, { capabilities: {} });

  let transport: any;
  let childProcess: ChildProcess | undefined;

  if (config.command) {
    const resolvedCommand = config.command;
    const resolvedArgs = config.args || [];
    const resolvedEnv = { ...process.env, ...(config.env || {}) };
    const resolvedCwd = config.cwd || app.getPath('userData');

    transport = new StdioClientTransport({
      command: resolvedCommand,
      args: resolvedArgs,
      env: resolvedEnv as Record<string, string>,
      cwd: resolvedCwd,
    });
  } else if (config.url) {
    const url = new URL(config.url);
    if (config.transport === 'streamable-http') {
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      });
    } else {
      transport = new SSEClientTransport(url, {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      });
    }
  } else {
    throw new Error('Server config must have either "command" or "url"');
  }

  const timeout = config.connectionTimeoutMs || 30000;

  await Promise.race([
    client.connect(transport),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), timeout)),
  ]);

  const toolsResult = await client.listTools();
  const tools: McpTool[] = (toolsResult.tools || []).map((t: any) => ({
    serverName: config.name,
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  return {
    client,
    transport,
    process: childProcess,
    tools,
    status: 'connected',
  };
}

async function disconnectServer(name: string): Promise<void> {
  const session = sessions.get(name);
  if (!session) return;

  try {
    await session.client.close();
  } catch {}

  if (session.process && !session.process.killed) {
    session.process.kill();
  }

  sessions.delete(name);
}

export function registerMcpHandlers() {
  ipcMain.handle('mcp:list-servers', () => {
    const configs = loadConfig();
    return configs.map((c) => ({
      ...c,
      status: sessions.get(c.name)?.status || 'disconnected',
      error: sessions.get(c.name)?.error,
      toolCount: sessions.get(c.name)?.tools.length || 0,
    }));
  });

  ipcMain.handle('mcp:add-server', (_event, config: McpServerConfig) => {
    const configs = loadConfig();
    const existing = configs.findIndex((c) => c.name === config.name);
    if (existing >= 0) {
      configs[existing] = config;
    } else {
      configs.push(config);
    }
    saveConfig(configs);
    return { success: true };
  });

  ipcMain.handle('mcp:remove-server', async (_event, name: string) => {
    await disconnectServer(name);
    const configs = loadConfig().filter((c) => c.name !== name);
    saveConfig(configs);
    return { success: true };
  });

  ipcMain.handle('mcp:connect-server', async (_event, name: string) => {
    const configs = loadConfig();
    const config = configs.find((c) => c.name === name);
    if (!config) return { error: `Server "${name}" not found` };

    await disconnectServer(name);

    try {
      const session = await connectServer(config);
      sessions.set(name, session);
      return {
        success: true,
        tools: session.tools,
        status: 'connected',
      };
    } catch (err: any) {
      const errorSession: McpSession = {
        client: null as any,
        transport: null,
        tools: [],
        status: 'error',
        error: err.message,
      };
      sessions.set(name, errorSession);
      return { error: err.message };
    }
  });

  ipcMain.handle('mcp:disconnect-server', async (_event, name: string) => {
    await disconnectServer(name);
    return { success: true };
  });

  ipcMain.handle('mcp:list-tools', (_event, serverName?: string) => {
    if (serverName) {
      const session = sessions.get(serverName);
      return session?.tools || [];
    }
    const allTools: McpTool[] = [];
    for (const [, session] of sessions) {
      if (session.status === 'connected') {
        allTools.push(...session.tools);
      }
    }
    return allTools;
  });

  ipcMain.handle('mcp:call-tool', async (_event, serverName: string, toolName: string, args: any) => {
    const session = sessions.get(serverName);
    if (!session || session.status !== 'connected') {
      return { error: `Server "${serverName}" not connected` };
    }

    try {
      const result = await session.client.callTool({ name: toolName, arguments: args || {} });
      return { success: true, result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('mcp:test-server', async (_event, config: McpServerConfig) => {
    try {
      const session = await connectServer(config);
      const toolCount = session.tools.length;
      await session.client.close();
      return { success: true, toolCount };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('mcp:connect-all', async () => {
    const configs = loadConfig().filter((c) => c.enabled !== false);
    const results: Record<string, { success?: boolean; error?: string }> = {};

    await Promise.allSettled(
      configs.map(async (config) => {
        try {
          const session = await connectServer(config);
          sessions.set(config.name, session);
          results[config.name] = { success: true };
        } catch (err: any) {
          sessions.set(config.name, {
            client: null as any,
            transport: null,
            tools: [],
            status: 'error',
            error: err.message,
          });
          results[config.name] = { error: err.message };
        }
      })
    );

    return results;
  });

  ipcMain.handle('mcp:get-all-tools', () => {
    const allTools: McpTool[] = [];
    for (const [, session] of sessions) {
      if (session.status === 'connected') {
        allTools.push(...session.tools);
      }
    }
    return allTools;
  });
}
