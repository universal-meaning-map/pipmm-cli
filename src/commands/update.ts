import { Command, flags } from "@oclif/command";

import ConfigController from "../lib/configController";
import axios from "axios";
import Utils from "../lib/utils";

export default class UpdateCommand extends Command {
  static description = "Uploads repo to server";

  static args = [
    {
      name: "iid",
      required: true,
      description: "iid of the note to update",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(UpdateCommand);

    if (!args.NoteUid) {
      // this.error("No config NoteUID specified");
    }

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
    const res = await axios.put("http://localhost:8080/update/x", notes);
    if (res.data) console.log(res.data);
    else console.log(res);
  }
}
