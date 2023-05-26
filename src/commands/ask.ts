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
  prepareContext,
  questionRequest,
  friendlyPersonalReply,
  technicalRequest,
  textToIPT,
} from "../lib/llm";
import { request } from "http";

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

    const context = await prepareContext(question, maxContextTokens);

    if (context.length <= 200) {
      llmRequest = dontKnowRequest;
    }
    const out = await callLlm(llmRequest, mu, context);

    const muosIids = [
      {
        name: "minformation computation hypothesis",
        iid: "i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3czw2tgsoq",
      },
      {
        name: "minformation",
        iid: "i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3cxhm6fu5a",
      },
      {
        name: "input information",
        iid: "i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3cvznzroxa",
      },
    ];

    const ipt = await textToIPT(out, muosIids);
    console.log(ipt);
  }
}
