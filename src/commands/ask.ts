import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
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
  getDocsNameIidMap,
  textToFoamText,
} from "../lib/llm";
import { request } from "http";
import Referencer from "../lib/referencer";

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

    let llmRequest = questionRequest;
    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );


    let mu = args.question;

    const questionRes = await callLlm(questionRequest, args.question, "");
    console.log(questionRes);

    const question: QuestionCat = Utils.yamlToJsObject(String(questionRes));
    if ((question.tone = "technical")) {
      llmRequest = technicalRequest;
    } else {
      llmRequest = friendlyPersonalReply;
    }

    const promptTokens =
      (llmRequest.template.length + mu.length) * openAITokenPerChar; //this is not correct
    const maxContextTokens =
      openAIMaxTokens - llmRequest.minCompletitionChars - promptTokens;

    const contextDocs = await getContextDocs(question, maxContextTokens);
    const contextPrompt = buildContextPromptFromDocs(contextDocs);

    if (contextPrompt.length <= 200) {
      llmRequest = dontKnowRequest;
    }
    const out = await callLlm(llmRequest, mu, contextPrompt);

    const usedDocsNameIidMap = getDocsNameIidMap(contextDocs);

    const ipt = await textToIptFromList(out, usedDocsNameIidMap);
    const foamText =  textToFoamText(out, usedDocsNameIidMap, Referencer.iidToFoamId);
    console.log(ipt);
    console.log(foamText);
  }
}
