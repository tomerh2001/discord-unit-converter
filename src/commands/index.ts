import { convertCommand } from './convert.js';
import { settingsCommand } from './settings.js';
import { unitCommand } from './unit.js';
import type { Command } from './types.js';

export const commands: Command[] = [convertCommand, unitCommand, settingsCommand];

export const commandMap = new Map<string, Command>(commands.map((c) => [c.data.name, c]));

export type { Command };
