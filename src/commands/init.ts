import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import { promises as fs } from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";

export default class Init extends Command {
  static description =
    "Opens latest repo and starts listening for commands";

  static examples = [
    `$ ipmm hello
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    help: flags.help({ char: "h" }),
    /*
    recursive: flags.boolean({
      char: "r",
      description: "Init files recursively",
      default: false,
      //default: getCurrentPath()
    }),*/
  };

  static args = [
    {
      name: "repoPath",
      required: false,
      description: "path of the repo to Init",
      hidden: false,
      default: process.cwd(),
    },
  ];

  async run() {
    const { args, flags } = this.parse(Init);

    this.readPath(args.repoPath);

    /*const name = flags.name ?? "world";
    this.log(`hello ${name} from ./src/commands/hello.ts`);
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`);
    }
    */
  }

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
}

interface NoteType {
  //typesafeProp1?: number,
  //requiredProp1: string,
  [key: string]: any;
}
