import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import {
  QuestionCat,
  callLlm,
  dontKnowRequest,
  openAIMaxTokens,
  openAITokenPerChar,
  getContextDocs,
  questionRequest,
  friendlyPersonalReply,
  technicalRequest,
  textToIptFromList,
  buildContextPromptFromDocs,
  getDocsNameIidList,
  textToFoamText,
  friendlyRewrite as friendlyRewriteRequest,
  outputToneType,
  outputFormType,
  extensiveDefinitionRequest,
  getContextDocsForConcept,
  inferMeaningRequest,
} from "../lib/llm";
import { request } from "http";
import Referencer from "../lib/referencer";
import { open } from "fs";
import DirectSearch from "../lib/directSearch";
import SemanticSearch from "../lib/semanticSearch";
import Tokenizer from "../lib/tokenizer";

export default class WriteCommand extends Command {
  static description = "Uses LLMs to write about a topic in a specific format";

  static flags = {
    help: flags.help({ char: "h" }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),

    contextOnly: flags.boolean({
      name: "contextOnly",
      char: "c",
      description:
        "Does not make LLM requests, only returns the prompt context",
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
    const { args, flags } = this.parse(WriteCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );

    let rootConcept = args.question;

    // 1. EXTENSIVE SEARCH

    const edContextDocs = await getContextDocsForConcept(
      rootConcept,
      0.5, //min confidence
      ["backlink"], //searchOrigins
      openAIMaxTokens
    );

    console.log(edContextDocs);

    let contextPrompt = buildContextPromptFromDocs(edContextDocs);

    //Anonimize rootConcept
    const rootConceptWithHyphen = SemanticSearch.rename(
      rootConcept,
      Tokenizer.hyphenToken
    );
    //Replace rootConcept with X

    contextPrompt = contextPrompt.replace(
      new RegExp(rootConceptWithHyphen, "g"),
      Tokenizer.unknownTermToken
    );

    console.log(contextPrompt);

    // 2. EXTENSIVE DEFINITION
    let llmRequest = inferMeaningRequest;

    //Token calculations
    const promptTokens = llmRequest.template.length * openAITokenPerChar; //this is not correct
    const maxContextTokens =
      openAIMaxTokens - llmRequest.minCompletitionChars - promptTokens;

    console.log(llmRequest.template);
    console.log("\n\n");
    //LLM request
    let out = await callLlm(llmRequest, rootConcept, contextPrompt);

    out = out.replace(
      new RegExp(Tokenizer.unknownTermToken, "g"),
      rootConceptWithHyphen
    );
    console.log(out);
    return;

    //Translate back into format X
    const usedDocsNameIidMap = getDocsNameIidList(edContextDocs);

    //const ipt = await textToIptFromList(out, sortedNameIId);
    //console.log(ipt);

    const foamText = textToFoamText(out);
    console.log(foamText);
  }
}
