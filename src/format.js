// Every answer as text. Pure: the data and the options in, a string out, and
// every answer ends with the page its figures come from (?via=discord-desk).
// Times are Discord timestamps (<t:…>), so each reader sees their own time.
import { BANK, COT_CURRENCIES } from './commands.js';
import { cotOf, decisionsOf, oddsOf, rateOf, signalsOf } from './data.js';
import { positionSize } from './size.js';

export const TOOL = 'discord-desk';
export const IRD = 'https://interestratedecision.com';

export function via(url) {
  if (/^https:\/\/github\.com\//.test(url)) return url;
  const u = new URL(url);
  u.searchParams.set('via', TOOL);
  return u.toString();
}
export const source = (url, label = 'Source') => `\n${label}: <${via(url)}>`;
const link = (label, url) => `[${label}](<${via(url)}>)`;

export const FOOTER = `Part of the Forexia network: ${[
  ['InterestRateDecision.com', `${IRD}/`],
  ['Forexia Academy', 'https://forexiapro.com/'],
  ['TradingSignalBot', 'https://tradingsignalbot.com/'],
  ['PropSim', 'https://github.com/PropSim-Enterprise'],
  ['OpenCharts', 'https://github.com/dylanpersonguy/OpenCharts'],
]
  .map(([l, u]) => link(l, u))
  .join(' · ')}`;

const ts = (t, style = 'F') => `<t:${Math.floor(t / 1000)}:${style}>`;
const pct = (x) => `${Math.round(x * 100)}%`;
const fmt = (x, d = 2) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('en-US')}`;
const pairLabel = (p) => (p.length === 6 ? `${p.slice(0, 3)}/${p.slice(3)}` : p);
const rateText = (r) => (typeof r.rangeLow === 'number' ? `${r.rangeLow.toFixed(2)}–${r.rate.toFixed(2)}%` : `${r.rate.toFixed(2)}%`);
const shortOf = (d) => d.short ?? BANK[d.bank]?.short ?? String(d.bank).toUpperCase();

export function rate({ rates, next }, bank, now = Date.now()) {
  const b = BANK[bank];
  const r = rateOf(rates, bank);
  const page = r?.page ?? `${IRD}/${bank}/`;
  if (!b || !r) return `The ${b?.name ?? 'bank'}'s rate is not available right now.${source(page)}`;
  const lines = [`**${r.name ?? b.name}**: the ${r.rateName ?? 'policy rate'} is **${rateText(r)}**${r.lastChange && Date.parse(r.lastChange) ? `, since ${ts(Date.parse(r.lastChange), 'D')}` : ''}.`];
  const d = decisionsOf(next, now).find((x) => x.bank === bank);
  const nextAt = d?.at ?? (Date.parse(r.nextDecision) > now ? Date.parse(r.nextDecision) : null);
  if (nextAt) lines.push(`Next decision: ${ts(nextAt)} (${ts(nextAt, 'R')})${d?.tentative ? ', tentative' : ''}.`);
  return lines.join('\n') + source(page);
}

export function nextList({ next }, bank, now = Date.now()) {
  const all = decisionsOf(next, now);
  const list = (bank ? all.filter((d) => d.bank === bank) : all).slice(0, bank ? 3 : 6);
  if (!list.length) return `No decision${bank ? ` of the ${BANK[bank]?.name ?? bank}` : ''} in the calendar right now.${source(`${IRD}/calendar/`)}`;
  const lines = list.map((d) => `• **${shortOf(d)}** ${d.rateName ?? 'rate decision'}${typeof d.rateBefore === 'number' ? `, now ${d.rateBefore.toFixed(2)}%` : ''}: ${ts(d.at, 'f')} (${ts(d.at, 'R')})${d.tentative ? ', tentative' : ''}`);
  const page = bank ? (list[0].page ?? `${IRD}/${bank}/`) : `${IRD}/calendar/`;
  return `**Next central bank decisions**\n${lines.join('\n')}${source(page)}`;
}

const bar = (x) => `${'█'.repeat(Math.round(x * 10))}${'░'.repeat(10 - Math.round(x * 10))}`;

export function odds({ odds: data, next }, bank, now = Date.now()) {
  const b = BANK[bank];
  const page = `${IRD}/${bank}/rate-odds/`;
  const list = oddsOf(data, bank, now).slice(0, 3);
  if (!b) return `Pick one of the ten banks.${source(`${IRD}/rate-odds/`)}`;
  if (!list.length) return `The odds for the ${b.name} are not in the open data right now.${source(page)}`;
  const decisions = decisionsOf(next, now).filter((d) => d.bank === bank);
  const blocks = list.map((o, i) => {
    const at = o.at ?? decisions[i]?.at;
    const head = at ? `**${b.short}, ${ts(at, 'D')}** (${ts(at, 'R')})` : `**${b.short}, ${i ? 'the meeting after' : 'next meeting'}**`;
    const rows = ['hike', 'hold', 'cut'].map((k) => `\`${k.padEnd(4)} ${bar(o[k])} ${pct(o[k]).padStart(4)}\``);
    return [head, ...rows].join('\n');
  });
  return `${blocks.join('\n\n')}\nOdds from the record: how decisions like this one went, counted by InterestRateDecision.com. Not market odds, and not a forecast.${source(list[0].page ?? page)}`;
}

export function cot({ cot: data }, currency) {
  const page = 'https://forexiapro.com/cot-report/';
  const c = String(currency ?? '').toUpperCase();
  if (!COT_CURRENCIES.includes(c)) return `Pick one of ${COT_CURRENCIES.join(', ')}.${source(page)}`;
  const parsed = cotOf(data);
  const r = parsed?.rows[c];
  if (!r) return `The COT positioning for ${c} is not available right now.${source(page)}`;
  const week = parsed.asOf ? `, report of ${ts(parsed.asOf, 'D')}` : '';
  const lines = [`**${c} COT positioning**${week}`];
  const n = (x) => Math.abs(x).toLocaleString('en-US');
  const sides = r.long != null && r.short != null ? `: ${n(r.long)} long, ${n(r.short)} short` : '';
  lines.push(`Large speculators (non-commercial) are net **${r.net >= 0 ? 'long' : 'short'}** ${n(r.net)} contracts${sides}.`);
  const more = [r.change != null && `${signed(r.change)} on the week`, r.pctOi != null && `${r.pctOi > 0 ? '+' : r.pctOi < 0 ? '−' : ''}${Math.abs(r.pctOi).toFixed(1)}% of open interest`].filter(Boolean);
  if (more.length) lines.push(`Net ${more.join(', ')}.`);
  lines.push("CFTC Commitments of Traders, futures. Positions only: Forexia's COT index and weekly reading are on the page below.");
  return lines.join('\n') + source(page);
}

export function size(opts) {
  const page = 'https://forexiapro.com/tradingtools';
  const r = positionSize({ balance: opts.balance, riskPct: opts.risk, stopPips: opts.stop, pair: opts.pair, account: opts.account ?? 'USD', rate: opts.rate });
  if (r.error) return `${r.error}${source(page)}`;
  const lines = [
    `Risking **${fmt(opts.risk, opts.risk % 1 ? 2 : 0)}%** of ${fmt(opts.balance)} ${r.account} = **${fmt(r.riskAmount)} ${r.account}** over a ${fmt(opts.stop, opts.stop % 1 ? 1 : 0)}-pip stop on ${pairLabel(r.pair)}:`,
    `**${fmt(r.lots)} lots** (${r.units.toLocaleString('en-US')} units). A pip is worth ${fmt(r.pipValue)} ${r.account} a lot${r.conversion ? ` at ${pairLabel(r.conversion)} ${opts.rate}` : ''}.`,
  ];
  if (r.lots === 0) lines.push('That is under the smallest lot (0.01): widen the risk or tighten the stop.');
  else if (Math.abs(r.actualRisk - r.riskAmount) > 0.005) lines.push(`Rounded down to 0.01 lot, so the risk is ${fmt(r.actualRisk)} ${r.account}.`);
  return lines.join('\n') + source(page, 'More tools');
}

export function signal({ signals }, pairText) {
  const pair = String(pairText ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6,8}$/.test(pair)) return `Give a pair like EURUSD.${source('https://tradingsignalbot.com/record/')}`;
  const page = `https://tradingsignalbot.com/forex-signals/${pair.toLowerCase()}/`;
  if (!signals) return `TradingSignalBot's public signal feed is not available right now.${source(page)}`;
  const s = signalsOf(signals).find((x) => x.pair === pair);
  if (!s) return `No public TradingSignalBot signal on ${pairLabel(pair)} right now.${source(page)}`;
  const n = (x) => (x == null ? '–' : String(+x.toFixed(5)));
  const lines = [
    `**${pairLabel(pair)}${s.side ? ` ${s.side.toUpperCase()}` : ''}**${s.strategy ? ` · ${s.strategy}` : ''}${s.at ? ` · ${ts(s.at, 'f')}` : ''}${s.status ? ` · ${s.status}` : ''}`,
    `Entry \`${n(s.entry)}\` · Stop \`${n(s.stop)}\` · Targets \`${s.targets.length ? s.targets.map(n).join(', ') : '–'}\``,
  ];
  if (s.chart) lines.push(`Chart: <${s.chart}>`);
  lines.push('A signal is not advice. Every one stays in the public record, losses included.');
  return lines.join('\n') + source(s.page ?? page);
}

export function help() {
  return [
    '**Macro Desk**: central bank decisions, rate odds, COT positioning, position size and signals, in your server.',
    '`/rate bank` the current rate and the next decision',
    '`/next [bank]` the next decisions, in your own time',
    '`/odds bank` hike, hold or cut: odds from the record, not markets',
    '`/cot currency` large speculators\' net position, its weekly change and share of open interest',
    '`/size balance risk stop pair` lots for a fixed risk',
    '`/signal pair` the latest public TradingSignalBot signal',
    '`/alerts subscribe` an alert in this channel an hour before each decision and with the result',
    'Figures: InterestRateDecision.com (rates, calendar, odds), the CFTC (COT), TradingSignalBot (signals). No account, nothing about you is kept.',
    FOOTER,
  ].join('\n') + source('https://github.com/ForexiaPro/macro-desk', 'Open source');
}
