import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import ConfigController from "../lib/configController";


export default class GetCommand extends Command {
  static description = "Use flags to config variables";

  static args = [
    {
      name: "NoteUid",
      required: true,
      description: "Note UID to retrieve",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(GetCommand);

    if (!args.NoteUid) {
     // this.error("No config NoteUID specified");
    }

   
  }
}
