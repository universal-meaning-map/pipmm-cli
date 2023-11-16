import Utils from "./utils";
import ConfigController from "../lib/configController";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import Referencer from "./referencer";
import Tokenizer from "./tokenizer";
import { ChainValues } from "langchain/dist/schema";
import { request } from "http";
import { template } from "@oclif/plugin-help/lib/util";

export const SEARCH_ORIGIN_DIRECT = "direct";
export const SEARCH_ORIGIN_BACKLINK = "backlink";
export const SEARCH_ORIGIN_SEMANTIC = "semantic";

const llmHistory: LlmRecord[] = [];
export interface LlmRecord {
  name: string;
  id: string;
  tokenOut: number;
  tokenIn: number;
  model: ModelConfig;
  duration: number; //ms
}

export interface ModelConfig {
  modelName: string;
  maxTokens: number;
  tokenToChar: number;
  tokenInCost: number;
  tokenOutCost: number;
}

export interface LlmRequest {
  name: string;
  identifierVariable: string;
  template: string; //langchain prompt template
  inputVariableNames: string[]; //variable names used in the prompt template
  maxCompletitionChars: number; //minimum chars saved for response
  temperature?: number; //model temperature
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export const GPT35TURBO: ModelConfig = {
  modelName: "gpt-3.5-turbo-1106",
  maxTokens: 8000, //16000
  tokenToChar: 4,
  tokenInCost: 0.001 / 1000,
  tokenOutCost: 0.002 / 1000,
};

export const GPT4: ModelConfig = {
  modelName: "gpt-4-0613",
  maxTokens: 8000,
  tokenToChar: 4,
  tokenInCost: 0.03 / 1000,
  tokenOutCost: 0.06 / 1000,
};

export const GPT4TURBO: ModelConfig = {
  modelName: "gpt-4-1106-preview",
  maxTokens: 8000, //128000
  tokenToChar: 4,
  tokenInCost: 0.01 / 1000,
  tokenOutCost: 0.03 / 1000,
};

export async function callLlm(
  modelConfig: ModelConfig,
  llmRequest: LlmRequest,
  inputVariables: ChainValues
): Promise<string> {
  const promptTemplate = new PromptTemplate({
    template: llmRequest.template,
    inputVariables: llmRequest.inputVariableNames,
  });

  const openAiModel = new OpenAI({
    temperature: llmRequest.temperature ? llmRequest.temperature : 0,
    frequencyPenalty: llmRequest.frequencyPenalty
      ? llmRequest.frequencyPenalty
      : 0,
    presencePenalty: llmRequest.presencePenalty
      ? llmRequest.presencePenalty
      : 0,
    topP: 1,
    modelName: modelConfig.modelName,
    maxTokens: -1,
    openAIApiKey: ConfigController._configFile.llm.openAiApiKey,
  });

  const verbose = false;
  if (verbose)
    console.log(`
REQUEST
Name: ${llmRequest.name}
Id: ${llmRequest.identifierVariable}`);

  const chain = new LLMChain({ llm: openAiModel, prompt: promptTemplate });
  const finalPrompt = (await chain.prompt.format(inputVariables)).toString();

  if (verbose) console.log(finalPrompt);

  if (verbose)
    console.log(`
IN
In chars: ${finalPrompt.length}
In tokens: ${finalPrompt.length / modelConfig.tokenToChar}
Cost in: ${Utils.round(
      (finalPrompt.length / modelConfig.tokenToChar) * modelConfig.tokenInCost
    )}$

OUT
Max. out chars: ${llmRequest.maxCompletitionChars} 
Max. out tokens: ${llmRequest.maxCompletitionChars / modelConfig.tokenToChar}
Max. cost out: ${Utils.round(
      (llmRequest.maxCompletitionChars / modelConfig.tokenToChar) *
        modelConfig.tokenOutCost
    )}$
  
MODEL
Id: ${modelConfig.modelName}
Max chars: ${modelConfig.maxTokens * modelConfig.tokenToChar}
Max tokens: ${modelConfig.maxTokens}
`);

  const t = Date.now();
  const res = await chain.call(inputVariables);
  const duration = Date.now() - t;

  const totalCost = Utils.round(
    (res.text.length / modelConfig.tokenToChar) * modelConfig.tokenOutCost +
      (finalPrompt.length / modelConfig.tokenToChar) * modelConfig.tokenInCost
  );
  if (verbose)
    console.log(`
RESPONSE:
Name: ${llmRequest.name}
Id: ${llmRequest.identifierVariable}
Duration: ${(Math.round(duration / 1000), 10)}s
Chars: ${res.text.length}
Tokens: ${res.text.length / modelConfig.tokenToChar}
Cost out: ${
      Utils.round(res.text.length / modelConfig.tokenToChar) *
      modelConfig.tokenOutCost
    }$
Cost total: ${totalCost}$`);

  if (verbose) console.log(res);

  if (!verbose)
    console.log(
      "💬" +
        totalCost +
        "$\t" +
        llmRequest.name +
        ": " +
        llmRequest.identifierVariable
    );

  const record: LlmRecord = {
    name: llmRequest.name,
    id: llmRequest.identifierVariable,
    duration: duration,
    model: modelConfig,
    tokenIn: finalPrompt.length / modelConfig.tokenToChar,
    tokenOut: llmRequest.maxCompletitionChars / modelConfig.tokenToChar,
  };
  llmHistory.push(record);
  return res.text;
}

export function outputLlmStats() {
  let totalCalls = 0;
  let totalCost = 0;
  let totalDuration = 0;
  for (let r of llmHistory) {
    const costOut = r.model.tokenOutCost * r.tokenOut;
    const costIn = r.model.tokenInCost * r.tokenIn;
    totalCalls++;
    totalCost = totalCost + costIn + costOut;
    totalDuration = totalDuration + r.duration;
    console.log(totalCalls + ". " + r.name);
    console.log("🆔 " + r.id);
    console.log(
      "💰  " +
        Utils.round(costIn + costOut) +
        "$\t⌛" +
        Utils.round(r.duration / 1000, 10) +
        "s"
    );
  }
  console.log("Total calls:\t" + totalCalls);
  console.log("Total cost:\t" + Utils.round(totalCost) + "$");
  console.log(
    "Total duration:\t" + Utils.round(totalDuration / 1000, 10) + "s"
  );
}

export function getPromptContextMaxChars(
  reservedResponseChars: number,
  promptTemplateChars: number,
  model: ModelConfig
) {
  const maxTotalChars = model.maxTokens * model.tokenToChar;
  const maxPromptChars = maxTotalChars - reservedResponseChars;
  const promptContextMaxChars = maxPromptChars - promptTemplateChars;
  return promptContextMaxChars;
}

export function getConfidenceScore(relevance: number, pir: number) {
  const accuracyPenalty = Utils.mapRange(pir, 0.5, 0.9, 0.8, 1);
  return relevance * accuracyPenalty;
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
