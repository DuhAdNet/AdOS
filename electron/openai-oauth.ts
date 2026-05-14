import { ipcMain, shell, net, BrowserWindow, session as electronSession, app } from 'electron';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTH_BASE = 'https://auth.openai.com';
const DEVICE_AUTH_URL = `${AUTH_BASE}/api/accounts/deviceauth/usercode`;
const TOKEN_POLL_URL = `${AUTH_BASE}/api/accounts/deviceauth/token`;
const TOKEN_EXCHANGE_URL = `${AUTH_BASE}/oauth/token`;
const CALLBACK_PORT = 1455;
const FALLBACK_PORT = 1457;

interface TokenData {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

let storedTokens: TokenData | null = null;
let callbackServer: http.Server | null = null;

function getTokensPath(): string {
  return path.join(app.getPath('userData'), 'openai-oauth-tokens.json');
}

function saveTokensToDisk(tokens: TokenData) {
  try {
    fs.writeFileSync(getTokensPath(), JSON.stringify(tokens), 'utf-8');
  } catch (err) {
    console.error('[openai-oauth] failed to save tokens:', (err as Error).message);
  }
}

function loadTokensFromDisk(): TokenData | null {
  try {
    const data = fs.readFileSync(getTokensPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function deleteTokensFromDisk() {
  try {
    fs.unlinkSync(getTokensPath());
  } catch {}
}

function generatePKCE() {
  const verifier = crypto.randomBytes(64).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function requestDeviceCode(): Promise<{ device_auth_id: string; user_code: string; interval: number } | null> {
  try {
    const ses = electronSession.fromPartition('persist:openai-auth');
    console.log('[openai-oauth] requesting device code from:', DEVICE_AUTH_URL);
    const response = await ses.fetch(DEVICE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ client_id: CLIENT_ID }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[openai-oauth] device code failed:', response.status, response.statusText, text.slice(0, 500));
      return null;
    }
    const data = await response.json();
    console.log('[openai-oauth] device code success:', data.user_code, data.device_auth_id);
    return data;
  } catch (err) {
    console.error('[openai-oauth] device code error:', (err as Error).message, (err as Error).stack);
    return null;
  }
}

async function pollForToken(deviceAuthId: string, userCode: string, interval: number): Promise<TokenData | null> {
  const ses = electronSession.fromPartition('persist:openai-auth');
  const maxAttempts = Math.floor(900 / interval); // 15 min timeout
  console.log('[openai-oauth] polling for token, interval:', interval, 'max attempts:', maxAttempts);
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    try {
      const res = await ses.fetch(TOKEN_POLL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_auth_id: deviceAuthId, user_code: userCode }),
      });
      console.log('[openai-oauth] poll attempt', i + 1, 'status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[openai-oauth] poll success, keys:', Object.keys(data).join(','));
        if (data.authorization_code) {
          console.log('[openai-oauth] got authorization_code, exchanging...');
          return await exchangeCodeForTokens(data.authorization_code, data.code_verifier);
        }
        if (data.access_token) {
          console.log('[openai-oauth] got access_token directly');
          return data as TokenData;
        }
        return null;
      }
      // Codex CLI treats 403/404 as "authorization_pending" — keep polling
      if (res.status === 403 || res.status === 404) {
        continue;
      }
      // Any other error status — stop
      console.log('[openai-oauth] poll unexpected status:', res.status);
      return null;
    } catch (err) {
      console.error('[openai-oauth] poll error:', (err as Error).message);
      continue;
    }
  }
  return null;
}

async function obtainApiKey(idToken: string): Promise<string | null> {
  try {
    const ses = electronSession.fromPartition('persist:openai-auth');
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: CLIENT_ID,
      requested_token: 'openai-api-key',
      subject_token: idToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    });

    console.log('[openai-oauth] exchanging id_token for API key...');
    const res = await ses.fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[openai-oauth] API key exchange failed:', res.status, text.slice(0, 300));
      return null;
    }
    const data = await res.json();
    console.log('[openai-oauth] API key exchange success:', !!data.access_token);
    return data.access_token || null;
  } catch (err) {
    console.error('[openai-oauth] API key exchange error:', (err as Error).message);
    return null;
  }
}

async function exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<TokenData | null> {
  try {
    const ses = electronSession.fromPartition('persist:openai-auth');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      redirect_uri: `${AUTH_BASE}/deviceauth/callback`,
    });
    if (codeVerifier) params.set('code_verifier', codeVerifier);

    console.log('[openai-oauth] exchanging code for tokens...');
    const res = await ses.fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[openai-oauth] token exchange failed:', res.status, text.slice(0, 300));
      return null;
    }
    const tokens = await res.json();
    console.log('[openai-oauth] token exchange success, got id_token:', !!tokens.id_token, 'access_token:', !!tokens.access_token);

    // Device code flow uses access_token directly with chatgpt.com/backend-api/codex
    console.log('[openai-oauth] using access_token for chatgpt backend');

    return tokens;
  } catch (err) {
    console.error('[openai-oauth] token exchange error:', (err as Error).message);
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  try {
    const ses = electronSession.fromPartition('persist:openai-auth');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    });
    const res = await ses.fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function startCallbackServer(port: number): Promise<TokenData | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      stopCallbackServer();
      resolve(null);
    }, 900000); // 15 min

    callbackServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Login realizado com sucesso!</h2><p>Você pode fechar esta aba.</p></body></html>');
          clearTimeout(timeout);
          const tokens = await exchangeCodeForTokens(code);
          stopCallbackServer();
          resolve(tokens);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Erro no login</h2></body></html>');
          clearTimeout(timeout);
          stopCallbackServer();
          resolve(null);
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    callbackServer.listen(port, '127.0.0.1', () => {});
    callbackServer.on('error', () => {
      if (port === CALLBACK_PORT) {
        callbackServer = null;
        startCallbackServer(FALLBACK_PORT).then(resolve);
      } else {
        resolve(null);
      }
    });
  });
}

function stopCallbackServer() {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
  }
}

export function getOpenAIAccessToken(): string | null {
  return storedTokens?.access_token || null;
}

export function registerOpenAIOAuthHandlers() {
  ipcMain.handle('openai-oauth:start', async () => {
    const deviceCode = await requestDeviceCode();
    if (!deviceCode) {
      return { error: 'Não foi possível iniciar o login. Tente novamente.' };
    }

    const deviceUrl = `https://auth.openai.com/codex/device`;
    shell.openExternal(deviceUrl);

    return {
      success: true,
      user_code: deviceCode.user_code,
      device_auth_id: deviceCode.device_auth_id,
      interval: deviceCode.interval,
    };
  });

  ipcMain.handle('openai-oauth:poll', async (_event, deviceAuthId: string, userCode: string, interval: number) => {
    const tokens = await pollForToken(deviceAuthId, userCode, interval);
    if (tokens) {
      storedTokens = tokens;
      saveTokensToDisk(tokens);
      return { success: true };
    }
    return { error: 'Login expirou ou foi cancelado.' };
  });

  ipcMain.handle('openai-oauth:check', async () => {
    if (storedTokens?.access_token) {
      return { authenticated: true };
    }
    const saved = loadTokensFromDisk();
    if (saved?.access_token) {
      storedTokens = saved;
      return { authenticated: true };
    }
    return { authenticated: false };
  });

  ipcMain.handle('openai-oauth:refresh', async () => {
    if (!storedTokens?.refresh_token) return { error: 'No refresh token' };
    const newTokens = await refreshAccessToken(storedTokens.refresh_token);
    if (newTokens) {
      storedTokens = newTokens;
      saveTokensToDisk(newTokens);
      return { success: true };
    }
    return { error: 'Refresh failed' };
  });

  ipcMain.handle('openai-oauth:logout', async () => {
    storedTokens = null;
    deleteTokensFromDisk();
    return { success: true };
  });

  ipcMain.handle('openai-oauth:get-token', () => {
    return { token: storedTokens?.access_token || null };
  });
}
