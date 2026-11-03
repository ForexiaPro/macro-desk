import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { isFromDiscord } from '../src/verify.js';
import { app } from '../src/server.js';

const { publicKey: pub, privateKey } = generateKeyPairSync('ed25519');
const publicKey = Buffer.from(pub.export({ format: 'jwk' }).x, 'base64url').toString('hex');
const signed = (body, timestamp = String(Math.floor(Date.now() / 1000))) => ({
  timestamp,
  signature: sign(null, Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]), privateKey).toString('hex'),
});

test('a request Discord signed passes', () => {
  const body = '{"type":1}';
  const s = signed(body);
  assert.equal(isFromDiscord({ publicKey, ...s, body }), true);
  assert.equal(isFromDiscord({ publicKey, ...s, body: Buffer.from(body) }), true);
});

test('anything else fails', () => {
  const body = '{"type":1}';
  const s = signed(body);
  assert.equal(isFromDiscord({ publicKey, ...s, body: '{"type":2}' }), false, 'body changed');
  assert.equal(isFromDiscord({ publicKey, signature: s.signature, timestamp: String(+s.timestamp + 1), body }), false, 'timestamp changed');
  assert.equal(isFromDiscord({ publicKey, signature: s.signature.replace(/^./, (c) => (c === '0' ? '1' : '0')), timestamp: s.timestamp, body }), false, 'signature changed');
  const other = Buffer.from(generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');
  assert.equal(isFromDiscord({ publicKey: other, ...s, body }), false, 'another key');
  assert.equal(isFromDiscord({ publicKey, signature: undefined, timestamp: s.timestamp, body }), false);
  assert.equal(isFromDiscord({ publicKey, signature: 'zz', timestamp: s.timestamp, body }), false);
  assert.equal(isFromDiscord({ publicKey: 'nothex', ...s, body }), false);
});

test('an old request is refused (no replay)', () => {
  const body = '{"type":1}';
  const old = signed(body, String(Math.floor(Date.now() / 1000) - 3600));
  assert.equal(isFromDiscord({ publicKey, ...old, body }), false);
  assert.equal(isFromDiscord({ publicKey, ...old, body, maxAge: 0 }), true);
});

test('the endpoint answers a signed PING with PONG and refuses an unsigned one', async () => {
  const server = app({ publicKey, appId: '1', deps: { feeds: { get: async () => null } } }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const body = '{"type":1}';
    const s = signed(body);
    const ok = await fetch(`${base}/interactions`, { method: 'POST', body, headers: { 'x-signature-ed25519': s.signature, 'x-signature-timestamp': s.timestamp, 'content-type': 'application/json' } });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { type: 1 });
    const bad = await fetch(`${base}/interactions`, { method: 'POST', body, headers: { 'x-signature-ed25519': '00'.repeat(64), 'x-signature-timestamp': s.timestamp } });
    assert.equal(bad.status, 401);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
  } finally {
    server.close();
  }
});
