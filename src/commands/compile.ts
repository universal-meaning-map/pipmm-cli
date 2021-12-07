import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import FoamController from "../lib/foamController";
import ErrorController from "../lib/errorController";
import Ipmm, { NoteWrap } from "../lib/ipmm";

export default class CompileCommand extends Command {
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
      name: "fileName",
      required: false,
      description: "File name to import within the Foam root directory",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(CompileCommand);

    let config = ConfigController.config;

    if(config.foamRepo==undefined)
    console.log("You need first to specify your notes repository.")

      //import a single file
      if (args.fileName) {
        const res = await FoamController.compileFile(
          config.ipmmRepo,
          config.foamRepo,
          args.fileName
        );

        if (res.isOk()) {
          let note: NoteWrap = res.value;
          console.log(note);
          //TODO: Update repo
        }
      }
      //import everything
      else {
        await FoamController.compileAll(config.ipmmRepo, config.foamRepo);
      }
    ErrorController.saveLogs();
  }
}
