import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { SubSection } from "../lib/composer";

export default class WriteCommand extends Command {
  static description = "Uses LLMs to write about a topic in a specific format";

  static flags = {
    help: flags.help({ char: "h" }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  static args = [
    {
      name: "uri",
      required: true,
      description: "URI to the drafter document",
      hidden: false,
    },
  ];

  async run() {
    console.warn = () => {};

    const { args, flags } = this.parse(WriteCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );

    await DefinerStore.load();

    let originalDrafter = Composer.loadDrafter(args.uri);
    let newsections = await Composer.writeSubSections(
      originalDrafter,
      originalDrafter.subSections[0],
      [0]
    );

    originalDrafter.subSections = [newsections];

    await DefinerStore.save();
    const json = JSON.stringify(originalDrafter, null, 2);
    Utils.saveFile(json, args.uri);
  }
}
