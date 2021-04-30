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
      name: "command",
      required: true,
      description: "Command to get the logs from",
      hidden: false,
    },
    {
      name: "subcommand",
      required: false,
      description: "Subcommand to get the logs from",
      hidden: false,
    },
  ];

  static flags = {
    help: flags.help({ char: "h" }),

    verbose: flags.boolean({
      char: "v",
      description: "Show the entire log file",
    }),
    errorIndex: flags.string({
      char: "e",
      description: "Error index to display details.",
    }),
  };

  async run() {
    const { args, flags } = this.parse(LogsCommand);

    let logs = LogsController.loadErrorLogs(args.command, args.subcommand);

    if (flags.errorIndex) {
      this.logErrorIndex(logs, flags.errorIndex);
      this.exit(0);
    }

    this.logNumberedList(logs);
    this.log("\nUse the flag -e=<error-index> to view error details");
  }

  logNumberedList = (logs: ProcessError[]) => {
    let i = 0;
    for (let l of logs) {
      this.log(i + ". Error " + l.processName + ": " + l.filePath);
      i++;
    }
  };

  logErrorIndex = (logs: ProcessError[], errorIndex: string) => {
    let i = Number.parseInt(errorIndex);
    if(i>logs.length-1){
        this.error("Error index out of range. Largest index is "+(logs.length-1))
    }
    this.log(
      i +
        ".\tError " +
        logs[i].processName +
        ": " +
        logs[i].filePath
    );
    console.log(logs[i].error);
  };
}
