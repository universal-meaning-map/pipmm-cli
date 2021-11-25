import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";
import axios from "axios";
import Utils from "../lib/utils";
import Referencer from "../lib/referencer";

export default class RestoreCommand extends Command {
  static description = "Uploads repo to server";

  static args = [
    {
      name: "Password",
      required: false,
      description: "foamId of the note to update",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(RestoreCommand);

    if (!args.foamId) {
      // this.error("No config NoteUID specified");
    }

    let repo = "";
    try {
      repo = Utils.getFile(ConfigController.ipmmRepoPath);
    } catch (e) {
      "Failed to retrive Repo from " + ConfigController.ipmmRepoPath;
    }

    let data = JSON.parse(repo);

    /*const res1 = await axios.put(
      "https://ipfoam-server-dc89h.ondigitalocean.app/uploadMindRepo/x",
      data
    );*/
    const res = await axios.put("http://localhost:8080/restore/x", data);
    if (res.data) console.log(res.data);
    else console.log(res);
  }
}
