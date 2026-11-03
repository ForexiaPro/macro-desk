# Macro Desk

A Discord app for trading servers: central bank rates and decisions, rate odds, COT positioning, position size, signals, and decision alerts in a channel. Slash commands, no account, nothing about members kept.

| Command | Answers |
| --- | --- |
| `/rate bank` | The bank's current rate, since when, and its next decision (in each reader's own time) |
| `/next [bank]` | The next six decisions of the ten banks, or the next three of one |
| `/odds bank` | Hike, hold or cut for the next meetings: [odds from the record](https://interestratedecision.com/rate-odds/?via=discord-desk), not market odds |
| `/cot currency` | Large speculators' net position in EUR, GBP, JPY, CHF, CAD, AUD, NZD or USD, the week's change and the net as a share of open interest. Positions only: the answer links Forexia's [COT index and weekly reading](https://forexiapro.com/cot-report/?via=discord-desk) |
| `/size balance risk stop pair [account] [rate]` | Lots for a fixed risk, rounded down to 0.01 lot |
| `/signal pair` | TradingSignalBot's latest public signal on the pair: entry, stop, targets, status |
| `/alerts subscribe [bank]` | An alert in this channel an hour before each decision and with the result |
| `/alerts unsubscribe`, `/alerts how` | Stop them; how they work |
| `/help` | All of this |

The banks: Fed, ECB, Bank of England, Bank of Japan, Bank of Canada, RBA, RBNZ, SNB, Norges Bank, Riksbank.

Every answer ends with the page its figures come from. Times are Discord timestamps, so each member sees their own time zone.

## Add it to a server

Use the invite link: `https://discord.com/oauth2/authorize?client_id=<APPLICATION_ID>&scope=bot+applications.commands&permissions=536870912`

The one permission asked for (536870912) is **Manage Webhooks**, used only by `/alerts subscribe` to create the channel's alert webhook. Everything else works without it. `/alerts` is shown only to members who can manage webhooks themselves.

The app can also be installed to a user account (Discord's "user install") and the data commands then work in any DM or server; `/alerts` needs a server.

## Where the figures come from

| Command | Feed | Licence |
| --- | --- | --- |
| `/rate`, `/next` | [`interestratedecision.com/data/rates.json`, `next.json`](https://interestratedecision.com/central-bank-data/?via=discord-desk) | Free with a link |
| `/odds` | `interestratedecision.com/data/odds.json` | Free with a link |
| `/cot` | [`ForexiaPro/cot-data`](https://github.com/ForexiaPro/cot-data) `data/latest.json` | CFTC data, public domain |
| `/signal` | `tradingsignalbot.com/data/signals.json` | TradingSignalBot's public record |
| `/size` | Nothing: the arithmetic below | |

The feeds are kept in memory and refreshed every five minutes, so a command answers within Discord's three seconds. A feed that is down keeps its last copy; a command whose feed has never answered says so and links the page.

`/size`: a standard lot is 100,000 units; a pip is 0.01 on a yen quote, 0.0001 otherwise. The pip is valued in the pair's quote currency; when the account is in another currency, `rate` is the price of the pair that converts it, written the market's way (for GBP/JPY on a USD account, USD/JPY; for EUR/GBP, GBP/USD). The bot says which price it needs.

`/signal`: a signal is not advice, and the bot makes no claim for anyone's results: every TradingSignalBot signal stays in its [public record](https://tradingsignalbot.com/record/?via=discord-desk), losses included.

## The alerts

InterestRateDecision.com already sends its decision alerts to any Discord channel webhook registered on [its alerts page](https://interestratedecision.com/alerts/?via=discord-desk). `/alerts subscribe` saves the steps: it creates a webhook named "Interest Rate Decisions" in the channel and registers it there (`POST /api/hooks`). InterestRateDecision.com's own rules apply: it posts a welcome message first and keeps the address only if that arrives; alerts never mention `@everyone`; it takes at most five new channels a network a day. When it refuses, the bot deletes the webhook it made and explains how to add one by hand. `/alerts unsubscribe` deletes the bot's webhooks in the channel and tells InterestRateDecision.com.

What InterestRateDecision.com keeps: the webhook address, which banks, and when it was added.

## Host it

It is an HTTP interactions endpoint: no gateway connection, no dependency, a few MB of memory. Node 20.6 or later.

1. Create an application at https://discord.com/developers/applications. Copy the **Application ID** and **Public Key** (General Information). Under **Bot**, reset and copy the token.
2. `cp .env.example .env` and fill it in.
3. Run it where Discord can reach it over HTTPS:
   - **Railway**: new project from this repository (it builds the `Dockerfile`; `railway.json` sets the health check). Add the variables from `.env`. Generate a domain.
   - **Docker**: `docker build -t macro-desk . && docker run -p 8080:8080 --env-file .env macro-desk`
   - **Locally**: `npm run dev`, behind a tunnel (`cloudflared tunnel --url http://localhost:8080`).
4. In the application's General Information, set **Interactions Endpoint URL** to `https://<your host>/interactions`. Discord sends a signed PING; the server answers it and Discord saves the URL.
5. `npm run register` registers the commands (globally; set `DISCORD_GUILD_ID` to register in one server at once while testing). It prints the invite link.
6. Installation (the app's settings): Guild Install with scopes `applications.commands` and `bot`, permission Manage Webhooks; User Install with `applications.commands`.

Every request is checked against the application's public key (Ed25519, `node:crypto`) and refused when its signature is wrong or its timestamp is more than five minutes old.

## Develop

```sh
npm test       # node:test: signature checks, the endpoint, every answer's text, sizes, alerts
npm run dev    # the server with .env
```

| File | What it is |
| --- | --- |
| `src/server.js` | The HTTP endpoint (`/interactions`, `/healthz`) and the Discord REST calls |
| `src/verify.js` | Ed25519 request verification |
| `src/handler.js` | One interaction in, one response out |
| `src/format.js` | Every answer's text |
| `src/data.js` | The feeds, cached, and their parsing |
| `src/size.js` | The position size arithmetic |
| `src/alerts.js` | `/alerts`: the channel webhook and InterestRateDecision.com's `/api/hooks` |
| `src/commands.js` | The command definitions; `scripts/register.js` sends them |
| `docs/listings.md` | App Directory and top.gg texts |

## Privacy

The bot keeps nothing: no message content (it has no gateway connection and cannot read messages), no member list, no logs of who ran what. It sees a command's options when someone runs one, answers, and forgets them.

## Licence

MIT. See [LICENSE](LICENSE).

---

Part of the Forexia network: [InterestRateDecision.com](https://interestratedecision.com/?via=discord-desk) · [Forexia Academy](https://forexiapro.com/?via=discord-desk) · [TradingSignalBot](https://tradingsignalbot.com/?via=discord-desk) · [PropSim](https://github.com/PropSim-Enterprise) · [OpenCharts](https://github.com/dylanpersonguy/OpenCharts)
