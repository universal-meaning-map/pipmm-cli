import { Command, flags } from "@oclif/command";
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
    {
      name: "property",
      required: true,
      description:
        "property key to set or get. Use 'all' to get the entire config.",
    },
    {
      name: "value",
      required: false,
      description: "value",
    },
  ];

  async run() {
    const { args, flags } = this.parse(ConfigCommand);
    //console.log(args, flags);

    if (!args.subcommand) {
      this.error("No config command specified");
    }

    if (args.subcommand == "get") {
      console.log(ConfigController.config);
    } else if (args.subcommand == "set") {
      if (!args.value) console.log("You need to specify the path");
      if (args.property == "ipmmRepo")
        ConfigController.ipmmRepoPath = args.value;
      else if (args.property == "foamRepo")
        ConfigController.foamRepoPath = args.value;
      else if (args.property == "ipfsRepo")
        ConfigController.ipfsRepoPath = args.value;
      else {
        this.error("Property " + args.property + "does not exist");
      }
    } else {
      this.error("Config command " + args.subcommand + " does not exist");
    }
  }
}
