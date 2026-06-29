import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  CustomUnitError,
  defineCustomUnit,
  resolveUnit,
} from '../conversion/index.js';
import {
  getCustomUnits,
  removeCustomUnit,
  saveCustomUnit,
} from '../storage/customUnits.js';
import { DIMENSION_BASE_SYMBOL, type Command } from './types.js';

function canManage(interaction: Parameters<Command['execute']>[0]): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

export const unitCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unit')
    .setDescription('Manage custom units for this server')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Define a custom unit, e.g. 1 smoot = 1.7018 m')
        .addStringOption((o) => o.setName('name').setDescription('Unit name, e.g. smoot').setRequired(true))
        .addStringOption((o) => o.setName('symbol').setDescription('Short symbol, e.g. smt').setRequired(true))
        .addNumberOption((o) => o.setName('factor').setDescription('How many of the base unit equal one of this unit').setRequired(true))
        .addStringOption((o) => o.setName('per').setDescription('Existing base unit, e.g. m, kg, l').setRequired(true))
        .addStringOption((o) => o.setName('aliases').setDescription('Extra aliases, comma-separated').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Delete a custom unit')
        .addStringOption((o) => o.setName('name').setDescription('Name of the unit to remove').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List this server’s custom units')),

  async execute(interaction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const units = getCustomUnits(guildId);
      if (units.length === 0) {
        await interaction.reply({
          content: 'No custom units yet. Add one with `/unit add`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const lines = units.map((u) => {
        const base = DIMENSION_BASE_SYMBOL[u.dimension] ?? '?';
        const names = u.aliases.join(', ');
        return `• **${u.aliases[0]}** (${u.symbol}) = ${u.toBase} ${base} — _${u.dimension}_ · aliases: ${names}`;
      });
      await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
      return;
    }

    if (!canManage(interaction)) {
      await interaction.reply({
        content: '🔒 You need the **Manage Server** permission to change custom units.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name', true);
      const removed = removeCustomUnit(guildId, name);
      await interaction.reply({
        content: removed ? `🗑️ Removed custom unit **${name}**.` : `No custom unit named **${name}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // sub === 'add'
    const name = interaction.options.getString('name', true);
    const symbol = interaction.options.getString('symbol', true);
    const factor = interaction.options.getNumber('factor', true);
    const per = interaction.options.getString('per', true);
    const aliasesRaw = interaction.options.getString('aliases') ?? '';
    const aliases = aliasesRaw.split(/[,\s]+/).map((a) => a.trim()).filter(Boolean);

    const existing = getCustomUnits(guildId);
    try {
      const unit = defineCustomUnit({ guildId, name, symbol, factor, per, aliases }, existing);

      // Reject aliases that would shadow a built-in unit.
      const clash = unit.aliases.find((a) => {
        const found = resolveUnit(a);
        return found && !found.custom;
      });
      if (clash) {
        await interaction.reply({
          content: `⚠️ The alias \`${clash}\` is already a built-in unit. Pick a different name/symbol.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      saveCustomUnit(unit, interaction.user.id);
      const base = resolveUnit(per);
      await interaction.reply({
        content: `✅ Added **${name}** (${symbol}): 1 ${name} = ${factor} ${base?.symbol ?? per}. It will now be auto-detected and available in \`/convert\`.`,
      });
    } catch (err) {
      const message = err instanceof CustomUnitError ? err.message : 'Could not define that unit.';
      await interaction.reply({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
