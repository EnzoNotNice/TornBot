const { Events } = require('discord.js');
const { getTimestamp } = require('../utils/tornApi');
module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        console.log(`[${getTimestamp()}] 📨 Message received from ${message.author.tag}: "${message.content}"`);
        if (message.author.bot) return;
        if (!message.content.startsWith('!')) return;
        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const client = message.client;
        const command = client.commands.get(commandName);
        if (!command) return;
        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(`[${getTimestamp()}] Command error:`, error);
            await message.reply('There was an error executing that command!');
        }
    },
};