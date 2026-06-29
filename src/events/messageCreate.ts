/**
 * Passive auto-detection. Every human message is scanned for units; if any are
 * found we reply with the original text plus bolded conversions inline. This
 * goes through the exact same `analyze`/`renderReply` path as `/convert`.
 *
 * The whole handler is wrapped in try/catch: discord.js does not await listener
 * promises, so an unguarded throw here (e.g. a transient DB error) would become
 * an unhandled rejection and take the process down for every server.
 */
import type { Message } from 'discord.js';
import { loadConfig } from '../config.js';
import { type Annotation, convertMessageContent } from '../conversion/index.js';
import { getCustomUnits, getGuildConfig } from '../storage/customUnits.js';

const DISCORD_MAX = 2000;
/** Minimum gap between auto-replies in a single channel, to avoid flooding. */
const COOLDOWN_MS = 2000;

const lastReplyByChannel = new Map<string, number>();

function onCooldown(channelId: string): boolean {
  const now = Date.now();
  const last = lastReplyByChannel.get(channelId) ?? 0;
  if (now - last < COOLDOWN_MS) return true;
  lastReplyByChannel.set(channelId, now);
  return false;
}

/** Compact, whole-line fallback when the inline render exceeds Discord's limit. */
function compactReply(annotations: Annotation[]): string {
  const out: string[] = [];
  let len = 0;
  for (let i = 0; i < annotations.length; i++) {
    const a = annotations[i]!;
    const line = `${a.raw.trim()} → **${a.display}**`;
    // Leave room for a possible "(+N more)" footer; never cut a line in half.
    if (len + line.length + 1 > DISCORD_MAX - 16) {
      out.push(`…(+${annotations.length - i} more)`);
      break;
    }
    out.push(line);
    len += line.length + 1;
  }
  return out.join('\n');
}

export async function handleMessageCreate(message: Message): Promise<void> {
  try {
    // Ignore bots (including ourselves) and empty / system messages.
    if (message.author.bot || message.system || !message.content) return;

    const guildId = message.guildId;
    let precision = loadConfig().defaultPrecision;
    let customUnits: ReturnType<typeof getCustomUnits> = [];

    if (guildId) {
      const cfg = getGuildConfig(guildId);
      if (!cfg.autoDetect) return; // server opted out
      precision = cfg.precision;
      customUnits = getCustomUnits(guildId);
    }

    const { annotations, reply: rendered } = convertMessageContent(message.content, {
      customUnits,
      mode: 'auto',
      precision,
    });
    if (annotations.length === 0) return;

    if (onCooldown(message.channelId)) return;

    let reply = rendered;
    if (reply.length > DISCORD_MAX) reply = compactReply(annotations);

    await message.reply({
      content: reply,
      // parse: [] neutralises any @everyone/@here/mentions echoed from the
      // original text; repliedUser: false avoids pinging the author.
      allowedMentions: { parse: [], repliedUser: false },
    });
    console.log(
      `Replied to ${message.author.tag} with ${annotations.length} conversion(s): ${annotations
        .map((a) => a.display)
        .join(', ')}`,
    );
  } catch (err) {
    console.error('messageCreate handler error:', err);
  }
}
