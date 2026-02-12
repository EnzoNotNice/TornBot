const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config.json');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
console.log('📦 Loading commands...');
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        if ('name' in command && 'execute' in command) {
            client.commands.set(command.name, command);
            console.log(` - Loaded command: ${command.name}`);
        } else {
            console.warn(`⚠️  Original file ${filePath} is missing "name" or "execute" property.`);
        }
    } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error);
    }
}
console.log(`✅ Loaded ${client.commands.size} commands.`);
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
console.log('🔔 Loading events...');
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(` - Loaded event: ${event.name}`);
    } catch (error) {
        console.error(`❌ Error loading event ${file}:`, error);
    }
}
console.log(`✅ Loaded ${eventFiles.length} events.`);
client.login(config.discordToken);