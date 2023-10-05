import Utils from "./utils";
import ConfigController from "../lib/configController";
import { LLMChain } from "langchain/chains";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import SemanticSearch from "../lib/semanticSearch";
import DirectSearch from "../lib/directSearch";
import Referencer from "./referencer";
import Tokenizer from "./tokenizer";

export const openAITokenPerChar = 0.25;
export const openAIMaxTokens = 8000;

export interface LlmRequest {
  nameId: string; //identifier of the request template
  template: string; //langchain prompt template
  minCompletitionChars: number; //minimum chars saved for response
  temperature?: number; //model temperature
  frequencyPenalty?: number;
  presencePenalty?: number;
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

export const outputRigourType = {
  strict: "strict",
  soft: "soft",
};

export const outputToneType = {
  friendly: "friendly",
  technical: "technical",
};

export const outputFormType = {
  chat: "chat", //soft, semantic and direct
  doc: "doc", //strict, semantic and direct
  rewrite: "rewrite", //strict, semantic and direct
  compare: "compare", // either, semantic and direct
  define: "define", //strict, diret
};

export interface ConceptCat {
  name: string;
  weight: number;
}

export interface QuestionCat {
  concepts: ConceptCat[];
  tone: string;
  form: string;
}

export const resverseSearch: SearchRequest = {
  nameId: "reverseIId",
  minConfidenceScore: 0.6,
  type: "direct",
};

export const semanticSearch: SearchRequest = {
  nameId: "semanticSearch",
  minConfidenceScore: 0.7,
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

export const extensiveDefinitionRequest: LlmRequest = {
  nameId: "extensiveDefinition",
  temperature: 0.1,
  minCompletitionChars: 3000, //minimum chars saved for response
  template: `- Define what "{mu}" is.
- Infer its meaning strictly from the provided utterances, without including external information.
- Each bullet point is an standalone statement (intension).
- Each statement is full comprehensive and extremely accurated and detailed, paying attention into the nuances.
- Be technical. Preserve jargon.
  
Utterances:
{context}
      
{mu}:`,
};

export const extensiveDefinitionRequest_: LlmRequest = {
  nameId: "extensiveDefinition",
  temperature: 0.3,
  minCompletitionChars: 3000, //minimum chars saved for response
  template: `- Define {mu} by listing its defining intensions
- Rely strictly on the provided statements, without including external information.
- Express what the "{mu}" is and how it how it releates to other concepts.
- Remove intensions that are redundant. Merge similar intension into a single one.
- Be technical. Be precise with names.
- Be comprehensive and detailed on each intension.
- List only intensions in which {mu} has an active role.
- One bullet point per intension.

Statements:
{context}
    
{mu}:`,
};

export const inferMeaningRequest: LlmRequest = {
  nameId: "inferMeaning",
  temperature: 0.1,
  minCompletitionChars: 3000, //minimum chars saved for response
  template:
    `- In the following occurrances an unknown term ` +
    Tokenizer.unknownTermToken +
    ` is used.
- Find commonalities betwen X usage in occurance and abstract them.
- Use one bullet point per abstraction to define what ` +
    Tokenizer.unknownTermToken +
    ` is.
- Rely strictly on the provided occurrences, without including external information.
- Be technical. Preserve used jargon. Don't start sentences with uppercase.
  
Ocurrances:
{context}
      
Abstractions:`,
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
  temperature: 0.5,
  minCompletitionChars: 1500, //minimum chars saved for response
  template: `
You are {myName}, a professional technical writter with a very unique perspective.
Your responses are clear and direct, and you use the right amount of words to explain.
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
You: Likewise, what can I do for you?
Friend: {mu}
You:`,
};

export const friendlyRewrite: LlmRequest = {
  nameId: "rewrite",
  temperature: 0.3,
  minCompletitionChars: 1500, //minimum chars saved for response
  template: `
You are writer with the same style than Paul Graham.
You have a very unique perspective about {mu}.
Do not use imperative language.
Make extensive use of paragraphs.
Rewrite your understanding about {mu} in a comprehensive style.
###
Context:
{context}

Rewrite:
{mu} is`,
};

export const technicalRequest: LlmRequest = {
  nameId: "rewrite",
  temperature: 0.2,
  frequencyPenalty: 0.1,
  minCompletitionChars: 1500, //minimum chars saved for response
  template: `
You're writting README.md for "{mu}" using Markdown.
Use H2 and H3 headings to organize the document.
You have beautiful, natural and pleasant style of writting.
"""
References {mu}:
{context}
"""
# {mu}
`,
};

export const questionRequest: LlmRequest = {
  nameId: "classifyQuestion",
  temperature: 0,
  minCompletitionChars: 500, //minimum chars saved for response

  template: `
###
Q: "define love"
concepts:
- name: love
  weight: 0.9
tone: technical,
form: define
###
Q: "What's the difference between narrative and story?"
concepts:
- name: narrative
  weight: 0.5
- name: story
  weight: 0.5
tone: technical
form: compare
###
Q: "What do you think about presence? and expectation?"
concepts:
- name: presence
  weight: 0.8
- name: expectation
  weight: 0.2
tone: friendly
form: chat
###
Q: "rewrite minformation in a friendly way"
concepts:
- name: minformation
  weight: 1
tone: friendly
form: rewrite
###
Q: "How is reasoning better than intelligence?"
concepts:
- name: reasoning
  weight: 0.6
- name: intelligence
  weight: 0.4
tone:  friendly
form: compare
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
    temperature: llmRequest.temperature ? llmRequest.temperature : 0,
    frequencyPenalty: llmRequest.frequencyPenalty
      ? llmRequest.frequencyPenalty
      : 0,
    presencePenalty: llmRequest.presencePenalty
      ? llmRequest.presencePenalty
      : 0,
    topP: 1,
    modelName: "gpt-4-0613",
    //modelName: "gpt-4-32k",
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

export function getOutputRigourByForm(form: string): string {
  if (form == outputFormType.doc || form == outputFormType.rewrite) {
    return outputRigourType.strict;
  }
  return outputRigourType.soft;
}

export async function getContextDocs(
  question: QuestionCat,
  minConfindence: number,
  maxContextTokens: number
): Promise<Document<Record<string, any>>[]> {
  let contextDocs: Document<Record<string, any>>[] = [];
  for (let i = 0; i < question.concepts.length; i++) {
    //to parallelize
    let conceptDocs: Document<Record<string, any>>[] = [];
    const name = question.concepts[i].name;
    let namesWithHyphen = false;
    const rigour = getOutputRigourByForm(question.form);
    if (rigour == outputRigourType.strict) namesWithHyphen = true;

    let includeDirectBacklinks = true;
    if ((question.form = outputFormType.rewrite)) {
      includeDirectBacklinks = false;
    }

    console.log("\n\ninclude backlinks" + includeDirectBacklinks);
    console.log("\n\nnames with hyphen " + namesWithHyphen);

    const muIidWithSameName = await DirectSearch.getIidByName(name);
    if (muIidWithSameName) {
      conceptDocs.push(
        ...(await DirectSearch.getBacklinkDocs(
          muIidWithSameName,
          namesWithHyphen,
          includeDirectBacklinks
        ))
      );
    }
    if (
      question.form != outputFormType.define &&
      question.form != outputFormType.rewrite
    ) {
      conceptDocs.push(
        ...(await SemanticSearch.search(
          name,
          Referencer.PROP_VIEW_FOAMID,
          namesWithHyphen
        ))
      );
    }

    // Todo: Eliminate duplicates

    const maxTokens = question.concepts[i].weight * maxContextTokens;
    conceptDocs = sortDocsByConfidence(conceptDocs);
    conceptDocs = filterDocsByConfindence(conceptDocs, minConfindence);
    conceptDocs = pruneDocsForTokens(conceptDocs, maxTokens);
    contextDocs.push(...conceptDocs);
    console.log("C");
  }
  return contextDocs;
}

export async function getContextDocsForConcept(
  concept: string,
  minConfindence: number,
  searchOrigins: string[],
  maxTokens: number
): Promise<Document<Record<string, any>>[]> {
  let conceptDocs: Document<Record<string, any>>[] = [];
  const namesWithHyphen = true;
  const includeDirectBacklinks = true;

  const muIidWithSameName = await DirectSearch.getIidByName(concept);
  console.log("IID match: " + muIidWithSameName);

  // Todo search with synonim?

  // IT ONLY GET BACK LINKS

  if (muIidWithSameName) {
    conceptDocs.push(
      ...(await DirectSearch.getBacklinkDocs(
        muIidWithSameName,
        namesWithHyphen,
        includeDirectBacklinks
      ))
    );
  } else {
    console.log("no exact name found for: " + concept);
  }

  conceptDocs.push(
    ...(await SemanticSearch.search(
      concept,
      Referencer.PROP_VIEW_FOAMID,
      namesWithHyphen
    ))
  );

  // Todo: Eliminate  duplicates and give them more confidence
  conceptDocs = sortDocsByConfidence(conceptDocs);
  conceptDocs = filterBySearchOrigin(conceptDocs, searchOrigins);
  //conceptDocs = filterDocsByConfindence(conceptDocs, minConfindence);
  conceptDocs = pruneDocsForTokens(conceptDocs, maxTokens);
  console.log(conceptDocs);
  return conceptDocs;
}

export function getDocsNameIidList(
  docs: Document<Record<string, any>>[]
): Map<string, string> {
  const nameToIid = new Map<string, string>();
  docs.forEach((doc) => {
    if (!nameToIid.has(doc.metadata.name)) {
      nameToIid.set(doc.metadata.name, doc.metadata.iid);
    }
  });
  return nameToIid;
}

export function buildContextPromptFromDocs(
  contextDocs: Document<Record<string, any>>[]
): string {
  let context = "";

  contextDocs.forEach((r) => {
    const statement = {
      s: r.pageContent,
      r: Math.round(r.metadata.confidence * 100) / 100,
      a: r.metadata.pir,
    };
    //context = context + JSON.stringify(statement, null, 2);

    context = context + r.pageContent + "\n###\n";
  });

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

export function filterDocsByConfindence(
  docs: Document<Record<string, any>>[],
  minConfidence: number
) {
  function confidenceFilter(doc: Document<Record<string, any>>): boolean {
    if (doc.metadata.confidence > minConfidence) return true;
    return false;
  }

  return docs.filter(confidenceFilter);
}

export function filterBySearchOrigin(
  docs: Document<Record<string, any>>[],
  searchOrigins: string[]
): Document<Record<string, any>>[] {
  return docs.filter((doc) =>
    searchOrigins.includes(doc.metadata.searchOrigin)
  );
}

export function logDocsWithHigherConfidenceLast(
  docs: Document<Record<string, any>>[]
) {
  docs.sort(
    (docA, docB) => docA.metadata.confidence - docB.metadata.confidence
  );

  console.log(docs);
}

export async function textToIptFromList(
  corpus: string,
  nameToIidList: [string, string][] //name, iid
): Promise<string[]> {
  //muoNames.sort longest to shoretes
  const nameIId = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);
  for (const [name, iid] of nameToIidList) {
    corpus = corpus.replaceAll(
      name,
      Tokenizer.splitToken + makeAref(iid, nameIId) + Tokenizer.splitToken
    );
  }
  return corpus.split(Tokenizer.splitToken);
}

export function makeAref(iid: string, transclusionPropIid: string): string {
  return '["' + iid + "/" + transclusionPropIid + '"]';
}

export function textToFoamText(corpus: string): string {
  const sortedNameToFoamId = Array.from(Referencer.nameWithHyphenToFoamId).sort(
    ([keyA], [keyB]) => keyB.length - keyA.length
  );
  for (const [name, foamId] of sortedNameToFoamId) {
    corpus = corpus.replaceAll(" " + name, " [[" + foamId + "]]");
    corpus = corpus.replaceAll("\n" + name, "\n[[" + foamId + "]]");
  }
  return corpus;
}
