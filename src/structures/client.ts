import { botOptions } from "@/utils/bot-options.js";
import { config } from "@/utils/config.js";
import { env } from "@/utils/env.js";
import {
  ApplicationCommandDataResolvable,
  Client,
  Collection,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { CommandOptions, SlashCommandOptions } from "./command.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export class BotClient<Ready extends boolean = boolean> extends Client<Ready> {
  commands = new Collection<string, CommandOptions>();
  slashCommands = new Collection<string, SlashCommandOptions>();

  constructor() {
    super(botOptions);
  }

  connect() {
    this.login(env.TOKEN);
  }

  register() {
    const join = (...paths: string[]) => path.join(__dirname, ...paths);
    const convertToUrl = (path: string) => pathToFileURL(path).toString();

    // commands
    fs.readdirSync(join("../commands")).forEach(async (dir) => {
      const commandFiles = fs
        .readdirSync(join("../commands", dir))
        .filter((file) => file.endsWith("js") || file.endsWith("ts"));

      for (const file of commandFiles) {
        const command = await import(
          convertToUrl(join("../commands", dir, file))
        )
          .then((x) => x?.default)
          .catch(() => null);
        if (!command || !command.name || !command.run) continue;

        this.commands.set(command.name, command);
      }
    });

    // slash commands
    const commands: ApplicationCommandDataResolvable[] = [];
    fs.readdirSync(join("../slashCommands")).forEach(async (dir) => {
      const commandFiles = fs
        .readdirSync(join("../slashCOmmands", dir))
        .filter((file) => file.endsWith("js") || file.endsWith("ts"));

      for (const file of commandFiles) {
        const command = await import(
          convertToUrl(join("../slashCommands", dir, file))
        )
          .then((x) => x?.default)
          .catch(() => null);
        if (!command || !command.data || !command.run) return;

        commands.push(command.data.toJSON());
        this.slashCommands.set(command.data.toJSON().name, command);
      }
    });

    this.on("ready", async () => {
      if (config.guildId && config.guildId.length) {
        const guild = this.guilds.cache.get(config.guildId);
        if (!guild)
          throw new SyntaxError(`No guild exists with ID '${config.guildId}'`);

        await guild.commands.set(commands);
        console.log(`Registered commands in ${guild.name}.`);
      } else {
        await this.application?.commands.set(commands);
        console.log("Registered commands globally.");
      }
    });

    // events
    fs.readdirSync(join("../events"))
      .filter((file) => file.endsWith("js") || file.endsWith("ts"))
      .forEach(async (file) => {
        const event = await import(convertToUrl(join("../events", file)))
          .then((x) => x?.default)
          .catch(() => null);
        if (!event || !event.name || !event.run) return;

        this.on(event.name, event.run.bind(null, this));
      });
  }
}
