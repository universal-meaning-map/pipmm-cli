import * as fs from "fs";
import * as path from "path";
import Utils from "./utils";
import { ProcessError } from "./errorController";

export default class LogsController {
  private static _logsDirectory = "~/.ipmm/";

  private static get logsDirectory(): string {
    return Utils.resolveHome(LogsController._logsDirectory);
  }

  private static getProcessLogDirectory(commandName: string) {
    return path.join(
      LogsController.logsDirectory,
      "log_" + commandName + ".json"
    );
  }

  static getComposedCommandName(
    commandName: string,
    subcommandName?: string
  ): string {
    if (!subcommandName) return commandName;
    else return commandName + "." + subcommandName;
  }

  static loadErrorLogs = (
    command: string,
    subcommand: string
  ): ProcessError[] => {
    let composedCommandName = LogsController.getComposedCommandName(
      command,
      subcommand
    );
    let logsPath = LogsController.getProcessLogDirectory(composedCommandName);

    if (fs.existsSync(logsPath)) {
      let data = JSON.parse(fs.readFileSync(logsPath, "utf8"));
      let logsFile: ProcessError[] = [];
      for (let d of data) {
        logsFile.push(
          new ProcessError(d.filePath, d.processName, d.error)
        );
      }

      return logsFile;
    }
    throw new Error("No logs file for " + logsPath + " exists");
  };

  static saveErrorLogs(
    command: string,
    subcommand: string,
    errorLogs: ProcessError[]
  ) {
    let composedCommandName = LogsController.getComposedCommandName(
      command,
      subcommand
    );

    Utils.saveFile(
      JSON.stringify(errorLogs),
      this.getProcessLogDirectory(composedCommandName)
    );
  }
}
