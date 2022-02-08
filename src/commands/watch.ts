import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import WatchController from "../lib/watchController";

export default class WatchCommand extends Command {
  static description = "Creates a local server and watches changes on the Abstraction repo, when a file is changed it updates the client";

  static flags = {
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
    isXavi: flags.boolean({
      name: "isXavi",
      char: "x",
      description:
        "Hard-coded foamId references to Xavi's repo are assumed to be on the root folder",
    }),
  };

  async run() {
    const { args, flags } = this.parse(WatchCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;
    if (flags.isXavi) ConfigController.isXavi = true;


    const watcher = new WatchController();
    watcher.start();
  }
}
