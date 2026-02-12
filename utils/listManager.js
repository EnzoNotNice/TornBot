const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const {
    getMonitoredPlayerIds,
    playerFactions,
    playerStates,
    monitorEvents
} = require('./monitor');
const { formatBattleEstimate } = require('./ffScouter');
const { getTimestamp } = require('./tornApi');
const activeLists = new Map();
const ITEMS_PER_PAGE = 20;
function generateContent(state) {
    const { filter, page } = state;
    const allIds = getMonitoredPlayerIds();
    let filteredIds = allIds;
    if (filter !== 'all') {
        filteredIds = allIds.filter(id => {
            const status = (playerStates.get(id) || 'Unknown').toLowerCase();
            if (filter === 'hospital') return status === 'hospital';
            if (filter === 'okay') return status === 'okay';
            return true;
        });
    }
    const totalPages = Math.max(1, Math.ceil(filteredIds.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(Math.max(0, page), totalPages - 1);
    state.page = currentPage;
    const startIdx = currentPage * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageIds = filteredIds.slice(startIdx, endIdx);
    const fields = pageIds.map(playerId => {
        const status = playerStates.get(playerId) || 'Unknown';
        const faction = playerFactions.get(playerId) || 'Unknown Faction';
        const ffData = formatBattleEstimate(playerId);
        let value = `**Status:** ${status}`;
        if (status === 'Okay') value = '🟢 **Status:** Okay';
        else if (status === 'Hospital') value = '🔴 **Status:** Hospital';
        value += `\n**Faction:** ${faction}`;
        if (ffData) {
            value += `\n**FF:** ${ffData.difficulty} (${ffData.ff})`;
            if (ffData.statsStr && ffData.statsStr !== 'N/A') value += `\n**Est:** ${ffData.statsStr}`;
        }
        value += `\n[Profile](https://www.torn.com/profiles.php?XID=${playerId})`;
        return {
            name: `${playerId}`,
            value: value,
            inline: true
        };
    });
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`📋 Monitored Targets (${currentPage + 1}/${totalPages})`)
        .setDescription(`Filter: **${filter.toUpperCase()}** | Total: ${filteredIds.length} / ${allIds.length}`)
        .addFields(fields)
        .setTimestamp()
        .setFooter({ text: `Auto-refreshing • Last updated` });
    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('list_filter')
            .setPlaceholder('Filter by Status')
            .addOptions([
                { label: 'All Players', value: 'all', emoji: '📋', default: filter === 'all' },
                { label: 'Okay (Attackable)', value: 'okay', emoji: '🟢', default: filter === 'okay' },
                { label: 'Hospitalized', value: 'hospital', emoji: '🔴', default: filter === 'hospital' },
            ])
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('list_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('list_refresh')
            .setLabel('Force Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄'),
        new ButtonBuilder()
            .setCustomId('list_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages - 1)
    );
    return { embeds: [embed], components: [row1, row2] };
}
async function createList(message) {
    const state = {
        message: null,
        filter: 'all',
        page: 0
    };
    const content = generateContent(state);
    const response = await message.channel.send(content);
    state.message = response;
    activeLists.set(response.id, state);
    console.log(`[${getTimestamp()}] 🆕 Created active list ${response.id}`);
}
async function updateList(messageId) {
    const state = activeLists.get(messageId);
    if (!state) return;
    try {
        const content = generateContent(state);
        await state.message.edit(content);
    } catch (error) {
        console.error(`[${getTimestamp()}] ❌ Failed to update list ${messageId}:`, error.message);
        if (error.code === 10008) {
            activeLists.delete(messageId);
        }
    }
}
async function handleInteraction(interaction) {
    const messageId = interaction.message.id;
    const state = activeLists.get(messageId);
    if (!state) {
        await interaction.reply({ content: '❌ This list is no longer active (bot restarted?). Please run !list again.', ephemeral: true });
        return;
    }
    await interaction.deferUpdate();
    try {
        if (interaction.isStringSelectMenu() && interaction.customId === 'list_filter') {
            state.filter = interaction.values[0];
            state.page = 0;
        }
        else if (interaction.isButton()) {
            if (interaction.customId === 'list_prev') {
                state.page = Math.max(0, state.page - 1);
            } else if (interaction.customId === 'list_next') {
                state.page++;
            } else if (interaction.customId === 'list_refresh') {
            }
        }
        const content = generateContent(state);
        await interaction.editReply(content);
    } catch (error) {
        console.error(`[${getTimestamp()}] Interaction error:`, error);
    }
}
monitorEvents.on('checkComplete', async () => {
    if (activeLists.size === 0) return;
    console.log(`[${getTimestamp()}] 🔄 Auto-updating ${activeLists.size} active lists...`);
    for (const [messageId, state] of activeLists) {
        await updateList(messageId);
    }
});
module.exports = {
    createList,
    handleInteraction
};