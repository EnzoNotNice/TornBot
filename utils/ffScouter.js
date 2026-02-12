const fetch = require('node-fetch');
const config = require('../config.json');
const { getTimestamp } = require('./tornApi');
const enemyFairFight = new Map();
async function fetchFFScouterData(monitoredPlayerIds) {
    const apiKey = config.ffScouterKey || config.tornApiKey;
    if (!apiKey) {
        console.log(`[${getTimestamp()}] ⏭️  Skipping FF data (no API key)`);
        return;
    }
    if (!monitoredPlayerIds || monitoredPlayerIds.length === 0) return;
    try {
        const targetList = monitoredPlayerIds.join(',');
        const url = `https://ffscouter.com/api/v1/get-stats?key=${apiKey}&targets=${targetList}`;
        console.log(`[${getTimestamp()}] 🔍 Fetching FF Scouter data for ${monitoredPlayerIds.length} players...`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[${getTimestamp()}] ❌ FF Scouter HTTP ${response.status}`);
            return;
        }
        const data = await response.json();
        if (data && data.error) {
            console.error(`[${getTimestamp()}] ❌ FF Scouter error: ${data.error}`);
            return;
        }
        if (!Array.isArray(data)) {
            console.error(`[${getTimestamp()}] ❌ FF Scouter: unexpected response format`);
            return;
        }
        let updated = 0;
        let noData = 0;
        for (const result of data) {
            if (!result || !result.player_id) continue;
            if (result.fair_fight === null || result.fair_fight === undefined) {
                noData++;
                continue;
            }
            enemyFairFight.set(result.player_id, {
                ff: result.fair_fight,
                bs_estimate: result.bs_estimate || null,
                bs_estimate_human: result.bs_estimate_human || null,
                last_updated: result.last_updated || 0
            });
            updated++;
        }
        console.log(`[${getTimestamp()}] 🎯 FF Scouter: ${updated} players with data, ${noData} no data`);
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ FF Scouter error:`, error.message);
    }
}
function formatBattleEstimate(playerId) {
    const data = enemyFairFight.get(playerId);
    if (!data) return null;
    const { ff, bs_estimate_human } = data;
    let difficulty;
    if (ff >= 2.8) difficulty = '🔴 HARD';
    else if (ff >= 2.2) difficulty = '🟠 MEDIUM';
    else if (ff >= 1.5) difficulty = '🟡 EASY';
    else difficulty = '🟢 VERY EASY';
    const now = Date.now() / 1000;
    const age = now - (data.last_updated || 0);
    let stale = '';
    if (age > 14 * 24 * 60 * 60) stale = '?';
    return {
        difficulty,
        statsStr: bs_estimate_human || 'N/A',
        ff: ff.toFixed(2) + stale
    };
}
module.exports = {
    fetchFFScouterData,
    formatBattleEstimate,
    enemyFairFight
};