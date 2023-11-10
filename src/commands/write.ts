import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import Definer from "../lib/definer";
import Tokenizer from "../lib/tokenizer";
import { openAIMaxTokens, openAITokenPerChar } from "../lib/llm";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { sectionInstructions } from "../lib/composer";

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
    const question = args.question;

    const d = await DefinerStore.getDefinition(
      question,
      false,
      false,
      false,
      true
    );

    console.log(d!.compiledDefinition);
    await DefinerStore.save();
    const sectionInstructions: sectionInstructions[] = [
      {
        title: "Overview",
        instructions:
          "Instructions:  very high level overview synthesis of what IPMM is. Just few paragraphs.",
        coverage: "IPMM intent, What problems IPMM solves",
        baseConcepts: ["IPMM"],
      },
      {
        title: "Current stage",
        instructions: "Synthesize the current stage of development of IPMM?",
        coverage: "IPMM intent, What problems IPMM solves",
        baseConcepts: [
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
        baseConcepts: [
          "personal-language",
          "shared-language",
          "limits-of-shared language",
          "word",
        ],
      },
    ];

    const baseConcepts= Composer.getBaseConcepts(sectionInstructions);
    const sectionInstructionsText = Composer.makeSectionRequest(sectionInstructions);
    const conceptDefintions = ""
    Composer.composeRequest("IPMM", sectionInstructionsText,conceptDefintions);
  }
}
