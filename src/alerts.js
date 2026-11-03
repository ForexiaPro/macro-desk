// /alerts: InterestRateDecision.com already sends its decision alerts to any
// Discord channel webhook registered on https://interestratedecision.com/alerts/
// (POST /api/hooks {url, banks}). The bot only saves the steps: it creates a
// webhook in the channel and registers it there. IRD's rules hold: it posts a
// welcome message first and keeps the address only if that arrives, and it
// takes a few sign-ups a network a day. When IRD refuses, the bot deletes the
// webhook it made and says how to add one by hand.
//
// Unsubscribing deletes the bot's webhooks in the channel and tells IRD; IRD
// would drop a deleted webhook at the next alert anyway.
import { IRD, source } from './format.js';
import { BANK } from './commands.js';

export const WEBHOOK_NAME = 'Interest Rate Decisions';
const ALERTS_PAGE = `${IRD}/alerts/`;

const manual = 'To add the alerts by hand: Channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL, then paste it on the alerts page.';

/** `discord(method, path, body)` → {status, body}; `post(url, body)` → {status, body}. */
export async function subscribe({ channelId, bank, discord, post, idOf = (w) => w.id }) {
  const banks = bank && BANK[bank] ? [bank] : [];
  const made = await discord('POST', `/channels/${channelId}/webhooks`, { name: WEBHOOK_NAME });
  if (made.status === 403) return `I need the **Manage Webhooks** permission in this channel to add the alerts. ${manual}${source(ALERTS_PAGE)}`;
  if (made.status === 400 && made.body?.code === 30007) return `This channel has the most webhooks Discord allows. Delete one first. ${manual}${source(ALERTS_PAGE)}`;
  if (made.status < 200 || made.status >= 300 || !made.body?.token) return `Discord did not create the webhook (${made.status || 'no answer'}). ${manual}${source(ALERTS_PAGE)}`;
  const url = `https://discord.com/api/webhooks/${idOf(made.body)}/${made.body.token}`;
  const res = await post(`${IRD}/api/hooks`, { url, banks }).catch(() => ({ status: 0, body: null }));
  if (res.status >= 200 && res.status < 300 && res.body?.ok) {
    const which = banks.length ? `the ${BANK[bank].name}'s decisions` : 'every decision of the ten banks';
    return `This channel will now get an alert for ${which} from InterestRateDecision.com: an hour before, and the result the moment it is out. Alerts never mention @everyone. To stop them: \`/alerts unsubscribe\`.${source(ALERTS_PAGE)}`;
  }
  await discord('DELETE', `/webhooks/${idOf(made.body)}`).catch(() => {});
  const why = typeof res.body?.error === 'string' ? res.body.error : `InterestRateDecision.com did not answer (${res.status || 'no answer'}).`;
  return `${why} ${manual}${source(ALERTS_PAGE)}`;
}

export async function unsubscribe({ channelId, appId, discord, post }) {
  const list = await discord('GET', `/channels/${channelId}/webhooks`);
  if (list.status === 403) return `I need the **Manage Webhooks** permission in this channel to remove the alerts. You can also delete the "${WEBHOOK_NAME}" webhook in Channel settings → Integrations.${source(ALERTS_PAGE)}`;
  const mine = (Array.isArray(list.body) ? list.body : []).filter((w) => w.token && (w.application_id === appId || w.user?.id === appId));
  for (const w of mine) {
    await post(`${IRD}/api/hooks/remove`, { url: `https://discord.com/api/webhooks/${w.id}/${w.token}` }).catch(() => {});
    await discord('DELETE', `/webhooks/${w.id}`).catch(() => {});
  }
  return mine.length
    ? `Done: the alerts in this channel are off.${source(ALERTS_PAGE)}`
    : `I found no alerts webhook of mine in this channel. One added by hand is removed by deleting it in Channel settings → Integrations → Webhooks.${source(ALERTS_PAGE)}`;
}

export const how = () =>
  [
    '**Decision alerts** come from InterestRateDecision.com: a message an hour before each central bank decision, and the result the moment it is out. Ten banks, or the one you pick.',
    '`/alerts subscribe [bank]` creates a webhook in this channel and registers it. It needs the Manage Webhooks permission, yours and mine.',
    '`/alerts unsubscribe` deletes it.',
    'What InterestRateDecision.com keeps: the webhook address, which banks, and when it was added. Nothing about the members.',
    manual,
  ].join('\n') + source(ALERTS_PAGE);
