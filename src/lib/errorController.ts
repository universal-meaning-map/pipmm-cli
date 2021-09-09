import LogsController from "./logsController";

export default class ErrorController {
   static processErrors: ProcessError[] = [];

  static recordProcessError = (
    filePath: string,
    processName: string,
    error: string
  ): void => {
    ErrorController.processErrors.push(
      new ProcessError(filePath, processName, error)
    );
  };

  static saveLogs() {
    LogsController.saveErrorLogs(
      ErrorController.processErrors
    );
  }

  static logProcessErrors = (): void => {
    if(ErrorController.processErrors.length==0)
      console.log("No errors where produced")
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
