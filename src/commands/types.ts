import type {
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

/**
 * A slash command. `data` is any discord.js command builder (they all expose
 * `name` and `toJSON()`), and `execute` handles the interaction.
 */
export interface Command {
  data: { name: string; toJSON(): RESTPostAPIApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export const DISCORD_MESSAGE_LIMIT = 2000;

/** Trim content to Discord's message limit, cutting on a line boundary. */
export function truncateForDiscord(text: string): string {
  if (text.length <= DISCORD_MESSAGE_LIMIT) return text;
  const slice = text.slice(0, DISCORD_MESSAGE_LIMIT - 2);
  const lastNewline = slice.lastIndexOf('\n');
  return `${lastNewline > 0 ? slice.slice(0, lastNewline) : slice}\n…`;
}

/** Base unit symbol for each dimension, used when describing custom units. */
export const DIMENSION_BASE_SYMBOL: Record<string, string> = {
  length: 'm',
  mass: 'g',
  temperature: '°C',
  volume: 'L',
  area: 'm²',
  speed: 'm/s',
  pressure: 'Pa',
};
