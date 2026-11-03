import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cot, help, nextList, odds, rate, signal, size } from '../src/format.js';
import { positionSize, conversionPair } from '../src/size.js';
import { handle, optionsOf } from '../src/handler.js';
import * as alerts from '../src/alerts.js';
import { COMMANDS } from '../src/commands.js';

const load = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const rates = load('rates.json');
const next = load('next.json');
const now = Date.parse(rates.asOf);
const BANNED = /order block|fair value gap|\bfvg\b|kill ?zone|liquidity void|imbalance|buy[- ]side|sell[- ]side|inducement|displacement|break of structure|change of character|premium|discount|judas|silver bullet|\bsmc\b|\bict\b/i;
const check = (text) => {
  assert.ok(text.length <= 2000, 'fits a message');
  assert.match(text.split('\n').at(-1), /<https:\/\/[^>]+>$/, 'ends with its source');
  assert.doesNotMatch(text, BANNED);
};

test('/rate from the live rates.json', () => {
  const t = rate({ rates, next }, 'fed', now);
  check(t);
  assert.match(t, /\*\*Federal Reserve\*\*: the federal funds rate \(target range\) is \*\*\d\.\d\d–\d\.\d\d%\*\*/);
  assert.match(t, /Next decision: <t:\d+:F> \(<t:\d+:R>\)/);
  assert.match(t, /Source: <https:\/\/interestratedecision\.com\/fed\/\?via=discord-desk>$/);
  const boe = rate({ rates, next }, 'boe', now);
  assert.match(boe, /is \*\*\d+\.\d\d%\*\*/);
  assert.match(rate({ rates: null, next: null }, 'boe', now), /not available right now[\s\S]*via=discord-desk/);
});

test('/next lists decisions soonest first, with Discord timestamps', () => {
  const t = nextList({ next }, undefined, now);
  check(t);
  const times = [...t.matchAll(/<t:(\d+):f>/g)].map((m) => +m[1]);
  assert.ok(times.length > 0 && times.length <= 6);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.match(t, /calendar\/\?via=discord-desk>$/);
  const boe = nextList({ next }, 'boe', now);
  assert.match(boe, /\*\*BoE\*\* Bank Rate/);
  assert.doesNotMatch(boe, /\*\*Fed\*\*/);
  assert.match(nextList({ next: null }, 'fed', now), /No decision of the Federal Reserve/);
});

test('/odds shows the record odds, and says when there are none', () => {
  const data = { banks: [{ bank: 'boe', meetings: [{ t: '2026-11-05T12:00:00Z', odds: { hike: 0.03, hold: 0.71, cut: 0.26 }, page: 'https://interestratedecision.com/boe/rate-odds/' }] }] };
  const t = odds({ odds: data, next }, 'boe', now);
  check(t);
  assert.match(t, /`hold █{7}░{3}  71%`/);
  assert.match(t, /Not market odds/);
  assert.doesNotMatch(t, /probability the market/i);
  const none = odds({ odds: null, next }, 'fed', now);
  check(none);
  assert.match(none, /not in the open data right now[\s\S]*fed\/rate-odds\/\?via=discord-desk>$/);
});

test('/cot reads the COT file: positions only, and hides what is missing', () => {
  const data = {
    report_date: '2026-10-27',
    markets: [
      { id: 'EUR', name: 'Euro FX', code: '099741', open_interest: 868188, legacy: { noncommercial: { long: 200000, short: 115790, net: 84210, net_change_1w: -3120, net_pct_oi: 9.7 }, commercial: { net: -90000 } } },
      { id: 'JPY', name: 'Japanese Yen', code: '097741', legacy: { noncommercial: { net: -61300, net_pct_oi: -20.27 } } },
    ],
  };
  const eur = cot({ cot: data }, 'EUR');
  check(eur);
  assert.match(eur, /net \*\*long\*\* 84,210 contracts: 200,000 long, 115,790 short\./);
  assert.match(eur, /Net −3,120 on the week, \+9\.7% of open interest\./);
  assert.doesNotMatch(eur, /extreme|of 100|positioning index/i);
  assert.match(eur, /forexiapro\.com\/cot-report\/\?via=discord-desk>$/);
  const jpy = cot({ cot: data }, 'JPY');
  assert.match(jpy, /net \*\*short\*\* 61,300 contracts\./);
  assert.match(jpy, /Net −20\.3% of open interest\./);
  const old = cot({ cot: { asOf: '2026-10-27', currencies: [{ currency: 'GBP', net: -5000, change: 100 }] } }, 'GBP');
  assert.match(old, /net \*\*short\*\* 5,000 contracts\.\nNet \+100 on the week\./);
  assert.match(cot({ cot: data }, 'GBP'), /not available right now/);
  assert.match(cot({ cot: null }, 'EUR'), /not available right now/);
});

test('position size: quote, base and cross accounts', () => {
  const a = positionSize({ balance: 10000, riskPct: 1, stopPips: 25, pair: 'EURUSD' });
  assert.equal(a.lots, 0.4);
  assert.equal(a.pipValue, 10);
  // USD/JPY on a USD account: the pip is 1,000 JPY a lot, at 150.00 that is 6.67 USD
  const b = positionSize({ balance: 10000, riskPct: 1, stopPips: 20, pair: 'USDJPY', rate: 150 });
  assert.ok(Math.abs(b.pipValue - 1000 / 150) < 1e-9);
  assert.equal(b.lots, 0.75);
  // EUR/GBP on a USD account: GBP/USD converts
  const c = positionSize({ balance: 5000, riskPct: 2, stopPips: 10, pair: 'eur/gbp', rate: 1.25 });
  assert.equal(c.conversion, 'GBPUSD');
  assert.equal(c.pipValue, 12.5);
  assert.equal(c.lots, 0.8);
  // GBP/JPY on a EUR account: EUR/JPY converts, inverted
  assert.deepEqual(conversionPair('JPY', 'EUR'), { pair: 'EURJPY', invert: true });
  assert.match(positionSize({ balance: 1, riskPct: 1, stopPips: 1, pair: 'GBPJPY', account: 'EUR' }).error, /EUR\/JPY/);
  assert.match(positionSize({ balance: 1000, riskPct: 1, stopPips: 10, pair: 'XAUUSD' }).error, /Pairs of/);
  assert.match(positionSize({ balance: 1000, riskPct: 0, stopPips: 10, pair: 'EURUSD' }).error, /risk/);
});

test('/size text', () => {
  const t = size({ balance: 10000, risk: 1, stop: 25, pair: 'EURUSD' });
  check(t);
  assert.match(t, /\*\*0\.40 lots\*\* \(40,000 units\)/);
  assert.match(t, /tradingtools\?via=discord-desk>$/);
  const r = size({ balance: 10000, risk: 1, stop: 30, pair: 'EURUSD' });
  assert.match(r, /Rounded down to 0\.01 lot, so the risk is 99\.00 USD/);
  assert.match(size({ balance: 100, risk: 0.5, stop: 50, pair: 'EURUSD' }), /under the smallest lot/);
  assert.match(size({ balance: 1000, risk: 1, stop: 10, pair: 'USDJPY' }), /Add the price of USD\/JPY as `rate`/);
});

test('/signal: the latest on the pair, no ICT words, no outside images', () => {
  const feed = {
    signals: [
      { pair: 'EURUSD', side: 'buy', entry: 1.0842, stop: 1.0811, targets: [1.0873, 1.0904], t: '2026-11-02T13:05:00Z', status: 'open', strategy: 'Silver bullet', chart: 'https://evil.example/c.png' },
      { pair: 'EURUSD', side: 'sell', entry: 1.09, stop: 1.093, targets: [1.087], t: '2026-10-30T13:05:00Z', status: 'stopped', strategy: 'Break and retest' },
    ],
  };
  const t = signal({ signals: feed }, 'eur/usd');
  check(t);
  assert.match(t, /\*\*EUR\/USD BUY\*\*/);
  assert.match(t, /Entry `1\.0842` · Stop `1\.0811` · Targets `1\.0873, 1\.0904`/);
  assert.doesNotMatch(t, /evil|Silver/i);
  assert.match(t, /losses included/);
  assert.match(t, /forex-signals\/eurusd\/\?via=discord-desk>$/);
  assert.match(signal({ signals: null }, 'EURUSD'), /not available right now/);
  assert.match(signal({ signals: feed }, 'GBPUSD'), /No public TradingSignalBot signal on GBP\/USD/);
});

test('/help has the shared footer', () => {
  const t = help();
  assert.match(t, /Part of the Forexia network: \[InterestRateDecision\.com\]\(<https:\/\/interestratedecision\.com\/\?via=discord-desk>\) · \[Forexia Academy\]/);
  assert.match(t, /TradingSignalBot.*PropSim.*OpenCharts/);
  assert.ok(t.length <= 2000);
});

test('commands are valid for Discord', () => {
  for (const c of COMMANDS) {
    assert.match(c.name, /^[a-z]{1,32}$/);
    assert.ok(c.description.length >= 1 && c.description.length <= 100, c.name);
    for (const o of c.options ?? []) {
      assert.ok(o.description.length <= 100, `${c.name} ${o.name}`);
      assert.ok((o.choices ?? []).length <= 25);
      for (const s of o.options ?? []) assert.ok(s.description.length <= 100);
    }
  }
});

test('the handler: PING, a command, options and subcommands', async () => {
  const feeds = { get: async (k) => ({ rates, next }[k] ?? null) };
  assert.deepEqual((await handle({ type: 1 }, { feeds })).response, { type: 1 });
  const { response } = await handle({ type: 2, data: { name: 'rate', options: [{ name: 'bank', type: 3, value: 'ecb' }] } }, { feeds, now: () => now });
  assert.equal(response.type, 4);
  assert.match(response.data.content, /European Central Bank/);
  assert.deepEqual(response.data.allowed_mentions, { parse: [] });
  assert.deepEqual(optionsOf({ options: [{ type: 1, name: 'subscribe', options: [{ name: 'bank', value: 'fed' }] }] }), { sub: 'subscribe', bank: 'fed' });
  const dm = await handle({ type: 2, data: { name: 'alerts', options: [{ type: 1, name: 'subscribe' }] }, channel_id: '5' }, { feeds });
  assert.match(dm.response.data.content, /server channel/);
});

test('/alerts subscribe: creates the webhook, registers it with IRD, cleans up on refusal', async () => {
  const calls = [];
  const discord = async (method, path, body) => {
    calls.push([method, path, body]);
    if (method === 'POST') return { status: 200, body: { id: '123456789', token: 'T'.repeat(68) } };
    return { status: 204, body: null };
  };
  const posted = [];
  const ok = await alerts.subscribe({ channelId: '42', bank: 'fed', discord, post: async (u, b) => (posted.push([u, b]), { status: 200, body: { ok: true, kind: 'discord' } }) });
  assert.match(ok, /the Federal Reserve's decisions/);
  assert.deepEqual(posted[0], ['https://interestratedecision.com/api/hooks', { url: `https://discord.com/api/webhooks/123456789/${'T'.repeat(68)}`, banks: ['fed'] }]);
  assert.match(posted[0][1].url, /^https:\/\/discord\.com\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,200}$/, "matches IRD's pattern");
  calls.length = 0;
  const refused = await alerts.subscribe({ channelId: '42', discord, post: async () => ({ status: 429, body: { error: 'Too many channels added from here today. Try again tomorrow.' } }) });
  assert.match(refused, /Too many channels[\s\S]*Copy Webhook URL[\s\S]*alerts\/\?via=discord-desk>$/);
  assert.deepEqual(calls.at(-1), ['DELETE', '/webhooks/123456789', undefined]);
  const noPerm = await alerts.subscribe({ channelId: '42', discord: async () => ({ status: 403, body: {} }), post: async () => ({}) });
  assert.match(noPerm, /Manage Webhooks/);
});

test('/alerts unsubscribe removes only its own webhooks', async () => {
  const deleted = [];
  const removed = [];
  const discord = async (method, path) => {
    if (method === 'GET') return { status: 200, body: [{ id: '1', token: 'a', application_id: 'APP' }, { id: '2', token: 'b', user: { id: 'someone' } }, { id: '3', user: { id: 'APP' } }] };
    deleted.push(path);
    return { status: 204 };
  };
  const t = await alerts.unsubscribe({ channelId: '42', appId: 'APP', discord, post: async (u, b) => removed.push(b.url) });
  assert.match(t, /alerts in this channel are off/);
  assert.deepEqual(deleted, ['/webhooks/1']);
  assert.deepEqual(removed, ['https://discord.com/api/webhooks/1/a']);
});
