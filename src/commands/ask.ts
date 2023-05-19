import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";

interface llmRequest {
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
    const maxDocsToRetrieve = 40; //openAIMaxTokens / (avgCharactersInDoc * openAITokenPerChar);
    const completitionChars = 1000;

    const rewriteRequest: llmRequest = {
      nameId: "rewrite",
      temperature: 0,
      minCompletitionChars: 1000, //minimum chars saved for response
      minSimilarityScore: 0.17,
      minConfidenceScore: 0.5,
      template: `
      You are a technical writer
      Rewrite text to explain "{mu}"
      \n\nContext:\n###\n{context}\n###
      Rewrite:`,
    };

    const identifyRequest: llmRequest = {
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

    const dontKnowRequest: llmRequest = {
      nameId: "dontKnow",
      temperature: 0.7,
      minCompletitionChars: 250, //minimum chars saved for response
      minSimilarityScore: 0,
      minConfidenceScore: 0,
      template: `Rephrase: "I don't know what you're talking about."`,
    };

    let request = rewriteRequest;

    // similarity search
    let outSearch = await vectorStore.similaritySearchWithScore(
      args.question,
      maxDocsToRetrieve
    );

    //Semantic similiartiy normalization
    /*
    Compensate semantic search with OpenAI embeddings gives a higher score than desired if
      //The search word appears multiple times
      //The text is short
      */
    const multipleOccurancePenalty = 0.8;
    const minLengthPenalty = 0.9; //applies on top of the multipe occurances penalty

    function getLengthPenalty(corpus: string): number {
      const maxLength = 200; // Maximum length considered for scoring
      const length = Math.min(corpus.length, maxLength); // Limit the length to maxLength
      const logScore = 1 - Math.exp(-length / maxLength); // it has a logarithmic score. It accelerates the shorter the text is
      const score = Utils.mapRange(
        logScore,
        0,
        1 - Math.exp(-1),
        minLengthPenalty,
        1
      ); //Normalized  to 0-1
      return score;
    }

    function getSemantcSearchCompensation(
      corpus: string,
      searchString: string
    ): number {
      let penalty = 1;
      if (Utils.hasMultipleOccurances(corpus, searchString))
        penalty = multipleOccurancePenalty * getLengthPenalty(searchString);
      return penalty;
    }

    function getConfidenceScore(similarityScore: number, pir: number) {
      return similarityScore * pir;
    }

    //Calculate confidence score
    //Add confidence score and normalized similiratiy score to metadata
    outSearch = outSearch.map((obj) => {
      const similarityScore = obj[1];
      const compensation = getSemantcSearchCompensation(
        obj[0].pageContent,
        args.question
      );
      const similarityCompensatedScore = similarityScore * compensation;

      let normalizedSimiliratityScore = Utils.mapRange(
        similarityCompensatedScore,
        0.1,
        0.2,
        1,
        0
      );

      obj[0].metadata.originalScore = similarityScore;
      obj[0].metadata.lengthy = getLengthPenalty(obj[0].pageContent);
      obj[0].metadata.occurrance = Utils.hasMultipleOccurances(
        obj[0].pageContent,
        args.question
      );
      obj[0].metadata.compensation = compensation;

      obj[0].metadata.similarity = normalizedSimiliratityScore;
      obj[0].metadata.confidenceScore = getConfidenceScore(
        normalizedSimiliratityScore,
        obj[0].metadata.pir
      );
      return obj;
    });

    //filter by relevance
    function searchScoreFilter(
      res: [Document<Record<string, any>>, number]
    ): boolean {
      if (res[1] < request.minSimilarityScore) return true;
      return false;
    }

    const outScoreFitlered = outSearch.filter(searchScoreFilter);

    //map into a simpler object without similarity score
    const outSimpler = outScoreFitlered.map((obj) => {
      return obj[0];
    });

    //sort by confidence

    outSimpler.sort(
      (docA, docB) => docB.metadata.confidence - docA.metadata.confidence
    );

    console.dir(outSimpler, { depth: null });
    console.log(
      "Max. docs:" +
        maxDocsToRetrieve +
        " Confidence score:" +
        request.minConfidenceScore +
        "Found docs:" +
        outScoreFitlered.length
    );

    // filter by metadata

    function confidenceFilter(doc: Document<Record<string, any>>): boolean {
      if (doc.metadata.confidence > request.minConfidenceScore) return true;
      return false;
    }

    const outMetadataFiltered = outSimpler.filter(confidenceFilter);

    //filter by tokens usage
    const promptChars = request.template.length + args.question.length;
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
