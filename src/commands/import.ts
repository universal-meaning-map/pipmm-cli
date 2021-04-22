import { Command, flags } from "@oclif/command";

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
    path: flags.string({
      char: "p",
      description: "path of the repo to import",
      //default: getCurrentPath()
    }),
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

    /*const name = flags.name ?? "world";
    this.log(`hello ${name} from ./src/commands/hello.ts`);
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`);
    }
    */
  }
}
