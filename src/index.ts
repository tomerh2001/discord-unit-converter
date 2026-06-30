/**
 * Bot entry point: build the client, wire up events, and log in.
 */
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { loadConfig } from './config.js';
import { fetchRates } from './conversion/index.js';
import { handleInteraction } from './events/interactionCreate.js';
import { handleMessageCreate } from './events/messageCreate.js';
import { handleReady } from './events/ready.js';
import { closeDb, getDb } from './storage/db.js';
import { loadRates, saveRates } from './storage/rates.js';

const config = loadConfig();
getDb(); // open the database / create schema before we start serving
loadRates(); // seed currency rates from the last saved snapshot (offline-friendly)

const RATES_REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours

async function refreshRates(): Promise<void> {
  try {
    await fetchRates();
    saveRates();
    console.log('💱 Exchange rates refreshed.');
  } catch (err) {
    console.warn('Could not refresh exchange rates:', (err as Error).message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged — enable it in the Dev Portal
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // required to receive direct messages
  // Default: never ping anyone. Individual replies can opt back in if needed.
  allowedMentions: { parse: [] },
});

// A bug in one guild's data must not crash the bot for everyone. Log and live.
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

client.once(Events.ClientReady, (c) => {
  handleReady(c);
  void refreshRates();
});
client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.MessageCreate, handleMessageCreate);

const ratesTimer = setInterval(() => void refreshRates(), RATES_REFRESH_MS);

function shutdown(signal: string): void {
  console.log(`\nReceived ${signal}, shutting down…`);
  clearInterval(ratesTimer);
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
