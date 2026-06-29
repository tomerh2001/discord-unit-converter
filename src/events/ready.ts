import { ActivityType, type Client } from 'discord.js';

export function handleReady(client: Client<true>): void {
  console.log(`✅ Logged in as ${client.user.tag} (serving ${client.guilds.cache.size} servers)`);
  client.user.setActivity('for units · /convert', { type: ActivityType.Watching });
}
