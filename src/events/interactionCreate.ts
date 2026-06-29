import { type Interaction, MessageFlags, type RepliableInteraction } from 'discord.js';
import { chatCommandMap, messageCommandMap } from '../commands/index.js';

async function run(
  interaction: RepliableInteraction,
  commandName: string,
  exec: () => Promise<void>,
): Promise<void> {
  try {
    await exec();
  } catch (err) {
    console.error(`Error in command "${commandName}":`, err);
    const payload = {
      content: '⚠️ Something went wrong running that command.',
      flags: MessageFlags.Ephemeral as const,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => undefined);
    } else {
      await interaction.reply(payload).catch(() => undefined);
    }
  }
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = chatCommandMap.get(interaction.commandName);
    if (command) await run(interaction, interaction.commandName, () => command.execute(interaction));
  } else if (interaction.isMessageContextMenuCommand()) {
    const command = messageCommandMap.get(interaction.commandName);
    if (command) await run(interaction, interaction.commandName, () => command.execute(interaction));
  }
}
