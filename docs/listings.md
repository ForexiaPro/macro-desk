# Listings

## Discord App Directory

Enable discovery in the Developer Portal (App Directory → Discoverability) once the app is verified-eligible. Fill:

- **Name**: Macro Desk
- **Short description** (up to 200): Central bank rates and decisions, rate odds, COT positioning, position size and signals for forex trading servers. Opt-in decision alerts in a channel.
- **Tags** (up to 5): forex, trading, finance, economics, utility
- **Category**: Utilities (secondary: Education)
- **Detailed description**:

  Macro Desk answers the questions a forex trading server asks every week, with the figures and the page they come from.

  /rate fed: the Federal Reserve's current rate, since when, and the next decision in your own time zone. Ten banks: Fed, ECB, Bank of England, Bank of Japan, Bank of Canada, RBA, RBNZ, SNB, Norges Bank, Riksbank.
  /next: the next decisions, with live countdowns.
  /odds boe: hike, hold or cut for the next meetings, from InterestRateDecision.com's odds from the record (how decisions like this one went, with the full scorecard published). Not market odds.
  /cot eur: large speculators' net position from the CFTC's Commitments of Traders, the week's change and its share of open interest, with a link to Forexia's COT index and weekly reading.
  /size: lots for a fixed risk from your balance, risk %, stop in pips and pair.
  /signal eurusd: TradingSignalBot's latest public signal on the pair, with its public record, losses included.
  /alerts subscribe: an alert in the channel an hour before each decision and the result the moment it is out.

  No account. The bot reads no messages and keeps nothing about members. Open source (MIT): github.com/ForexiaPro/macro-desk

  Part of the Forexia network: InterestRateDecision.com · Forexia Academy · TradingSignalBot · PropSim · OpenCharts

- **Privacy policy URL**: https://github.com/ForexiaPro/macro-desk#privacy
- **Terms of service URL**: https://github.com/ForexiaPro/macro-desk/blob/main/LICENSE (or a page on forexiapro.com)
- **Support server**: the Forexia Discord, if there is one; else https://github.com/ForexiaPro/macro-desk/issues
- **Images**: the icon (512×512), and screenshots of `/rate fed`, `/odds boe`, `/next` and `/size` in a test server.

## top.gg

- **Short description** (up to 140): Forex desk for your server: central bank rates, decision countdowns, rate odds, COT positioning, position size and signals.
- **Prefix**: `/` (slash commands only)
- **Tags**: Economy (or Utility), Education, Finance
- **Long description** (Markdown):

  ```md
  ## Macro Desk

  The figures a forex trading server checks every week, each with its source page.

  | Command | What you get |
  | --- | --- |
  | `/rate fed` | The current rate and the next decision, in your time zone |
  | `/next` | The next central bank decisions, with countdowns |
  | `/odds boe` | Hike, hold or cut: odds from the record (InterestRateDecision.com), not market odds |
  | `/cot eur` | CFTC COT: large speculators' net position, weekly change and % of open interest |
  | `/size` | Lots for your balance, risk %, stop and pair |
  | `/signal eurusd` | The latest public TradingSignalBot signal, with its public record |
  | `/alerts subscribe` | Decision alerts in this channel: an hour before, and the result |

  Ten banks: Fed, ECB, BoE, BoJ, BoC, RBA, RBNZ, SNB, Norges Bank, Riksbank.

  No account, no message reading, nothing kept about members. Open source: https://github.com/ForexiaPro/macro-desk

  Part of the Forexia network: InterestRateDecision.com · Forexia Academy · TradingSignalBot · PropSim · OpenCharts
  ```

- **Website**: https://github.com/ForexiaPro/macro-desk
- **Invite link**: the one `npm run register` prints (permissions 536870912, Manage Webhooks).

top.gg's server-count posting needs a gateway connection or the guild count from the application; skip it (the listing does not require it).

## Words

The listings link InterestRateDecision.com, so its banned-word rule applies: none of the ICT terms in the network plan's rule 5. No claims about signal results: say "public record, losses included", never win rates.
