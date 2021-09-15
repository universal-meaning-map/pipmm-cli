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
  msg?: string;
  target?: string;
  prevContext?: ErrorContext;
}

export class Res {
  value: any;
  errContext!: ErrorContext;

  static success<T>(value: T) {
    let res = new Res();
    res.value = value;
    return res;
  }

  static error(
    errorContext: ErrorContext,
    handleError: (error: ErrorContext) => void
  ): Res {
    let res = new Res();
    res.errContext = errorContext;
    handleError(res.errContext);
    return res;
  }

  isOk() {
    return this.value ? true : false;
  }
  isError() {
    return this.errContext ? true : false;
  }

  static async = async <T>(
    promise: Promise<T>,
    errorContext: ErrorContext,
    handleError: (error: ErrorContext) => void
  ): Promise<Res> => {
    let res = new Res();
    try {
      res.value = await promise;
    } catch (e) {
      res.errContext = errorContext;
      res.errContext.msg = e;
      handleError(res.errContext);
    }
    return res;
  };

  static sync<T>(
    func: () => T,
    errorContext: ErrorContext,
    handleError: (error: ErrorContext) => void
  ): Res {
    let res = new Res();
    try {
      res.value = func();
    } catch (e) {
      res.errContext = errorContext;
      res.errContext.msg = e;
      handleError(res.errContext);
    }
    return res;
  }

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
