import { ipcMain, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';
  baseUrl?: string;
  apiKeyPlaceholder?: string;
  models: ModelConfig[];
  enabled?: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  providerId: string;
  api: 'chat-completions' | 'responses' | 'anthropic-messages' | 'google-generative';
  contextWindow?: number;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  description?: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { id: 'gpt-5.5', name: 'GPT-5.5', providerId: 'openai', api: 'responses', contextWindow: 1000000, maxTokens: 65536, supportsStreaming: true, supportsTools: true, description: 'Modelo mais inteligente — máxima qualidade' },
      { id: 'codex-mini-latest', name: 'Codex Mini', providerId: 'openai', api: 'responses', contextWindow: 192000, maxTokens: 100000, supportsStreaming: true, supportsTools: true, description: 'Agente de código — rápido e inteligente' },
      { id: 'o3-mini', name: 'O3 Mini', providerId: 'openai', api: 'responses', contextWindow: 200000, maxTokens: 100000, supportsStreaming: true, supportsTools: true, description: 'Raciocínio avançado' },
      { id: 'o4-mini', name: 'O4 Mini', providerId: 'openai', api: 'responses', contextWindow: 200000, maxTokens: 100000, supportsStreaming: true, supportsTools: true, description: 'Raciocínio de última geração' },
      { id: 'gpt-4.1', name: 'GPT-4.1', providerId: 'openai', api: 'responses', contextWindow: 1000000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Modelo flagship — 1M context' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', providerId: 'openai', api: 'responses', contextWindow: 1000000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Rápido e inteligente com 1M context' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', providerId: 'openai', api: 'responses', contextWindow: 1000000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Ultra-rápido, baixo custo' },
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', api: 'chat-completions', contextWindow: 128000, maxTokens: 16384, supportsStreaming: true, supportsTools: true, description: 'Multimodal versátil' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', api: 'chat-completions', contextWindow: 128000, maxTokens: 16384, supportsStreaming: true, supportsTools: true, description: 'Rápido e barato' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyPlaceholder: 'sk-ant-...',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', providerId: 'anthropic', api: 'anthropic-messages', contextWindow: 200000, maxTokens: 32000, supportsStreaming: true, supportsTools: true, description: 'Modelo mais capaz — raciocínio profundo' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', providerId: 'anthropic', api: 'anthropic-messages', contextWindow: 200000, maxTokens: 16000, supportsStreaming: true, supportsTools: true, description: 'Equilíbrio inteligência/velocidade' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', providerId: 'anthropic', api: 'anthropic-messages', contextWindow: 200000, maxTokens: 8192, supportsStreaming: true, supportsTools: true, description: 'Ultra-rápido e barato' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    type: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyPlaceholder: 'AIza...',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', providerId: 'google', api: 'google-generative', contextWindow: 1000000, maxTokens: 65536, supportsStreaming: true, supportsTools: true, description: 'Raciocínio avançado com 1M context' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', providerId: 'google', api: 'google-generative', contextWindow: 1000000, maxTokens: 65536, supportsStreaming: true, supportsTools: true, description: 'Ultra-rápido, bom custo-benefício' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'openai' as const,
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPlaceholder: 'gsk_...',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', providerId: 'groq', api: 'chat-completions' as const, contextWindow: 128000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Rápido — ideal para tarefas gerais' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-...',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', providerId: 'openrouter', api: 'chat-completions', contextWindow: 128000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Raciocínio open-source' },
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', providerId: 'openrouter', api: 'chat-completions', contextWindow: 128000, maxTokens: 32768, supportsStreaming: true, supportsTools: false, description: 'Meta — modelo aberto poderoso' },
      { id: 'mistralai/mistral-large-latest', name: 'Mistral Large', providerId: 'openrouter', api: 'chat-completions', contextWindow: 128000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Europeu — multilíngue' },
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', providerId: 'openrouter', api: 'chat-completions', contextWindow: 128000, maxTokens: 32768, supportsStreaming: true, supportsTools: true, description: 'Alibaba — grande e poderoso' },
    ],
  },
];

function getProvidersPath(): string {
  return path.join(app.getPath('userData'), 'providers.json');
}

function loadProviders(): ProviderConfig[] {
  try {
    const data = fs.readFileSync(getProvidersPath(), 'utf-8');
    const custom = JSON.parse(data) as ProviderConfig[];
    return [...DEFAULT_PROVIDERS, ...custom.filter((c) => !DEFAULT_PROVIDERS.find((d) => d.id === c.id))];
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

function saveCustomProviders(providers: ProviderConfig[]): void {
  const custom = providers.filter((p) => !DEFAULT_PROVIDERS.find((d) => d.id === p.id));
  fs.writeFileSync(getProvidersPath(), JSON.stringify(custom, null, 2));
}

function getStoredKey(provider: string): string | null {
  try {
    const credPath = path.join(app.getPath('userData'), 'credentials.json');
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    const encrypted = creds[`apiKey:${provider}`];
    if (!encrypted) return null;
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch {
    return null;
  }
}

export function registerProviderHandlers() {
  ipcMain.handle('providers:list', () => {
    const providers = loadProviders();
    return providers.map((p) => ({
      ...p,
      hasKey: getStoredKey(p.id) !== null,
    }));
  });

  ipcMain.handle('providers:list-models', () => {
    const providers = loadProviders();
    const models: (ModelConfig & { providerName: string; hasKey: boolean })[] = [];
    for (const p of providers) {
      if (p.enabled === false) continue;
      const hasKey = getStoredKey(p.id) !== null;
      for (const m of p.models) {
        models.push({ ...m, providerName: p.name, hasKey });
      }
    }
    return models;
  });

  ipcMain.handle('providers:add', (_event, provider: ProviderConfig) => {
    const providers = loadProviders();
    const existing = providers.findIndex((p) => p.id === provider.id);
    if (existing >= 0) {
      providers[existing] = provider;
    } else {
      providers.push(provider);
    }
    saveCustomProviders(providers);
    return { success: true };
  });

  ipcMain.handle('providers:remove', (_event, id: string) => {
    const providers = loadProviders().filter((p) => p.id !== id);
    saveCustomProviders(providers);
    return { success: true };
  });

  ipcMain.handle('providers:add-model', (_event, providerId: string, model: ModelConfig) => {
    const providers = loadProviders();
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return { error: 'Provider not found' };
    provider.models.push(model);
    saveCustomProviders(providers);
    return { success: true };
  });

  ipcMain.handle('providers:get-key', (_event, providerId: string) => {
    return { hasKey: getStoredKey(providerId) !== null };
  });

  ipcMain.handle('providers:save-key', (_event, providerId: string, key: string) => {
    try {
      const encrypted = safeStorage.encryptString(key).toString('base64');
      const credPath = path.join(app.getPath('userData'), 'credentials.json');
      let creds: Record<string, string> = {};
      try { creds = JSON.parse(fs.readFileSync(credPath, 'utf-8')); } catch {}
      creds[`apiKey:${providerId}`] = encrypted;
      fs.writeFileSync(credPath, JSON.stringify(creds), 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('providers:get-default-model', () => {
    try {
      const { app } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const settingsPath = path.join(app.getPath('userData'), 'ados-settings.json');
      if (fs.existsSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        return data.defaultModel || 'gpt-4.1-mini';
      }
      return 'gpt-4.1-mini';
    } catch {
      return 'gpt-4.1-mini';
    }
  });

  ipcMain.handle('providers:set-default-model', (_event, modelId: string) => {
    try {
      const { app } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const settingsPath = path.join(app.getPath('userData'), 'ados-settings.json');
      let data: any = {};
      if (fs.existsSync(settingsPath)) {
        data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
      data.defaultModel = modelId;
      fs.writeFileSync(settingsPath, JSON.stringify(data), 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });
}

export { getStoredKey };
