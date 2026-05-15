import { ipcMain, BrowserWindow } from 'electron';
import { getStoredKey } from './providers';
import { getBuiltinTools, executeBuiltinTool } from './tools';
import { getSetting } from './database';
import { getOpenAIAccessToken } from './openai-oauth';
import OpenAI from 'openai';

// --- Types ---

export type AgentTier = 'router' | 'fast' | 'balanced' | 'power';
export type AgentRole = 'router' | 'summarizer' | 'writer' | 'coder' | 'researcher' | 'analyst' | 'executor' | 'custom';

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  tier: AgentTier;
  model: string;
  systemPrompt: string;
  tools: string[]; // 'all' | 'none' | specific tool names
  maxIterations: number;
  temperature?: number;
  description?: string;
  enabled: boolean;
}

export interface AgentTask {
  id: string;
  parentTaskId?: string;
  agentId: string;
  input: string;
  context?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  tokenUsage?: { input: number; output: number };
  startedAt?: string;
  completedAt?: string;
}

interface RouterDecision {
  agentId: string;
  reasoning: string;
  subtasks?: Array<{ agentId: string; input: string }>;
}

// --- Default Agent Hierarchy ---

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'router',
    name: 'Router',
    role: 'router',
    tier: 'fast',
    model: 'gpt-4.1-nano',
    systemPrompt: `You are a task router. Analyze the user's request and decide which agent should handle it.

Available agents:
- summarizer: Summarize text, extract key points, TL;DR. Fast, low-cost.
- writer: Write emails, reports, documents, creative text. Balanced.
- coder: Write code, debug, refactor, explain code. Power tier.
- researcher: Search the web, find information, compile research. Balanced.
- analyst: Analyze data, calculate metrics, interpret numbers. Power tier.
- executor: Run commands, manage files, automate tasks. Balanced.

Respond ONLY with JSON:
{"agentId": "agent_name", "reasoning": "brief explanation", "subtasks": []}

If the task needs multiple agents, use subtasks:
{"agentId": "orchestrator", "reasoning": "...", "subtasks": [{"agentId": "researcher", "input": "..."}, {"agentId": "writer", "input": "..."}]}

For simple greetings or clarification questions, respond:
{"agentId": "direct", "reasoning": "simple response, no agent needed"}`,
    tools: [],
    maxIterations: 1,
    temperature: 0,
    description: 'Analisa a tarefa e roteia para o agente correto',
    enabled: true,
  },
  {
    id: 'summarizer',
    name: 'Summarizer',
    role: 'summarizer',
    tier: 'fast',
    model: 'gpt-4.1-nano',
    systemPrompt: 'You are a concise summarizer. Extract key points, create TL;DRs, and condense information. Be brief and accurate. Respond in the same language as the input.',
    tools: [],
    maxIterations: 1,
    temperature: 0.3,
    description: 'Resumos, extração de pontos-chave, TL;DR',
    enabled: true,
  },
  {
    id: 'writer',
    name: 'Writer',
    role: 'writer',
    tier: 'balanced',
    model: 'gpt-4.1-mini',
    systemPrompt: 'You are a professional writer. Create clear, well-structured content adapted to the requested tone and format. Respond in the same language as the input.',
    tools: ['write_file'],
    maxIterations: 3,
    temperature: 0.7,
    description: 'Emails, relatórios, documentos, texto criativo',
    enabled: true,
  },
  {
    id: 'coder',
    name: 'Coder',
    role: 'coder',
    tier: 'power',
    model: 'codex-mini-latest',
    systemPrompt: 'You are an expert software engineer. Write clean, efficient, well-structured code. Use tools to read existing files before modifying them. Always explain your approach briefly.',
    tools: ['all'],
    maxIterations: 10,
    temperature: 0.2,
    description: 'Código, debugging, refatoração, explicação técnica',
    enabled: true,
  },
  {
    id: 'researcher',
    name: 'Researcher',
    role: 'researcher',
    tier: 'balanced',
    model: 'gpt-4.1-mini',
    systemPrompt: 'You are a research assistant. Search the web, find relevant information, and compile structured findings. Always cite sources. Respond in the same language as the input.',
    tools: ['search_web', 'open_browser'],
    maxIterations: 5,
    temperature: 0.3,
    description: 'Pesquisa web, coleta de informações, compilação',
    enabled: true,
  },
  {
    id: 'analyst',
    name: 'Analyst',
    role: 'analyst',
    tier: 'power',
    model: 'gpt-4.1',
    systemPrompt: 'You are a data analyst. Analyze numbers, calculate metrics, identify trends, and provide actionable insights. Show your work with calculations. Respond in the same language as the input.',
    tools: ['read_file', 'run_command'],
    maxIterations: 5,
    temperature: 0.1,
    description: 'Análise de dados, métricas, tendências, insights',
    enabled: true,
  },
  {
    id: 'executor',
    name: 'Executor',
    role: 'executor',
    tier: 'balanced',
    model: 'gpt-4.1-mini',
    systemPrompt: 'You are a task executor. Run commands, manage files, and automate operations. Be careful with destructive operations — confirm before deleting. Report results clearly.',
    tools: ['all'],
    maxIterations: 8,
    temperature: 0.1,
    description: 'Comandos, arquivos, automação de tarefas',
    enabled: true,
  },
];

// --- Tier Cost Multipliers (relative) ---
const TIER_COSTS: Record<AgentTier, number> = {
  router: 0.1,
  fast: 0.2,
  balanced: 1.0,
  power: 5.0,
};

// --- Agent State ---
let agents: AgentConfig[] = [...DEFAULT_AGENTS];
let taskHistory: AgentTask[] = [];
let routingEnabled = true;

// --- Core Functions ---

function getAgents(): AgentConfig[] {
  return agents.filter(a => a.enabled);
}

function getAgent(id: string): AgentConfig | undefined {
  return agents.find(a => a.id === id);
}

function getToolsForAgent(agent: AgentConfig, allTools: any[]): any[] {
  if (agent.tools.length === 0) return [];
  if (agent.tools.includes('all')) return allTools;
  return allTools.filter(t => agent.tools.includes(t.name));
}

async function routeTask(userMessage: string): Promise<RouterDecision> {
  const router = getAgent('router');
  if (!router || !routingEnabled) {
    return { agentId: 'direct', reasoning: 'routing disabled' };
  }

  try {
    const result = await callAgentOnce(router, userMessage);
    const parsed = JSON.parse(result);
    return parsed as RouterDecision;
  } catch {
    return { agentId: 'direct', reasoning: 'router parse error, falling back to direct' };
  }
}

async function callAgentOnce(agent: AgentConfig, input: string): Promise<string> {
  const model = agent.model;
  const messages = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: input },
  ];

  const providerId = resolveProviderForModel(model);
  const apiKey = getStoredKey(providerId);
  if (!apiKey && providerId === 'openai') {
    const oauthToken = getOpenAIAccessToken();
    if (oauthToken) {
      const client = new OpenAI({
        apiKey: oauthToken,
        baseURL: 'https://chatgpt.com/backend-api/codex',
        defaultHeaders: { 'x-codex-client-version': '0.1.0' },
      });
      const response = await (client as any).responses.create({
        model: 'gpt-5.5',
        input: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
        store: false,
      });
      return response.output_text || '';
    }
  }
  if (!apiKey) throw new Error(`No API key for ${providerId}`);

  if (providerId === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 4096, system: agent.systemPrompt, messages: [{ role: 'user', content: input }] }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  if (providerId === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${agent.systemPrompt}\n\n${input}` }] }] }),
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // OpenAI / OpenRouter
  const config: any = { apiKey };
  if (providerId === 'openrouter') config.baseURL = 'https://openrouter.ai/api/v1';
  const client = new OpenAI(config);

  const isResponses = ['codex-mini-latest', 'o3-mini', 'o4-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'].some(m => model.startsWith(m));
  if (isResponses) {
    const response = await (client as any).responses.create({
      model,
      input: messages.map(m => ({ role: m.role === 'system' ? 'developer' : m.role, content: m.content })),
      temperature: agent.temperature,
    });
    return response.output_text || '';
  }

  const response = await client.chat.completions.create({
    model,
    messages: messages as any,
    temperature: agent.temperature,
  });
  return response.choices[0]?.message?.content || '';
}

function resolveProviderForModel(model: string): string {
  if (model.includes('/')) return 'openrouter';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gemini')) return 'google';
  return 'openai';
}

// --- IPC Handlers ---

export function registerAgentHandlers() {
  ipcMain.handle('agents:list', () => {
    return agents.map(a => ({
      ...a,
      tierCost: TIER_COSTS[a.tier],
    }));
  });

  ipcMain.handle('agents:get', (_event, id: string) => {
    return getAgent(id);
  });

  ipcMain.handle('agents:update', (_event, id: string, updates: Partial<AgentConfig>) => {
    const idx = agents.findIndex(a => a.id === id);
    if (idx < 0) return { error: 'Agent not found' };
    agents[idx] = { ...agents[idx], ...updates };
    return { success: true };
  });

  ipcMain.handle('agents:add', (_event, config: AgentConfig) => {
    if (agents.find(a => a.id === config.id)) return { error: 'Agent ID already exists' };
    agents.push(config);
    return { success: true };
  });

  ipcMain.handle('agents:remove', (_event, id: string) => {
    if (DEFAULT_AGENTS.find(a => a.id === id)) return { error: 'Cannot remove default agent' };
    agents = agents.filter(a => a.id !== id);
    return { success: true };
  });

  ipcMain.handle('agents:reset', () => {
    agents = [...DEFAULT_AGENTS];
    return { success: true };
  });

  ipcMain.handle('agents:route', async (_event, message: string) => {
    try {
      const decision = await routeTask(message);
      return decision;
    } catch (err: any) {
      return { agentId: 'direct', reasoning: err.message };
    }
  });

  ipcMain.handle('agents:execute', async (_event, agentId: string, input: string, streamToWindow?: boolean) => {
    const agent = getAgent(agentId);
    if (!agent) return { error: `Agent '${agentId}' not found` };

    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      input,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    taskHistory.push(task);

    const win = streamToWindow ? BrowserWindow.getFocusedWindow() : null;

    try {
      if (agent.maxIterations <= 1 || agent.tools.length === 0) {
        // Simple call — no tool loop needed
        const result = await callAgentOnce(agent, input);
        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date().toISOString();
        if (win) {
          win.webContents.send('agent:result', { taskId: task.id, agentId, result });
        }
        return { taskId: task.id, result };
      }

      // Full streaming with tool loop — delegate to llm:stream pattern
      // This is for agents that need tool access
      const result = await executeAgentWithTools(agent, input, win);
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date().toISOString();
      return { taskId: task.id, result };
    } catch (err: any) {
      task.status = 'failed';
      task.result = err.message;
      task.completedAt = new Date().toISOString();
      return { error: err.message, taskId: task.id };
    }
  });

  ipcMain.handle('agents:run-pipeline', async (_event, message: string) => {
    const win = BrowserWindow.getFocusedWindow();

    // Step 1: Route
    if (win) win.webContents.send('agent:routing', { message });
    const decision = await routeTask(message);

    if (decision.agentId === 'direct') {
      return { type: 'direct', reasoning: decision.reasoning };
    }

    // Step 2: Execute (single agent or multi-agent pipeline)
    if (decision.subtasks && decision.subtasks.length > 0) {
      if (win) win.webContents.send('agent:pipeline-start', { subtasks: decision.subtasks });

      const results: Array<{ agentId: string; result: string }> = [];
      for (const subtask of decision.subtasks) {
        const agent = getAgent(subtask.agentId);
        if (!agent) continue;
        if (win) win.webContents.send('agent:subtask-start', { agentId: subtask.agentId, input: subtask.input });
        const result = await executeAgentWithTools(agent, subtask.input, null);
        results.push({ agentId: subtask.agentId, result });
        if (win) win.webContents.send('agent:subtask-complete', { agentId: subtask.agentId, result });
      }

      return { type: 'pipeline', decision, results };
    }

    // Single agent execution
    const agent = getAgent(decision.agentId);
    if (!agent) {
      return { type: 'direct', reasoning: `Agent ${decision.agentId} not found` };
    }

    if (win) win.webContents.send('agent:executing', { agentId: decision.agentId, reasoning: decision.reasoning });

    const result = await executeAgentWithTools(agent, message, win);
    return { type: 'agent', agentId: decision.agentId, reasoning: decision.reasoning, result };
  });

  ipcMain.handle('agents:get-history', () => {
    return taskHistory.slice(-50);
  });

  ipcMain.handle('agents:clear-history', () => {
    taskHistory = [];
    return { success: true };
  });

  ipcMain.handle('agents:set-routing', (_event, enabled: boolean) => {
    routingEnabled = enabled;
    return { success: true, routingEnabled };
  });

  ipcMain.handle('agents:get-routing', () => {
    return { routingEnabled };
  });

  ipcMain.handle('agents:get-tiers', () => {
    return {
      tiers: [
        { id: 'router', name: 'Router', cost: 0.1, description: 'Apenas classifica a tarefa' },
        { id: 'fast', name: 'Fast', cost: 0.2, description: 'Tarefas simples — resumos, formatação, extração' },
        { id: 'balanced', name: 'Balanced', cost: 1.0, description: 'Tarefas médias — escrita, pesquisa, automação' },
        { id: 'power', name: 'Power', cost: 5.0, description: 'Tarefas complexas — código, análise, raciocínio' },
      ],
      models: {
        fast: ['gpt-4.1-nano', 'claude-haiku-4-5', 'gemini-2.5-flash'],
        balanced: ['gpt-4.1-mini', 'claude-sonnet-4-6', 'gemini-2.5-flash'],
        power: ['gpt-4.1', 'codex-mini-latest', 'claude-opus-4-7', 'gemini-2.5-pro', 'o4-mini'],
      },
    };
  });
}

// --- Agent Execution with Tool Loop ---

async function executeAgentWithTools(agent: AgentConfig, input: string, win: BrowserWindow | null): Promise<string> {
  const model = agent.model;
  const providerId = resolveProviderForModel(model);
  const builtinTools = getBuiltinTools();
  const agentTools = getToolsForAgent(agent, builtinTools);

  const apiKey = getStoredKey(providerId);
  let oauthMode = false;

  if (!apiKey && providerId === 'openai') {
    const oauthToken = getOpenAIAccessToken();
    if (!oauthToken) throw new Error(`No API key for ${providerId}`);
    oauthMode = true;
  } else if (!apiKey) {
    throw new Error(`No API key for ${providerId}`);
  }

  // Anthropic with tools
  if (providerId === 'anthropic') {
    return await executeAnthropicAgent(agent, input, agentTools, win);
  }

  // Google with tools
  if (providerId === 'google') {
    return await executeGoogleAgent(agent, input, agentTools, win);
  }

  // OpenAI / OpenRouter with tools
  return await executeOpenAIAgent(agent, input, agentTools, win, oauthMode);
}

async function executeOpenAIAgent(agent: AgentConfig, input: string, tools: any[], win: BrowserWindow | null, oauthMode: boolean): Promise<string> {
  let client: OpenAI;

  if (oauthMode) {
    const oauthToken = getOpenAIAccessToken()!;
    client = new OpenAI({
      apiKey: oauthToken,
      baseURL: 'https://chatgpt.com/backend-api/codex',
      defaultHeaders: { 'x-codex-client-version': '0.1.0' },
    });
  } else {
    const apiKey = getStoredKey(resolveProviderForModel(agent.model))!;
    const config: any = { apiKey };
    if (agent.model.includes('/')) config.baseURL = 'https://openrouter.ai/api/v1';
    client = new OpenAI(config);
  }

  const isResponses = ['codex-mini-latest', 'o3-mini', 'o4-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'].some(m => agent.model.startsWith(m)) || oauthMode;
  const effectiveModel = oauthMode ? 'gpt-5.5' : agent.model;

  if (isResponses) {
    let inputArr: any[] = [
      { role: 'user', content: `${agent.systemPrompt}\n\n${input}` },
    ];

    let fullText = '';

    for (let i = 0; i < agent.maxIterations; i++) {
      const params: any = { model: effectiveModel, input: inputArr, stream: false };
      if (oauthMode) { params.store = false; }
      if (tools.length > 0) {
        params.tools = tools.map(t => ({
          type: 'function', name: t.name, description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
        }));
      }

      const response = await (client as any).responses.create(params);

      // Extract text
      const text = response.output_text || '';
      fullText += text;
      if (win && text) win.webContents.send('llm:stream-chunk', text);

      // Check for tool calls
      const functionCalls = (response.output || []).filter((o: any) => o.type === 'function_call');
      if (functionCalls.length === 0) break;

      for (const fc of functionCalls) {
        let args: any = {};
        try { args = JSON.parse(fc.arguments || '{}'); } catch {}
        if (win) win.webContents.send('llm:tool-call', { name: fc.name, arguments: fc.arguments, call_id: fc.call_id });
        const result = await executeBuiltinTool(fc.name, args);
        inputArr.push({ type: 'function_call', call_id: fc.call_id, name: fc.name, arguments: fc.arguments });
        inputArr.push({ type: 'function_call_output', call_id: fc.call_id, output: result.slice(0, 20000) });
      }
    }

    if (win) win.webContents.send('llm:stream-end');
    return fullText;
  }

  // Chat completions path
  let messages: any[] = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: input },
  ];
  let fullText = '';

  for (let i = 0; i < agent.maxIterations; i++) {
    const params: any = { model: effectiveModel, messages };
    if (tools.length > 0) {
      params.tools = tools.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }));
    }

    const response = await client.chat.completions.create(params);
    const choice = response.choices[0];
    const content = choice?.message?.content || '';
    fullText += content;
    if (win && content) win.webContents.send('llm:stream-chunk', content);

    const toolCalls = choice?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) break;

    messages.push(choice.message);
    for (const tc of toolCalls) {
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      if (win) win.webContents.send('llm:tool-call', { name: tc.function.name, arguments: tc.function.arguments, call_id: tc.id });
      const result = await executeBuiltinTool(tc.function.name, args);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result.slice(0, 20000) });
    }
  }

  if (win) win.webContents.send('llm:stream-end');
  return fullText;
}

async function executeAnthropicAgent(agent: AgentConfig, input: string, tools: any[], win: BrowserWindow | null): Promise<string> {
  const apiKey = getStoredKey('anthropic')!;
  let messages: any[] = [{ role: 'user', content: input }];
  let fullText = '';

  for (let i = 0; i < agent.maxIterations; i++) {
    const body: any = {
      model: agent.model,
      max_tokens: 16000,
      system: agent.systemPrompt,
      messages,
    };
    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name, description: t.description || '',
        input_schema: t.inputSchema || { type: 'object', properties: {} },
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    const textBlocks = (data.content || []).filter((c: any) => c.type === 'text');
    const toolBlocks = (data.content || []).filter((c: any) => c.type === 'tool_use');

    const text = textBlocks.map((c: any) => c.text).join('');
    fullText += text;
    if (win && text) win.webContents.send('llm:stream-chunk', text);

    if (toolBlocks.length === 0) break;

    messages.push({ role: 'assistant', content: data.content });
    const toolResults: any[] = [];
    for (const tu of toolBlocks) {
      if (win) win.webContents.send('llm:tool-call', { name: tu.name, arguments: JSON.stringify(tu.input), call_id: tu.id });
      const result = await executeBuiltinTool(tu.name, tu.input);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result.slice(0, 20000) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (win) win.webContents.send('llm:stream-end');
  return fullText;
}

async function executeGoogleAgent(agent: AgentConfig, input: string, tools: any[], win: BrowserWindow | null): Promise<string> {
  const apiKey = getStoredKey('google')!;
  let contents: any[] = [{ role: 'user', parts: [{ text: `${agent.systemPrompt}\n\n${input}` }] }];
  let fullText = '';

  for (let i = 0; i < agent.maxIterations; i++) {
    const body: any = { contents, generationConfig: { maxOutputTokens: 65536 } };
    if (tools.length > 0) {
      body.tools = [{ functionDeclarations: tools.map(t => ({
        name: t.name, description: t.description || '',
        parameters: t.inputSchema || { type: 'object', properties: {} },
      })) }];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();

    const parts = data.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter((p: any) => p.text);
    const fcParts = parts.filter((p: any) => p.functionCall);

    const text = textParts.map((p: any) => p.text).join('');
    fullText += text;
    if (win && text) win.webContents.send('llm:stream-chunk', text);

    if (fcParts.length === 0) break;

    const modelParts: any[] = [...textParts.map((p: any) => ({ text: p.text }))];
    for (const fc of fcParts) modelParts.push({ functionCall: fc.functionCall });
    contents.push({ role: 'model', parts: modelParts });

    const responseParts: any[] = [];
    for (const fc of fcParts) {
      const name = fc.functionCall.name;
      const args = fc.functionCall.args || {};
      if (win) win.webContents.send('llm:tool-call', { name, arguments: JSON.stringify(args), call_id: name });
      const result = await executeBuiltinTool(name, args);
      responseParts.push({ functionResponse: { name, response: { result: result.slice(0, 20000) } } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  if (win) win.webContents.send('llm:stream-end');
  return fullText;
}
