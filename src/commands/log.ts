import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";
import LogsController from "../lib/logsController";
import { Res } from "../lib/errorController";
import { Config } from "@oclif/config";
import Utils from "../lib/utils";

export default class LogsCommand extends Command {
  static description = "View the logs from the last command ran";

  static args = [
    {
      name: "errorIndex",
      required: false,
      description: "Index of the error to display",
      hidden: false,
    },
  ];

  static flags = {
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(LogsCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;


    let logs = LogsController.loadErrorLogs();

    if (args.errorIndex) LogsController.logErrorIndex(logs, args.errorIndex);
    else LogsController.logAllErrors(logs);

    this.exit(0);

    //LogsController.logNumberedList(logs);
    //this.log("\nUse the flag -e=<error-index> to view error details");
  }
}
