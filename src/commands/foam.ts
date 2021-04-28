import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import { promises as fs } from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import { promises } from "dns";

export default class Foam extends Command {
  static description =
    "Parses a given Foam repo and generates an array of notes with their corresponding metadata";

  static examples = [
    `$ ipmm hello
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    help: flags.help({ char: "h" }),

    ipmmRepo: flags.string({
      name: "ipmm_repo",
      char: "i",
      description:
        "path to IPMM repository. If not specified it defaults to thte config one",
      // default: getCurrentPath()
    }),
    foamRepo: flags.string({
      name: "foam_repo",
      char: "f",
      description:
        "path the FOAM repository. If not specified it defaults to thte config one",
      // default: getCurrentPath()
    }),
  };

  static args = [
    {
      name: "subcommand",
      required: true,
      description: "subcommand to execute: import, export, sync, watch",
      hidden: false,
    },
    /*{
      name: "repoPath",
      required: false,
      description: "path of the repo to import",
      hidden: false,
      default: process.cwd(),
    },*/
  ];

  async run() {
    const { args, flags } = this.parse(Foam);

    if (!args.subcommand) {
      this.error("No Foam command specified");
      // exit with status code
      this.exit(1);
    }
    let config = await this.loadConfig("");

    let ipmmRepo: string = flags.ipmmRepo ? flags.ipmmRepo : config.ipmmRepo;
    let foamRepo: string = flags.foamRepo ? flags.foamRepo : config.foamRepo;

    if (args.subcommand == "import") {
      this.foamImport(ipmmRepo, foamRepo);
    } else if (args.subcommand == "export") {
      this.foamExport(ipmmRepo, foamRepo);
    }
  }

  foamImport = async (ipmmRepo: String, foamRepo: string): Promise<void> => {
    await this.readPath(foamRepo);
  };

  foamExport = (ipmmRepo: String, foamRepo: string) => void {};

  readPath = async (directoryPath: string) => {
    let files = await fs.readdir(directoryPath);

    files = this.filterExtension(files, [".md"]);

    const progressBar = cli.progress({
      format: "{bar} {value}/{total} Notes",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    });

    progressBar.start(files.length, 0);

    let i: number = 0;

    for (let fileName of files) {
      i++;
      let filePath = path.join(directoryPath, fileName);
      let note = await this.makeNote(filePath);
      progressBar.update(i);
    }

    progressBar.stop();
  };

  filterExtension = (files: string[], extensions: string[]): string[] => {
    return files.filter(function (file) {
      for (let extension of extensions) {
        if (path.extname(file).toLowerCase() === extension) return true;
      }
      return false;
    });
  };

  makeNote = async (filePath: string): Promise<NoteType> => {
    let note: NoteType = {};
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (error) {
      console.log("Unable to read", filePath, error);
    }

    //gray-matter object
    try {
      let m = matter(data);

      note.content = m.content;

      for (let prop in m.data) {
        note[prop] = m.data[prop];
      }

      return note;
    } catch (e) {
      console.log("Error parsing YAML for note: ", filePath, e);
      return note;
    }
  };

  loadConfig = async (filePath: string): Promise<Config> => {
    let config = new Config("ipmmPath", "ipfoamPath");
    return config;
  };
}

interface NoteType {
  //typesafeProp1?: number,
  //requiredProp1: string,
  [key: string]: any;
}

class Config {
  ipmmRepo: string;
  foamRepo: string;

  constructor(ipmmrepo: string, foamRepo: string) {
    this.ipmmRepo = ipmmrepo;
    this.foamRepo = foamRepo;
  }
}
