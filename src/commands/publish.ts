import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import ErrorController from "../lib/errorController";
import Publisher from "../lib/publisher";
import LogsController from "../lib/logsController";

export default class PublishCommand extends Command {
  static description =
    "Exports a given note and publishes to one of the the pre-existing publishing platforms";

  static flags = {
    help: flags.help({ char: "h" }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),

    remote: flags.boolean({
      name: "buttonDown",
      char: "b",
      description:
        "Publishes the specified note to ButtonDown following the config specs",
    }),
  };

  static args = [
    {
      name: "fileName",
      required: false,
      description: "File name within the Foam root directory to import ",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(PublishCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    await Publisher.toButtonDown(args.fileName);

    ErrorController.saveLogs();
    LogsController.logSummary(ErrorController.savedErrors);
  }
}
