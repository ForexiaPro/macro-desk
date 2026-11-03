// The slash commands, as Discord registers them (scripts/register.js).
import { CURRENCIES } from './size.js';

export const BANKS = [
  ['fed', 'Federal Reserve', 'Fed'],
  ['ecb', 'European Central Bank', 'ECB'],
  ['boe', 'Bank of England', 'BoE'],
  ['boj', 'Bank of Japan', 'BoJ'],
  ['boc', 'Bank of Canada', 'BoC'],
  ['rba', 'Reserve Bank of Australia', 'RBA'],
  ['rbnz', 'Reserve Bank of New Zealand', 'RBNZ'],
  ['snb', 'Swiss National Bank', 'SNB'],
  ['norges', 'Norges Bank', 'Norges Bank'],
  ['riksbank', 'Sveriges Riksbank', 'Riksbank'],
];
export const BANK = Object.fromEntries(BANKS.map(([id, name, short]) => [id, { id, name, short }]));
export const COT_CURRENCIES = ['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'USD'];

const STRING = 3, NUMBER = 10, SUB = 1;
/** Manage Webhooks: only people who could add a webhook by hand can subscribe a channel. */
export const MANAGE_WEBHOOKS = 1n << 29n;
const ANYWHERE = { integration_types: [0, 1], contexts: [0, 1, 2] };
const GUILD_ONLY = { integration_types: [0], contexts: [0] };

const bankOption = (required = true) => ({
  type: STRING,
  name: 'bank',
  description: 'The central bank',
  required,
  choices: BANKS.map(([value, name]) => ({ name, value })),
});

export const COMMANDS = [
  { name: 'rate', description: "A central bank's current rate and its next decision", options: [bankOption()], ...ANYWHERE },
  { name: 'next', description: 'The next central bank decisions, in your own time', options: [bankOption(false)], ...ANYWHERE },
  { name: 'odds', description: 'Hike, hold or cut: the odds from the record for the next meetings', options: [bankOption()], ...ANYWHERE },
  {
    name: 'cot',
    description: "This week's COT positioning of large speculators in a currency",
    options: [{ type: STRING, name: 'currency', description: 'The currency', required: true, choices: COT_CURRENCIES.map((c) => ({ name: c, value: c })) }],
    ...ANYWHERE,
  },
  {
    name: 'size',
    description: 'Position size from your balance, risk and stop',
    options: [
      { type: NUMBER, name: 'balance', description: 'Account balance', required: true, min_value: 0.01 },
      { type: NUMBER, name: 'risk', description: 'Risk per trade, % of the balance (e.g. 1)', required: true, min_value: 0.01, max_value: 100 },
      { type: NUMBER, name: 'stop', description: 'Stop distance in pips', required: true, min_value: 0.1 },
      { type: STRING, name: 'pair', description: 'The pair, e.g. EURUSD', required: true, min_length: 6, max_length: 7 },
      { type: STRING, name: 'account', description: 'Account currency (default USD)', required: false, choices: CURRENCIES.map((c) => ({ name: c, value: c })) },
      { type: NUMBER, name: 'rate', description: 'Only if the account is not the quote currency: the price that converts it', required: false, min_value: 0.000001 },
    ],
    ...ANYWHERE,
  },
  {
    name: 'signal',
    description: "TradingSignalBot's latest public signal on a pair",
    options: [{ type: STRING, name: 'pair', description: 'The pair, e.g. EURUSD', required: true, min_length: 6, max_length: 8 }],
    ...ANYWHERE,
  },
  {
    name: 'alerts',
    description: 'Central bank decision alerts in this channel, from InterestRateDecision.com',
    default_member_permissions: String(MANAGE_WEBHOOKS),
    ...GUILD_ONLY,
    options: [
      { type: SUB, name: 'subscribe', description: 'Post an alert here an hour before each decision and with the result', options: [bankOption(false)] },
      { type: SUB, name: 'unsubscribe', description: 'Stop the alerts in this channel' },
      { type: SUB, name: 'how', description: 'How the alerts work, and how to add them by hand' },
    ],
  },
  { name: 'help', description: 'What Macro Desk does and where its figures come from', ...ANYWHERE },
];
