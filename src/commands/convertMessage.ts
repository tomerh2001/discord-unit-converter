import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { loadConfig } from '../config.js';
import { analyze, renderReply } from '../conversion/index.js';
import { getCustomUnits, getGuildConfig } from '../storage/customUnits.js';
import { truncateForDiscord, type MessageCommand } from './types.js';

/**
 * Right-click a message → Apps → "Convert Units". Converts every unit in the
 * target message and posts the result publicly as a reply under that message —
 * the same render the passive scanner and /convert use.
 *
 * The interaction itself is acknowledged with an ephemeral defer that we delete
 * once the public reply is posted, so the only thing left in the channel is the
 * conversion (no "X used Convert Units" noise). A "no units found" outcome stays
 * private to the invoker.
 *
 * Uses `explicit` mode because the user deliberately invoked it on this message,
 * so ambiguous tokens like a spaced "in"/"c"/"f" are accepted.
 */
export const convertMessageCommand: MessageCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Convert Units')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    const content = interaction.targetMessage.content ?? '';
    const guildId = interaction.guildId;
    const customUnits = guildId ? getCustomUnits(guildId) : [];
    const precision = guildId
      ? getGuildConfig(guildId).precision
      : loadConfig().defaultPrecision;

    const annotations = analyze(content, { customUnits, mode: 'explicit', precision });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (annotations.length === 0) {
      await interaction.editReply({
        content: "🤷 I couldn't find any convertible units in that message.",
      });
      return;
    }

    // Post the conversion publicly, threaded under the original message.
    await interaction.targetMessage.reply({
      content: truncateForDiscord(renderReply(content, annotations)),
      allowedMentions: { parse: [], repliedUser: false },
    });
    // Remove the private "thinking…" acknowledgement so nothing else is left.
    await interaction.deleteReply();
  },
};
