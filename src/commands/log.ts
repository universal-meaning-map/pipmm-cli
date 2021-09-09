import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";
import LogsController from "../lib/logsController";
import { ProcessError } from "../lib/errorController";

export default class LogsCommand extends Command {
  static description = "Use flags to config variables";

  static args = [
    {
      name: "errorIndex",
      required: true,
      description: "Index of the error to display",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(LogsCommand);

    let logs = LogsController.loadErrorLogs();

    LogsController.logErrorIndex(logs, args.errorIndex);
    this.exit(0);

    //LogsController.logNumberedList(logs);
    //this.log("\nUse the flag -e=<error-index> to view error details");
  }
}
