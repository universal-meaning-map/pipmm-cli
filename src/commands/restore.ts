import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import axios from "axios";
import Referencer from "../lib/referencer";
import Compiler from "../lib/compiler";
import Utils from "../lib/utils";
import Filter from "../lib/filterController";

export default class RestoreCommand extends Command {
  static description =
    "Compiles repo, filters it and uploads to the server (local or remote, depending on the flag) erasing the previous version applying a filter";

  static flags = {
    help: flags.help({ char: "h" }),

    remote: flags.boolean({
      name: "remote",
      char: "r",
      description:
        "Restores the IPMM repo into the remote server specified in the config file using the `remoteFilter.json`. If this flag is not use it will try to restore a local server using `localFilter.json` instead.",
    }),
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
    isXavi: flags.boolean({
      name: "isXavi",
      char: "x",
      description:
        "Hard-coded foamId references to Xavi's repo are assumed to be on the root folder",
    }),
  };

  async run() {
    const { args, flags } = this.parse(RestoreCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;
    if (flags.isXavi) ConfigController.isXavi = true;

    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );
    let repo = Referencer.iidToNoteWrap;

    let endpoint = "";
    let jsonFilter = "";

    //REMOTE
    if (flags.remote) {
      console.log(
        "Restoring to remote: " + ConfigController._configFile.network.remoteServer
      );
      if (ConfigController._configFile.network.remoteServer == "") {
        console.log(
          "'remoteServer' not specified in " + ConfigController.configPath
        );
        return;
      }
      endpoint =
        ConfigController._configFile.network.remoteServer + "/restore/x";
      jsonFilter = Utils.getFile(ConfigController.remoteFilterPath);
      console.log("Restoring remote repo");
    }
    //LOCAL
    else {
      endpoint =
        "http://localhost:" +
        ConfigController._configFile.network.localServerPort +
        "/restore/x";
      jsonFilter = Utils.getFile(ConfigController.localFilterPath);
      console.log("Restoring to local:"+ endpoint);
    }
    let filter = JSON.parse(jsonFilter);
    console.log("Applying filter:\n" + jsonFilter);

    let filteredRepo = await Filter.filter(repo, filter);
    console.log("Total abstractions: " + repo.size);
    console.log("Filtered abstractions: " + filteredRepo.size);
    console.log(
      "Percentage " +
        Math.round(((filteredRepo.size * 100) / repo.size) * 100) / 100 +
        "%"
    );

    console.log("Uploading...");

    const res = await axios.put(endpoint, Utils.notesWrapToObjs(filteredRepo));

    if (res.data) {
      console.log(res.data);
    } else {
      console.log(res);
    }
  }
}
