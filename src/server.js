// The HTTP interactions endpoint. Set the application's "Interactions Endpoint
// URL" to https://<host>/interactions. No gateway connection, no dependency:
// one small process, cheap to host.
//
//   DISCORD_PUBLIC_KEY       the application's public key (verifies requests)
//   DISCORD_APPLICATION_ID   the application id
//   DISCORD_BOT_TOKEN        only for /alerts (creates the channel webhook) and register.js
//   PORT                     default 8080
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { feeds as makeFeeds } from './data.js';
import { handle } from './handler.js';
import { isFromDiscord } from './verify.js';

const API = 'https://discord.com/api/v10';

export function discordRest(token, fetchFn = fetch) {
  return async (method, path, body) => {
    const res = await fetchFn(`${API}${path}`, {
      method,
      headers: { authorization: `Bot ${token}`, 'content-type': 'application/json', 'user-agent': 'DiscordBot (https://github.com/ForexiaPro/macro-desk, 1.0)' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {}
    return { status: res.status, body: parsed };
  };
}

export async function postJson(url, body, fetchFn = fetch) {
  const res = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'MacroDesk/1.0 (+https://github.com/ForexiaPro/macro-desk)' }, body: JSON.stringify(body) });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {}
  return { status: res.status, body: parsed };
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function app({ publicKey, appId, deps }) {
  return createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return send(200, 'ok', 'text/plain');
    if (url.pathname === '/' && req.method === 'GET') return send(200, 'Macro Desk: a Discord app for central bank decisions, odds, COT, position size and signals. https://github.com/ForexiaPro/macro-desk\n', 'text/plain');
    if (url.pathname !== '/interactions') return send(404, { error: 'not found' });
    if (req.method !== 'POST') return send(405, { error: 'method not allowed' });
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      return send(413, { error: 'too large' });
    }
    const ok = isFromDiscord({ publicKey, signature: req.headers['x-signature-ed25519'], timestamp: req.headers['x-signature-timestamp'], body: raw });
    if (!ok) return send(401, { error: 'invalid request signature' });
    let interaction;
    try {
      interaction = JSON.parse(raw.toString('utf8'));
    } catch {
      return send(400, { error: 'bad request' });
    }
    try {
      const { response, after } = await handle(interaction, { ...deps, appId });
      send(200, response);
      if (after) after().catch((e) => console.error('after:', e.message));
    } catch (e) {
      console.error('handle:', e);
      send(200, { type: 4, data: { content: 'Something went wrong. Try again in a minute.', flags: 64 } });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { DISCORD_PUBLIC_KEY: publicKey, DISCORD_APPLICATION_ID: appId, DISCORD_BOT_TOKEN: token, PORT = '8080' } = process.env;
  if (!publicKey || !appId) {
    console.error('Set DISCORD_PUBLIC_KEY and DISCORD_APPLICATION_ID (see .env.example).');
    process.exit(1);
  }
  const feeds = makeFeeds();
  feeds.refreshAll().then(() => console.log('feeds loaded'));
  setInterval(() => feeds.refreshAll(), 5 * 60 * 1000).unref();
  const deps = { feeds, discord: token ? discordRest(token) : null, post: (u, b) => postJson(u, b) };
  app({ publicKey, appId, deps }).listen(+PORT, () => console.log(`Macro Desk on :${PORT}/interactions${token ? '' : ' (no bot token: /alerts subscribe points to the alerts page)'}`));
}
