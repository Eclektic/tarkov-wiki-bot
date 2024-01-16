import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const rest = new REST().setToken(process.env.BOT_TOKEN);

// ...

// for guild-based commands
rest.put(Routes.applicationGuildCommands(process.env.APP_ID, process.env.DISCORD_ID), { body: [] })
	.then(() => console.log('Successfully deleted all guild commands.'))
	.catch(console.error);

// for global commands
rest.put(Routes.applicationCommands(process.env.APP_ID), { body: [] })
	.then(() => console.log('Successfully deleted all application commands.'))
	.catch(console.error);