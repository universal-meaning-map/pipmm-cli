import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import * as fs from "fs";
import Utils from "../lib/utils";

export default class InitCommand extends Command {
  static description =
    "Generates initial configuration, the MID (mind-identifier) and its keys";

  static flags = {
    help: flags.help({ char: "h" }),
    force: flags.boolean({
      name: "force",
      char: "f",
      description:
        "Generates a new config file overriding existing one, including keys and the existing preferences",
    }),
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(InitCommand);
  

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    let configPath = workingPath + ConfigController.relativeConfigPath;

    if (flags.force) {
      ConfigController.init(workingPath);
      return;
    }

    if (fs.existsSync(configPath)) {
      console.log("A config already exists at " + configPath);
      console.log("Running the command will override the already created keys");
      console.log("Use the -f flag to ignore this warning");
    } else {
      ConfigController.init(workingPath);
    }
  }
}
