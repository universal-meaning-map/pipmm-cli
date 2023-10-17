import { Document } from "langchain/document";
import DirectSearch from "./directSearch";
import {
  LlmRequest,
  SEARCH_ORIGIN_BACKLINK,
  SEARCH_ORIGIN_DIRECT,
  SEARCH_ORIGIN_SEMANTIC,
  buildContextPromptFromDocs,
  callLlm,
  filterDocsByConfindence,
  getContextDocsForConcept,
  openAIMaxTokens,
  openAITokenPerChar,
} from "./llm";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";
import Utils from "./utils";

export default class Definer {
  static getLiteralIntensionsByIid = async (
    nameWithoutHyphen: string,
    withHyphen: boolean
  ): Promise<string[]> => {
    const iid = await DirectSearch.getIidByName(nameWithoutHyphen);

    const contextDocs = await DirectSearch.getAllDocsOfIid(iid, withHyphen);

    if (contextDocs.length == 0) {
      console.log("🔴 " + nameWithoutHyphen + " not found");
      return [];
    }

    if (contextDocs.length == 1) {
      console.log("🟡 " + nameWithoutHyphen + " exists but not is defined");
      return [];
    }

    console.log("🟢  " + nameWithoutHyphen + "  defined. ");

    //let contextPrompt = buildContextPromptFromDocs(contextDocs);
    let intensions = Definer.docsToIntensions(contextDocs);
    return intensions;
  };

  static docsToIntensions(docs: Document<Record<string, any>>[]): string[] {
    let intensions: string[] = [];

    docs.forEach((r) => {
      intensions.push(r.pageContent);
    });

    return intensions;
  }

  static getCondensedDirectIntensions = async (
    concept: string
  ): Promise<string> => {
    const extensiveDefinitionRequest: LlmRequest = {
      nameId: "extensiveDefinition",
      temperature: 0.1,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- Summarize {mu} by listing its defining intensions estrictly based on the provided statements
- The character "${Tokenizer.beginingOfStatementToken} is used to indicate the begining of statement.
- Do not include external information. If there are one or few statements, stick to them.
- Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}". Don't start sentences with uppercase.
- One bullet point per intension.

Statements:
###
{context}

{mu}:`,
    };

    //- Merge similar intension into a single one without loosing nuances.

    const contextDocs = await getContextDocsForConcept(
      concept,
      [SEARCH_ORIGIN_DIRECT] //searchOrigins
    );

    if (contextDocs.length == 0) return "";

    let contextPrompt = buildContextPromptFromDocs(contextDocs);

    let llmRequest = extensiveDefinitionRequest;

    const out = await callLlm(llmRequest, concept, contextPrompt);
    return out;
    return "Direct\n" + out;
  };

  static getInferredIntenionsFromBacklinks = async (
    concept: string
  ): Promise<string> => {
    const inferMeaningRequest: LlmRequest = {
      nameId: "inferMeaning",
      temperature: 0.2,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- In the following occurrances an unknown term ${Tokenizer.unknownTermToken} is used.
- Find commonalities betwen X usage in occurance and abstract them.
- Use one bullet point per abstraction to define what ${Tokenizer.unknownTermToken} is.
- Rely strictly on the provided occurrences, without including external information.
- Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}". Don't start sentences with uppercase.    
Ocurrances:
###
{context}
        
${Tokenizer.unknownTermToken}:`,
    };

    const contextDocs = await getContextDocsForConcept(
      concept,
      [SEARCH_ORIGIN_BACKLINK] //searchOrigins
    );

    if (contextDocs.length == 0) {
      console.log("No backlink statements for " + concept);
      return "";
    }

    let contextPrompt = buildContextPromptFromDocs(contextDocs);

    //Anonimize concept
    const conceptWithHyphen = Utils.renameToHyphen(concept);

    //Replace concept with X
    contextPrompt = contextPrompt.replace(
      new RegExp(conceptWithHyphen, "g"),
      Tokenizer.unknownTermToken
    );

    let llmRequest = inferMeaningRequest;

    let out = await callLlm(llmRequest, concept, contextPrompt);

    out = out.replace(
      new RegExp(Tokenizer.unknownTermToken, "g"),
      conceptWithHyphen
    );
    return "Backlinks\n" + out;
  };

  static getDefinitionKeyConcepts = async (
    concept: string,
    definition: string
  ): Promise<string[]> => {
    const keyConceptsRequest: LlmRequest = {
      nameId: "definitionKeyConcepts",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- The following is a particular definition of "{mu}"
- List the top words in the definition that are prerequisits to understand "{mu}".
- Prioritize words that are rare, use "${Tokenizer.hyphenToken}" or are fundamental to have a comprehensive understanding.
- Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}".
- Output a comma separated list without. Do not put a "." at the end.
- Transform the words to its singular form.

Definition of "{mu}":
{context}

Top words:`,
    };

    let out = await callLlm(keyConceptsRequest, concept, definition);
    return out.split(", ");
  };

  static getQuestionKeyConcepts = async (
    definition: string
  ): Promise<string[]> => {
    const keyConceptsRequest: LlmRequest = {
      nameId: "questionKeyConcepts",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `"INSTRUCTIONS
- List the key words in the following text.
- Output a comma separated list without. Do not put a "." at the end.

TEXT:
{context}

KEY IDEAS:`,
    };

    let out = await callLlm(keyConceptsRequest, "", definition);
    return out.split(", ");
  };

  static getTextKeyMeaningUnits = async (text: string): Promise<string[]> => {
    let docs: Document<Record<string, any>>[] = [];

    //KEY CONCEPTS
    const keyWords = await Definer.getQuestionKeyConcepts(text);

    for (let word of keyWords) {
      let wordDocs = await getContextDocsForConcept(word, [
        SEARCH_ORIGIN_SEMANTIC,
      ]);

      wordDocs = filterDocsByConfindence(wordDocs, 0.7);
      docs = docs.concat(wordDocs);
    }

    let keyMus: string[] = [];

    for (let d of docs) {
      keyMus.push(d.metadata.name);
    }
    keyMus = [...new Set(keyMus)]; //remove duplicates
    return keyMus;
  };

  static respondQuestion = async (
    mu: string, // question
    context: string // allDefintions
  ): Promise<string> => {
    const questionWithDefinitions: LlmRequest = {
      nameId: "respond",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `INSTRUCTIONS
- Act as a very humble and deep thinker that has a very unique prespective and brings clarity to the audience through reasoning.
- Your perspective is the founded on the particular meaning you give to certain concepts (defined below).
- Respond to the question below.
- Respond strictly based on your particular understanding of the concepts. 
- Think deeply about how your perspective can provide clarity to the question.
- Do not include external information or other people perspectives.
- The audience does not know the concepts you use, make sure they can understand.
- Do not use complicated, rare or technical words, explain them instead.
- Provide an extensive, comprehensive and nuanced explanation.
- Try to see deeper into what's behind the questions, and why is important.
- If you make an statement, explain its reasoning. 
- Use simple and consice language. Do not use jargon, rare words or technisms.
- Explore interesting ideas in detail but make sure you are responding to the question.
- Communicate in a gentle, humble and non condescending to a general audience.

CONCEPTS
{context}

QUESTION
{mu}

RESPONSE`,
    };

    let out = await callLlm(questionWithDefinitions, mu, context);
    return out;
  };

  static intensionsToText(intensions: string[]): string {
    let text = "";
    intensions.forEach((i) => {
      text = text + Tokenizer.beginingOfStatementToken + " " + i + "\n";
    });
    return text;
  }
}
//- Explain the necessary meaning behind concepts when necessary. Express it inline, then continue answering the question.
/*template: `- Identify the top words that are prerequisits to understand "{mu}" based on the following definition.
- Rate the rarity of each word from very common (0), to used in specific domains (0.5), to extremely technical or unnexisten (1), and everything in between.
- Attribute a percentage (from 0 to 1) for how integral is the word in order to comprehend "{mu}" in relation to the rest of the words. The sum of all the top words "integrity" must be 1
- Return a JSON array of objects containing: word, rarity, integral

Definition of "{mu}":
{context}

JSON object of key concepts:`,*/
