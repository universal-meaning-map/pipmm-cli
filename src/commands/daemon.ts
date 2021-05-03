import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import FoamController from "../lib/foamController";
import ErrorController from "../lib/errorController";
import LogsController from "../lib/logsController";
import Ipmm from "../lib/ipmm";
import DaemonServer from "../lib/daemonServer";

export default class DaemonCommand extends Command {
  static description =
    "Parses a given Foam repo and generates an array of notes with their corresponding metadata";

  static flags = {
    help: flags.help({ char: "h" }),
  };

  async run() {
    const { args, flags } = this.parse(DaemonCommand);

    DaemonServer.init();
    process.stdin.resume();
  }
}