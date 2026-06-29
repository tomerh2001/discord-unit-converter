import { convertCommand } from './convert.js';
import { convertMessageCommand } from './convertMessage.js';
import { settingsCommand } from './settings.js';
import { unitCommand } from './unit.js';
import type { Command, MessageCommand } from './types.js';

/** Slash (chat-input) commands. */
export const chatCommands: Command[] = [convertCommand, unitCommand, settingsCommand];

/** Message context-menu commands (right-click → Apps → …). */
export const messageCommands: MessageCommand[] = [convertMessageCommand];

export const chatCommandMap = new Map(chatCommands.map((c) => [c.data.name, c]));
export const messageCommandMap = new Map(messageCommands.map((c) => [c.data.name, c]));

/** Everything to register with Discord, in one array. */
export const allCommandData = [...chatCommands, ...messageCommands].map((c) => c.data.toJSON());

export type { Command, MessageCommand };
