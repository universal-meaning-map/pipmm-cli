import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import FoamController from "../lib/foamController";
import ErrorController from "../lib/errorController";
import {NoteWrap}  from "../lib/ipmm";
import { promises as fs, readFile } from "fs";
import Referencer from "../lib/referencer";


export default class ExportCommand extends Command {
  static description =
    "Compiles the entire Foam specified in the config (or a single note) into an IPMM repo and saves it as JSON object where specified in the config";

  static flags = {
    help: flags.help({ char: "h" }),
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
    const { args, flags } = this.parse(ExportCommand);
    ConfigController.load();



      //import a single file
      if (args.fileName) {
        const res = await FoamController.compileFile(
          ConfigController._configFile.resources.ipmmRepo,
          ConfigController._configFile.resources.foamRepo,
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
        await FoamController.compileAll(ConfigController._configFile.resources.ipmmRepo, ConfigController._configFile.resources.foamRepo);
        await fs.writeFile(
          ConfigController.ipmmRepoPath,
          JSON.stringify(Referencer.iidToNoteWrap, null, 4)
        );
      }
    ErrorController.saveLogs();
  }
}
