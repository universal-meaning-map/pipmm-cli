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
      description: "The subcommand to run: import, export, sync, watch",
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
      let notes = await FoamController.import(ipmmRepo, foamRepo);
      Ipmm.save(notes, ipmmRepo)
      
    } else if (args.subcommand == "export") {
      await this.foamExport(ipmmRepo, foamRepo);
    }
    else if (args.subcommand == "buildTypes")
  {
    await FoamController.buildTypes(ipmmRepo, foamRepo);
  }

    ErrorController.saveLogs("foam", args.subcommand);
  }

  foamExport = (ipmmRepo: String, foamRepo: string) => void {};
}

/*
const progressBar = cli.progress({
      format: "{bar} {value}/{total} Notes",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    });

    progressBar.start(files.length, 0);
    progressBar.update(i);
    progressBar.stop();
*/
