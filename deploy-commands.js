import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import path from 'path';
import { fileURLToPath } from 'url';

const deployCommandToAll = true;

(async () => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	const commands = [];
	// Grab all the command folders from the commands directory you created earlier
	const foldersPath = join(__dirname, 'commands');
	const commandFolders = readdirSync(foldersPath);

	for (const file of commandFolders) {
		const filePath = './commands/'+file;
		const command = await import(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}

	// Construct and prepare an instance of the REST module
	const rest = new REST().setToken(process.env.BOT_TOKEN);

	// and deploy your commands!
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);

			let data

			if (deployCommandToAll) {
				// The put method is used to fully refresh all commands
				data = await rest.put(
					Routes.applicationCommands(process.env.APP_ID),
					{ body: commands },
				);
			} else {
				data = await rest.put(
					Routes.applicationGuildCommands(process.env.APP_ID, process.env.DISCORD_ID),
					{ body: commands },
				);
			}

			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			// And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
})();