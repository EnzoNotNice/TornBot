const { EmbedBuilder } = require('discord.js');
const EventEmitter = require('events');
const monitorEvents = new EventEmitter();
const config = require('../config.json');
const { tornApiRequest, tornApiV2Request, getTimestamp, MIN_API_DELAY } = require('./tornApi');
const { fetchFFScouterData, formatBattleEstimate } = require('./ffScouter');
const playerStates = new Map();
const playerFactions = new Map();
let monitoredPlayerIds = [];
let discoveredEnemyFactions = [];
let isMonitoring = false;
let intervalId = null;
async function fetchFactionMembers(factionId) {
    const data = await tornApiRequest(`faction/${factionId}?selections=basic`);
    if (!data || !data.members) return null;
    return data;
}
async function fetchPlayerData(playerId) {
    return await tornApiRequest(`user/${playerId}?selections=profile`);
}
function getPlayerStatus(data) {
    if (!data || !data.status) return 'Unknown';
    return data.status.state || 'Unknown';
}
function isWarActive(war) {
    if (!war) return false;
    if (war.end && war.end > 0) return false;
    if (war.ended && war.ended > 0) return false;
    if (war.result) return false;
    if (war.winner) return false;
    if (war.status === 'ended' || war.status === 'finished') return false;
    return true;
}
async function discoverEnemyFactions() {
    if (!config.myFactionId) return [];
    console.log(`[${getTimestamp()}] 🔎 Checking active wars for faction ${config.myFactionId}...`);
    const basicData = await tornApiRequest(`faction/${config.myFactionId}?selections=basic`);
    const myFactionName = basicData?.name || `Faction ${config.myFactionId}`;
    const warData = await tornApiV2Request(`faction/${config.myFactionId}/wars`);
    const rankedWarData = await tornApiV2Request(`faction/${config.myFactionId}/rankedwars`);
    const enemies = [];
    if (warData && warData.wars) {
        const wars = Array.isArray(warData.wars) ? warData.wars : Object.values(warData.wars);
        const activeWars = wars.filter(isWarActive);
        console.log(`[${getTimestamp()}] 📋 Wars: ${wars.length} total, ${activeWars.length} active`);
        for (const war of activeWars) {
            extractEnemies(war, 'Active war', enemies, myFactionName);
        }
    }
    if (rankedWarData && rankedWarData.rankedwars) {
        const wars = Array.isArray(rankedWarData.rankedwars) ? rankedWarData.rankedwars : Object.values(rankedWarData.rankedwars);
        const activeWars = wars.filter(isWarActive);
        console.log(`[${getTimestamp()}] 📋 Ranked wars: ${wars.length} total, ${activeWars.length} active`);
        for (const war of activeWars) {
            extractEnemies(war, 'Active ranked war', enemies, myFactionName);
        }
    }
    if (enemies.length === 0) {
        console.log(`[${getTimestamp()}] ℹ️  No active wars found for ${myFactionName}`);
    }
    return enemies;
}
function extractEnemies(war, label, enemies, myFactionName) {
    const factions = war.factions || war;
    for (const [key, val] of Object.entries(factions)) {
        const fid = parseInt(val?.faction_id || val?.id || key);
        if (isNaN(fid) || fid === config.myFactionId) continue;
        if (!enemies.includes(fid)) {
            const name = val?.name || `Faction ${fid}`;
            enemies.push(fid);
            console.log(`[${getTimestamp()}] ⚔️  ${label}: ${myFactionName} vs ${name} [${fid}]`);
        }
    }
}
async function refreshMonitoredPlayers() {
    console.log(`[${getTimestamp()}] 🔄 Refreshing target list...`);
    discoveredEnemyFactions = await discoverEnemyFactions();
    const manualFactions = config.enemyFactionIds || [];
    const allFactions = new Set([...discoveredEnemyFactions, ...manualFactions]);
    const factionPlayerIds = [];
    for (const factionId of allFactions) {
        const factionData = await fetchFactionMembers(factionId);
        if (!factionData || !factionData.members) continue;
        const factionName = factionData.name || `Faction ${factionId}`;
        const memberIds = Object.keys(factionData.members).map(Number);
        console.log(`[${getTimestamp()}] 📋 ${factionName} [${factionId}]: ${memberIds.length} members`);
        for (const memberId of memberIds) {
            factionPlayerIds.push(memberId);
            playerFactions.set(memberId, factionName);
        }
    }
    const manualIds = config.enemyPlayerIds || [];
    const combined = new Set([...factionPlayerIds, ...manualIds]);
    monitoredPlayerIds = Array.from(combined);
    console.log(`[${getTimestamp()}] 📊 Monitoring: ${monitoredPlayerIds.length} players (${allFactions.size} factions, ${manualIds.length} manual IDs)`);
}
async function sendBatchNotification(client, players) {
    if (players.length === 0) return;
    try {
        const channel = await client.channels.fetch(config.channelId);
        if (!channel) {
            console.error(`[${getTimestamp()}] Could not find channel ${config.channelId}`);
            return;
        }
        const ping = config.roleId ? `<@&${config.roleId}>` : '@everyone';
        const chunkSize = 25;
        for (let i = 0; i < players.length; i += chunkSize) {
            const chunk = players.slice(i, i + chunkSize);
            const fields = [];
            let urgencyColor = 0x00FF00;
            for (const p of chunk) {
                const profileUrl = `https://www.torn.com/profiles.php?XID=${p.player_id}`;
                const attackUrl = `https://www.torn.com/loader.php?sid=attack&user2ID=${p.player_id}`;
                const factionName = playerFactions.get(p.player_id) || 'Unknown';
                const estimate = formatBattleEstimate(p.player_id);
                let value = `[Attack](${attackUrl}) | [Profile](${profileUrl})\n**Fac:** ${factionName}`;
                if (estimate) {
                    value += `\n**FF:** ${estimate.difficulty} (${estimate.ff})`;
                    const ffNum = parseFloat(estimate.ff);
                    if (ffNum >= 2.8) urgencyColor = 0xFF4444;
                    else if (ffNum >= 2.2 && urgencyColor !== 0xFF4444) urgencyColor = 0xFF8800;
                    else if (ffNum >= 1.5 && urgencyColor !== 0xFF4444 && urgencyColor !== 0xFF8800) urgencyColor = 0xFFCC00;
                }
                fields.push({
                    name: `${p.name} [${p.level}]`,
                    value: value,
                    inline: true
                });
            }
            const embed = new EmbedBuilder()
                .setColor(urgencyColor)
                .setTitle(`🎯 ${players.length} TARGETS AVAILABLE!`)
                .setDescription(`The following targets have left the hospital!`)
                .addFields(fields)
                .setTimestamp()
                .setFooter({ text: 'Hospital Watcher Bot' });
            await channel.send({
                content: i === 0 ? `${ping} **TARGETS AVAILABLE!**` : '',
                embeds: [embed]
            });
        }
        console.log(`[${getTimestamp()}] ✅ Batched alert sent for ${players.length} players.`);
    } catch (error) {
        console.error(`[${getTimestamp()}] Notification error:`, error.message);
    }
}
async function monitorPlayers(client) {
    if (monitoredPlayerIds.length === 0) {
        console.log(`[${getTimestamp()}] ⚠️  No players to monitor. Set myFactionId, enemyFactionIds, or enemyPlayerIds in config.json`);
        return;
    }
    if (isMonitoring) {
        console.log(`[${getTimestamp()}] ⏳ Previous cycle still running, skipping...`);
        return;
    }
    isMonitoring = true;
    try {
        const counts = { Hospital: 0, Okay: 0, other: 0, errors: 0 };
        const recentlyAvailable = [];
        for (const playerId of monitoredPlayerIds) {
            const data = await fetchPlayerData(playerId);
            if (!data) { counts.errors++; continue; }
            const currentStatus = getPlayerStatus(data);
            const previousStatus = playerStates.get(playerId);
            if (currentStatus === 'Hospital') counts.Hospital++;
            else if (currentStatus === 'Okay') counts.Okay++;
            else counts.other++;
            if (previousStatus === 'Hospital' && currentStatus === 'Okay') {
                console.log(`[${getTimestamp()}] 🚨 ${data.name} LEFT HOSPITAL!`);
                recentlyAvailable.push(data);
            }
            playerStates.set(playerId, currentStatus);
        }
        if (recentlyAvailable.length > 0) {
            await sendBatchNotification(client, recentlyAvailable);
        }
        const errMsg = counts.errors > 0 ? ` | ${counts.errors} err` : '';
        console.log(`[${getTimestamp()}] 📊 ${monitoredPlayerIds.length} players: ${counts.Hospital} hosp | ${counts.Okay} okay | ${counts.other} other${errMsg}`);
    } finally {
        isMonitoring = false;
        monitorEvents.emit('checkComplete', monitoredPlayerIds);
    }
}
async function startMonitoring(client) {
    await refreshMonitoredPlayers();
    await fetchFFScouterData(monitoredPlayerIds);
    const minCycleTime = (monitoredPlayerIds.length * MIN_API_DELAY) + 5000;
    const effectiveInterval = Math.max(config.pollingInterval, minCycleTime);
    if (effectiveInterval > config.pollingInterval) {
        console.log(`[${getTimestamp()}] ⚠️  Adjusted poll interval: ${config.pollingInterval / 1000}s → ${Math.round(effectiveInterval / 1000)}s (${monitoredPlayerIds.length} players need ~${Math.round(minCycleTime / 1000)}s per cycle)`);
    }
    console.log(`[${getTimestamp()}] 🏥 Hospital Watcher active!`);
    console.log(`[${getTimestamp()}] ⏱️  Poll: ${Math.round(effectiveInterval / 1000)}s | Refresh: ${(config.factionRefreshInterval || 300000) / 1000}s | Delay: ${MIN_API_DELAY}ms/req`);
    await monitorPlayers(client);
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(async () => {
        await monitorPlayers(client);
    }, effectiveInterval);
    const refreshInterval = config.factionRefreshInterval || 300000;
    setInterval(async () => {
        await refreshMonitoredPlayers();
        await fetchFFScouterData(monitoredPlayerIds);
    }, refreshInterval);
}
module.exports = {
    startMonitoring,
    refreshMonitoredPlayers,
    getMonitoredPlayerIds: () => monitoredPlayerIds,
    playerFactions,
    playerStates,
    fetchPlayerData,
    getPlayerStatus,
    monitorEvents
};