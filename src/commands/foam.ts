import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import { promises as fs } from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";
import { promises } from "dns";
import ConfigController from "../lib/configController"


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
        "Path to IPMM repository. If not specified it defaults to the config one",
      // default: getCurrentPath()
    }),
    foamRepo: flags.string({
      name: "foam_repo",
      char: "f",
      description:
        "Path the FOAM repository. If not specified it defaults to the config one",
      // default: getCurrentPath()
    }),
  };

  static args = [
    {
      name: "subcommand",
      required: true,
      description: "what to execute: import, export, sync, watch",
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

  processErrors: ProcessError[] = [];

  async run() {
    const { args, flags } = this.parse(Foam);

    if (!args.subcommand) {
      this.error("No Foam command specified");
      // exit with status code
      this.exit(1);
    }
    let config =  ConfigController.config;

    let ipmmRepo: string = flags.ipmmRepo ? flags.ipmmRepo : config.ipmmRepo;
    let foamRepo: string = flags.foamRepo ? flags.foamRepo : config.foamRepo;

    if (args.subcommand == "import") {
      await this.foamImport(ipmmRepo, foamRepo);
    } else if (args.subcommand == "export") {
      await this.foamExport(ipmmRepo, foamRepo);
    }
    this.logProcessErrors()
  }

  foamImport = async (ipmmRepo: String, foamRepo: string): Promise<void> => {
    let files = await fs.readdir(foamRepo);

    files = this.filterExtension(files, [".md"]);

    this.log(
      "Importing FOAM repository from ",
      path.resolve(process.cwd(), foamRepo),
      "..."
    );

    let i: number = 0;

    const progressBar = cli.progress({
      format: "{file}, {bar} {value}/{total} Notes",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    });
    progressBar.start(files.length, 0);

    for (let fileName of files) {
      progressBar.update({ file: fileName });
      i++;
      let filePath = path.join(foamRepo, fileName);
      let note = await this.makeNote(filePath);
    }
    progressBar.stop();
  };

  foamExport = (ipmmRepo: String, foamRepo: string) => void {};

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
    } catch (e) {
      this.recordProcessError(new ProcessError(filePath, "reading file", e));
      //this.error("Unable to read" + filePath + e);
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
      this.recordProcessError(
        new ProcessError(filePath, "parsing Front Matter", e)
      );
      //this.error("Error parsing YAML for note: " + filePath + e);
      return note;
    }
  };

  recordProcessError = (noteError: ProcessError): void => {
    this.processErrors.push(noteError);
  };

  logProcessErrors = (): void => {
    for (let e of this.processErrors)
      this.log("Error " + e.processName + " for " + e.notePath);
  };
}

interface NoteType {
  [key: string]: any;
}

class ProcessError {
  constructor(
    public notePath: string,
    public processName: string,
    public error: string
  ) {}
}



/*
const progressBar = cli.progress({
      format: "{bar} {value}/{total} Notes",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    });

    progressBar.start(files.length, 0);
    progressBar.update(i);
    progressBar.stop();
*/
