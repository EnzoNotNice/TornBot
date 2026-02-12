const { Events } = require('discord.js');
const { startMonitoring } = require('../utils/monitor');
const { getTimestamp } = require('../utils/tornApi');
module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`[${getTimestamp()}] ✅ Logged in as ${client.user.tag}`);
        startMonitoring(client);
    },
};