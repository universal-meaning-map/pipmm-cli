import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import Finder from "../lib/semanticSearch";

interface LlmRequest {
  nameId: string; //identifier of the request template
  temperature: number; //model temperature
  template: string; //langchain prompt template
  minCompletitionChars: number; //minimum chars saved for response
  minSimilarityScore: number; //0-1, usually between 0.15 and 0.2
  minConfidenceScore: number; //0-1, confidence filter
}

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

    const vectorStore = await HNSWLib.load(
      ConfigController._configFile.llm.vectorStorePath,
      embeddingsObject
    );

    const openAITokenPerChar = 0.25;
    const openAIMaxTokens = 4000;
    const maxDocsToRetrieve = 20; //openAIMaxTokens / (avgCharactersInDoc * openAITokenPerChar);
    const completitionChars = 1000;

    const rewriteRequest: LlmRequest = {
      nameId: "rewrite",
      temperature: 0,
      minCompletitionChars: 1000, //minimum chars saved for response
      minSimilarityScore: 0,
      minConfidenceScore: 0.5,
      template: `
      You are a technical writer
      Rewrite text to explain "{mu}"
      \n\nContext:\n###\n{context}\n###
      Rewrite:`,
    };

    const identifyRequest: LlmRequest = {
      nameId: "identify",
      temperature: 0,
      minCompletitionChars: 500, //minimum chars saved for response
      minSimilarityScore: 0.17,
      minConfidenceScore: 0.5,
      template: `What concepts in the text are uncommon and fundamental to understand {mu}
      CONTEXT:\n###\n{context}
      Concepts:
      -`,
    };

    const dontKnowRequest: LlmRequest = {
      nameId: "dontKnow",
      temperature: 0.7,
      minCompletitionChars: 250, //minimum chars saved for response
      minSimilarityScore: 0,
      minConfidenceScore: 0,
      template: `Rephrase: "I don't know what you're talking about."`,
    };

    let request = rewriteRequest;

    const results = await Finder.semantic(args.question);

    console.dir(results, { depth: null });

    // filter by metadata

    function confidenceFilter(doc: Document<Record<string, any>>): boolean {
      if (doc.metadata.confidence > request.minConfidenceScore) return true;
      return false;
    }

    const resultsFiltered = results.filter(confidenceFilter);
    console.log(resultsFiltered.length);

    //filter by tokens usage
    const promptChars = request.template.length + args.question.length;
    let accumulatedChars = promptChars;

    const outTokenFiltered = resultsFiltered;

    for (let i = 0; i < resultsFiltered.length; i++) {
      accumulatedChars += resultsFiltered[i].pageContent.length;
      if (
        accumulatedChars * openAITokenPerChar >
        openAIMaxTokens - completitionChars * openAITokenPerChar
      ) {
        outTokenFiltered.splice(i);
        break;
      }
    }

    console.log("Keeping " + outTokenFiltered.length + " results");
    console.log(
      "Aproximate promp tokens: " + accumulatedChars * openAITokenPerChar
    );
    console.log(
      "Aproximate completition tokens left: " +
        (openAIMaxTokens - accumulatedChars * openAITokenPerChar)
    );
    console.log(
      "Average text length: " +
        (accumulatedChars - promptChars) / outTokenFiltered.length
    );

    //console.log(outMetadataFiltered);

    // TODO filter repeated content
    // These are not because of trans-sub-abstraction-block but direct prop-view transclusions

    // Build context

    let context = "";
    outTokenFiltered.forEach((r) => {
      context = context + r.pageContent + "\n";
    });

    if (context.length <= 200) {
      request = dontKnowRequest;
    }

    const promptTemplate = new PromptTemplate({
      template: request.template,
      inputVariables: ["mu", "context", "myName"],
    });

    const promptInput = {
      mu: args.question,
      context: context,
      myName: ConfigController._configFile.share.myName,
    };

    const prompt = await promptTemplate.format(promptInput);

    console.dir(prompt, { depth: null });

    const model = new OpenAI({
      temperature: request.temperature,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topP: 1,
      maxTokens: -1,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
    });

    /*
    const tokens = await model.generate([prompt]);
    console.log(tokens);
*/

    const chain = new LLMChain({ llm: model, prompt: promptTemplate });

    const res = await chain.call(promptInput);
    console.log(res);

    /*
    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    const res = await chain.call({
      input_documents: vectorStore.asRetriever(),
      question: args.question,
    });
    */
  }
}
