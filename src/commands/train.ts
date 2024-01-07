import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Referencer from "../lib/referencer";
import Compiler from "../lib/compiler";
import Utils from "../lib/utils";
import Filter from "../lib/filterController";
import SemanticSearch from "../lib/semanticSearch";
import Tokenizer from "../lib/tokenizer";

export default class TrainCommand extends Command {
  static description =
    "Iterates over git history and creates word embeddings for every meaning unit";

  static flags = {
    help: flags.help({ char: "h" }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),

    indexWithoutHyphen: flags.boolean({
      name: "noHyphen",
      char: "N",
      description:
        "Indexes view and  names on their own vector DB. Multi word names are joined with " +
        Tokenizer.hyphenToken,
    }),
  };

  async run() {
    const { args, flags } = this.parse(TrainCommand);

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

    //await Utils.saveIpmmRepo();

    let repo = Referencer.iidToNoteWrap;
    console.log(repo.size);

    //Filter
    let jsonFilter = Utils.getFile(ConfigController.botFilterPath);
    let filter = JSON.parse(jsonFilter);
    console.log("Applying filter:\n" + ConfigController.botFilterPath);

    let filteredRepo = await Filter.filter(repo, filter);
    console.log("Total abstractions: " + repo.size);
    console.log("Filtered abstractions: " + filteredRepo.size);
    console.log(
      "Percentage " +
        Math.round(((filteredRepo.size * 100) / repo.size) * 100) / 100 +
        "%"
    );
    // Name transform

    await SemanticSearch.index(
      filteredRepo,
      Referencer.PROP_VIEW_FILENAME,
      !flags.indexWithoutHyphen
    );
    /*await SemanticSearch.index(
      filteredRepo,
      Referencer.PROP_NAME_FOAMID,
      flags.indexWithHyphen
    );*/
  }
}
