import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import Definer from "../lib/definer";
import DirectSearch from "../lib/directSearch";
import { SlowBuffer } from "buffer";
import SemanticSearch from "../lib/semanticSearch";
import Tokenizer from "../lib/tokenizer";
import {
  SEARCH_ORIGIN_SEMANTIC,
  filterDocsByConfindence,
  getContextDocsForConcept,
  openAIMaxTokens,
  openAITokenPerChar,
} from "../lib/llm";
import DefinerStore, { Definition } from "../lib/definerStore";
import { LLM } from "langchain/dist/llms/base";
import Referencer from "../lib/referencer";

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

    const question = args.question;

    //QUESTION
    //SHOULD this return definitions? So I have the number of backlinks
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

    console.log("\nGuessed:");
    questionKeyMu.forEach((mu: string) => {
      console.log(mu);
    });

    const rootProcessing = rootKeyMu.map(async (mu: string) => {
      let muDefinition = await DefinerStore.getDefinition(
        mu,
        true,
        false,
        true,
        false
      );

      /*
      let out = await Definer.getDefinitionKeyConcepts(
        muDefinition!.nameWithHyphen,
        Definer.intensionsToText(muDefinition!.directIntensions)
      );

      let out2 = await Definer.getDefinitionScoredConcepts(
        muDefinition!.nameWithHyphen,
        Definer.intensionsToText(muDefinition!.directIntensions)
      );
      console.log(muDefinition!.nameWithHyphen + ":\n\n" + out + "\n\n" + out2);

      */
    });

    await Promise.all(rootProcessing);

    console.log("\nDefinitions:");
    let allDefinitions: Definition[] = [];
    DefinerStore.definitions.forEach((d, key) => {
      allDefinitions.push(d);
      //console.log(d);
    });

    allDefinitions.sort((a, b) => a.backLinkScore - b.backLinkScore);

    allDefinitions.forEach((d) => {
      console.log(d.nameWithHyphen + " " + d.backLinkScore);
    });
    return;

    /*

    allDefinitions.forEach((d) => {
      d.keyConceptsScores.forEach((c) => {
        inputKeyMuWithoutHyphen.push(c.k);
      });
    });

    inputKeyMuWithoutHyphen = [...new Set(inputKeyMuWithoutHyphen)]; //remove duplicates

    const secondLayerProcessing = inputKeyMuWithoutHyphen.map(
      async (conceptWithHyphen: string) => {
        let conceptDefinition = await DefinerStore.getDefinition(
          conceptWithHyphen,
          true,
          false,
          false,
          false
        );
        if (conceptDefinition) allDefinitions.push(conceptDefinition);
      }
    );
    await Promise.all(secondLayerProcessing);

    let numOfDefWithContent = 0;
    let definitionsContext = "";
    let defitinionsDirectContext = "";
    let definitionsCondensedContext = "";

    DefinerStore.definitions.forEach((d, key) => {
      console.log(d.nameWithHyphen + " " + d.backLinkScore);
    });

    return;

    allDefinitions.forEach((d) => {
      const defitinionText = Definer.intensionsToText(d.directIntensions);
      defitinionsDirectContext =
        defitinionsDirectContext + d.name + ":\n" + defitinionText;

      definitionsCondensedContext =
        definitionsCondensedContext +
        "\n" +
        d.name +
        ":\n" +
        d.condensedDirectIntensions +
        "\n";
      if (d.directIntensions.length > 1) {
        numOfDefWithContent++;
      }
    });

    //definitionsContext = defitinionsDirectContext;
    definitionsContext = definitionsCondensedContext;

    console.log(definitionsContext);

    //TODO!!! only replaces key concepts
    for (let conceptWithHyphens of inputKeyMuWithoutHyphen) {
      let concept = Utils.renameFromHyphen(conceptWithHyphens);
      console.log(conceptWithHyphens + " --> " + concept);

      definitionsContext = definitionsContext.replaceAll(
        conceptWithHyphens,
        concept
      );
    }

    let prunedDefinitionsContext = "";

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

    console.log(allDefinitions);
    const out = await Definer.respondQuestion(
      question,
      prunedDefinitionsContext
    );

    console.log(inputKeyMuWithoutHyphen);

    const directRemainPercentage =
      maxPromptChars / defitinionsDirectContext.length;
    const condensedRemainPercentage =
      maxPromptChars / definitionsCondensedContext.length;

    console.log(`STATS

Accepted aprox:
    Total chars: ${maxTotalChars} tokens ${maxTotalChars * openAITokenPerChar}
    Prompt chars: ${maxPromptChars} tokens ${
      maxPromptChars * openAITokenPerChar
    }

Original
    Nº of def : ${numOfDefWithContent}
    Condensed %: ${
      Math.round(
        (definitionsCondensedContext.length / defitinionsDirectContext.length) *
          100
      ) / 100
    }

    Avg direct def Chars: ${Math.round(
      defitinionsDirectContext.length / numOfDefWithContent
    )} Tokens: ${Math.round(
      (defitinionsDirectContext.length / numOfDefWithContent) *
        openAITokenPerChar
    )}
    Direct context Chars: ${defitinionsDirectContext.length}  Tokens: ${
      defitinionsDirectContext.length * openAITokenPerChar
    }

    Avg condensed def chars: ${Math.round(
      definitionsCondensedContext.length / numOfDefWithContent
    )} tokens ${Math.round(
      (definitionsCondensedContext.length / numOfDefWithContent) *
        openAITokenPerChar
    )}
    Condensed context Chars: ${definitionsCondensedContext.length}  Tokens: ${
      definitionsCondensedContext.length * openAITokenPerChar
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

    Condensed % remained: ${Math.round(condensedRemainPercentage * 100) / 100}
    Nº of condensed def. : ${
      Math.round(numOfDefWithContent * condensedRemainPercentage * 100) / 100
    }
    Condensed context chars: ${Math.round(
      definitionsCondensedContext.length * condensedRemainPercentage
    )}  tokens: ${Math.round(
      definitionsCondensedContext.length *
        condensedRemainPercentage *
        openAITokenPerChar
    )}



`);

    //Translate back into format X
    //const usedDocsNameIidMap = getDocsNameIidList(edContextDocs);

    //const ipt = await textToIptFromList(out, sortedNameIId);
    //console.log(ipt);

    // const foamText = textToFoamText(out);
    // console.log(foamText);
    */
  }
}
