import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { convertExpression } from '../conversion/index.js';
import { guildUnitContext } from './context.js';
import { truncateForDiscord, type Command } from './types.js';

export const convertCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert units, e.g. "10 km to miles", "72f", or "5\'11\\""')
    .addStringOption((o) =>
      o
        .setName('expression')
        .setDescription('e.g. "10 km to miles", "72f", "1.5B USD", "$50 to EUR"')
        .setRequired(true),
    ),

  async execute(interaction) {
    const expression = interaction.options.getString('expression', true);
    const { customUnits, currencyUnits, precision, baseCurrency } = guildUnitContext(
      interaction.guildId,
    );

    const { lines, error } = convertExpression(expression, {
      customUnits,
      currencyUnits,
      baseCurrency,
      precision,
    });

    if (error) {
      await interaction.reply({ content: `⚠️ ${error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: truncateForDiscord(lines.join('\n')) });
  },
};
