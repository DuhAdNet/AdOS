import { BrowserWindow, ipcMain } from 'electron';
import { getSetting } from './database';

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

const tokens: Record<string, TokenData> = {};

function buildAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${config.authUrl}?${params.toString()}`;
}

async function exchangeCode(config: OAuthConfig, code: string): Promise<TokenData> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

async function refreshToken(config: OAuthConfig, refresh: string): Promise<TokenData> {
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refresh,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

function openAuthWindow(url: string, redirectUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      webPreferences: { nodeIntegration: false },
    });

    win.loadURL(url);

    win.webContents.on('will-redirect', (_event, navUrl) => {
      if (navUrl.startsWith(redirectUri)) {
        const code = new URL(navUrl).searchParams.get('code');
        win.close();
        if (code) resolve(code);
        else reject(new Error('No code received'));
      }
    });

    win.webContents.on('will-navigate', (_event, navUrl) => {
      if (navUrl.startsWith(redirectUri)) {
        const code = new URL(navUrl).searchParams.get('code');
        win.close();
        if (code) resolve(code);
        else reject(new Error('No code received'));
      }
    });

    win.on('closed', () => reject(new Error('Window closed')));
  });
}

export function getToken(provider: string): TokenData | null {
  return tokens[provider] || null;
}

export async function getValidToken(provider: string, config: OAuthConfig): Promise<string | null> {
  const token = tokens[provider];
  if (!token) return null;

  if (token.expiresAt && Date.now() > token.expiresAt - 60000) {
    if (token.refreshToken) {
      const newToken = await refreshToken(config, token.refreshToken);
      tokens[provider] = newToken;
      return newToken.accessToken;
    }
    return null;
  }
  return token.accessToken;
}

const providerConfigs: Record<string, () => OAuthConfig | null> = {
  google: () => {
    const clientId = getSetting('oauth_google_client_id');
    const clientSecret = getSetting('oauth_google_client_secret');
    if (!clientId || !clientSecret) return null;
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId,
      clientSecret,
      scopes: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      redirectUri: 'http://localhost:19836/oauth/callback',
    };
  },
  github: () => {
    const clientId = getSetting('oauth_github_client_id');
    const clientSecret = getSetting('oauth_github_client_secret');
    if (!clientId || !clientSecret) return null;
    return {
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      clientId,
      clientSecret,
      scopes: ['repo', 'read:user', 'read:org'],
      redirectUri: 'http://localhost:19836/oauth/callback',
    };
  },
  slack: () => {
    const clientId = getSetting('oauth_slack_client_id');
    const clientSecret = getSetting('oauth_slack_client_secret');
    if (!clientId || !clientSecret) return null;
    return {
      authUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      clientId,
      clientSecret,
      scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read'],
      redirectUri: 'http://localhost:19836/oauth/callback',
    };
  },
};

export function registerOAuthHandlers() {
  ipcMain.handle('oauth:start', async (_event, provider: string) => {
    const configFn = providerConfigs[provider];
    if (!configFn) return { error: `Provider ${provider} not supported` };
    const config = configFn();
    if (!config) return { error: `OAuth credentials not configured for ${provider}` };

    try {
      const state = Math.random().toString(36).slice(2);
      const authUrl = buildAuthUrl(config, state);
      const code = await openAuthWindow(authUrl, config.redirectUri);
      const token = await exchangeCode(config, code);
      tokens[provider] = token;
      return { success: true, provider };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('oauth:status', (_event, provider: string) => {
    const token = tokens[provider];
    if (!token) return { authenticated: false };
    const expired = token.expiresAt ? Date.now() > token.expiresAt : false;
    return { authenticated: true, expired };
  });

  ipcMain.handle('oauth:logout', (_event, provider: string) => {
    delete tokens[provider];
    return { success: true };
  });

  ipcMain.handle('oauth:refresh', async (_event, provider: string) => {
    const configFn = providerConfigs[provider];
    if (!configFn) return { error: 'Provider not supported' };
    const config = configFn();
    if (!config) return { error: 'Config not set' };
    const token = tokens[provider];
    if (!token?.refreshToken) return { error: 'No refresh token' };

    try {
      const newToken = await refreshToken(config, token.refreshToken);
      tokens[provider] = newToken;
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });
}
