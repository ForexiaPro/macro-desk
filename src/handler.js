// One interaction in, one response out (and, for the slow commands, the work to
// do after the response: `after`, which edits the deferred answer).
import * as alerts from './alerts.js';
import { cot, help, nextList, odds, rate, signal, size } from './format.js';

export const PING = 1, COMMAND = 2;
const PONG = 1, MESSAGE = 4, DEFERRED = 5;
const EPHEMERAL = 1 << 6, SUPPRESS_EMBEDS = 1 << 2;

const message = (content, ephemeral = false) => ({
  type: MESSAGE,
  data: { content: content.slice(0, 2000), flags: SUPPRESS_EMBEDS | (ephemeral ? EPHEMERAL : 0), allowed_mentions: { parse: [] } },
});

/** The options of a command (or of its subcommand) as {name: value}. */
export function optionsOf(data) {
  let opts = data?.options ?? [];
  let sub = null;
  if (opts[0]?.type === 1) {
    sub = opts[0].name;
    opts = opts[0].options ?? [];
  }
  return { sub, ...Object.fromEntries(opts.map((o) => [o.name, o.value])) };
}

/**
 * deps: {feeds, discord, post, appId, now}. Returns {response, after?}.
 */
export async function handle(interaction, deps) {
  if (interaction?.type === PING) return { response: { type: PONG } };
  if (interaction?.type !== COMMAND) return { response: message('That is not something I can answer.', true) };
  const name = interaction.data?.name;
  const o = optionsOf(interaction.data);
  const now = deps.now?.() ?? Date.now();
  const get = (...keys) => Promise.all(keys.map((k) => deps.feeds.get(k))).then((v) => Object.fromEntries(keys.map((k, i) => [k, v[i]])));
  switch (name) {
    case 'rate':
      return { response: message(rate(await get('rates', 'next'), o.bank, now)) };
    case 'next':
      return { response: message(nextList(await get('next'), o.bank, now)) };
    case 'odds':
      return { response: message(odds(await get('odds', 'next'), o.bank, now)) };
    case 'cot':
      return { response: message(cot(await get('cot'), o.currency)) };
    case 'size':
      return { response: message(size(o)) };
    case 'signal':
      return { response: message(signal(await get('signals'), o.pair)) };
    case 'help':
      return { response: message(help(), true) };
    case 'alerts': {
      if (o.sub === 'how' || !o.sub) return { response: message(alerts.how(), true) };
      const channelId = interaction.channel_id ?? interaction.channel?.id;
      if (!interaction.guild_id || !channelId) return { response: message('Alerts go to a server channel: run this in one.', true) };
      if (!deps.discord) return { response: message(alerts.how(), true) };
      const work = o.sub === 'subscribe'
        ? () => alerts.subscribe({ channelId, bank: o.bank, discord: deps.discord, post: deps.post })
        : () => alerts.unsubscribe({ channelId, appId: deps.appId, discord: deps.discord, post: deps.post });
      return {
        response: { type: DEFERRED, data: { flags: EPHEMERAL } },
        after: async () => {
          const content = await work().catch((e) => `Something went wrong (${e.message}). ${alerts.how()}`);
          await deps.discord('PATCH', `/webhooks/${interaction.application_id ?? deps.appId}/${interaction.token}/messages/@original`, {
            content: content.slice(0, 2000),
            flags: SUPPRESS_EMBEDS,
            allowed_mentions: { parse: [] },
          });
        },
      };
    }
    default:
      return { response: message(`I do not know /${name}.\n${help()}`, true) };
  }
}
