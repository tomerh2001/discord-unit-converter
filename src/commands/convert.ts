import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { loadConfig } from '../config.js';
import { convertExpression } from '../conversion/index.js';
import { getCustomUnits, getGuildConfig } from '../storage/customUnits.js';
import type { Command } from './types.js';

export const convertCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert units, e.g. "10 km to miles", "72f", or "5\'11\\""')
    .addStringOption((o) =>
      o
        .setName('expression')
        .setDescription('What to convert — a value with a unit, optionally "... to <unit>"')
        .setRequired(true),
    ),

  async execute(interaction) {
    const expression = interaction.options.getString('expression', true);
    const guildId = interaction.guildId;
    const customUnits = guildId ? getCustomUnits(guildId) : [];
    const precision = guildId
      ? getGuildConfig(guildId).precision
      : loadConfig().defaultPrecision;

    const { lines, error } = convertExpression(expression, { customUnits, precision });

    if (error) {
      await interaction.reply({ content: `⚠️ ${error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: lines.join('\n') });
  },
};
