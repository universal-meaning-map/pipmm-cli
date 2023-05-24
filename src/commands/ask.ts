import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import SemanticSearch from "../lib/semanticSearch";
import DirectSearch from "../lib/directSearch";
import Compiler from "../lib/compiler";
import {
  LlmRequest,
  QuestionCat,
  SearchRequest,
  callLlm,
  dontKnowRequest,
  prepareContext,
  questionRequest,
  rewriteRequest,
  semanticSearch,
} from "../lib/llm";

export default class AskCommand extends Command {
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

  static args = [
    {
      name: "question",
      required: true,
      description: "What to ask to the author of the repo",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(AskCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    const embeddingsObject = new OpenAIEmbeddings({
      verbose: true,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
    });

    let llmRequest = questionRequest;
    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );

    let mu = args.question;

    const questionRes = await callLlm(questionRequest, args.question, "");
    console.log(questionRes);

    const question: QuestionCat = Utils.yamlToJsObject(String(questionRes));

    llmRequest = rewriteRequest;
    const assumedId = await DirectSearch.assumeIid(mu);

    let results: Document<Record<string, any>>[] = [];
    if (assumedId) {
      results = await DirectSearch.getBacklinkDocs(assumedId);
    } else {
      results = await SemanticSearch.search(mu);
    }

    console.dir(results, { depth: null });
    if (assumedId) console.log(" Doing reverse direct search");
    else console.log("Doing semantic serach");

    function confidenceFilter(doc: Document<Record<string, any>>): boolean {
      if (doc.metadata.confidence > semanticSearch.minConfidenceScore)
        return true;
      return false;
    }

    const resultsFiltered = results.filter(confidenceFilter);
    console.log(resultsFiltered);

    const context = await prepareContext(resultsFiltered, llmRequest, mu);

    if (context.length <= 200) {
      llmRequest = dontKnowRequest;
    }

    return callLlm(llmRequest, mu, context);
  }
}
