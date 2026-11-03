// Position size from balance, risk, stop and pair. Standard lots of 100,000
// units; a pip is 0.01 on a yen quote and 0.0001 otherwise.
//
// The pip's value is in the pair's quote currency. When the account is in
// another currency, one more price converts it: the pair of the quote and the
// account currency, written the way the market writes it (EUR before GBP
// before AUD before NZD before USD before CAD before CHF before NOK before SEK
// before JPY). For USD/JPY on a USD account that pair is USD/JPY itself.

export const CURRENCIES = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'NOK', 'SEK', 'JPY'];
export const LOT = 100_000;

export function parsePair(text) {
  const p = String(text ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (p.length !== 6) return null;
  const base = p.slice(0, 3), quote = p.slice(3);
  if (base === quote || !CURRENCIES.includes(base) || !CURRENCIES.includes(quote)) return null;
  return { base, quote, pair: p };
}

export const pipSize = (quote) => (quote === 'JPY' ? 0.01 : 0.0001);

/** The pair that converts `from` into `to`, as the market writes it, and whether its price must be inverted. */
export function conversionPair(from, to) {
  const first = CURRENCIES.indexOf(from) < CURRENCIES.indexOf(to);
  return first ? { pair: `${from}${to}`, invert: false } : { pair: `${to}${from}`, invert: true };
}

/**
 * {lots, units, riskAmount, pipValue} or {error, need?}. `rate` is the
 * conversion pair's price, needed only when the account is not the quote currency.
 */
export function positionSize({ balance, riskPct, stopPips, pair, account = 'USD', rate }) {
  const p = parsePair(pair);
  if (!p) return { error: `Pairs of ${CURRENCIES.join(', ')} only, like EURUSD or GBPJPY.` };
  const acc = String(account).toUpperCase();
  if (!CURRENCIES.includes(acc)) return { error: `The account currency must be one of ${CURRENCIES.join(', ')}.` };
  if (!(balance > 0)) return { error: 'The balance must be more than zero.' };
  if (!(riskPct > 0 && riskPct <= 100)) return { error: 'The risk is a percentage of the balance, more than 0 and at most 100.' };
  if (!(stopPips > 0)) return { error: 'The stop is a distance in pips, more than zero.' };
  const inQuote = LOT * pipSize(p.quote);
  let toAccount = 1;
  let conv = null;
  if (p.quote !== acc) {
    conv = conversionPair(p.quote, acc);
    if (!(rate > 0)) return { error: `A ${p.pair.slice(0, 3)}/${p.pair.slice(3)} stop is valued in ${p.quote}. Add the price of ${conv.pair.slice(0, 3)}/${conv.pair.slice(3)} as \`rate\` to convert it to ${acc}.`, need: conv.pair };
    toAccount = conv.invert ? 1 / rate : rate;
  }
  const pipValue = inQuote * toAccount;
  const riskAmount = (balance * riskPct) / 100;
  const exact = riskAmount / (stopPips * pipValue);
  const lots = Math.floor(exact * 100 + 1e-9) / 100;
  return { ...p, account: acc, riskAmount, pipValue, exact, lots, units: Math.round(lots * LOT), actualRisk: lots * stopPips * pipValue, conversion: conv?.pair ?? null };
}
