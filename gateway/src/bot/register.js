// ============================================================
// Registers slash commands with Discord.
//   node src/register.js
// Registers to a guild (instant) if DISCORD_GUILD_ID is set,
// otherwise globally (can take up to ~1h to propagate).
// ============================================================

import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands.js';

if (!config.token || !config.clientId) {
  console.error('❌  DISCORD_TOKEN and DISCORD_CLIENT_ID are required to register commands.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log(`✅  Registered ${commands.length} guild commands to ${config.guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log(`✅  Registered ${commands.length} global commands.`);
  }
} catch (err) {
  console.error('❌  Failed to register commands:', err);
  process.exit(1);
}
