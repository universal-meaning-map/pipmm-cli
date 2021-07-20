import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";

export default class ConfigCommand extends Command {
  static description = "Use flags to config variables";

  static args = [
    {
      name: "subcommand",
      required: true,
      description: "The subcommand to run : get, set",
      hidden: false,
    },
    
  ];

  static flags = {
    help: flags.help({ char: "h" }),

    ipmmRepo: flags.string({
      char: "i",
      description: "Path for IPMM repository",
    }),

    foamRepo: flags.string({
      char: "f",
      description: "Path for FOAM repository",
    }),
  };

  async run() {
    const { args, flags } = this.parse(ConfigCommand);
    console.log(args,flags)

    if (!args.subcommand) {
      this.error("No config command specified");
    }

    if (args.subcommand == "get") {
      console.log(ConfigController.config);
      
    } else if (args.subcommand == "set") {
      if (flags.ipmmRepo) ConfigController.ipmmRepoPath = flags.ipmmRepo;
      if (flags.foamRepo) ConfigController.foamRepoPath = flags.foamRepo;
    } else {
      this.error("Config command " + args.subcommand + " does not exist");
    }
  }
}
