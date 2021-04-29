import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import Config from "../lib/config"


export default class ConfigCommand extends Command {
  
  static description = "Use flags to config variables";

  static examples = [
    `$ ipmm hello
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    help: flags.help({ char: "h" }),

    ipmmRepo: flags.string({
      char: "i",
      description: "Set path for Ipmm repository",
    }),

    foamRepo: flags.string({
      char: "f",
      description: "Set path for FOAM repository",
    }),
  };

  async run() {
    const { args, flags } = this.parse(ConfigCommand);

    console.log("hellos")
    await Config.loadConfig();

    if (flags.foamRepo) {
    }
  }

  
}


