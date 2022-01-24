import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Filter from "../lib/filter";
import FoamController from "../lib/foamController";
import Referencer from "../lib/referencer";

export default class QueryCommand extends Command {
  static description = "Uploads repo to server";

  static flags = {
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(QueryCommand);
    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    await FoamController.compileAll(ConfigController.ipmmRepoPath, ConfigController.foamRepoPath);
    let inputNotes = Referencer.iidToNoteWrap;

    let filterJson = Utils.getFile(ConfigController.remoteFilterPath);
    let filter = JSON.parse(filterJson);
    console.log("Applying filter:");
    console.log(filter);
    let outputNotes = await Filter.filter(inputNotes,filter);

    console.log(outputNotes);
  }
}
