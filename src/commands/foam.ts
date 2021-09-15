import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import FoamController from "../lib/foamController";
import ErrorController from "../lib/errorController";
import LogsController from "../lib/logsController";
import Ipmm from "../lib/ipmm";

export default class FoamCommand extends Command {
  static description =
    "Parses a given Foam repo and generates an array of notes with their corresponding metadata";

  static flags = {
    help: flags.help({ char: "h" }),

    ipmmRepo: flags.string({
      name: "ipmm_repo",
      char: "i",
      description:
        "Path to IPMM repository. If not specified it defaults to the config one",
      // default: getCurrentPath()
    }),
    foamRepo: flags.string({
      name: "foam_repo",
      char: "f",
      description:
        "Path the FOAM repository. If not specified it defaults to the config one",
      // default: getCurrentPath()
    }),
  };

  static args = [
    {
      name: "subcommand",
      required: true,
      description: "The subcommand to run: import",
      hidden: false,
    },
    {
      name: "fileName",
      required: false,
      description: "File name to import within the Foam root directory",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(FoamCommand);

    if (!args.subcommand) {
      this.error("No Foam command specified");
    }
    let config = ConfigController.config;

    let ipmmRepo: string = flags.ipmmRepo ? flags.ipmmRepo : config.ipmmRepo;
    let foamRepo: string = flags.foamRepo ? flags.foamRepo : config.foamRepo;

    if (args.subcommand == "import") {
      //import a single file
      if (args.fileName) {
        const note = await FoamController.importFile(
          ipmmRepo,
          foamRepo,
          args.fileName
        );

        if (note.isOk()) console.log(note.value);
      }

      //import everything
      else {
        await FoamController.importAll(ipmmRepo, foamRepo);
        //Ipmm.save(notes, ipmmRepo);
      }
    } else if (args.subcommand == "export") {
      await this.foamExport(ipmmRepo, foamRepo);
    }

    ErrorController.saveLogs();
  }

  foamExport = (ipmmRepo: String, foamRepo: string) => void {};
}
