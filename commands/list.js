const { createList } = require('../utils/listManager');
const { getMonitoredPlayerIds } = require('../utils/monitor');
module.exports = {
    name: 'list',
    description: 'List all monitored players with interactive dashboard',
    async execute(message, args) {
        const monitoredIds = getMonitoredPlayerIds();
        if (monitoredIds.length === 0) {
            await message.reply('ℹ️  No players are currently being monitored.');
            return;
        }
        await createList(message);
    }
};