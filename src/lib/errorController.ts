import LogsController from "./logsController";

export default class ErrorController {
  static processErrors: Res[] = [];
  static catchedErrors: ErrorContext[] = [];

  static recordProcessError = (
    filePath: string,
    processName: string,
    error: string
  ): void => {
    throw "recordProcessError used in " + processName;
    // ErrorController.processErrors.push( new ProcessError(filePath, processName, error));
  };

  static saveLogs() {
    LogsController.saveErrorLogs(ErrorController.processErrors);
  }

  static logProcessErrors = (): void => {
    /*
    if (ErrorController.processErrors.length == 0)
      console.log("No errors where produced");
    for (let e of ErrorController.processErrors)
      console.log("Error " + e.processName + " for " + e.filePath);
      */
  };

  
}

interface ErrorContext {
  process?: string;
  target?: string;
  error?: string;
}

export class Res {
  value: any;
  errContext!: ErrorContext;

  ok<T>(value: T) {
    this.value = value;
  }

  err(error: ErrorContext, handleError: (error: ErrorContext) => {}) {
    this.errContext = error;
    handleError(this.errContext);
  }

  isOk() {
    return this.value ? true : false;
  }

  static make = async <T>(promise: Promise<T>, errorContext:ErrorContext, handleError: (error: ErrorContext)=>void ): Promise<Res> => {
    let res = new Res();
    try {
      res.value = await promise;
    } catch (e) {
      res.errContext = errorContext;
      res.errContext.error=e
      handleError(res.errContext)
    }
    return res;
  };

  static saveError = (e: ErrorContext): void => {
    ErrorController.catchedErrors.push(e);
  };
}

/*
 promise.then(
      (value) => {
        this.value = value;
        console.log("Resolved");
      },
      (err) => {
        this.err = err;
        console.log("Error ", err);
      }
    );*/
