import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  getGuildConfig,
  setAutoDetect,
  setPrecision,
} from '../storage/customUnits.js';
import type { Command } from './types.js';

export const settingsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure unit auto-detection for this server')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('autodetect')
        .setDescription('Turn automatic message scanning on or off')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Scan messages automatically?').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('precision')
        .setDescription('How many decimal places to show')
        .addIntegerOption((o) =>
          o.setName('digits').setDescription('0–6 decimal places').setRequired(true).setMinValue(0).setMaxValue(6),
        ),
    )
    .addSubcommand((sub) => sub.setName('view').setDescription('Show the current settings')),

  async execute(interaction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const cfg = getGuildConfig(guildId);
      await interaction.reply({
        content: `**Auto-detect:** ${cfg.autoDetect ? 'on' : 'off'}\n**Precision:** ${cfg.precision} decimal places`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false)) {
      await interaction.reply({
        content: '🔒 You need the **Manage Server** permission to change settings.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'autodetect') {
      const enabled = interaction.options.getBoolean('enabled', true);
      setAutoDetect(guildId, enabled);
      await interaction.reply({
        content: `✅ Automatic unit detection is now **${enabled ? 'on' : 'off'}**.`,
      });
      return;
    }

    if (sub === 'precision') {
      const digits = interaction.options.getInteger('digits', true);
      setPrecision(guildId, digits);
      await interaction.reply({ content: `✅ Conversions will now show **${digits}** decimal places.` });
    }
  },
};
