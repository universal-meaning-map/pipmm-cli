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
  outputLlmStats,
} from "../lib/llm";
import DefinerStore, { Definition } from "../lib/definerStore";
import RequestConceptHolder from "../lib/requestConceptHolder";
import { request } from "http";

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
    await DefinerStore.load();

    //QUESTION and KEY CONCEPTS
    const question = args.question;
    const givenConcepts: string[] = args.keyConcepts.split(", ");

    let rch = new RequestConceptHolder(givenConcepts, question);
    await rch.proces();

    await DefinerStore.save();

    //ANSWER
    const answerRequest = Definer.respondToQuestionRequest;
    answerRequest.identifierVariable = question;
    const answerModel = GPT4TURBO;
    const promptTemplateChars = answerRequest.template.length;
    const maxPromptContextChars = getPromptContextMaxChars(
      answerRequest.maxCompletitionChars,
      promptTemplateChars,
      answerModel
    );

    let allDefinitions: Definition[] =
      await DefinerStore.getDefinitionsByConceptScoreList(rch.all);
    let maxedOutTextDefinitions: string[] = DefinerStore.getMaxOutDefinitions(
      allDefinitions,
      maxPromptContextChars
    );
    let definitionsText = maxedOutTextDefinitions.join("\n");
    definitionsText = definitionsText.replaceAll(Tokenizer.hyphenToken, " ");
    const answerInputVariables = {
      question: question,
      definitions: definitionsText,
    };

    //SUCCESSION
    const successionModel = GPT4TURBO;
    const successionRequest = Definer.successionRequest;
    successionRequest.identifierVariable = question;
    const successionMaxPromptContextChars = getPromptContextMaxChars(
      successionRequest.maxCompletitionChars,
      successionRequest.template.length,
      successionModel
    );

    let successionMaxedOutTextDefinitions: string[] =
      DefinerStore.getMaxOutDefinitions(
        allDefinitions,
        successionMaxPromptContextChars
      );
    let successionPerspective = maxedOutTextDefinitions.join("\n");

    successionPerspective = definitionsText.replaceAll(
      Tokenizer.hyphenToken,
      " "
    );

    const successionInputVariables = {
      request: question,
      perspective: successionPerspective,
    };

    console.log(`
DEFINITIONS:
Name: ${answerRequest.name}
Id: ${answerRequest.identifierVariable}
Used defs: ${maxedOutTextDefinitions.length} /  ${allDefinitions.length}
`);

    // let text = await callLlm(answerModel, answerRequest, answerInputVariables);
    let text = await callLlm(
      GPT4TURBO,
      successionRequest,
      successionInputVariables
    );
    console.log(text);

    outputLlmStats();

    return;

    const codRequest = Definer.codRequest;
    codRequest.identifierVariable = question;
    const codModel = GPT35TURBO;

    const codMaxPromptContextChars = getPromptContextMaxChars(
      codRequest.maxCompletitionChars,
      promptTemplateChars,
      codModel
    );

    let codMaxedOutTextDefinitions: string[] =
      DefinerStore.getMaxOutDefinitions(
        allDefinitions,
        codMaxPromptContextChars
      );

    let codDefinitionsText = codMaxedOutTextDefinitions.join("\n");
    codDefinitionsText = codDefinitionsText.replaceAll(
      Tokenizer.hyphenToken,
      " "
    );

    const codInputVariables = {
      request: question,
      text: text,
      perspective: codDefinitionsText,
    };

    let out = await callLlm(codModel, codRequest, codInputVariables);
    console.log(out);

    outputLlmStats();

    //Translate back into format X
    //const usedDocsNameIidMap = getDocsNameIidList(edContextDocs);

    //const ipt = await textToIptFromList(out, sortedNameIId);
    //console.log(ipt);

    // const foamText = textToFoamText(out);
    // console.log(foamText);
  }
}
