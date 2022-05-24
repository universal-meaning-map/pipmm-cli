import * as fs from "fs";
import Utils from "./utils";
import { ErrorContext } from "./errorController";
import ConfigController from "./configController";

export default class LogsController {
  static getComposedCommandName(
    commandName: string,
    subcommandName?: string
  ): string {
    if (!subcommandName) return commandName;
    else return commandName + "." + subcommandName;
  }

  static loadErrorLogs = (): ErrorContext[] => {
    if (fs.existsSync(ConfigController._configFile.resources.logs)) {

      let data = JSON.parse(fs.readFileSync(ConfigController._configFile.resources.logs, "utf8"));

      let logsFile: ErrorContext[] = [];
      let d: ErrorContext;
      for (d of data) {
        logsFile.push(new ErrorContext(d.message, d.info));
      }

      return logsFile;
    }

    throw new Error("No logs file for " + ConfigController._configFile.resources.logs + " exists");
  };

  static saveErrorLogs(errorLogs: ErrorContext[]) {
    const json = JSON.stringify(errorLogs);
    Utils.saveFile(json, Utils.resolveHome(ConfigController._configFile.resources.logs ));
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
    else console.log("\nUse 'pipmm log <errorIndex>' to see more details");
  };

  static logSummary = (logs: ErrorContext[]) => {
    if (logs.length == 0) console.log("\n🌱 Success! No errors were found");
    else console.log("💩 " +logs.length+" errors were found. Run 'ipmm log' to list them");
  };
}
