import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { convertMessageContent } from '../conversion/index.js';
import { guildUnitContext } from './context.js';
import { truncateForDiscord, type MessageCommand } from './types.js';

/**
 * Right-click a message → Apps → "Convert Units". Converts every unit in the
 * target message and replies publicly — the same render the passive scanner and
 * /convert use.
 *
 * This is a plain public interaction reply, so Discord shows the standard
 * "<user> used Convert Units" attribution above the result. A "no units found"
 * outcome is sent ephemerally so it doesn't clutter the channel.
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
    const { customUnits, currencyUnits, precision, baseCurrency } = guildUnitContext(
      interaction.guildId,
    );

    const { annotations, reply } = convertMessageContent(content, {
      customUnits,
      currencyUnits,
      baseCurrency,
      mode: 'explicit',
      precision,
    });

    if (annotations.length === 0) {
      await interaction.reply({
        content: "🤷 I couldn't find any convertible units in that message.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: truncateForDiscord(reply),
      allowedMentions: { parse: [] },
    });
  },
};
