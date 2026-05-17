import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ados', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
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
    stop: () => ipcRenderer.invoke('llm:stop'),
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
    transcribe: (audioBase64: string, mimeType: string) =>
      ipcRenderer.invoke('llm:transcribe', audioBase64, mimeType),
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
    toggleSessionFavorite: (id: string) => ipcRenderer.invoke('db:toggle-session-favorite', id),
    toggleSessionArchived: (id: string) => ipcRenderer.invoke('db:toggle-session-archived', id),
    addMessage: (id: string, sessionId: string, role: string, content: string) =>
      ipcRenderer.invoke('db:add-message', id, sessionId, role, content),
    getMessages: (sessionId: string) => ipcRenderer.invoke('db:get-messages', sessionId),
    getSetting: (key: string) => ipcRenderer.invoke('db:get-setting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('db:set-setting', key, value),
    getSessionSetting: (sessionId: string, key: string) => ipcRenderer.invoke('db:get-session-setting', sessionId, key),
    setSessionSetting: (sessionId: string, key: string, value: string) => ipcRenderer.invoke('db:set-session-setting', sessionId, key, value),
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
    getPermissions: () => ipcRenderer.invoke('db:get-permissions'),
    addPermission: (id: string, pattern: string, type: string, access: string, comment: string) =>
      ipcRenderer.invoke('db:add-permission', id, pattern, type, access, comment),
    updatePermission: (id: string, access: string) => ipcRenderer.invoke('db:update-permission', id, access),
    deletePermission: (id: string) => ipcRenderer.invoke('db:delete-permission', id),
    getMemories: () => ipcRenderer.invoke('db:get-memories'),
    addMemory: (id: string, content: string, category: string) =>
      ipcRenderer.invoke('db:add-memory', id, content, category),
    deleteMemory: (id: string) => ipcRenderer.invoke('db:delete-memory', id),
    searchMemories: (query: string) => ipcRenderer.invoke('db:search-memories', query),
    getAutomations: () => ipcRenderer.invoke('db:get-automations'),
    addAutomation: (id: string, name: string, description: string, schedule: string, sources: string) =>
      ipcRenderer.invoke('db:add-automation', id, name, description, schedule, sources),
    toggleAutomation: (id: string, enabled: boolean) => ipcRenderer.invoke('db:toggle-automation', id, enabled),
    updateAutomation: (id: string, name: string, description: string, schedule: string, sources: string, extra?: any) =>
      ipcRenderer.invoke('db:update-automation', id, name, description, schedule, sources, extra),
    deleteAutomation: (id: string) => ipcRenderer.invoke('db:delete-automation', id),
    // Labels
    getLabels: () => ipcRenderer.invoke('db:get-labels'),
    addLabel: (id: string, name: string, color: string, parentId: string | null, autoPattern: string | null) =>
      ipcRenderer.invoke('db:add-label', id, name, color, parentId, autoPattern),
    updateLabel: (id: string, fields: any) => ipcRenderer.invoke('db:update-label', id, fields),
    deleteLabel: (id: string) => ipcRenderer.invoke('db:delete-label', id),
    getSessionLabels: (sessionId: string) => ipcRenderer.invoke('db:get-session-labels', sessionId),
    setSessionLabels: (sessionId: string, labelIds: string[]) => ipcRenderer.invoke('db:set-session-labels', sessionId, labelIds),
    // Preferences
    getPreferences: () => ipcRenderer.invoke('db:get-preferences'),
    setPreference: (key: string, value: string) => ipcRenderer.invoke('db:set-preference', key, value),
    // Shortcuts
    getShortcuts: () => ipcRenderer.invoke('db:get-shortcuts'),
    setShortcut: (id: string, action: string, keys: string) => ipcRenderer.invoke('db:set-shortcut', id, action, keys),
    // Shared Sessions
    shareSession: (sessionId: string, publicId: string) => ipcRenderer.invoke('db:share-session', sessionId, publicId),
    unshareSession: (sessionId: string) => ipcRenderer.invoke('db:unshare-session', sessionId),
    getSharedSession: (sessionId: string) => ipcRenderer.invoke('db:get-shared-session', sessionId),
    getSharedSessions: () => ipcRenderer.invoke('db:get-shared-sessions'),
    // Telegram Pairings
    getTelegramPairings: () => ipcRenderer.invoke('db:get-telegram-pairings'),
    pairTelegram: (chatId: number, sessionId: string, direction: string) => ipcRenderer.invoke('db:pair-telegram', chatId, sessionId, direction),
    unpairTelegram: (chatId: number, sessionId?: string) => ipcRenderer.invoke('db:unpair-telegram', chatId),
    getDashboards: () => ipcRenderer.invoke('db:get-dashboards'),
    createDashboard: (id: string, name: string, layout: string) => ipcRenderer.invoke('db:create-dashboard', id, name, layout),
    updateDashboard: (id: string, layout: string) => ipcRenderer.invoke('db:update-dashboard', id, layout),
    deleteDashboard: (id: string) => ipcRenderer.invoke('db:delete-dashboard', id),
  },
  browser: {
    open: (url: string, sessionId?: string) => ipcRenderer.invoke('browser:open', url, sessionId),
    navigate: (url: string, sessionId?: string) => ipcRenderer.invoke('browser:navigate', url, sessionId),
    back: (sessionId?: string) => ipcRenderer.invoke('browser:back', sessionId),
    forward: (sessionId?: string) => ipcRenderer.invoke('browser:forward', sessionId),
    reload: (sessionId?: string) => ipcRenderer.invoke('browser:reload', sessionId),
    screenshot: (sessionId?: string) => ipcRenderer.invoke('browser:screenshot', sessionId),
    getUrl: (sessionId?: string) => ipcRenderer.invoke('browser:get-url', sessionId),
    getTitle: (sessionId?: string) => ipcRenderer.invoke('browser:get-title', sessionId),
    executeJs: (code: string, sessionId?: string) => ipcRenderer.invoke('browser:execute-js', code, sessionId),
    close: (sessionId?: string) => ipcRenderer.invoke('browser:close', sessionId),
    hide: (sessionId?: string) => ipcRenderer.invoke('browser:hide', sessionId),
    show: (sessionId?: string) => ipcRenderer.invoke('browser:show', sessionId),
    isOpen: (sessionId?: string) => ipcRenderer.invoke('browser:is-open', sessionId),
    resize: (bounds: { x: number; y: number; width: number; height: number }, sessionId?: string) =>
      ipcRenderer.invoke('browser:resize', bounds, sessionId),
    history: (sessionId?: string) => ipcRenderer.invoke('browser:history', sessionId),
    screenshotToChat: (sessionId?: string) => ipcRenderer.invoke('browser:screenshot-to-chat', sessionId),
    getSelection: (sessionId?: string) => ipcRenderer.invoke('browser:get-selection', sessionId),
    pip: (sessionId?: string) => ipcRenderer.invoke('browser:pip', sessionId),
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
  agents: {
    list: () => ipcRenderer.invoke('agents:list'),
    get: (id: string) => ipcRenderer.invoke('agents:get', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('agents:update', id, updates),
    add: (config: any) => ipcRenderer.invoke('agents:add', config),
    remove: (id: string) => ipcRenderer.invoke('agents:remove', id),
    reset: () => ipcRenderer.invoke('agents:reset'),
    route: (message: string) => ipcRenderer.invoke('agents:route', message),
    execute: (agentId: string, input: string, stream?: boolean) =>
      ipcRenderer.invoke('agents:execute', agentId, input, stream),
    runPipeline: (message: string) => ipcRenderer.invoke('agents:run-pipeline', message),
    getHistory: () => ipcRenderer.invoke('agents:get-history'),
    clearHistory: () => ipcRenderer.invoke('agents:clear-history'),
    setRouting: (enabled: boolean) => ipcRenderer.invoke('agents:set-routing', enabled),
    getRouting: () => ipcRenderer.invoke('agents:get-routing'),
    getTiers: () => ipcRenderer.invoke('agents:get-tiers'),
    onRouting: (callback: (data: any) => void) => {
      ipcRenderer.on('agent:routing', (_e, data) => callback(data));
    },
    onExecuting: (callback: (data: any) => void) => {
      ipcRenderer.on('agent:executing', (_e, data) => callback(data));
    },
    onResult: (callback: (data: any) => void) => {
      ipcRenderer.on('agent:result', (_e, data) => callback(data));
    },
    onPipelineStart: (callback: (data: any) => void) => {
      ipcRenderer.on('agent:pipeline-start', (_e, data) => callback(data));
    },
    onSubtaskStart: (callback: (data: any) => void) => {
      ipcRenderer.on('agent:subtask-start', (_e, data) => callback(data));
    },
    onSubtaskComplete: (callback: (data: any) => void) => {
      ipcRenderer.on('agent:subtask-complete', (_e, data) => callback(data));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('agent:routing');
      ipcRenderer.removeAllListeners('agent:executing');
      ipcRenderer.removeAllListeners('agent:result');
      ipcRenderer.removeAllListeners('agent:pipeline-start');
      ipcRenderer.removeAllListeners('agent:subtask-start');
      ipcRenderer.removeAllListeners('agent:subtask-complete');
    },
  },
  oauth: {
    start: (provider: string) => ipcRenderer.invoke('oauth:start', provider),
    status: (provider: string) => ipcRenderer.invoke('oauth:status', provider),
    logout: (provider: string) => ipcRenderer.invoke('oauth:logout', provider),
    refresh: (provider: string) => ipcRenderer.invoke('oauth:refresh', provider),
  },
  integrations: {
    gmailList: (maxResults?: number) => ipcRenderer.invoke('integration:gmail-list', maxResults),
    gmailRead: (id: string) => ipcRenderer.invoke('integration:gmail-read', id),
    gmailSend: (to: string, subject: string, body: string) => ipcRenderer.invoke('integration:gmail-send', to, subject, body),
    driveList: (query?: string) => ipcRenderer.invoke('integration:drive-list', query),
    githubRepos: () => ipcRenderer.invoke('integration:github-repos'),
    githubIssues: (repo: string) => ipcRenderer.invoke('integration:github-issues', repo),
    githubCreateIssue: (repo: string, title: string, body: string) => ipcRenderer.invoke('integration:github-create-issue', repo, title, body),
    slackChannels: () => ipcRenderer.invoke('integration:slack-channels'),
    slackHistory: (channel: string, limit?: number) => ipcRenderer.invoke('integration:slack-history', channel, limit),
    slackSend: (channel: string, text: string) => ipcRenderer.invoke('integration:slack-send', channel, text),
  },
  telegram: {
    setToken: (token: string) => ipcRenderer.invoke('telegram:set-token', token),
    getToken: () => ipcRenderer.invoke('telegram:get-token'),
    removeToken: () => ipcRenderer.invoke('telegram:remove-token'),
    getMe: () => ipcRenderer.invoke('telegram:get-me'),
    send: (chatId: number | string, text: string, parseMode?: string) =>
      ipcRenderer.invoke('telegram:send', chatId, text, parseMode),
    sendPhoto: (chatId: number | string, photoUrl: string, caption?: string) =>
      ipcRenderer.invoke('telegram:send-photo', chatId, photoUrl, caption),
    sendDocument: (chatId: number | string, documentUrl: string, caption?: string) =>
      ipcRenderer.invoke('telegram:send-document', chatId, documentUrl, caption),
    getChats: () => ipcRenderer.invoke('telegram:get-chats'),
    startPolling: () => ipcRenderer.invoke('telegram:start-polling'),
    stopPolling: () => ipcRenderer.invoke('telegram:stop-polling'),
    pollingStatus: () => ipcRenderer.invoke('telegram:polling-status'),
    setWebhook: (url: string) => ipcRenderer.invoke('telegram:set-webhook', url),
    deleteWebhook: () => ipcRenderer.invoke('telegram:delete-webhook'),
    getWebhookInfo: () => ipcRenderer.invoke('telegram:get-webhook-info'),
    generatePairCode: (sessionId: string) => ipcRenderer.invoke('telegram:generate-pair-code', sessionId),
    onPairSuccess: (callback: (data: any) => void) => {
      ipcRenderer.on('telegram:pair-success', (_e, data) => callback(data));
    },
    onMessage: (callback: (msg: any) => void) => {
      ipcRenderer.on('telegram:message', (_e, msg) => callback(msg));
    },
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on('telegram:error', (_e, error) => callback(error));
    },
    onPairingUpdated: (callback: () => void) => {
      ipcRenderer.on('telegram:pairing-updated', () => callback());
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('telegram:message');
      ipcRenderer.removeAllListeners('telegram:error');
      ipcRenderer.removeAllListeners('telegram:pairing-updated');
    },
  },
  actions: {
    listFlows: () => ipcRenderer.invoke('actions:list-flows'),
    getFlow: (id: string) => ipcRenderer.invoke('actions:get-flow', id),
    createFlow: (data: any) => ipcRenderer.invoke('actions:create-flow', data),
    updateFlow: (id: string, updates: any) => ipcRenderer.invoke('actions:update-flow', id, updates),
    deleteFlow: (id: string) => ipcRenderer.invoke('actions:delete-flow', id),
    executeFlow: (id: string, data?: any) => ipcRenderer.invoke('actions:execute-flow', id, data),
    getLogs: (flowId: string, limit?: number) => ipcRenderer.invoke('actions:get-logs', flowId, limit),
    listActionTypes: () => ipcRenderer.invoke('actions:list-action-types'),
    onFlowCompleted: (callback: (data: any) => void) => {
      ipcRenderer.on('actions:flow-completed', (_e, data) => callback(data));
    },
    onNodeExecuted: (callback: (data: any) => void) => {
      ipcRenderer.on('actions:node-executed', (_e, data) => callback(data));
    },
    onNotification: (callback: (data: any) => void) => {
      ipcRenderer.on('actions:notification', (_e, data) => callback(data));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('actions:flow-completed');
      ipcRenderer.removeAllListeners('actions:node-executed');
      ipcRenderer.removeAllListeners('actions:notification');
    },
  },
  listeners: {
    list: () => ipcRenderer.invoke('listeners:list'),
    create: (data: any) => ipcRenderer.invoke('listeners:create', data),
    update: (id: string, updates: any) => ipcRenderer.invoke('listeners:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('listeners:delete', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('listeners:toggle', id, enabled),
    getEvents: (listenerId: string, limit?: number) => ipcRenderer.invoke('listeners:events', listenerId, limit),
    recentEvents: (limit?: number) => ipcRenderer.invoke('listeners:recent-events', limit),
    onListenerEvent: (callback: (data: any) => void) => {
      ipcRenderer.on('listener:events', (_e, data) => callback(data));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('listener:events');
    },
  },
});
