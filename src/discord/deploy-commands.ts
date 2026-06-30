/**
 * Registers the slash + context-menu commands with Discord and enables both
 * installation contexts (server install AND user install). Run `npm run deploy`.
 *
 * Commands register GLOBALLY so they work everywhere — in servers where the bot
 * is added, and (for the user-installable ones: /convert and Convert Units) in
 * any server or DM where the invoking user has installed the app to their
 * account. Global commands can take a little while to appear the first time.
 */
import { REST, Routes } from 'discord.js';
import { loadConfig } from '../config.js';
import { allCommandData } from '../commands/index.js';

const config = loadConfig();
const rest = new REST().setToken(config.token);

try {
  // 1) Turn on guild + user installation for the application, with the OAuth2
  //    install params each context uses.
  await rest.patch(Routes.currentApplication(), {
    body: {
      integration_types_config: {
        0: { oauth2_install_params: { scopes: ['bot', 'applications.commands'], permissions: '84992' } },
        1: { oauth2_install_params: { scopes: ['applications.commands'], permissions: '0' } },
      },
    },
  });
  console.log('✅ Enabled server + user installation on the application.');

  // 2) Register commands globally.
  await rest.put(Routes.applicationCommands(config.clientId), { body: allCommandData });
  console.log(
    `✅ Registered ${allCommandData.length} global command(s): ${allCommandData.map((c) => c.name).join(', ')}`,
  );

  // 3) Remove any leftover guild-scoped commands so they don't duplicate the
  //    global ones in that guild.
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] });
    console.log(`🧹 Cleared guild ${config.guildId} commands (now served globally).`);
  }
} catch (err) {
  console.error('Failed to deploy commands:', err);
  process.exit(1);
}
