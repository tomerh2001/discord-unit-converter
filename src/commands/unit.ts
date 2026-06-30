import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  CustomUnitError,
  defineCustomUnit,
  formatQuantity,
  parseMagnitudeNumber,
  parseQuantities,
  resolveUnit,
} from '../conversion/index.js';
import {
  countCustomUnits,
  getCustomUnits,
  removeCustomUnit,
  saveCustomUnit,
} from '../storage/customUnits.js';
import { guildUnitContext } from './context.js';
import { DIMENSION_BASE_SYMBOL, truncateForDiscord, type Command } from './types.js';

/** Max custom units per guild, to bound DB growth and the parser's alias regex. */
const MAX_CUSTOM_UNITS = 100;

const groupFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

function canManage(interaction: Parameters<Command['execute']>[0]): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

export const unitCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unit')
    .setDescription('Manage custom units & currencies for this server')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Define a custom unit/currency, e.g. 1 billion Mesos = 2.5 USD')
        .addStringOption((o) => o.setName('name').setDescription('Unit name, e.g. mesos or smoot').setRequired(true))
        .addStringOption((o) => o.setName('symbol').setDescription('Short symbol, e.g. Mz or smt').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('equals')
            .setDescription('What the rate equals, e.g. "2.5 USD" or "1.7018 m"')
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('rate_amount')
            .setDescription('How many of your unit that equals (supports "1 billion", "1B"). Default 1.')
            .setRequired(false),
        )
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
        return `• **${u.aliases[0]}** (${u.symbol}) — 1 = ${u.toBase} ${base} · _${u.dimension}_ · aliases: ${u.aliases.join(', ')}`;
      });
      await interaction.reply({
        content: truncateForDiscord(lines.join('\n')),
        flags: MessageFlags.Ephemeral,
      });
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
    const equalsStr = interaction.options.getString('equals', true);
    const rateStr = interaction.options.getString('rate_amount') ?? '1';
    const aliasesRaw = interaction.options.getString('aliases') ?? '';
    const aliases = aliasesRaw.split(/[,]+/).map((a) => a.trim()).filter(Boolean);

    const { customUnits, currencyUnits, precision } = guildUnitContext(guildId);

    const rateAmount = parseMagnitudeNumber(rateStr);
    if (rateAmount === null || rateAmount <= 0) {
      await interaction.reply({
        content: `⚠️ Couldn't read the rate amount "${rateStr}". Try \`1\`, \`1 billion\`, or \`1B\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const eq = parseQuantities(equalsStr, { customUnits, currencyUnits, mode: 'explicit' });
    if (eq.length === 0) {
      await interaction.reply({
        content: `⚠️ Couldn't read "${equalsStr}". Try something like \`2.5 USD\`, \`1.7018 m\`, or \`100 cm\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const { value: equalsValue, unit: equalsUnit } = eq[0]!;

    const existing = getCustomUnits(guildId);
    try {
      const unit = defineCustomUnit({ guildId, name, symbol, rateAmount, equalsValue, equalsUnit, aliases });
      const isReplacing = existing.some((e) => e.aliases[0] === unit.aliases[0]);

      if (!isReplacing && countCustomUnits(guildId) >= MAX_CUSTOM_UNITS) {
        await interaction.reply({
          content: `⚠️ This server already has the maximum of ${MAX_CUSTOM_UNITS} custom units. Remove one first.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Reject aliases that shadow a built-in unit, a built-in currency, or
      // another existing custom unit.
      const clash = unit.aliases.find((a) => {
        const builtin = resolveUnit(a);
        if (builtin && !builtin.custom) return true;
        if (currencyUnits.some((c) => !c.custom && c.aliases.includes(a))) return true;
        return existing.some((e) => e.aliases[0] !== unit.aliases[0] && e.aliases.includes(a));
      });
      if (clash) {
        await interaction.reply({
          content: `⚠️ The alias \`${clash}\` is already used by another unit/currency. Pick a different name/symbol.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      saveCustomUnit(unit, interaction.user.id);
      const rate = `${groupFormatter.format(rateAmount)} ${name} = ${formatQuantity(equalsValue, equalsUnit, precision)}`;
      await interaction.reply({
        content: `✅ Added **${name}** (${symbol}): ${rate}. It’s now available in \`/convert\` and the right-click **Convert Units** command.`,
        allowedMentions: { parse: [] },
      });
    } catch (err) {
      const message = err instanceof CustomUnitError ? err.message : 'Could not define that unit.';
      await interaction.reply({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
