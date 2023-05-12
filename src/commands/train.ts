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
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

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

    // Export with transclusion from pipmm compilation
    const PIR_IID = await Referencer.makeIid(Referencer.PROP_PIR_FOAMID);
    const NAME_IID = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);

    console.log("Transcluding...");
    const docs = [];
    for (let [iid, note] of filteredRepo.entries()) {
      // console.log(iid);
      let config = {
        // property: "xavi-YAxr3c/prop-name-1612697362",
        property: "xavi-YAxr3c/prop-view-1612698885",
        exportTemplateId: "txt",
      };

      let out = await Publisher.makePublishRun(iid, config);

      const doc = new Document({
        pageContent: out,
        metadata: {
          iid: iid,
          name: note.block.get(NAME_IID),
          pir: note.block.get(PIR_IID),
          time: Date.now(),
        },
      });
      docs.push(doc);
    }

    console.log("Splitting text...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 400,
      chunkOverlap: 0,
      separators: ["\n\n", "\n", " ", ""],
    });

    const texts = [];
    const metadatas = [];

    for (const doc of docs) {
      const docTexts = await textSplitter.splitText(doc.pageContent);
      for (const text of docTexts) {
        texts.push(text);
        metadatas.push(doc.metadata);
      }
    }

    console.log("Generating embeddings...");
    const embeddingsObject = new OpenAIEmbeddings({
      verbose: true,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
    });

    const vectorStore = await HNSWLib.fromTexts(
      texts,
      metadatas,
      embeddingsObject
    );

    console.log(
      "Storing embeddings into " +
        ConfigController._configFile.llm.vectorStorePath
    );
    // Save the vector store to a directory
    await vectorStore.save(ConfigController._configFile.llm.vectorStorePath);

    console.log("Success!");
  }
}
