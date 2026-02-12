# 🏥 TornBot Baldr's Target Watcher with Faction War Support

A powerful and modular Discord bot designed for Torn City factions. It monitors enemy players' hospital status in real-time and sends alerts when they become available for attack.

## ✨ Key Features

- **Real-time Monitoring**: Tracks hospital status of enemy players and factions.
- **Batched Notifications**: Groups multiple target alerts into a single, clean embed to prevent spam.
- **Fair Fight (FF) Estimates**: Integrates with FF Scouter to display estimated battle stats and Fair Fight difficulty (e.g., 🟢 Easy, 🟡 Medium, 🔴 Hard).
- **Interactive Dashboard**:
  - `!list` command spawns a live dashboard.
  - **Auto-Refresh**: Updates automatically every monitoring cycle.
  - **Filtering**: Dropdown menu to filter by "All", "Okay" (Attackable), or "Hospital".
  - **Pagination**: Browse large lists of targets easily.
- **Smart Rate Limiting**: Automatically adjusts polling intervals to respect Torn API limits based on the number of monitored players.
- **Modular Architecture**: Clean code structure with separate commands, events, and utility handlers.

## 🚀 Installation & Setup

### Prerequisites
- Node.js 16.9.0 or newer
- A Discord Bot Token (with `Message Content Intent` enabled)
- A Torn API Key (Public access sufficient)

### 1. Clone & Install
```bash
# Navigate to the project directory
cd ssg-enzo

# Install dependencies
npm install
```

### 2. Configuration
Edit `config.json` with your details:

```json
{
    "discordToken": "YOUR_DISCORD_BOT_TOKEN",
    "tornApiKey": "YOUR_TORN_API_KEY",
    "channelId": "CHANNEL_ID_FOR_ALERTS",
    "roleId": "ROLE_ID_TO_PING",
    "myFactionId": 12345,
    "enemyFactionIds": [], 
    "enemyPlayerIds": [],
    "pollingInterval": 15000,
    "factionRefreshInterval": 300000
}
```

- **myFactionId**: Your faction ID (used to auto-discover enemies from wars).
- **enemyFactionIds**: Array of specific enemy faction IDs to monitor (optional).
- **enemyPlayerIds**: Array of specific player IDs to monitor (populates via `!grow` or manual edit).
- **pollingInterval**: How often to check player status (in ms).
- **factionRefreshInterval**: How often to refresh faction member lists and war participants (in ms).

### 3. Run the Bot
```bash
# Start the bot
node index.js

# Or using npm
npm start
```

## 🛠️ Commands

### `!grow [playerID] [playerID] ...`
Adds one or more players to the monitoring list manually.
- **Usage**: `!grow 123456 789012`
- **Effect**: Adds IDs to `config.json` and starts tracking them immediately.

### `!list`
Displays an interactive dashboard of all monitored players.
- **Features**:
  - **Status Indicators**: 🟢 Okay, 🔴 Hospital.
  - **Live Updates**: The message updates automatically when statuses change.
  - **Filter Menu**: Show only "Okay" targets to find quick hits.

## 📂 Project Structure

```
TornBot/
├── commands/       # Command modules (!grow, !list)
├── events/         # Event handlers (ready, messageCreate, interactionCreate)
├── utils/          # Core logic
│   ├── monitor.js  # Main monitoring loop & event emitter
│   ├── tornApi.js  # API wrapper with rate limiting
│   ├── ffScouter.js# FF Scouter integration
│   └── listManager.js # Interactive list logic
├── index.js        # Entry point
└── config.json     # Configuration file
```

## ⚠️ Disclaimer
This bot is not affiliated with Torn City. Use it responsibly and ensure you comply with Torn's API usage policies.
