const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { getTimestamp } = require('../utils/tornApi');
const { refreshMonitoredPlayers, getMonitoredPlayerIds } = require('../utils/monitor');
const { fetchFFScouterData } = require('../utils/ffScouter');
module.exports = {
    name: 'grow',
    description: 'Add new players to the monitoring list',
    async execute(message, args) {
        if (config.roleId && !message.member.roles.cache.has(config.roleId)) {
        }
        const text = args.join(' ');
        const addedIds = [];
        const currentIds = new Set(config.enemyPlayerIds || []);
        const bracketRegex = /\[(\d+)\]/g;
        let match;
        let foundBracketIds = false;
        while ((match = bracketRegex.exec(text)) !== null) {
            const id = parseInt(match[1]);
            if (!isNaN(id)) {
                if (!currentIds.has(id)) {
                    currentIds.add(id);
                    addedIds.push(id);
                    foundBracketIds = true;
                }
            }
        }
        if (!foundBracketIds) {
            const numberRegex = /\b(\d{3,10})\b/g;
            while ((match = numberRegex.exec(text)) !== null) {
                const id = parseInt(match[1]);
                if (!isNaN(id)) {
                    if (!currentIds.has(id)) {
                        currentIds.add(id);
                        addedIds.push(id);
                    }
                }
            }
        }
        if (addedIds.length > 0) {
            config.enemyPlayerIds = Array.from(currentIds);
            try {
                const configPath = path.join(__dirname, '..', 'config.json');
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
                await message.reply(`✅ Added ${addedIds.length} new players to the tracker: ${addedIds.join(', ')}`);
                console.log(`[${getTimestamp()}] 🆕 !grow command added ${addedIds.length} players.`);
                await refreshMonitoredPlayers();
                await fetchFFScouterData(getMonitoredPlayerIds());
            } catch (err) {
                console.error(`[${getTimestamp()}] ❌ Failed to save config:`, err);
                await message.reply('❌ Failed to save configuration.');
            }
        } else {
            await message.reply('ℹ️  No NEW players found. (Any IDs found in your message were likely already being tracked)');
        }
    }
};