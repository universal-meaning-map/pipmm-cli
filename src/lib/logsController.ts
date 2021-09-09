import * as fs from "fs";
import * as path from "path";
import Utils from "./utils";
import ErrorController, { ProcessError } from "./errorController";

export default class LogsController {
  private static logsPath = "~/.ipmm/logs.json";

  static getComposedCommandName(
    commandName: string,
    subcommandName?: string
  ): string {
    if (!subcommandName) return commandName;
    else return commandName + "." + subcommandName;
  }

  static loadErrorLogs = (): ProcessError[] => {
    if (fs.existsSync(LogsController.logsPath)) {
      let data = JSON.parse(fs.readFileSync(LogsController.logsPath, "utf8"));
      let logsFile: ProcessError[] = [];
      for (let d of data) {
        logsFile.push(new ProcessError(d.filePath, d.processName, d.error));
      }

      return logsFile;
    }
    throw new Error("No logs file for " + LogsController.logsPath + " exists");
  };

  static saveErrorLogs(errorLogs: ProcessError[]) {
    Utils.saveFile(JSON.stringify(errorLogs), LogsController.logsPath);
  }

  static logNumberedList = (logs: ProcessError[]) => {
    let i = 0;
    for (let l of logs) {
      console.log(i + ". Error " + l.processName + ": " + l.filePath);
      i++;
    }
  };

  static logErrorIndex = (logs: ProcessError[], errorIndex: string) => {
    let i = Number.parseInt(errorIndex);
    if (i > logs.length - 1) {
      console.error(
        "Error index out of range. Largest index is " + (logs.length - 1)
      );
    }
    console.log(
      i + ".\tError " + logs[i].processName + ": " + logs[i].filePath
    );
    console.log(logs[i].error);
  };

  static displayLogsNotice() {
    if (ErrorController.processErrors.length == 0) return;
    console.log(ErrorController.processErrors.length + " errors where found:")
    LogsController.logNumberedList(ErrorController.processErrors);
    console.log(
      "\nUse the `log` command with the flag `-e=<error-index>` to view error details"
    );
  }
}
