/**
 * Bot entry point: build the client, wire up events, and log in.
 */
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { loadConfig } from './config.js';
import { handleInteraction } from './events/interactionCreate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleReady } from './events/ready.js';
import { closeDb, getDb } from './storage/db.js';

const config = loadConfig();
getDb(); // open the database / create schema before we start serving

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged — enable it in the Dev Portal
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // required to receive direct messages
});

client.once(Events.ClientReady, handleReady);
client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.MessageCreate, handleMessageCreate);

function shutdown(signal: string): void {
  console.log(`\nReceived ${signal}, shutting down…`);
  client.destroy();
  closeDb();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(config.token).catch((err) => {
  console.error('Failed to log in:', err);
  process.exit(1);
});
