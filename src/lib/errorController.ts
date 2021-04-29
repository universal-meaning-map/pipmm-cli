import LogsController from "./logsController";

export default class ErrorController {
  private static processErrors: ProcessError[] = [];

  static recordProcessError = (
    filePath: string,
    processName: string,
    error: string
  ): void => {
    ErrorController.processErrors.push(
      new ProcessError(filePath, "reading file", error)
    );
  };

  static saveLogs(command: string, subcommand: string) {
    LogsController.saveErrorLogs(
      command,
      subcommand,
      ErrorController.processErrors
    );
  }

  static logProcessErrors = (): void => {
    for (let e of ErrorController.processErrors)
      console.log("Error " + e.processName + " for " + e.filePath);
  };
}

export class ProcessError {
  constructor(
    public filePath: string,
    public processName: string,
    public error: string
  ) {}
}
