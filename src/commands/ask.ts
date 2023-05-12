import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { RetrievalQAChain, loadSummarizationChain } from "langchain/chains";
import { loadQAStuffChain, loadQAMapReduceChain } from "langchain/chains";
import { LLMChain } from "langchain/chains";

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

import { OpenAI } from "langchain/llms/openai";

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

    const results = await vectorStore.similaritySearch(args.question, 100);
    //console.log(results);

    let context = "";
    results.forEach((r) => {
      context = context + r.pageContent + "\n\n";
    });

    const template = `Below, there are two sections: 'Rules' and 'Context'. Rules are a list of guidelines you will use to respond. 'Context' is all the data that you will base your respond on.
      Rules:
      - My name is {myName}, you will impersonate me.
      - Write an article based on my understanding of {mu} based on the context below.
      - If the context does not give enough details, kindly say that I haven't thought that much about {mu}
      - Do not leave out important details.
      - Be clear and concise.
      - Use examples and analogies if possible.
      - Format the text nicely.
      - Replace words that sound strange to more commonly used synonyms.
       \n\nContext:\n{context}"`;

    const promptTemplate = new PromptTemplate({
      template,
      inputVariables: ["mu", "context"],
    });

    // We can use the `format` method to format the template with the given input values.
    /* const prompt = await promptTemplate.format({
      mu: args.question,
      context: context,
    });*/

    const model = new OpenAI({
      modelName: "text-davinci-003",
      temperature: 0,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
    });

    const chain = new LLMChain({ llm: model, prompt: promptTemplate });
    const res = await chain.call({
      mu: args.question,
      context: context,
      myName: ConfigController._configFile.share.myName,
    });
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
