import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ados', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  llm: {
    chat: (messages: Array<{ role: string; content: string }>, model: string) =>
      ipcRenderer.invoke('llm:chat', messages, model),
    stream: (messages: Array<{ role: string; content: string }>, model: string, tools?: any[]) =>
      ipcRenderer.invoke('llm:stream', messages, model, tools),
    onStreamChunk: (callback: (chunk: string) => void) => {
      ipcRenderer.on('llm:stream-chunk', (_e, chunk) => callback(chunk));
    },
    onStreamEnd: (callback: () => void) => {
      ipcRenderer.on('llm:stream-end', () => callback());
    },
    onStreamError: (callback: (error: string) => void) => {
      ipcRenderer.on('llm:stream-error', (_e, error) => callback(error));
    },
    onToolCall: (callback: (data: any) => void) => {
      ipcRenderer.on('llm:tool-call', (_e, data) => callback(data));
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('llm:stream-chunk');
      ipcRenderer.removeAllListeners('llm:stream-end');
      ipcRenderer.removeAllListeners('llm:stream-error');
      ipcRenderer.removeAllListeners('llm:tool-call');
    },
    saveKey: (provider: string, key: string) =>
      ipcRenderer.invoke('llm:save-key', provider, key),
    testKey: (provider: string, key: string) =>
      ipcRenderer.invoke('llm:test-key', provider, key),
    hasKey: (provider: string) =>
      ipcRenderer.invoke('llm:has-key', provider),
  },
  mcp: {
    listServers: () => ipcRenderer.invoke('mcp:list-servers'),
    addServer: (config: any) => ipcRenderer.invoke('mcp:add-server', config),
    removeServer: (name: string) => ipcRenderer.invoke('mcp:remove-server', name),
    connectServer: (name: string) => ipcRenderer.invoke('mcp:connect-server', name),
    disconnectServer: (name: string) => ipcRenderer.invoke('mcp:disconnect-server', name),
    connectAll: () => ipcRenderer.invoke('mcp:connect-all'),
    testServer: (config: any) => ipcRenderer.invoke('mcp:test-server', config),
    listTools: (serverName?: string) => ipcRenderer.invoke('mcp:list-tools', serverName),
    getAllTools: () => ipcRenderer.invoke('mcp:get-all-tools'),
    callTool: (serverName: string, toolName: string, args: any) =>
      ipcRenderer.invoke('mcp:call-tool', serverName, toolName, args),
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    listModels: () => ipcRenderer.invoke('providers:list-models'),
    add: (provider: any) => ipcRenderer.invoke('providers:add', provider),
    remove: (id: string) => ipcRenderer.invoke('providers:remove', id),
    addModel: (providerId: string, model: any) => ipcRenderer.invoke('providers:add-model', providerId, model),
    getKey: (providerId: string) => ipcRenderer.invoke('providers:get-key', providerId),
    saveKey: (providerId: string, key: string) => ipcRenderer.invoke('providers:save-key', providerId, key),
    getDefaultModel: () => ipcRenderer.invoke('providers:get-default-model'),
    setDefaultModel: (modelId: string) => ipcRenderer.invoke('providers:set-default-model', modelId),
  },
  db: {
    createSession: (id: string, title: string) =>
      ipcRenderer.invoke('db:create-session', id, title),
    getSessions: () => ipcRenderer.invoke('db:get-sessions'),
    updateSessionTitle: (id: string, title: string) =>
      ipcRenderer.invoke('db:update-session-title', id, title),
    deleteSession: (id: string) => ipcRenderer.invoke('db:delete-session', id),
    addMessage: (id: string, sessionId: string, role: string, content: string) =>
      ipcRenderer.invoke('db:add-message', id, sessionId, role, content),
    getMessages: (sessionId: string) => ipcRenderer.invoke('db:get-messages', sessionId),
    getSetting: (key: string) => ipcRenderer.invoke('db:get-setting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('db:set-setting', key, value),
    getConnections: () => ipcRenderer.invoke('db:get-connections'),
    addConnection: (id: string, name: string, type: string, config: string) =>
      ipcRenderer.invoke('db:add-connection', id, name, type, config),
    updateConnection: (id: string, fields: any) => ipcRenderer.invoke('db:update-connection', id, fields),
    deleteConnection: (id: string) => ipcRenderer.invoke('db:delete-connection', id),
    getSkills: () => ipcRenderer.invoke('db:get-skills'),
    addSkill: (id: string, name: string, slug: string, description: string, instructions: string) =>
      ipcRenderer.invoke('db:add-skill', id, name, slug, description, instructions),
    deleteSkill: (id: string) => ipcRenderer.invoke('db:delete-skill', id),
    getWorkflows: () => ipcRenderer.invoke('db:get-workflows'),
    addWorkflow: (id: string, name: string, slug: string, description: string, instructions: string) =>
      ipcRenderer.invoke('db:add-workflow', id, name, slug, description, instructions),
    deleteWorkflow: (id: string) => ipcRenderer.invoke('db:delete-workflow', id),
    getAutomations: () => ipcRenderer.invoke('db:get-automations'),
    addAutomation: (id: string, name: string, description: string, schedule: string, sources: string) =>
      ipcRenderer.invoke('db:add-automation', id, name, description, schedule, sources),
    toggleAutomation: (id: string, enabled: boolean) => ipcRenderer.invoke('db:toggle-automation', id, enabled),
    deleteAutomation: (id: string) => ipcRenderer.invoke('db:delete-automation', id),
  },
  browser: {
    open: (url: string) => ipcRenderer.invoke('browser:open', url),
    navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
    back: () => ipcRenderer.invoke('browser:back'),
    forward: () => ipcRenderer.invoke('browser:forward'),
    reload: () => ipcRenderer.invoke('browser:reload'),
    screenshot: () => ipcRenderer.invoke('browser:screenshot'),
    getUrl: () => ipcRenderer.invoke('browser:get-url'),
    getTitle: () => ipcRenderer.invoke('browser:get-title'),
    executeJs: (code: string) => ipcRenderer.invoke('browser:execute-js', code),
    close: () => ipcRenderer.invoke('browser:close'),
    hide: () => ipcRenderer.invoke('browser:hide'),
    show: () => ipcRenderer.invoke('browser:show'),
    isOpen: () => ipcRenderer.invoke('browser:is-open'),
    resize: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('browser:resize', bounds),
    onStateChanged: (callback: (state: any) => void) => {
      ipcRenderer.on('browser:state-changed', (_e, state) => callback(state));
    },
  },
  chatgpt: {
    open: () => ipcRenderer.invoke('chatgpt:open'),
    checkSession: () => ipcRenderer.invoke('chatgpt:check-session'),
    sendMessage: (message: string) => ipcRenderer.invoke('chatgpt:send-message', message),
    logout: () => ipcRenderer.invoke('chatgpt:logout'),
    close: () => ipcRenderer.invoke('chatgpt:close'),
  },
  openaiOAuth: {
    start: () => ipcRenderer.invoke('openai-oauth:start'),
    poll: (deviceAuthId: string, userCode: string, interval: number) =>
      ipcRenderer.invoke('openai-oauth:poll', deviceAuthId, userCode, interval),
    check: () => ipcRenderer.invoke('openai-oauth:check'),
    refresh: () => ipcRenderer.invoke('openai-oauth:refresh'),
    logout: () => ipcRenderer.invoke('openai-oauth:logout'),
    getToken: () => ipcRenderer.invoke('openai-oauth:get-token'),
  },
  tools: {
    getDocumentsPath: () => ipcRenderer.invoke('tools:get-documents-path'),
  },
});
