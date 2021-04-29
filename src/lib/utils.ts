import * as path from "path";

export default class Utils {
  static resolveHome = (filepath: string) => {
    if (filepath[0] === "~") {
      if (process.env.HOME)
        return path.join(process.env.HOME, filepath.slice(1));
      else
        throw new Error(
          "process.env.HOME does not exist. Unable to resolve ~ for " + filepath
        );
    }
    return filepath;
  };
}
