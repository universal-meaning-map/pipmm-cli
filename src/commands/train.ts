import { Command, flags } from "@oclif/command";
import ConfigController, {
  ExportTemplate,
  PublishExportRun,
} from "../lib/configController";
import Referencer from "../lib/referencer";
import Compiler from "../lib/compiler";
import Utils from "../lib/utils";
import Filter from "../lib/filterController";
import Publisher from "../lib/publisher";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { NoteWrap } from "../lib/ipmm";
import Tokenizer from "../lib/tokenizer";
import SemanticSearch from "../lib/semanticSearch";
import { boolean } from "@oclif/command/lib/flags";

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

    indexWithHyphen: flags.boolean({
      name: "indexHypen",
      char: "h",
      description:
        "Indexes view and  names on their own vector DB. Multi word names are joined with `-`",
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
    let repo = Referencer.iidToNoteWrap;

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

    let namesWithHyphen = true;
    await SemanticSearch.index(
      filteredRepo,
      Referencer.PROP_VIEW_FOAMID,
      flags.indexWithHyphen
    );
    await SemanticSearch.index(
      filteredRepo,
      Referencer.PROP_NAME_FOAMID,
      flags.indexWithHyphen
    );
  }
}
