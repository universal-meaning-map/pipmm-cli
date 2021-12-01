import { Command, flags } from "@oclif/command";
import WatchController from "../lib/watchController";

export default class WatchCommand extends Command {
  static description = "Watches changes on Foam repo and updates the web view";

  async run() {
    const { args, flags } = this.parse(WatchCommand);
    const watcher = new WatchController();
    watcher.start();
  }
}
