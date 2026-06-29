/**
 * Passive auto-detection. Every human message is scanned for units; if any are
 * found we reply with the original text plus bolded conversions inline. This
 * goes through the exact same `analyze`/`renderReply` path as `/convert`.
 */
import type { Message } from 'discord.js';
import { loadConfig } from '../config.js';
import { analyze, renderReply } from '../conversion/index.js';
import { getCustomUnits, getGuildConfig } from '../storage/customUnits.js';

const DISCORD_MAX = 2000;

export async function handleMessageCreate(message: Message): Promise<void> {
  // Ignore bots (including ourselves) and empty / system messages.
  if (message.author.bot || message.system || !message.content) return;

  const guildId = message.guildId;
  let precision = loadConfig().defaultPrecision;
  let customUnits = guildId ? getCustomUnits(guildId) : [];

  if (guildId) {
    const cfg = getGuildConfig(guildId);
    if (!cfg.autoDetect) return; // server opted out
    precision = cfg.precision;
  } else {
    customUnits = [];
  }

  const annotations = analyze(message.content, {
    customUnits,
    mode: 'auto',
    precision,
  });
  if (annotations.length === 0) return;

  let reply = renderReply(message.content, annotations);
  if (reply.length > DISCORD_MAX) {
    // Fall back to a compact list if the inline render is too long.
    reply = annotations
      .map((a) => `${a.raw.trim()} → **${a.display}**`)
      .join('\n')
      .slice(0, DISCORD_MAX - 1);
  }

  try {
    await message.reply({
      content: reply,
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    console.error('Failed to reply with conversion:', err);
  }
}
