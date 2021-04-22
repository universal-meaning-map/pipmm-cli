import { Command, flags } from "@oclif/command";
import { promises as fs } from "fs";
import * as path from "path";
import * as matter from "gray-matter";
import { Console } from "console";

export default class Import extends Command {
  static description =
    "Parses a given Foam repo and generates an array of notes with their corresponding metadata";

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
      description: "import files recursively",
      default: false,
      //default: getCurrentPath()
    }),*/
  };

  static args = [
    {
      name: "repoPath",
      required: false,
      description: "path of the repo to import",
      hidden: false,
      default: process.cwd(),
    },
  ];

  async run() {
    const { args, flags } = this.parse(Import);
    console.log(args, flags);

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

    for (let fileName of files) {
      let filePath = path.join(directoryPath, fileName);
      let note = await this.makeNote(filePath);
    }
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
