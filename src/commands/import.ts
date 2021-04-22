import { Command, flags } from "@oclif/command";
import * as fs from "fs";
import * as path from "path";
import * as matter from "gray-matter";

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
    fs.readdir(directoryPath, (err, files) => {
      //handling error
      if (err) {
        return console.log("Unable to scan directory: " + err);
      }
      //get the directories in case we want it to import recusively
      let directories = this.getDirectories(directoryPath);

      //filter files by extension

      files = this.filterExtension(files, [".md"]);

      files.forEach( (fileName)=> {
        let filePath = path.join(directoryPath, fileName);
        fs.readFile(filePath, "utf8", (err, data) => {
          if (err) {
            console.error(err);
            return;
          }

          this.parseFrontMatter(data)
          //console.log(data);
          return
        });
      });
    });
  };

  filterExtension = (files: string[], extensions: string[]): string[] => {
    return files.filter(function (file) {
      for (let extension of extensions) {
        if (path.extname(file).toLowerCase() === extension) return true;
      }
      return false;
    });
  };

  getDirectories = (directoryPath: string): string[] => {
    return fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  };

  parseFrontMatter = (data: string): any => {
    console.log(matter(data));
  };
}
