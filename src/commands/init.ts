import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import * as fs from "fs";
import Utils from "../lib/utils";

export default class InitCommand extends Command {
  static description = "Generates initial configuration, the MID (mind-identifier) and its keys";

  static flags = {
    help: flags.help({ char: "h" }),
    force: flags.boolean({
      name: "force",
      char: "f",
      description:
        "Generates a new config file despite on existing. Overrides existing keys",
    }),
  };

  async run() {
    const { args, flags } = this.parse(InitCommand);

     if(flags.force){
        ConfigController.init();
        return;
    }
    

    if (fs.existsSync(Utils.resolveHome( ConfigController._configPath))) {
      console.log("A config already exists at " + ConfigController._configPath);
      console.log("Running the command will override the already created keys");
      console.log("Use the -f flag to ignore this warning");
    } else {
      ConfigController.init();
    }
  }
}
