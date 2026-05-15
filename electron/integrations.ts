import { ipcMain } from 'electron';
import { getToken } from './oauth';

async function googleApi(path: string, options: RequestInit = {}) {
  const token = getToken('google');
  if (!token) throw new Error('Google not authenticated');
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token.accessToken}`, ...options.headers },
  });
  if (!res.ok) throw new Error(`Google API error: ${res.status}`);
  return res.json();
}

async function githubApi(path: string, options: RequestInit = {}) {
  const token = getToken('github');
  if (!token) throw new Error('GitHub not authenticated');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

async function slackApi(method: string, body?: any) {
  const token = getToken('slack');
  if (!token) throw new Error('Slack not authenticated');
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export function registerIntegrationHandlers() {
  // Gmail
  ipcMain.handle('integration:gmail-list', async (_event, maxResults = 10) => {
    try {
      const data = await googleApi(`/gmail/v1/users/me/messages?maxResults=${maxResults}`);
      return { success: true, messages: data.messages || [] };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('integration:gmail-read', async (_event, messageId: string) => {
    try {
      const data = await googleApi(`/gmail/v1/users/me/messages/${messageId}?format=full`);
      return { success: true, message: data };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('integration:gmail-send', async (_event, to: string, subject: string, body: string) => {
    try {
      const raw = btoa(
        `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
      ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const data = await googleApi('/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      return { success: true, id: data.id };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // Google Drive
  ipcMain.handle('integration:drive-list', async (_event, query?: string) => {
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : '';
      const data = await googleApi(`/drive/v3/files?pageSize=20${q}&fields=files(id,name,mimeType,modifiedTime)`);
      return { success: true, files: data.files || [] };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // GitHub
  ipcMain.handle('integration:github-repos', async () => {
    try {
      const data = await githubApi('/user/repos?sort=updated&per_page=20');
      return { success: true, repos: data.map((r: any) => ({ name: r.full_name, url: r.html_url, description: r.description })) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('integration:github-issues', async (_event, repo: string) => {
    try {
      const data = await githubApi(`/repos/${repo}/issues?state=open&per_page=20`);
      return { success: true, issues: data.map((i: any) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('integration:github-create-issue', async (_event, repo: string, title: string, body: string) => {
    try {
      const data = await githubApi(`/repos/${repo}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      return { success: true, issue: { number: data.number, url: data.html_url } };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // Slack
  ipcMain.handle('integration:slack-channels', async () => {
    try {
      const data = await slackApi('conversations.list', { types: 'public_channel,private_channel', limit: 50 });
      return { success: true, channels: (data.channels || []).map((c: any) => ({ id: c.id, name: c.name })) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('integration:slack-history', async (_event, channel: string, limit = 20) => {
    try {
      const data = await slackApi('conversations.history', { channel, limit });
      return { success: true, messages: (data.messages || []).map((m: any) => ({ user: m.user, text: m.text, ts: m.ts })) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('integration:slack-send', async (_event, channel: string, text: string) => {
    try {
      const data = await slackApi('chat.postMessage', { channel, text });
      return { success: true, ts: data.ts };
    } catch (err: any) {
      return { error: err.message };
    }
  });
}
