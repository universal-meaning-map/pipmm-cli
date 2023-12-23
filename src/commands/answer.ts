import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import Definer from "../lib/definer";
import Tokenizer from "../lib/tokenizer";
import {
  GPT35TURBO,
  GPT4,
  GPT4TURBO,
  callLlm,
  getPromptContextMaxChars,
  logLlmStats,
} from "../lib/llm";
import DefinerStore, { Definition } from "../lib/definerStore";
import RequestConceptHolder from "../lib/requestConceptHolder";

export default class AnswerCommand extends Command {
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
      description: "What to ask",
      hidden: false,
    },
    {
      name: "keyConcepts",
      required: true,
      description:
        "Comma separated list of meaning unit names. Its definitions will be included in the context. ",
      hidden: false,
    },
  ];

  static async answer(
    request: string,
    guidelines: string,
    context: string,
    baseOutput: string,
    givenConcepts: string[]
  ): Promise<string> {
    if (context != "") {
      context = "\n\nContext: " + context;
    }
    if (guidelines != "") {
      guidelines = "\n\nRequest Requirements:" + guidelines;
    }

    //RCH
    let rch = new RequestConceptHolder(givenConcepts, request);
    await rch.proces();

    //ANSWER
    const mmRq = Definer.meaningMakingRq;
    mmRq.identifierVariable = request;
    const answerModel = GPT4TURBO;
    const promptTemplateChars = mmRq.template.length;
    const maxPromptContextChars = getPromptContextMaxChars(
      mmRq.maxPromptChars,
      mmRq.maxCompletitionChars,
      promptTemplateChars,
      answerModel
    );

    let trimedByScore = DefinerStore.trimScoreList(rch.all, 0.8);

    let allDefinitions: Definition[] =
      await DefinerStore.getDefinitionsByConceptScoreList(trimedByScore);

    let maxedOutTextDefinitions: string[] = DefinerStore.getMaxOutDefinitions(
      allDefinitions,
      maxPromptContextChars
    );
    let definitionsText = maxedOutTextDefinitions.join("\n");
    definitionsText = definitionsText.replaceAll(Tokenizer.hyphenToken, " ");

    for (let i = 0; i < maxedOutTextDefinitions.length; i++) {
      console.log(i + ". " + allDefinitions[i].name);
    }
    console.log(`
    DEFINITIONS:
    Name: ${mmRq.name}
    Id: ${mmRq.identifierVariable}
    Used defs: ${maxedOutTextDefinitions.length} /  ${allDefinitions.length}
    `);

    const inputVariables = {
      request: request,
      context: context,
      guidelines: guidelines,
      perspective: definitionsText,
      continue: "## Output1:Response\n\n" + baseOutput,
    };

    let allOutputs = await callLlm(answerModel, mmRq, inputVariables);
    console.log(allOutputs);

    let out = Definer.getFinalOutcomeOrRetry(
      "Output5:Response",
      allOutputs,
      answerModel,
      mmRq,
      inputVariables,
      0
    );

    logLlmStats();

    return out;
  }

  async run() {
    console.warn = () => {};
    const { args, flags } = this.parse(AnswerCommand);

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

    // Load compiled definitions

    //QUESTION and KEY CONCEPTS
    const request = args.question;
    const givenConcepts: string[] = args.keyConcepts.split(", ");
    await DefinerStore.load();
    const response = await AnswerCommand.answer(
      request,
      "",
      "",
      "",
      givenConcepts
    );
    await DefinerStore.save();
    console.log(response);
  }
}
