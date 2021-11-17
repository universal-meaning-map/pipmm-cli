import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";
import axios from "axios";
import Utils from "../lib/utils";

export default class UploadCommand extends Command {
  static description = "Uploads repo to server";

  static args = [
    {
      name: "password",
      required: false,
      description: "Password to upolad",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(UploadCommand);

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
    const res = await axios.put(
      "https://ipfoam-server-dc89h.ondigitalocean.app/uploadMindRepo/x",
      data
    );
    if (res.data) console.log(res.data);
    else console.log(res);
  }
}
