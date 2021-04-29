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

  static logProcessErrors = (): void => {
    for (let e of ErrorController.processErrors)
      console.log("Error " + e.processName + " for " + e.notePath);
  };
}

class ProcessError {
  constructor(
    public notePath: string,
    public processName: string,
    public error: string
  ) {}
}
