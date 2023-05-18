import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { RetrievalQAChain, loadSummarizationChain } from "langchain/chains";
import { loadQAStuffChain, loadQAMapReduceChain } from "langchain/chains";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";
const util = require("util");

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

import { OpenAI } from "langchain/llms/openai";
import { prompt } from "cli-ux/lib/prompt";
import { strict } from "assert";

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

    const avgCharactersInDoc = 200;
    const openAITokenPerChar = 0.25;
    const openAIMaxTokens = 4000;
    const maxDocsToRetrieve = 40; //openAIMaxTokens / (avgCharactersInDoc * openAITokenPerChar);

    const iDontKnowTemplate = `Rephrase: "I don't know what you're talking about."`;
    const completitionChars = 1000;

    const rewriteTemplate = `
You are a technical writer
Rewrite text to explain "{mu}"
\n\nContext:\n###\n{context}\n###
Rewrite:`;

    const identifyTemplate = `Based on the following text, what concepts necessary to understand {mu}
    CONTEXT:\n###\n{context}
    Concepts:
    -`;

    let template = rewriteTemplate;

    const promptChars = template.length + args.question.length;
    // similarity search
    let outSearch = await vectorStore.similaritySearchWithScore(
      args.question,
      maxDocsToRetrieve
    );

    const strictScore = 0.15;
    const extendedContextScore = 0.17;
    const fullContextScore = 0.19;

    const minSearchScore = strict;

    function mapRange(
      value: number,
      fromMin: number,
      fromMax: number,
      toMin: number,
      toMax: number
    ): number {
      // Normalize the value within the source range
      const normalizedValue = (value - fromMin) / (fromMax - fromMin);
      // Map the normalized value to the target range
      const mappedValue = normalizedValue * (toMax - toMin) + toMin;

      return mappedValue;
    }

    const multipleOccurancePenalty = 0.8;

    function hasMultipleOccurances(
      text: string,
      searchString: string
    ): boolean {
      const regex = new RegExp(searchString, "g");
      const matches = text.match(regex);
      const occurrences = matches ? matches.length : 0;
      if (occurrences > 1) return true;
    }

    const maxLengthPenalty = 0.9; //applies on top of the multipe occurances penalty

    function getLengthPenalty(corpus: string): number {
      const maxLength = 200; // Maximum length considered for scoring
      const length = Math.min(corpus.length, maxLength); // Limit the length to maxLength
      const score1 = 1 - Math.exp(-length / maxLength);
      const score = mapRange(score1, 0, 1 - Math.exp(-1), maxLengthPenalty, 1);
      return score;
    }

    function getSemanticSearchCompensationPenalty(
      corpus: string,
      searchString: string
    ): number {
      //semantic search gives a similiratity score too high when:
      //The search word appears multiple times
      //The text is short
      let penalty = 1;
      if (hasMultipleOccurances(corpus, searchString))
        penalty = maxLengthPenalty * getLengthPenalty(searchString);
      return penalty;
    }

    //Add confidence score and normalized similiratiy score
    outSearch = outSearch.map((obj) => {
      let normalizedSimiliratityScore = mapRange(obj[1], 0.1, 0.2, 1, 0);
      let similartySearchCompensation = getSemanticSearchCompensationPenalty(
        obj[0].pageContent,
        args.question
      );
      let confidenceScore =
        normalizedSimiliratityScore *
        obj[0].metadata.pir *
        similartySearchCompensation;
      obj[0].metadata.similarity = normalizedSimiliratityScore;
      obj[0].metadata.similartySearchCompensation = obj[0].metadata.confidence =
        confidenceScore;
      return obj;
    });

    //filter by relevance
    function searchScoreFilter(
      res: [Document<Record<string, any>>, number]
    ): boolean {
      if (res[1] < strictScore) return true;
      return false;
    }

    const outScoreFitlered = outSearch.filter(searchScoreFilter);
    console.log(
      "Max. docs:" +
        maxDocsToRetrieve +
        " Filter score:" +
        minSearchScore +
        "Found docs:" +
        outScoreFitlered.length
    );

    //map into a simpler object without similarity score
    const outSimpler = outScoreFitlered.map((obj) => {
      return obj[0];
    });

    //sort by confidence

    outSimpler.sort(
      (docA, docB) => docB.metadata.confidence - docA.metadata.confidence
    );

    console.dir(outSimpler, { depth: null });

    // filter by metadata

    function confidenceFilter(doc: Document<Record<string, any>>): boolean {
      if (doc.metadata.confidence > 0.45) return true;
      return false;
    }

    const outMetadataFiltered = outSimpler.filter(confidenceFilter);

    //filter by tokens usage
    let accumulatedChars = promptChars;

    const outTokenFiltered = outMetadataFiltered;

    for (let i = 0; i < outMetadataFiltered.length; i++) {
      accumulatedChars += outMetadataFiltered[i].pageContent.length;
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

    let finalTemplate = template;

    if (context.length <= 200) {
      finalTemplate = iDontKnowTemplate;
    }

    const promptTemplate = new PromptTemplate({
      template: finalTemplate,
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
      temperature: 0,
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
