import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";
import LogsController from "../lib/logsController";

export default class LogsCommand extends Command {
  static description = "Use flags to config variables";

  static args = [
    {
      name: "command",
      required: true,
      description: "Command to get the logs from",
      hidden: false,
    },
    {
      name: "subcommand",
      required: false,
      description: "Subcommand to get the logs from",
      hidden: false,
    },
  ];

  static flags = {
    help: flags.help({ char: "h" }),

    verbose: flags.boolean({
      char: "v",
      description: "Show the entire log file",
    }),
  };

  async run() {
    const { args, flags } = this.parse(LogsCommand);

    let commandName: string = args.command;

    if (args.subcommand) {
      commandName = commandName + "." + args.subcommand;
    }

    if (flags.verbose)
      console.log(LogsController.loadErrorLogs(args.command, args.subcommand));
    else
      console.log(LogsController.loadErrorLogs(args.command, args.subcommand));
  }
}
