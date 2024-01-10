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
      name: "keyConcepts",
      required: true,
      description:
        "Comma separated list of meaning unit names. Its definitions will be included in the context. ",
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

    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );

    let givenConcepts: string[] = args.keyConcepts.split(", ");

    await DefinerStore.load();

    console.log("B");
    //Fetch scores
    const processScores = givenConcepts.map(async (c: string) => {
      const d = await DefinerStore.getDefinition(c, false, false, true, false);

      if (!d) {
        console.log("E");
        console.log(c + "Doesn't exist. Removing it from the list");
        givenConcepts = givenConcepts.filter((item) => item !== c);
      }
    });

    const all = await Promise.all(processScores);
    console.log("C");
    //
    for (let column of givenConcepts) {
      let cd = DefinerStore.definitions.get(column);
      if (!cd) {
        console.log(column + " doesn't exist");
        continue;
      }
      for (let row of givenConcepts) {
        let rd = DefinerStore.definitions.get(row);

        if (!rd) {
          continue;
        }

        let crs = 0;
        let cr = cd.keyConceptsScores.find((c) => c.c === row);
        if (cr) crs = cr.s;

        let rcs = 0;
        let rc = rd.keyConceptsScores.find((c) => c.c === column);
        if (rc) rcs = rc.s;

        if (crs == 0 || rcs == 0) {
          // continue;
        }

        console.log(column, row, crs, rcs, crs - rcs);
      }
    }
    DefinerStore.save();
  }
}
