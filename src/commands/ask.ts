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
} from "../lib/llm";
import { request } from "http";
import Referencer from "../lib/referencer";
import { open } from "fs";
import DirectSearch from "../lib/directSearch";

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
    const { args, flags } = this.parse(AskCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    let llmRequest = questionRequest;
    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );

    let mu = args.question;

    let question: QuestionCat;

    //Get context only
    if (flags.contextOnly) {
      question = {
        concepts: [{ name: args.question, weight: 1 }],
        tone: outputToneType.friendly,
        form: outputFormType.rewrite,
      };

      const minConfindence = 0.69;

      const contextDocs = await getContextDocs(
        question,
        minConfindence,
        openAIMaxTokens
      );
      console.log(contextDocs);

      const contextPrompt = buildContextPromptFromDocs(contextDocs);
      console.log(contextPrompt);
      return contextPrompt;
    }

    //Figure out request type
    const questionRes = await callLlm(questionRequest, args.question, "");
    console.log(questionRes);

    question = Utils.yamlToJsObject(String(questionRes));
    if (question.form == outputFormType.rewrite) {
      llmRequest = friendlyRewriteRequest;
    } else if (question.form == outputFormType.doc) {
      llmRequest = technicalRequest;
    } else {
      llmRequest = friendlyPersonalReply;
    }

    //Token calculations
    const promptTokens =
      (llmRequest.template.length + mu.length) * openAITokenPerChar; //this is not correct
    const maxContextTokens =
      openAIMaxTokens - llmRequest.minCompletitionChars - promptTokens;

    const contextDocs = await getContextDocs(question, 0.5, maxContextTokens);
    const contextPrompt = buildContextPromptFromDocs(contextDocs);

    if (contextPrompt.length <= 200) {
      llmRequest = dontKnowRequest;
    }

    //LLM request
    const out = await callLlm(llmRequest, mu, contextPrompt);

    //Translate back into format X
    const usedDocsNameIidMap = getDocsNameIidList(contextDocs);

    //const ipt = await textToIptFromList(out, sortedNameIId);
    //console.log(ipt);

    const foamText = textToFoamText(out);
    console.log(foamText);
  }
}
