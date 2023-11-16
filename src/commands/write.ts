import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { sectionInstructions } from "../lib/composer";
import RequestConceptHolder, { parallelRCH } from "../lib/requestConceptHolder";
import {
  GPT4TURBO,
  callLlm,
  getPromptContextMaxChars,
  outputLlmStats,
} from "../lib/llm";
import Tokenizer from "../lib/tokenizer";
import { ChainValues } from "langchain/dist/schema";

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

    await DefinerStore.load();
    const sectionInstructions: sectionInstructions[] = [
      {
        title: "Overview",
        instructions:
          "Instructions:  very high level overview synthesis of what IPMM is. Just few paragraphs.",
        coverage: "IPMM intent, What problems IPMM solves",
        givenConcepts: ["IPMM"],
      },
      {
        title: "Current stage",
        instructions: "Synthesize the current stage of development of IPMM?",
        coverage: "IPMM intent, What problems IPMM solves",
        givenConcepts: [
          "IPMM-current-focus",
          "IPMM",
          "IPMM-purpose",
          "IPMM Framework",
        ],
      },
      {
        title: "Terminology",
        instructions:
          "Justify in a synthetic way why it is  relevant for IPMM to have its own terminology",
        coverage:
          "IPMM has a unique terminology. It creates and redefines words in order to create a paradigm that can capture the problem space with much more accuracy, and not be constrained by pre-existing conceptions",
        givenConcepts: [
          "personal-language",
          "shared-language",
          "limits-of-shared-language",
          "word",
        ],
      },
    ];

    const mainTitle = "IPMM project overview";

    const allConceptScores = await parallelRCH(sectionInstructions);
    const allDefinitions = await DefinerStore.getDefinitionsByConceptScoreList(
      allConceptScores
    );
    await DefinerStore.save();

    const request = Composer.composeRequest;

    request.identifierVariable = mainTitle;
    const model = GPT4TURBO;
    const reservedResponseChars = 6000;
    const promptTemplateChars = request.template.length;
    const maxPromptContextChars = getPromptContextMaxChars(
      reservedResponseChars,
      promptTemplateChars,
      model
    );

    let maxedOutTextDefinitions: string[] = DefinerStore.getMaxOutDefinitions(
      allDefinitions,
      maxPromptContextChars
    );

    let definitionsText = maxedOutTextDefinitions.join("\n");
    definitionsText = definitionsText.replaceAll(Tokenizer.hyphenToken, " ");

    const sectionsInstructionsText =
      Composer.makeSectionRequest(sectionInstructions);
    const inputVariables: ChainValues = {
      mainTitle: mainTitle,
      keyConceptDefinitions: definitionsText,
      sectionsInstructions: sectionsInstructionsText,
    };

    let out = await callLlm(model, request, inputVariables);
    console.log(out);
    outputLlmStats();
  }
}
