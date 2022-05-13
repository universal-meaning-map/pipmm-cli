import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import Compiler from "../lib/compiler";
import ErrorController from "../lib/errorController";
import { NoteWrap } from "../lib/ipmm";
import { promises as fs, readFile } from "fs";
import Referencer from "../lib/referencer";
import Utils from "../lib/utils";
import LogsController from "../lib/logsController";

export default class CompileCommand extends Command {
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
    const { args, flags } = this.parse(CompileCommand);
    let workingPath = process.cwd();
    if (flags.notesRepoPath) {
      workingPath = Utils.resolveHome(flags.notesRepoPath);
    }
    if (!ConfigController.load(workingPath)) return;

    //compile a single file
    if (args.fileName) {
      const res = await Compiler.compileFile(
        ConfigController._configFile.resources.ipmmRepo,
        ConfigController._configFile.resources.notesRepo,
        args.fileName
      );

      if (res.isOk()) {
        let note: NoteWrap = res.value;
        let obj = Utils.strMapToObj(note.block);
        console.log("iid: " + note.iid);
        console.log("cid: " + note.cid);
        console.log(JSON.stringify(obj, null, 2));
        //TODO: Update repo
      }
    }
    //compile all files from user repo and its dependencies
    else {
      await Compiler.compileAll(
        ConfigController._configFile.resources.ipmmRepo,
        ConfigController._configFile.resources.notesRepo
      );
      console.log("Compiled "+Referencer.iidToNoteWrap.size+" abstractions");
      await Utils.saveIpmmRepo();

    }
    
    ErrorController.saveLogs();
    LogsController.logSummary(ErrorController.savedErrors);
  }
}
