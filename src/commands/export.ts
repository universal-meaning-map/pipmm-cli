import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import FoamController from "../lib/foamController";
import ErrorController from "../lib/errorController";
import { NoteWrap } from "../lib/ipmm";
import { promises as fs, readFile } from "fs";
import Referencer from "../lib/referencer";
import Utils from "../lib/utils";

export default class ExportCommand extends Command {
  static description =
    "Compiles the `Abstractions` repository (or a single note) into an IPMM repo and saves it as JSON object";

  static flags = {
    help: flags.help({ char: "h" }),
    notesRepoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
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
    const { args, flags } = this.parse(ExportCommand);
    let workingPath = process.cwd();
    if (flags.notesRepoPath) {
      workingPath = Utils.resolveHome(flags.notesRepoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    //import a single file
    if (args.fileName) {
      const res = await FoamController.compileFile(
        ConfigController._configFile.resources.ipmmRepo,
        ConfigController._configFile.resources.notesRepo,
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
      await FoamController.compileAll(
        ConfigController._configFile.resources.ipmmRepo,
        ConfigController._configFile.resources.notesRepo
      );
      await fs.writeFile(
        ConfigController._configFile.resources.ipmmRepo,
        JSON.stringify(Utils.notesWrapToObjs(Referencer.iidToNoteWrap), null, 2)
      );
      console.log(JSON.stringify(Utils.notesWrapToObjs(Referencer.iidToNoteWrap), null, 2))
    }
    ErrorController.saveLogs();
  }
}
