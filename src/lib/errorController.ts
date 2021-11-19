import LogsController from "./logsController";

export default class ErrorController {
  static savedErrors: ErrorContext[] = [];
  /*
  static recordProcessError = (
    filePath: string,
    processName: string,
    error: string
  ): void => {
    throw "recordProcessError used in " + processName;
    // ErrorController.processErrors.push( new ProcessError(filePath, processName, error));
  };

  */

  static saveLogs() {
    LogsController.saveErrorLogs(ErrorController.savedErrors);
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

export class ErrorContext {
  message: string;
  info?: any;
  constructor(msg: string, info?: any) {
    this.message = msg;
    this.info = info; //.toString();
  }
}

export class Res {
  value: any;
  context?: ErrorContext;

  static success<T>(value: T) {
    let res = new Res();
    res.value = value;
    return res;
  }

  static error(
    errorMessage: string,
    handleError: (error: ErrorContext) => void,
    errorInfo?: any
  ): Res {
    let res = new Res();
    res.context = new ErrorContext(errorMessage, errorInfo);
    handleError(res.context);
    return res;
  }

  isOk() {
    return this.value ? true : false;
  }
  isError() {
    return this.context ? true : false;
  }

  static async = async <T>(
    promise: Promise<T>,
    errorMessage: string,
    handleError: (error: ErrorContext) => void,
    errorInfo?: any
  ): Promise<Res> => {
    let res = new Res();
    try {
      res.value = await promise;
    } catch (e) {
      res.context = new ErrorContext(errorMessage, errorInfo);
      handleError(res.context);
      return res;
    }
    return res;
  };

  static sync<T>(
    func: () => T,
    errorMessage: string,
    handleError: (error: ErrorContext) => void,
    errorInfo?: any
  ): Res {
    let res = new Res();
    try {
      res.value = func();
    } catch (e) {
      res.context = new ErrorContext(errorMessage, errorInfo);
      handleError(res.context);
      return res;
    }
    return res;
  }

  static saveError = (e: ErrorContext): void => {
    ErrorController.savedErrors.push(e);
  };
}
