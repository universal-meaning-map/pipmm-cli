import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { SubSection } from "../lib/composer";
import AnswerCommand from "./answer";

export default class PrioritizeCommand extends Command {
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

    const { args, flags } = this.parse(PrioritizeCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    await DefinerStore.load();
    for (let [column, columnValue] of DefinerStore.definitions) {
      for (let [row, rowValue] of DefinerStore.definitions) {
        let crs = 0;
        let cr = columnValue.keyConceptsScores.find((c) => c.c === row);
        if (cr) crs = cr.s;

        let rcs = 0;
        let rc = rowValue.keyConceptsScores.find((c) => c.c === column);
        if (rc) rcs = rc.s;

        if (crs == 0 || rcs || 0) {
          continue;
        }

        console.log(column, row, crs, rcs, crs - rcs);
      }
    }
    DefinerStore;
  }
}
