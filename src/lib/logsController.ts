import * as fs from "fs";
import Utils from "./utils";
import ErrorController, { Res, ErrorContext } from "./errorController";

export default class LogsController {
  private static logsPath = "~/.ipmm/logs.json";

  static getComposedCommandName(
    commandName: string,
    subcommandName?: string
  ): string {
    if (!subcommandName) return commandName;
    else return commandName + "." + subcommandName;
  }

  static loadErrorLogs = (): ErrorContext[] => {
    if (fs.existsSync(LogsController.logsPath)) {
      let data = JSON.parse(fs.readFileSync(LogsController.logsPath, "utf8"));
      let logsFile: ErrorContext[] = [];
      let d: ErrorContext;
      for (d of data) {
        logsFile.push(new ErrorContext(d.message, d.info));
        // new Res(d.filePath, d.processName, d.error));
      }

      return logsFile;
    }
    throw new Error("No logs file for " + LogsController.logsPath + " exists");
  };

  static saveErrorLogs(errorLogs: ErrorContext[]) {
    Utils.saveFile(JSON.stringify(errorLogs), LogsController.logsPath);
  }

  static logNumberedList = (logs: ErrorContext[]) => {
    let i = 0;
    for (let e of logs) {
      console.log(
        "  " + i + ". Error " + e.message + ": " + JSON.stringify(e.info)
      );
      i++;
    }
  };

  static logErrorIndex = (logs: ErrorContext[], errorIndex: number) => {
    let i = errorIndex; //Number.parseInt(errorIndex);
    if (i > logs.length - 1) {
      console.error(
        "Error index out of range. Largest index is " + (logs.length - 1)
      );
    }
    console.log(i + ". " + logs[i].message);
    if (logs[i].info) console.dir(logs[i].info);
  };

  static logAllErrors = (logs: ErrorContext[], verbose: boolean = false) => {
    for (let i = 0; i < logs.length; i++) {
      console.log(i + ". " + logs[i].message);
      if (verbose && logs[i].info)
        console.log("   " + JSON.stringify(logs[i].info) + "\n");
    }
  };
}
