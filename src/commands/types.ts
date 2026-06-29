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
