import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { RetrievalQAChain, loadSummarizationChain } from "langchain/chains";
import { loadQAStuffChain, loadQAMapReduceChain } from "langchain/chains";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

import { OpenAI } from "langchain/llms/openai";
import { prompt } from "cli-ux/lib/prompt";

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
      description: "What do you want to ask xabot?",
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

    const maxCharactersInDoc =
      ConfigController._configFile.llm.chunkSize +
      ConfigController._configFile.llm.chunkOverlap * 2;
    const openAITokenPerCharacter = 0.25;
    const openAIMaxTokens = 4000;
    const maxDocsToRetrieve =
      openAIMaxTokens / (maxCharactersInDoc * openAITokenPerCharacter);

    // similarity search
    const outSearch = await vectorStore.similaritySearchWithScore(
      args.question,
      maxDocsToRetrieve
    );

    //filter by relevance
    function searchScoreFilter(
      res: [Document<Record<string, any>>, number]
    ): boolean {
      if (res[1] < 0.17) return true;
      return false;
    }

    const outScoreFitlered = outSearch.filter(searchScoreFilter);

    //map into a simpler object without similarity score
    const outSimpler = outScoreFitlered.map((obj) => {
      return obj[0];
    });

    // filter by metadata

    function pirFilter(doc: Document<Record<string, any>>): boolean {
      if (doc.metadata.pir > 0.6) return true;
      return false;
    }

    const outMetadataFiltered = outSimpler.filter(pirFilter);

    console.log(outMetadataFiltered);

    // TODO filter repeated content
    // These are not because of trans-sub-abstraction-block but direct prop-view transclusions

    // Build context

    let context = "";
    outMetadataFiltered.forEach((r) => {
      context = context + r.pageContent + "\n\n";
    });

    const template = `Below, there are two sections: 'RULES' and 'CONTEXT'. RULES are a list of guidelines you will use to respond. CONTEXT is all the data that you will base your respond on.
    RULES:
    - CONTEX represents my understanding of {mu}.
    - Rewrite CONTEXT as an article about {mu}.
    \n\nCONTEXT:\n{context}"`;

    const promptTemplate = new PromptTemplate({
      template,
      inputVariables: ["mu", "context", "myName"],
    });

    const promptInput = {
      mu: args.question,
      context: context,
      myName: ConfigController._configFile.share.myName,
    };

    const prompt = await promptTemplate.format(promptInput);

    console.log(prompt);
    return;

    const model = new OpenAI({
      temperature: 0,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
    });
    const tokens = await model.generate([prompt]);
    console.log(tokens);

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
