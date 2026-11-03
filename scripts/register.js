// Registers the slash commands with Discord. Global by default (they can take
// up to an hour to appear everywhere); with DISCORD_GUILD_ID, in that one
// server at once, for testing.
//   node --env-file=.env scripts/register.js
import { COMMANDS } from '../src/commands.js';

const { DISCORD_APPLICATION_ID: app, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guild } = process.env;
if (!app || !token) {
  console.error('Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN.');
  process.exit(1);
}
const path = guild ? `/applications/${app}/guilds/${guild}/commands` : `/applications/${app}/commands`;
const body = guild ? COMMANDS.map(({ integration_types, contexts, ...c }) => c) : COMMANDS;
const res = await fetch(`https://discord.com/api/v10${path}`, {
  method: 'PUT',
  headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const out = await res.json().catch(() => null);
if (!res.ok) {
  console.error(res.status, JSON.stringify(out, null, 2));
  process.exit(1);
}
console.log(`${out.length} commands registered ${guild ? `in server ${guild}` : 'globally'}: ${out.map((c) => `/${c.name}`).join(' ')}`);
console.log(`Invite: https://discord.com/oauth2/authorize?client_id=${app}&scope=bot+applications.commands&permissions=536870912`);
