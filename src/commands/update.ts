import { Command, flags } from "@oclif/command";

import ConfigController from "../lib/configController";
import axios from "axios";
import Utils from "../lib/utils";

export default class UpdateCommand extends Command {
  static description = "Uploads a note to the sever";

  static args = [
    {
      name: "iid",
      required: true,
      description: "iid of the note to update",
      hidden: false,
    },
  ];


  static flags = {
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };


  async run() {
    const { args, flags } = this.parse(UpdateCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    let repo = "";
    try {
      repo = Utils.getFile(ConfigController.ipmmRepoPath);
    } catch (e) {
      "Failed to retrive Repo from " + ConfigController.ipmmRepoPath;
    }

    let data = JSON.parse(repo);
    let note = data[args.iid];
    let notes: { [iid: string]: any } = {};
    notes[args.iid] = note;
    /*const res1 = await axios.put(
      "https://ipfoam-server-dc89h.ondigitalocean.app/uploadMindRepo/x",
      data
    );*/
    const res = await axios.put("http://localhost:"+ConfigController._configFile.network.localServerPort+"/update/x", notes);
    if (res.data) console.log(res.data);
    else console.log(res);
  }
}
