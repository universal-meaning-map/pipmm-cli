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
      name: "platform",
      required: true,
      description: "One of the platform ids used in the config.json/publish",
      hidden: false,
    },
    {
      name: "fileName",
      required: true,
      description: "File name within the repository root directory to import ",
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

    if (args.platform == "buttondown") {
      await Publisher.toButtondown(args.fileName);
    } else if (args.platform == "twitter") {
      await Publisher.toTwitter(args.fileName);
    } else if (args.platform == "telegram") {
      await Publisher.toTelegram(args.fileName);
    } else {
      console.log(
        "There is no platform with the id of '" + args.platform + "'"
      );
      console.log(
        "Currently available plaforms are: buttondown, twitter and telegram"
      );
      return;
    }

    ErrorController.saveLogs();
    LogsController.logSummary(ErrorController.savedErrors);
  }
}
