import { LLM } from "langchain/dist/llms/base";
import ConfigController from "./configController";
import Definer from "./definer";
import DirectSearch from "./directSearch";
import Referencer from "./referencer";
import Tokenizer from "./tokenizer";
import Utils from "./utils";
import * as fs from "fs";
import {
    GPT4,
  SEARCH_ORIGIN_BACKLINK,
  buildContextPromptFromDocs,
  callLlm2,
  filterDocsByMaxLength,
  getContextDocsForConcept,
} from "./llm";
import { ChainValues } from "langchain/dist/schema";

export interface Definition {
  //evrything is with hyphen
  name: string;
  nameWithHyphen: string;
  iid: string;
  directIntensions: string[];
  usageClauses: string[];
  compiledDefinition: string;
  lastCompiledRequest: number;
  keyConceptsScores: KeyValuePair[];
  lastKeyConceptsRequest: number;
  backLinkScore: number;
}

export interface KeyValuePair {
  k: string;
  v: number;
}

export default class DefinerStore {
  static hoursToMilis = 3600000;
  static defaultLlmUpdatePeriod: number = 4 * 24 * DefinerStore.hoursToMilis; //miliseconds in a day
  static definitions: Map<string, Definition> = new Map();

  static save = async (): Promise<void> => {
    let storedDefinitions: Definition[] = [];

    DefinerStore.definitions.forEach((d) => {
      storedDefinitions.push(d);
    });

    const j = JSON.stringify(storedDefinitions, null, 2);
    Utils.saveFile(
      j,
      ConfigController._configFile.resources.compiledDefinitions
    );
  };

  static load = async (): Promise<void> => {
    const path = Utils.resolveHome(
      ConfigController._configFile.resources.compiledDefinitions
    );
    let data = "";
    if (fs.existsSync(path)) {
      data = fs.readFileSync(path, "utf8");
    } else {
      console.log(" No compiled definitions on: " + path);
      return;
    }

    const storedDefinitions: Definition[] = JSON.parse(data);
    if (storedDefinitions.length == 0) {
      console.log("Could not read compiled definitions despite being found.");
      return;
    }
    console.log("Found " + storedDefinitions.length + " stored definitions");

    //reset backlink score
    for (let d of storedDefinitions) {
      d.backLinkScore = 0;
      DefinerStore.definitions.set(d.nameWithHyphen, d);
    }
  };

  static initDefinition = async (
    nameWithHyphen: string
  ): Promise<Definition | undefined> => {
    const name = Utils.renameFromHyphen(nameWithHyphen);

    const iid = await DirectSearch.getIidByName(name);

    if (iid == "") {
      return undefined;
    }
    //console.log("INIT " + nameWithHyphen);

    const definition: Definition = {
      nameWithHyphen: nameWithHyphen,
      iid: iid,
      name: name,
      directIntensions: [],
      usageClauses: [],
      compiledDefinition: "",
      lastCompiledRequest: 0,
      keyConceptsScores: [],
      backLinkScore: 0,
      lastKeyConceptsRequest: 0,
    };
    return definition;
  };

  static addBackLinkScore = async (
    nameWithHyphen: string,
    score: number
  ): Promise<void> => {
    //    console.log("Start backlink: " + nameWithHyphen);
    const d = await DefinerStore.getDefinition(
      nameWithHyphen,
      false,
      false,
      false,
      false
    );

    if (!d) return;

    d!.backLinkScore = d!.backLinkScore + score;
    DefinerStore.definitions.set(d!.nameWithHyphen, d!);

    // console.log("SET backlink: " + nameWithHyphen);
  };

  static getDefinition = async (
    nameWithHyphen: string,
    needsDirect: boolean,
    needsBacklink: boolean,
    needsKeyConcepts: boolean,
    needsCompiled: boolean
  ): Promise<Definition | undefined> => {
    //We return it from store if exists

    let d: Definition;
    if (DefinerStore.definitions.has(nameWithHyphen)) {
      d = DefinerStore.definitions.get(nameWithHyphen)!;
    } else {
      // console.log(     "NEW " + nameWithHyphen + " " + DefinerStore.definitions.size  );

      const du = await DefinerStore.initDefinition(nameWithHyphen);

      if (!du) {
        console.log("couldn't find" + nameWithHyphen);
        return undefined;
      } else {
        d = du;
        DefinerStore.definitions.set(nameWithHyphen, d);
      }
    }

    //After here definitions.has(X) is always true

    //always gets the last one
    if (needsDirect) {
      d = DefinerStore.definitions.get(nameWithHyphen)!;
      if (d.directIntensions.length == 0) {
        const docs = await DirectSearch.getAllDocsOfIid(d.iid, true);
        if (docs.length == 0) console.log("🔴 " + nameWithHyphen);

        if (docs[0].pageContent == "") {
          console.log("🟡 " + nameWithHyphen);
        } else {
          console.log("🟢  " + nameWithHyphen);
          d = DefinerStore.definitions.get(nameWithHyphen)!;
          d.directIntensions = Definer.docsToIntensions(docs);
          DefinerStore.definitions.set(nameWithHyphen, d);
        }
      }
    }

    if (needsBacklink) {
      if (d.usageClauses.length == 0) {
      }
    }

    d = DefinerStore.definitions.get(nameWithHyphen)!;
    // dependes on
    if (needsKeyConcepts) {
      if (
        Date.now() - d.lastKeyConceptsRequest >
        DefinerStore.defaultLlmUpdatePeriod
      ) {
        const dependencies =
          await DirectSearch.getAllNamesWithHyphenDependencies(nameWithHyphen);

        const keyWordsScores = await Definer.getDefinitionScoredConcepts(
          d.nameWithHyphen,
          Definer.intensionsToText(d.directIntensions),
          dependencies
        );

        d = DefinerStore.definitions.get(nameWithHyphen)!;
        d.keyConceptsScores = []; //resets stored ones

        keyWordsScores.forEach((wordWithScore) => {
          if (Referencer.nameWithHyphenToFoamId.has(wordWithScore.k)) {
            d.keyConceptsScores.push(wordWithScore);
            console.log(wordWithScore);
          }
        });
        d.keyConceptsScores.sort((a, b) => b.v - a.v);
        d.lastKeyConceptsRequest = Date.now();
        DefinerStore.definitions.set(nameWithHyphen, d);
      } else {
        console.log(
          "Not updating " +
            nameWithHyphen +
            " Key Concepts because it was updated only " +
            (Date.now() - d.lastKeyConceptsRequest) /
              DefinerStore.hoursToMilis +
            " hours ago"
        );
      }
    }

    d = DefinerStore.definitions.get(nameWithHyphen)!;
    if (needsCompiled) {
      if (
        //true ||
        Date.now() - d.lastCompiledRequest >
        DefinerStore.defaultLlmUpdatePeriod
      ) {
        const cd = await DefinerStore.getDefinitionSupportContext(
          nameWithHyphen
        );
        d = DefinerStore.definitions.get(nameWithHyphen)!;
        d.lastCompiledRequest = Date.now();
        d.compiledDefinition = cd;
        DefinerStore.definitions.set(nameWithHyphen, d);
      }
    }

    //Ads backlinkls after the definition is set.

    if (needsKeyConcepts) {
      for (let w of d.keyConceptsScores) {
        await DefinerStore.addBackLinkScore(w.k, w.v);
      }
    }
    return d;

    //directIntensions
  };

  static getDefinitionSupportContext = async (
    nameWithHyphen: string
  ): Promise<string> => {
    let rootDefinition = await DefinerStore.getDefinition(
      nameWithHyphen,
      true,
      false,
      true,
      false
    );

    if (!rootDefinition) {
      console.log("No definition for " + nameWithHyphen);
      return "";
    }

    //Get list of key concepts
    //Filter only the ones with high score.
    let keyConcepts: string[] = [];
    for (let ks of rootDefinition!.keyConceptsScores) {
      if (ks.v > 0.7) keyConcepts.push(ks.k);
    }

    //filter key concepts

    //Get KeyConcepts definitions
    const secondLayerProcessing = keyConcepts.map(
      async (conceptWithHyphen: string): Promise<Definition | undefined> => {
        return await DefinerStore.getDefinition(
          conceptWithHyphen,
          true,
          false,
          false,
          false
        );
      }
    );

    let keyConceptsSynthesis: Definition[] = [];
    await Promise.all(secondLayerProcessing).then((definitions) => {
      for (let d of definitions) {
        if (d) keyConceptsSynthesis.push(d);
      }
    });

    //Remove hyphens
    const term = nameWithHyphen; //nameWithHyphen.replaceAll(Tokenizer.hyphenToken, " ");

    // Get root definition
    const termIntensions = DefinerStore.directDefinitionsToText([
      rootDefinition,
    ]); //.replaceAll(Tokenizer.hyphenToken, " ");
    const keyConceptstextDefinitions =
      DefinerStore.directDefinitionsToText(keyConceptsSynthesis); //.replaceAll(Tokenizer.hyphenToken, " ");

    //Terms usage context
    /*
    THIS SHOULD BE A DIFFERENT CALL
    - direct intension
    - usage intensions
    - key concepts syntesis
    */
    let termUsageContext = "<No usage examples>";
    /*
    let termUsageDocs = await getContextDocsForConcept(
      term,
      [SEARCH_ORIGIN_BACKLINK] //searchOrigins
    );

    termUsageDocs = filterDocsByMaxLength(termUsageDocs, 300);

    if (termUsageDocs.length != 0) {
      termUsageContext = buildContextPromptFromDocs(termUsageDocs);
    }
    console.log("TERM USAGE CONTEXT");
    console.log(termUsageContext.length);
    console.log(termUsageContext);
    */

    // Get final call

    const inputVariables: ChainValues = {
        term: term,
        termDefiningIntensions: termIntensions,
        termUsageContext: termUsageContext,
        termKeyConceptsDefinitions: keyConceptstextDefinitions,
      };


    let out = await callLlm2(GPT4,Definer.compiledFriendlyRequest, inputVariables);
    return out;

  };

  static directDefinitionsToText(definitions: Definition[]): string {
    let definitionsText = "";
    definitions.forEach((d) => {
      if (d.directIntensions.length == 0) {
        return;
      }
      const defitinionText = Definer.intensionsToText(d.directIntensions);
      definitionsText =
        definitionsText + "\n" + d.nameWithHyphen + ":\n" + defitinionText;
    });
    //NEEDS PRUNING
    return definitionsText;
  }

  static filterKeyConceptByScore(
    keyConcepts: KeyValuePair[],
    minScore: number
  ) {
    function keyConceptsFitler(keyConcept: KeyValuePair): boolean {
      if (keyConcept.v >= minScore) return true;
      return false;
    }

    return keyConcepts.filter(keyConceptsFitler);
  }
}
