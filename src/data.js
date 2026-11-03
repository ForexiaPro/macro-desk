// The feeds the commands read, cached in memory. Discord gives a command three
// seconds to answer, so the cache is refreshed in the background (every five
// minutes) and a command waits at most FETCH_MS for a feed it has never had.
// Every feed is read defensively: a missing field is "not available", never a crash.

export const URLS = {
  rates: 'https://interestratedecision.com/data/rates.json',
  next: 'https://interestratedecision.com/data/next.json',
  odds: 'https://interestratedecision.com/data/odds.json',
  cot: 'https://raw.githubusercontent.com/ForexiaPro/cot-data/main/data/latest.json',
  signals: 'https://tradingsignalbot.com/data/signals.json',
};
const TTL = 5 * 60 * 1000;
const FETCH_MS = 2000;

export function feeds({ fetch: fetchFn = globalThis.fetch, now = Date.now, urls = URLS } = {}) {
  const cache = new Map();
  async function load(key, timeout = 8000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetchFn(urls[key], { signal: ctl.signal, headers: { 'user-agent': 'MacroDesk/1.0 (+https://github.com/ForexiaPro/macro-desk)' } });
      if (!res.ok) return cache.get(key)?.value ?? null;
      const value = await res.json();
      cache.set(key, { value, at: now() });
      return value;
    } catch {
      return cache.get(key)?.value ?? null;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    /** A feed: the cached copy (refreshed behind the answer when old), else a quick fetch. */
    async get(key) {
      const hit = cache.get(key);
      if (hit) {
        if (now() - hit.at > TTL) load(key);
        return hit.value;
      }
      return load(key, FETCH_MS);
    },
    async refreshAll() {
      await Promise.all(Object.keys(urls).map((k) => load(k)));
    },
    cache,
  };
}

// ------------------------------------------------------------- parsing

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(+x) ? +x : null);
export const timeOf = (x) => {
  if (x == null || x === '') return null;
  const t = typeof x === 'number' ? (x < 1e12 ? x * 1000 : x) : Date.parse(x);
  return Number.isFinite(t) ? t : null;
};

export function rateOf(rates, bank) {
  const r = Array.isArray(rates?.rates) ? rates.rates.find((x) => x?.bank === bank) : null;
  return r && num(r.rate) != null ? r : null;
}

export function decisionsOf(next, now = Date.now()) {
  const list = Array.isArray(next?.decisions) ? next.decisions : [];
  return list
    .map((d) => ({ ...d, at: timeOf(d?.t) }))
    .filter((d) => d.at && typeof d.bank === 'string' && d.at > now)
    .sort((a, b) => a.at - b.at);
}

/** Every meeting with odds in odds.json, whatever its exact shape. */
export function oddsEntries(odds) {
  const out = [];
  const take = (o, bank) => {
    if (!o || typeof o !== 'object') return;
    const b = typeof o.bank === 'string' ? o.bank : bank;
    const p = o.odds && typeof o.odds === 'object' ? o.odds : o.probs && typeof o.probs === 'object' ? o.probs : o;
    let hike = num(p.hike), hold = num(p.hold), cut = num(p.cut);
    if (b && hike != null && hold != null && cut != null) {
      if (hike + hold + cut > 1.5) [hike, hold, cut] = [hike / 100, hold / 100, cut / 100];
      const sum = hike + hold + cut;
      if (sum > 0.9 && sum < 1.1 && hike >= 0 && hold >= 0 && cut >= 0) {
        out.push({ bank: b, at: timeOf(o.t ?? o.date ?? o.at ?? o.time), hike, hold, cut, rule: typeof o.rule === 'string' ? o.rule : null, page: typeof o.page === 'string' ? o.page : null });
      }
      return;
    }
    for (const key of ['meetings', 'next', 'decisions']) if (Array.isArray(o[key])) o[key].forEach((m) => take(m, b));
  };
  const root = odds && typeof odds === 'object' ? odds : {};
  for (const key of ['banks', 'odds', 'meetings', 'decisions']) {
    const v = root[key];
    if (Array.isArray(v)) v.forEach((x) => take(x));
    else if (v && typeof v === 'object') for (const [bank, x] of Object.entries(v)) Array.isArray(x) ? x.forEach((m) => take(m, bank)) : take(x, bank);
  }
  if (Array.isArray(odds)) odds.forEach((x) => take(x));
  if (!out.length) for (const [bank, x] of Object.entries(root)) if (/^[a-z]+$/.test(bank) && x && typeof x === 'object') Array.isArray(x) ? x.forEach((m) => take(m, bank)) : take(x, bank);
  return out;
}

/** The bank's meetings with odds, soonest first (those already past dropped). */
export function oddsOf(odds, bank, now = Date.now()) {
  return oddsEntries(odds)
    .filter((e) => e.bank === bank && (!e.at || e.at > now))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
}

const COT_NAMES = { 'EURO FX': 'EUR', 'BRITISH POUND': 'GBP', 'JAPANESE YEN': 'JPY', 'SWISS FRANC': 'CHF', 'CANADIAN DOLLAR': 'CAD', 'AUSTRALIAN DOLLAR': 'AUD', 'NZ DOLLAR': 'NZD', 'NEW ZEALAND DOLLAR': 'NZD', 'USD INDEX': 'USD', 'U.S. DOLLAR INDEX': 'USD', GOLD: 'XAU' };
const pick = (o, keys) => {
  for (const k of keys) {
    const v = k.split('.').reduce((a, p) => (a && typeof a === 'object' ? a[p] : undefined), o);
    if (num(v) != null) return num(v);
  }
  return null;
};
const codeOf = (x) => {
  if (typeof x !== 'string') return null;
  const u = x.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(u)) return u;
  for (const [name, code] of Object.entries(COT_NAMES)) if (u.startsWith(name)) return code;
  return null;
};

/**
 * The COT file as {asOf, rows: {EUR: {net, change, pctOi, long, short, oi}}}: the
 * large speculators (legacy non-commercial) of each market, or null. Positions
 * only: the file has no index and this adds none.
 */
export function cotOf(data) {
  if (!data || typeof data !== 'object') return null;
  const rows = {};
  const take = (o, key) => {
    if (!o || typeof o !== 'object') return;
    const code = [o.id, o.currency, o.symbol, o.asset, o.code, o.market, o.name, key].map(codeOf).find(Boolean);
    if (!code) return;
    const g = ['legacy.noncommercial', 'legacy.nonCommercial', 'noncommercial', 'nonCommercial', 'speculators'];
    const at = (fields, flat = []) => pick(o, [...g.flatMap((p) => fields.map((f) => `${p}.${f}`)), ...flat]);
    const net = at(['net'], ['net', 'netNonCommercial', 'nonCommercialNet', 'net_noncommercial', 'positions.net']);
    const change = at(['net_change_1w', 'change', 'netChange'], ['net_change_1w', 'change', 'netChange', 'weeklyChange', 'net_change']);
    const pctOi = at(['net_pct_oi', 'netPctOi'], ['net_pct_oi', 'netPctOi']);
    const long = at(['long', 'longs'], ['long']);
    const short = at(['short', 'shorts'], ['short']);
    const oi = pick(o, ['open_interest', 'openInterest', 'oi']);
    if (net == null) return;
    rows[code] = { net, change, pctOi, long, short, oi };
  };
  for (const l of [data.currencies, data.markets, data.data, data.rows, data.latest, Array.isArray(data) ? data : null]) {
    if (Array.isArray(l)) l.forEach((x) => take(x));
    else if (l && typeof l === 'object') Object.entries(l).forEach(([k, x]) => take(x, k));
  }
  if (!Object.keys(rows).length) Object.entries(data).forEach(([k, x]) => take(x, k));
  if (!Object.keys(rows).length) return null;
  return { asOf: timeOf(data.report_date ?? data.asOf ?? data.reportDate ?? data.date ?? data.week ?? data.updated), rows };
}

// IRD's rule: nothing that links to it uses these. Applied to text from the signal feed.
const BANNED = [
  'order block', 'fair value gap', 'fvg', 'kill ?zone', 'liquidity void', 'imbalance', 'buy[- ]side', 'sell[- ]side',
  'inducement', 'displacement', 'break of structure', 'bos', 'change of character', 'choch', 'premium', 'discount',
  'judas', 'silver bullet', 'smc', 'ict',
];
const BANNED_RE = new RegExp(`\\b(?:${BANNED.join('|')})\\b`, 'i');
export const isClean = (text) => typeof text === 'string' && !BANNED_RE.test(text);

const tsb = (u) => typeof u === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)?tradingsignalbot\.com\//.test(u);

/** The signals in the feed, latest first. */
export function signalsOf(feed) {
  const list = Array.isArray(feed) ? feed : Array.isArray(feed?.signals) ? feed.signals : Array.isArray(feed?.data) ? feed.data : [];
  return list
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const pair = String(s.pair ?? s.symbol ?? s.instrument ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z0-9]{6,8}$/.test(pair)) return null;
      const t = Array.isArray(s.targets) ? s.targets : Array.isArray(s.tp) ? s.tp : s.target ?? s.tp ?? s.takeProfit;
      const targets = (Array.isArray(t) ? t : t == null ? [] : [t]).map((x) => (x && typeof x === 'object' ? num(x.price ?? x.level) : num(x))).filter((x) => x != null);
      const side = String(s.side ?? s.direction ?? s.type ?? s.action ?? '').toLowerCase();
      return {
        pair,
        side: /buy|long/.test(side) ? 'buy' : /sell|short/.test(side) ? 'sell' : null,
        entry: num(s.entry ?? s.price ?? s.open),
        stop: num(s.stop ?? s.sl ?? s.stopLoss),
        targets,
        status: typeof s.status === 'string' && isClean(s.status) ? s.status : null,
        at: timeOf(s.t ?? s.time ?? s.opened ?? s.openedAt ?? s.createdAt ?? s.date),
        chart: [s.chart, s.image, s.chartUrl, s.img].find(tsb) ?? null,
        page: [s.url, s.page, s.link].find(tsb) ?? null,
        strategy: typeof s.strategy === 'string' && isClean(s.strategy) ? s.strategy : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}
