import * as fs from "fs";
import Utils from "./utils";
import ErrorController, { Res, ErrorContext } from "./errorController";
import ConfigController from "./configController";
import Referencer from "./referencer";

export default class LogsController {
  static getComposedCommandName(
    commandName: string,
    subcommandName?: string
  ): string {
    if (!subcommandName) return commandName;
    else return commandName + "." + subcommandName;
  }

  static loadErrorLogs = (): ErrorContext[] => {
    const path = Utils.resolveHome(ConfigController.logsPath);
    if (fs.existsSync(path)) {
      let data = JSON.parse(fs.readFileSync(path, "utf8"));
      let logsFile: ErrorContext[] = [];
      let d: ErrorContext;
      for (d of data) {
        logsFile.push(new ErrorContext(d.message, d.info));
        // new Res(d.filePath, d.processName, d.error));
      }

      return logsFile;
    }
    throw new Error("No logs file for " + path + " exists");
  };

  static saveErrorLogs(errorLogs: ErrorContext[]) {
    Utils.saveFile(
      JSON.stringify(errorLogs),
      Utils.resolveHome(ConfigController.logsPath)
    );
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
    if (logs.length == 0) console.log("\nSuccess! No errors were found");
    else console.log("\nUse 'ipmm log <errorIndex>' to see more details");
  };
}
