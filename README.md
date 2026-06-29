<p align="center">
  <img src="assets/icon.png" alt="discord-unit-converter logo" width="128" height="128">
</p>

# 📏 discord-unit-converter

A Discord bot that **automatically converts units** between metric and imperial.
It watches messages, spots quantities like `10 km`, `72°F`, `5'11"`, or `2 cups`,
and replies with the same message — but with each conversion **bolded** inline.
It also ships a `/convert` command and supports **custom units per server**.

```
User:  It's 30°C today and I drove 100 km/h for 26 miles
Bot:   It's 30°C (**86°F**) today and I drove 100 km/h (**62.14 mph**) for 26 miles (**41.84 km**)
```

---

## ✨ Features

- **Automatic detection** — every message is scanned; if it contains units, the bot replies with conversions. No command needed.
- **`/convert` command** — `/convert 10 km to miles`, `/convert 72f`, `/convert 5'11"`. The auto-detector and the command share the exact same engine.
- **Right-click → Convert** — a message context-menu command: right-click (or long-press) any message → **Apps → Convert Units** to convert it on demand. It posts the result publicly as a reply under that message (a "no units found" notice stays private to you).
- **Flexible formats** — `1M`, `1m`, `1 Meter`, `1 meter`, `1.5km`, `5,000 m`, `-40c`, `350F`, `5'11"`, `5 ft 11 in` all work.
- **Many units & dimensions** — length, mass, temperature, volume, area, speed, and pressure, covering metric ⇄ imperial/US customary.
- **Multiple units per message** — each one is converted independently.
- **Smart targets** — picks a sensible counterpart by magnitude (10 km → miles, 30 cm → inches).
- **Custom units per server** — `/unit add` lets admins define server-specific units (e.g. a smoot).
- **Sensible & safe** — ignores units inside code blocks, inline code, and links, and avoids firing on ambiguous words like “in” in normal prose.

---

## 🚀 Quick start

### 1. Create the Discord application & bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Give it a name.
2. Open the **Bot** tab → **Reset Token** → copy the token. This is your `DISCORD_TOKEN`. **Keep it secret.**
3. Still on the **Bot** tab, scroll to **Privileged Gateway Intents** and enable **MESSAGE CONTENT INTENT**. This is required for the bot to read message text and auto-detect units.
4. Open **General Information** and copy the **Application ID**. This is your `CLIENT_ID`.

### 2. Invite the bot to your server

Build an invite URL (replace `CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=274877990912&scope=bot%20applications.commands
```

The `permissions` value grants **View Channels**, **Send Messages**, and **Read Message History** — everything the bot needs. Open the URL, pick your server, and authorize.

> You can also build this URL in the Developer Portal under **OAuth2 → URL Generator** (scopes: `bot` + `applications.commands`).

### 3. Configure & run

```bash
git clone https://github.com/tomerh2001/discord-unit-converter.git
cd discord-unit-converter
cp .env.example .env       # then fill in DISCORD_TOKEN and CLIENT_ID
npm install
npm run deploy             # register the slash commands
npm run dev                # start the bot (watch mode)
```

For production:

```bash
npm run build
npm start
```

> **Tip:** set `GUILD_ID` in `.env` during development so slash commands register
> to your test server **instantly**. Leave it blank for global registration
> (which can take up to ~1 hour to propagate).

---

## 🐳 Run with Docker

```bash
cp .env.example .env       # fill it in
docker compose up -d --build
```

The SQLite database (custom units & per-server settings) is persisted to `./data`
via a mounted volume. Run `npm run deploy` once locally (or `docker compose run --rm bot node dist/discord/deploy-commands.js`) to register the commands.

---

## 🧑‍💻 Usage

### Automatic detection

Just talk normally. If a message contains a recognizable quantity, the bot replies:

| You type | Bot replies |
| --- | --- |
| `the trail is 8 km` | the trail is 8 km (**4.97 mi**) |
| `oven at 400F` | oven at 400F (**204.44°C**) |
| `I'm 6'2"` | I'm 6'2" (**1.88 m**) |
| `need 500 ml of milk` | need 500 ml (**1.06 pt**) of milk |

### `/convert`

```
/convert expression: 10 km to miles      → 10 km = 6.21 mi
/convert expression: 72f                  → 72°F = 22.22°C
/convert expression: 5 kg and 200 g       → two lines, each converted
/convert expression: 60 mph in km/h       → 60 mph = 96.56 km/h
```

If you omit a target (`... to <unit>`), each quantity is auto-converted to its
metric/imperial counterpart.

### Right-click a message → Convert Units

Right-click (desktop) or long-press (mobile) any message → **Apps → Convert Units**.
The bot converts every unit in that message and posts the result **publicly** as a
reply under that message, with the original text plus bolded conversions (if no
units are found, only you get a quiet notice). Handy for older messages, or in
servers where passive auto-detection is turned off. It runs the same engine as
`/convert`, in explicit mode (so a spaced `5 in` counts as inches).

### Custom units (per server)

Requires the **Manage Server** permission.

```
/unit add name: smoot symbol: smt factor: 1.7018 per: m
        → 1 smoot = 1.7018 m, now auto-detected and usable in /convert
/unit list
/unit remove name: smoot
```

A custom unit is defined relative to an existing one and inherits its dimension,
so it converts to the opposite system automatically.

### Server settings

Requires the **Manage Server** permission.

```
/settings autodetect enabled: false   → turn off automatic scanning
/settings precision digits: 1          → show 1 decimal place
/settings view                         → show current settings
```

---

## 📐 Supported units

| Dimension | Metric | Imperial / US |
| --- | --- | --- |
| **Length** | mm, cm, m, km | in, ft, yd, mi, nmi |
| **Mass** | mg, g, kg, tonne | oz, lb, stone, ton |
| **Temperature** | °C, K | °F |
| **Volume** | ml, L | tsp, tbsp, fl oz, cup, pint, quart, gallon |
| **Area** | mm², cm², m², hectare, km² | in², ft², yd², acre, mi² |
| **Speed** | m/s, km/h | mph, ft/s, knot |
| **Pressure** | Pa, kPa, bar, mbar, atm | psi |

Each unit accepts several spellings/abbreviations (e.g. `meter`, `metre`,
`meters`, `m`). See [`src/conversion/units.ts`](src/conversion/units.ts) for the
full list and exact conversion factors.

---

## 🏗️ How it works

```
message / command text
        │
        ▼
  parser.ts ──► finds (value, unit) pairs, masking code/URLs, handling
        │       compounds (5'11") and ambiguous words (bare "in")
        ▼
 converter.ts ─► value→base→target math (affine, so temperature works),
        │        magnitude-aware target selection
        ▼
   index.ts ───► analyze() + renderReply() rebuild the message with **bold**
```

The passive scanner (`events/messageCreate.ts`), `/convert`
(`commands/convert.ts`), and the right-click **Convert Units** command
(`commands/convertMessage.ts`) all call the same `analyze` / `convertExpression`
functions, so their behaviour can never drift apart.

---

## 🧪 Development

```bash
npm run dev        # run with hot reload (tsx watch)
npm test           # run the vitest suite (conversion math, parser, custom units)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --write
```

---

## ⚙️ Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | — | Bot token from the Developer Portal |
| `CLIENT_ID` | ✅ | — | Application ID |
| `GUILD_ID` | — | (global) | Register commands to one guild for instant updates |
| `DATA_DIR` | — | `./data` | Where the SQLite file lives |
| `DEFAULT_PRECISION` | — | `2` | Default decimal places |
| `AUTO_DETECT_DEFAULT` | — | `true` | Whether auto-detection is on for new servers |

---

## 📄 License

[MIT](LICENSE) © 2026 tomerh2001
