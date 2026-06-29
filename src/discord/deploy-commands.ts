/**
 * Registers the slash commands with Discord. Run with `npm run deploy`.
 *
 * If GUILD_ID is set in your .env, commands are registered to that one guild
 * and appear instantly (ideal for development). Otherwise they register
 * globally, which can take up to ~1 hour to propagate.
 */
import { REST, Routes } from 'discord.js';
import { loadConfig } from '../config.js';
import { commands } from '../commands/index.js';

const config = loadConfig();
const body = commands.map((c) => c.data.toJSON());
const rest = new REST().setToken(config.token);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

try {
  await rest.put(route, { body });
  console.log(
    `✅ Registered ${commands.length} command(s) ${
      config.guildId ? `to guild ${config.guildId}` : 'globally'
    }: ${commands.map((c) => `/${c.data.name}`).join(', ')}`,
  );
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
