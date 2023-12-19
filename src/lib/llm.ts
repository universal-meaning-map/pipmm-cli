import Utils from "./utils";
import ConfigController from "../lib/configController";
import OpenAI from "openai";
import Referencer from "./referencer";
import Tokenizer from "./tokenizer";
import { ChainValues } from "langchain/dist/schema";
import { PromptTemplate } from "langchain/prompts";
import { finished } from "stream";
export const SEARCH_ORIGIN_DIRECT = "direct";
export const SEARCH_ORIGIN_BACKLINK = "backlink";
export const SEARCH_ORIGIN_SEMANTIC = "semantic";

const llmHistory: LlmRecord[] = [];
export interface LlmRecord {
  tokenOut: number;
  tokenIn: number;
  model: ModelConfig;
  duration: number; //ms
  finishReason: string;
  request: LlmRequest;
}

export interface ModelConfig {
  modelName: string;
  maxPrompTokens: number;
  maxCompletitionTokens: number;
  tokenToChar: number;
  tokenInCost: number;
  tokenOutCost: number;
}

export interface LlmRequest {
  name: string;
  identifierVariable: string;
  template: string; //langchain prompt template
  inputVariableNames: string[]; //variable names used in the prompt template
  maxCompletitionChars: number; //maximum chars saved for response
  maxPromptChars: number; //maximum chars used for prompt. Will be used to prune context. -1 will max out until Model maxTokens.  maxCompletitionChars preceeds maxPromptChars
  temperature?: number; //model temperature
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export const GPT35TURBO: ModelConfig = {
  modelName: "gpt-3.5-turbo-1106",
  maxPrompTokens: 8000, //16000
  maxCompletitionTokens: 4096,
  tokenToChar: 4,
  tokenInCost: 0.001 / 1000,
  tokenOutCost: 0.002 / 1000,
};

export const GPT4: ModelConfig = {
  modelName: "gpt-4-0613",
  maxPrompTokens: 8000,
  maxCompletitionTokens: 8000,
  tokenToChar: 4,
  tokenInCost: 0.03 / 1000,
  tokenOutCost: 0.06 / 1000,
};

export const GPT4TURBO: ModelConfig = {
  modelName: "gpt-4-1106-preview",
  maxPrompTokens: 32000, //128000
  maxCompletitionTokens: 4096,
  tokenToChar: 4,
  tokenInCost: 0.01 / 1000,
  tokenOutCost: 0.03 / 1000,
};

export function logLlmStats() {
  let totalCalls = 0;
  let totalCost = 0;
  let totalDuration = 0;
  for (let r of llmHistory) {
    const costOut = r.model.tokenOutCost * r.tokenOut;
    const costIn = r.model.tokenInCost * r.tokenIn;
    totalCalls++;
    totalCost = totalCost + costIn + costOut;
    totalDuration = totalDuration + r.duration;
    console.log(
      totalCalls + ". " + r.request.name + ": " + r.request.identifierVariable
    );
    console.log(
      Utils.round(costIn + costOut) +
        "$\t" +
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

export function logSuccintRequest(r: LlmRecord) {
  const costOut = r.model.tokenOutCost * r.tokenOut;
  const costIn = r.model.tokenInCost * r.tokenIn;
  const cost = costIn + costOut;
  let warning = "";
  if (r.finishReason != "stop") warning = "❗";

  console.log(
    "💬" +
      cost +
      "$  " +
      r.request.name +
      ": " +
      r.request.identifierVariable +
      ". " +
      warning +
      r.finishReason
  );
}
export function logRequest(
  request: LlmRequest,
  model: ModelConfig,
  prompt: string
) {
  console.log(`
    REQUEST
    Name: ${request.name}
    Id: ${request.identifierVariable}
    
    In chars: ${prompt.length}
    In tokens: ${prompt.length / model.tokenToChar}
    In cost: ${Utils.round(
      (prompt.length / model.tokenToChar) * model.tokenInCost
    )}$
    
    Max. out chars: ${request.maxCompletitionChars} 
    Max. out tokens: ${request.maxCompletitionChars / model.tokenToChar}
    Max. cost out: ${Utils.round(
      (request.maxCompletitionChars / model.tokenToChar) * model.tokenOutCost
    )}$
      
    Model Id: ${model.modelName}
    Model maax chars: ${model.maxPrompTokens * model.tokenToChar}
    Model max tokens: ${model.maxPrompTokens}
    `);
}

export function logResponse(
  request: LlmRequest,
  model: ModelConfig,
  duration: number,
  res: string
) {
  /*
    console.log(`
    RESPONSE:
    Name: ${request.name}
    Id: ${request.identifierVariable}
    Duration: ${(Math.round(duration / 1000), 10)}s
    Chars: ${}
    Tokens: ${}
    Cost out: ${
          Utils.round(res.text.length / model.tokenToChar) *
          model.tokenOutCost
        }$
    Cost total: ${totalCost}$`);
    */
}

export function getPromptContextMaxChars(
  promptCharsCap: number,
  reservedResponseChars: number,
  promptTemplateChars: number,
  model: ModelConfig
) {
  let maxTotalChars = model.maxPrompTokens * model.tokenToChar;
  if (promptCharsCap > 0) {
    if (promptCharsCap < maxTotalChars) {
      maxTotalChars = promptCharsCap;
    }
  }
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

export async function callLlm(
  model: ModelConfig,
  request: LlmRequest,
  inputVariables: ChainValues
): Promise<string> {
  const requestMaxCompletitionTokens = Math.round(
    request.maxCompletitionChars / model.tokenToChar
  );

  if (requestMaxCompletitionTokens > model.maxCompletitionTokens) {
    throw new Error(
      "CallLLm: Request completition tokens is larger than model's\n" +
        request.name +
        ": " +
        request.identifierVariable +
        ". Completition: " +
        requestMaxCompletitionTokens +
        "\n" +
        model.modelName +
        ": " +
        model.maxCompletitionTokens
    );
  }

  const openai = new OpenAI({
    apiKey: ConfigController._configFile.llm.openAiApiKey,
  });

  const promptTemplate = PromptTemplate.fromTemplate(request.template);
  const prompt = await promptTemplate.format(inputVariables);
  const promptTokens = Math.round(prompt.length / model.tokenToChar);

  console.log("---");
  console.log(prompt);
  console.log("---");

  const maxCompletitonTokens =
    request.maxCompletitionChars == 0
      ? model.maxPrompTokens - promptTokens - 200
      : requestMaxCompletitionTokens;

  console.log("\nToken forecast");
  console.log(
    "Prompt used/cap:" +
      promptTokens +
      "/" +
      request.maxPromptChars / model.tokenToChar
  );
  console.log(
    "Completion: " + maxCompletitonTokens + " / " + model.maxCompletitionTokens
  );
  console.log(
    "Total used/model: " +
      (promptTokens + maxCompletitonTokens) +
      " / " +
      model.maxPrompTokens +
      " " +
      model.modelName +
      "\n"
  );

  const t = Date.now();

  //CALL
  let completion = await openai.chat.completions.create({
    model: model.modelName,
    messages: [{ role: "user", content: prompt }],
    n: 1,
    temperature: request.temperature,
    stream: false,
    max_tokens: maxCompletitonTokens,
    seed: 0,
  });
  /*
if(model.modelName == GPT4TURBO.modelName || model.modelName == GPT35TURBO.modelName){
    completion.response_format = { type: "json_object" },
}*/

  const duration = Date.now() - t;
  const finishReason = completion.choices[0].finish_reason;
  const out = completion.choices[0].message!.content;
  const usage = completion.usage!;
  const record: LlmRecord = {
    request: request,
    duration: duration,
    model: model,
    tokenIn: usage.prompt_tokens,
    tokenOut: usage.completion_tokens,
    finishReason: finishReason,
  };

  logSuccintRequest(record);
  llmHistory.push(record);
  console.log(usage);

  if (out) return out;
  return "FAIL";
}
