import ConfigController from "./configController";
import Utils from "./utils";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";
import { LLM } from "langchain/dist/llms/base";
import { SEARCH_ORIGIN_SEMANTIC, callLlm, getConfidenceScore } from "./llm";
import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import Tokenizer from "./tokenizer";
import Publisher from "./publisher";
import { CharacterTextSplitter } from "langchain/text_splitter";

export default class SemanticSearch {
  static search = async (
    searchText: string,
    indexedFoamProperty: string,
    namesWithHyphen: boolean,
    maxDocsToRetrieve: number = 50
  ): Promise<Document<Record<string, any>>[]> => {
    const embeddingsObject = new OpenAIEmbeddings({
      verbose: true,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey, // why is this required
    });

    const dbPath = SemanticSearch.getVectorStorePath(
      indexedFoamProperty,
      namesWithHyphen
    );
    const vectorStore = await HNSWLib.load(dbPath, embeddingsObject);

    // similarity search
    let outSearch = await vectorStore.similaritySearchWithScore(
      searchText,
      maxDocsToRetrieve
    );

    //Semantic similiartiy normalization
    /*Compensate semantic search with OpenAI embeddings gives a higher score than desired if
    The search word appears multiple times
    he text is short
    */
    const multipleOccurancePenalty = 0.85;
    const minLengthPenalty = 0.75; //applies on top of the multipe occurances penalty

    function getShortLengthPenalty(corpus: string): number {
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

    function getSemantcSearchCompensationPenalty(
      corpus: string,
      searchString: string
    ): number {
      let penalty = 1;
      if (Utils.hasMultipleOccurances(corpus, searchString))
        penalty =
          multipleOccurancePenalty * getShortLengthPenalty(searchString);
      return penalty;
    }

    //Calculate confidence score
    //Add confidence score and normalized similiratiy score to metadata
    const maxSearchScore = 0.14; // below that will be 1 when normaliezd
    const acceptableSearchScore = 0.19; //0.5 when normalized
    const minSearchScore = acceptableSearchScore * 2 - maxSearchScore; //above that will be zero wehn normalized

    outSearch = outSearch.map((obj) => {
      const cappedSearchSimiliarityScore = Math.max(
        Math.min(obj[1], minSearchScore),
        maxSearchScore
      );

      const inverseSearchScore = Utils.mapRange(
        cappedSearchSimiliarityScore,
        maxSearchScore,
        minSearchScore,
        1,
        0
      );

      const compensation = getSemantcSearchCompensationPenalty(
        obj[0].pageContent,
        searchText
      );
      const similarityScore = inverseSearchScore * compensation;

      /*
      obj[0].metadata.originalScore = obj[1];
      obj[0].metadata.capped = cappedSearchSimiliarityScore;
      obj[0].metadata.inverseScore = inverseSearchScore;
      obj[0].metadata.occurrance = Utils.hasMultipleOccurances(
        obj[0].pageContent,
        searchText
      );
      obj[0].metadata.lengthy = getLengthPenalty(obj[0].pageContent);
      obj[0].metadata.compensation = compensation;
     */
      obj[0].metadata.similarity = similarityScore;
      obj[0].metadata.searchOrigin = SEARCH_ORIGIN_SEMANTIC;
      obj[0].metadata.confidence = getConfidenceScore(
        similarityScore,
        obj[0].metadata.pir
      );
      return obj;
    });

    //map into a simpler object without original similarity score
    const outSimpler = outSearch.map((obj) => {
      return obj[0];
    });

    //sort by confidence

    outSimpler.sort(
      (docA, docB) => docB.metadata.confidence - docA.metadata.confidence
    );

    return outSimpler;
  };

  static getVectorStorePath(
    foamIdIndexed: string,
    namesWithHyphen: boolean
  ): string {
    let dbName =
      foamIdIndexed + (namesWithHyphen ? "-withHyphen" : "-withSpace");
    const dbLocation =
      ConfigController._configFile.llm.vectorStorePath + "/" + dbName;
    return dbLocation;
  }

  static index = async (
    repo: Map<string, NoteWrap>,
    propFileName: string,
    namesWithHyphen: boolean
  ) => {
    console.log("Renaming...");

    const PIR_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_PIR_FILENAME
    );
    const NAME_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_NAME_FILENAME
    );

    if (namesWithHyphen) {
      repo = await Referencer.getRepoWithHyphenNames();
    }

    // Transclude

    console.log("Transcluding...");
    const docs = [];
    for (let [iid, note] of repo.entries()) {
      // console.log(iid);
      let config = {
        property: propFileName,
        exportTemplateId: "txt",
      };

      let out = await Publisher.makePublishRun(iid, config, namesWithHyphen);

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
    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1, //ConfigController._configFile.llm.chunkSize,
      chunkOverlap: 0, // ConfigController._configFile.llm.chunkOverlap,
      separator: Referencer.selfDescribingSemanticUntiSeparator,
    });

    const texts = [];
    const metadatas = [];

    for (const doc of docs) {
      //      console.log("Splitting " + doc.metadata.iid + " " + doc.metadata.name);
      console.log(doc.metadata.name);
      const docTexts = await textSplitter.splitText(doc.pageContent);
      for (const text of docTexts) {
        texts.push(text);
        metadatas.push(doc.metadata);
      }
    }

    console.log("Generating embeddings for " + propFileName);
    const embeddingsObject = new OpenAIEmbeddings({
      verbose: true,
      openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
    });

    const vectorStore = await HNSWLib.fromTexts(
      texts,
      metadatas,
      embeddingsObject
    );

    // Save the vector store to a directory

    const dbPath = SemanticSearch.getVectorStorePath(
      propFileName,
      namesWithHyphen
    );
    await vectorStore.save(dbPath);

    console.log("Embddings stored at:");
    console.log(dbPath);
  };
}
