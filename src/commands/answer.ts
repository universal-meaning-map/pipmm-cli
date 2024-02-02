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
import LlmRequests from "../lib/llmRequests";

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
    semanticRequest: string,
    baseOutput: string,
    givenConcepts: string[]
  ): Promise<string> {
    //RCH
    let rch = new RequestConceptHolder(givenConcepts, semanticRequest, []);
    await rch.proces();
    await DefinerStore.save();

    //ANSWER
    const llmReg = LlmRequests.Enrich;
    llmReg.identifierVariable = semanticRequest;
    const answerModel = GPT4TURBO;
    const promptTemplateChars = llmReg.template.length;
    const maxPromptContextChars = getPromptContextMaxChars(
      llmReg.maxPromptChars,
      llmReg.maxCompletitionChars,
      promptTemplateChars,
      answerModel
    );

    let trimedByScore = DefinerStore.trimScoreList(rch.all, 0.7);

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
    Name: ${llmReg.name}
    Id: ${llmReg.identifierVariable}
    Used defs: ${maxedOutTextDefinitions.length} /  ${allDefinitions.length}
    `);

    const inputVariables = {
      draft: request,
      perspective: definitionsText,
      //  continue: baseOutput,
    };

    let allOutputs = await callLlm(answerModel, llmReg, inputVariables);

    /*
    let out = await Definer.getFinalOutcomeOrRetry(
      "--- Output3:Final text",
      allOutputs,
      answerModel,
      llmReg,
      inputVariables,
      0
    );
    */

    logLlmStats();

    return allOutputs;
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
      request,
      "",
      givenConcepts
    );

    console.log(response);
  }
}
