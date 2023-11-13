import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import Definer from "../lib/definer";
import Tokenizer from "../lib/tokenizer";
import { GPT4, ModelConfig } from "../lib/llm";
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

    console.log("\nDefinitions:");
    let allDefinitions: Definition[] = rch.getFinalDefinitions();
    let definitionsText = DefinerStore.directDefinitionsToText(allDefinitions);
    definitionsText = definitionsText.replaceAll(Tokenizer.hyphenToken, " ");

    let getPromptContextMaxChars = (
      reservedResponseChars: number,
      promptTemplateChars: number,
      model: ModelConfig
    ) => {
      const maxTotalChars = model.maxTokens * model.tokenToChar;
      const maxPromptChars = maxTotalChars - reservedResponseChars;
      const promptContextMaxChars = maxPromptChars - promptTemplateChars;
      return promptContextMaxChars;
    };

    const responseModel = GPT4;
    const reservedResponseChars = 6000;
    const promptTemplateChars = 9;
    const maxContextChars = getPromptContextMaxChars(
      reservedResponseChars,
      promptTemplateChars,
      responseModel
    );

    let prunedDefinitionsText = definitionsText;

    //Todo prune definitions instead of chars. To get the number of definitions.
    if (definitionsText.length > maxContextChars) {
      const charsToRemove = definitionsText.length - maxContextChars;
      prunedDefinitionsText = definitionsText.slice(0, -charsToRemove);
    }

    const out = await Definer.respondQuestion(
      responseModel,
      question,
      prunedDefinitionsText
    );

    console.log("\n\nOUT");
    console.log(out);

    console.log(`
STATS

Accepted aprox:
    Total chars: ${
      responseModel.maxTokens * responseModel.tokenToChar
    } tokens ${responseModel.maxTokens}
`);

    //Translate back into format X
    //const usedDocsNameIidMap = getDocsNameIidList(edContextDocs);

    //const ipt = await textToIptFromList(out, sortedNameIId);
    //console.log(ipt);

    // const foamText = textToFoamText(out);
    // console.log(foamText);
  }
}
