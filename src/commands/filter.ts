import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Filter from "../lib/filterController";
import FoamController from "../lib/foamController";
import Referencer from "../lib/referencer";

export default class FilterCommand extends Command {
  static description = "Returns a list of compiled notes based on a filter. It uses the filterLocal set in the config by default. Use -r to use filterRemote instead";

  static flags = {
    remote: flags.boolean({
      name: "remote",
      char: "r",
      description:
        "Use filterRemote specified in the config.",
    }),
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(FilterCommand);
    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    await FoamController.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );
    let inputNotes = Referencer.iidToNoteWrap;

    let filterJson;
    if (flags.remote) {
      console.log("Filtering based on filterRemote");
      filterJson = Utils.getFile(ConfigController.remoteFilterPath);
    } else {
      console.log("Filtering based on loca filterLocal");
      filterJson = Utils.getFile(ConfigController.localFilterPath);
    }

    let filter = JSON.parse(filterJson);
    console.log("Applying filter:");
    console.log(filter);
    let outputNotes = await Filter.filter(inputNotes, filter);

    console.log(outputNotes);
  }
}
