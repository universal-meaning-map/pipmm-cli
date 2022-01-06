import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import * as fs from "fs";
import Utils from "../lib/utils";
import { Console } from "console";
import { off } from "process";

export default class InitCommand extends Command {
  static description =
    "Generates initial configuration, the MID (mind-identifier) and its keys";

  static args = [
    {
      name: "foamRepo",
      required: true,
      description: "The path to the root of the repository you keep your notes",
      hidden: false,
    },
  ];

  static flags = {
    help: flags.help({ char: "h" }),
    force: flags.boolean({
      name: "force",
      char: "f",
      description:
        "Generates a new config file overriding existing one, including keys",
    }),
  };

  async run() {
    const { args, flags } = this.parse(InitCommand);

    if (flags.force) {
      ConfigController.init(args.foamRepo);
      return;
    }

    if (fs.existsSync(Utils.resolveHome(ConfigController.configPath))) {
      console.log("A config already exists at " + ConfigController.configPath);
      console.log("Running the command will override the already created keys");
      console.log("Use the -f flag to ignore this warning");
    } else {
      ConfigController.init(args.foamRepo);
    }
  }
}
