import { Command, flags } from "@oclif/command";
import WatchController from "../lib/watchController";
import { Config } from "@oclif/config";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";

export default class WatchCommand extends Command {
  static description = "Watches changes on Foam repo and updates the web view";

  async run() {
    const { args, flags } = this.parse(WatchCommand);

    //Watch FoamRepo
    const watcher = new WatchController();
    watcher.startFileWatcher();

    //Import foamId if changes
    //Upload note to server
    //Notifiy client of note change
    watcher.startWs();
  }
}
