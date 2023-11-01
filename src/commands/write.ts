import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import Definer from "../lib/definer";
import Tokenizer from "../lib/tokenizer";
import { openAIMaxTokens, openAITokenPerChar } from "../lib/llm";
import DefinerStore, { Definition } from "../lib/definerStore";

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
    return;

    //QUESTION
    const inputKeyMuWithoutHyphen: string[] = args.keyConcepts.split(", ");
    const inputedKeyMu: string[] = [];

    for (let mu of inputKeyMuWithoutHyphen) {
      inputedKeyMu.push(Utils.renameToHyphen(mu));
    }

    const questionKeyMu: string[] = await Definer.getTextKeyMeaningUnits(
      question
    );

    const rootKeyMu = [...new Set(inputedKeyMu.concat(questionKeyMu))]; //remove duplicates

    console.log("\nInput:");
    inputedKeyMu.forEach((mu: string) => {
      console.log(mu);
    });

    console.log("\n\nGuessed:");
    questionKeyMu.forEach((mu: string) => {
      console.log(mu);
    });

    const rootProcessing = rootKeyMu.map(async (mu: string) => {
      await DefinerStore.getDefinition(mu, true, false, true, false);
    });

    await Promise.all(rootProcessing);

    //MAKE LIST OF SECOND LAYER KC

    let secondLayerKeyMu: string[] = [];

    for (let r of rootKeyMu) {
      await DefinerStore.addBackLinkScore(r, 3);
    }

    DefinerStore.definitions.forEach((d) => {
      for (let kcs of d.keyConceptsScores) {
        secondLayerKeyMu.push(kcs.k);
      }
    });

    secondLayerKeyMu = [...new Set(secondLayerKeyMu)]; //remove duplicates

    console.log("SECOND LAYER KC:");
    console.log(secondLayerKeyMu);

    // GET SECOND LAYER DEFINITIONS
    const secondLayerProcessing = secondLayerKeyMu.map(
      async (conceptWithHyphen: string) => {
        const mu = await DefinerStore.getDefinition(
          conceptWithHyphen,
          true,
          false,
          false,
          false
        );
      }
    );

    await Promise.all(secondLayerProcessing);

    console.log("\nDefinitions:");
    let allDefinitions: Definition[] = [];
    DefinerStore.definitions.forEach((d, key) => {
      allDefinitions.push(d);
      //console.log(d);
    });

    allDefinitions.sort((a, b) => b.backLinkScore - a.backLinkScore);

    allDefinitions.forEach((d) => {
      console.log(d.nameWithHyphen + " " + d.backLinkScore);
    });

    let numOfDefWithContent = 0;
    let definitionsContext = "";

    let defitinionsDirectContext =
      DefinerStore.directDefinitionsToText(allDefinitions);

    //MAKE CONTEXT
    /*
    allDefinitions.forEach((d) => {
      if (d.directIntensions.length == 0) {
        return;
      }
      const defitinionText = Definer.intensionsToText(d.directIntensions);
      defitinionsDirectContext =
        defitinionsDirectContext + "\n" + d.name + ":\n" + defitinionText;

      if (d.directIntensions.length > 1) {
        numOfDefWithContent++;
      } else {
        console.log("No intensions " + d.nameWithHyphen);
      }
    });

    */

    //REPLACE HYPHENS
    definitionsContext = defitinionsDirectContext.replaceAll(
      Tokenizer.hyphenToken,
      " "
    );

    let prunedDefinitionsContext = definitionsContext;

    const reservedResonseChars = 6000;
    const maxTotalChars = openAIMaxTokens / openAITokenPerChar;
    const maxPromptChars = maxTotalChars - reservedResonseChars;

    const responseTokens = 1500;
    const maxTokens = 8000;
    const maxPromptTOkens = maxTokens - responseTokens;
    const promptTokens = definitionsContext.length * openAITokenPerChar;
    if (promptTokens > maxPromptTOkens) {
      const tokensToRemove =
        (promptTokens - maxPromptTOkens) / openAITokenPerChar;

      prunedDefinitionsContext = definitionsContext.slice(0, -tokensToRemove);
    }

    const out = await Definer.respondQuestion(
      question,
      prunedDefinitionsContext
    );

    /*
    const textType: string = "a motivational speech";
    const topic: string = question;
    const targetAudience: string =
    "gaining awareness of what matters when I wake up in the morning";
    const style: string = "Leonardo Da Vinci";
    const perspective: string = prunedDefinitionsContext;
    const out = await Definer.respondQuestion2(
        textType,
      topic,
      targetAudience,
      style,
      perspective
      );
      */

    console.log("\n\nOUT");
    console.log(out);

    const directRemainPercentage =
      maxPromptChars / defitinionsDirectContext.length;

    console.log(`
STATS

Accepted aprox:
    Total chars: ${maxTotalChars} tokens ${maxTotalChars * openAITokenPerChar}
    Prompt chars: ${maxPromptChars} tokens ${
      maxPromptChars * openAITokenPerChar
    }

Original
    Nº of def : ${numOfDefWithContent}
    Avg direct def Chars: ${Math.round(
      defitinionsDirectContext.length / numOfDefWithContent
    )} Tokens: ${Math.round(
      (defitinionsDirectContext.length / numOfDefWithContent) *
        openAITokenPerChar
    )}
    Direct context Chars: ${defitinionsDirectContext.length}  Tokens: ${
      defitinionsDirectContext.length * openAITokenPerChar
    }

Pruned 
    Direct % remained: ${Math.round(directRemainPercentage * 100) / 100}
    Nº of direct def. : ${
      Math.round(numOfDefWithContent * directRemainPercentage * 100) / 100
    }
    Direct context chars: ${Math.round(
      defitinionsDirectContext.length * directRemainPercentage
    )}  tokens: ${Math.round(
      defitinionsDirectContext.length *
        directRemainPercentage *
        openAITokenPerChar
    )}
`);

    DefinerStore.save();

    //Translate back into format X
    //const usedDocsNameIidMap = getDocsNameIidList(edContextDocs);

    //const ipt = await textToIptFromList(out, sortedNameIId);
    //console.log(ipt);

    // const foamText = textToFoamText(out);
    // console.log(foamText);
  }
}
