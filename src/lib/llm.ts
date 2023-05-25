import Utils from "./utils";
import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import SemanticSearch from "../lib/semanticSearch";
import DirectSearch from "../lib/directSearch";
import Compiler from "../lib/compiler";

export const openAITokenPerChar = 0.25;
export const openAIMaxTokens = 4000;

export interface LlmRequest {
  nameId: string; //identifier of the request template
  temperature: number; //model temperature
  template: string; //langchain prompt template
  minCompletitionChars: number; //minimum chars saved for response
}

export interface SearchRequest {
  nameId: string;
  //minSimilarityScore: number; //0-1, usually between 0.15 and 0.2
  minConfidenceScore: number; //0-1, confidence filter
  type: string;
}

export function getConfidenceScore(relevance: number, pir: number) {
  const accuracyPenalty = Utils.mapRange(pir, 0.5, 0.9, 0.8, 1);
  return relevance * accuracyPenalty;
}

export interface ConceptCat {
  name: string;
  weight: number;
  alt: string[];
}

export interface QuestionCat {
  concepts: ConceptCat[];
  type: string;
  tone: string;
}

export const resverseSearch: SearchRequest = {
  nameId: "reverseIId",
  minConfidenceScore: 0.6,
  type: "direct",
};

export const semanticSearch: SearchRequest = {
  nameId: "semanticSearch",
  minConfidenceScore: 0.6,
  type: "semantic",
};

export const identifyRequest: LlmRequest = {
  nameId: "identify",
  temperature: 0,
  minCompletitionChars: 500, //minimum chars saved for response

  template: `What concepts in the text are uncommon and fundamental to understand {mu}
      CONTEXT:\n###\n{context}
      Concepts:
      -`,
};

export const dontKnowRequest: LlmRequest = {
  nameId: "dontKnow",
  temperature: 0.7,
  minCompletitionChars: 250, //minimum chars saved for response

  template: `
  Simple rephrase of: "I don't know what you're talking about, can you remind me what are we talking about?"`,
};

export const friendlyPersonalReply: LlmRequest = {
  nameId: "rewrite",
  temperature: 0,
  minCompletitionChars: 2000, //minimum chars saved for response

  template: `
You are {myName}, a professional technical writter with a very unique perspective.
You are having a friendly conversation with a friend.
You are a being ask your personal perspective about {mu}.
Be concise.
Write in first person.
Do not use imperative language.
Make extensive use of paragraphs.
If a complicated concept is mentioned, explain its meaning, followed by the complicated word in parenthensis.
###
Your thoughts on {mu}:
{context}
###
Friend: Hi {myName}! Is lovely to see you!
You: Likewise! I'm super happy to hear from you! ^^
Friend: Me too :)
You: What can I do for you?
Friend: {mu}
You:`,
};

export const questionRequest: LlmRequest = {
  nameId: "classifyQuestion",
  temperature: 0,
  minCompletitionChars: 1000, //minimum chars saved for response

  template: `
###
Q: "love"
concepts:
- name: love
  weight: 0.9
  alt:
  - sentiment
  - emotion
  - fondneses
  - devotion
  - warmth
type: explanation
tone: technical
###
Q: "What's the difference between narrative and story?"
concepts:
- name: narrative
  weight: 0.5
  alt:
  - story
  - tale
  - account
  - chronicle
- name: story
  weight: 0.5
  alt:
  - narrative
  - tale
  - account
  - chronicle
type: comparison
tone: friendly
###
Q: "What Victor thinks about presence? and expectation?"
concepts:
- name: presence
  weight: 0.8
  alt:
  - mindfulness
  - alertness
  - consciousness
- name: expectation
  weight: 0.2
  alt:
  - belief
  - anticipation
type: explanation
tone: friendly
###
Q: "Give me a technical explanation for minformation"
concepts:
- name: minformation
  weight: 1
  alt: []
type: explanation
tone: technical
###
Q: "How is reasoning better than intelligence?"
concepts:
- name: reasoning
  weight: 0.6
  alt:
  - rationality
  - logic
- name: intelligence
  weight: 0.4
  alt:
  - cognitive prowess
  - intellect
type: comparison
tone: friendly
###
Q: "{mu}"
`,
};

export async function callLlm(
  llmRequest: LlmRequest,
  mu: string,
  context: string
): Promise<string> {
  const promptTemplate = new PromptTemplate({
    template: llmRequest.template,
    inputVariables: ["mu", "context", "myName"],
  });

  const promptInput = {
    mu: mu,
    context: context,
    myName: Utils.capitalizeFirstLetter(
      ConfigController._configFile.share.myName
    ),
  };

  const prompt = await promptTemplate.format(promptInput);
  console.dir(prompt, { depth: null });

  const model = new OpenAI({
    temperature: llmRequest.temperature,
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
  return res.text;
}

export async function prepareContext(
  question: QuestionCat,
  maxContextTokens: number
): Promise<string> {
  let context = "";
  for (let i = 0; i < question.concepts.length; i++) {
    //to parallelize
    const name = question.concepts[i].name;
    let results: Document<Record<string, any>>[] = [];
    const muWithSameName = await DirectSearch.findMuWithSameName(name);
    if (muWithSameName) {
      //console.log(" Doing reverse direct search for " + name);
      results.push(...(await DirectSearch.getBacklinkDocs(muWithSameName)));
      console.log(results);
    }
    //console.log("Doing semantic serac for " + name);
    results.push(...(await SemanticSearch.search(name)));

    results = sortDocsByConfidence(results);

    const resultsFiltered = results.filter(confidenceFilter);

    const maxTokens = question.concepts[i].weight * maxContextTokens;

    console.log(resultsFiltered);
    const prunedDocs = pruneDocsForTokens(resultsFiltered, maxTokens);

    //console.log(pruneDocsForTokens);

    prunedDocs.forEach((r) => {
      context = context + r.pageContent + "\n";
    });

    // console.log("\nContext for " + name + ":\n" + context);
  }
  return context;
}

export function pruneDocsForTokens(
  docs: Document<Record<string, any>>[],
  maxTokens: number
) {
  const openAITokenPerChar = 0.25;
  let accumulatedChars = 0;
  for (let i = 0; i < docs.length; i++) {
    accumulatedChars += docs[i].pageContent.length;
    if (accumulatedChars * openAITokenPerChar >= maxTokens) {
      docs.splice(i - 1);
      return docs;
    }
  }
  return docs;
}

export function sortDocsByConfidence(docs: Document<Record<string, any>>[]) {
  docs.sort(
    (docA, docB) => docB.metadata.confidence - docA.metadata.confidence
  );
  return docs;
}

export function confidenceFilter(doc: Document<Record<string, any>>): boolean {
  if (doc.metadata.confidence > semanticSearch.minConfidenceScore) return true;
  return false;
}

export function logDocsWithHigherConfidenceLast(
  docs: Document<Record<string, any>>[]
) {
  docs.sort(
    (docA, docB) => docA.metadata.confidence - docB.metadata.confidence
  );

  console.log(docs);
}
