import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import WatchController from "../lib/watchController";

export default class WatchCommand extends Command {
  static description = "Watches changes on Foam repo and updates the web view";

  static flags = {
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(WatchCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;


    const watcher = new WatchController();
    watcher.start();
  }
}
