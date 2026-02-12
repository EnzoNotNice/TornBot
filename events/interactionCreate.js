const { Events } = require('discord.js');
const { handleInteraction } = require('../utils/listManager');
const { getTimestamp } = require('../utils/tornApi');
module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
        if (interaction.customId.startsWith('list_')) {
            try {
                await handleInteraction(interaction);
            } catch (error) {
                console.error(`[${getTimestamp()}] Interaction error:`, error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Interaction failed.', ephemeral: true });
                }
            }
        }
    },
};