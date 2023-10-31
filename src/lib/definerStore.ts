import ConfigController from "./configController";
import Definer from "./definer";
import DirectSearch from "./directSearch";
import { buildContextPromptFromDocs } from "./llm";
import Referencer from "./referencer";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";
import Utils from "./utils";
import * as fs from "fs";

export interface Definition {
  //evrything is with hyphen
  name: string;
  nameWithHyphen: string;
  iid: string;
  directIntensions: string[];
  backlinkIntensions: string[];
  keyConceptsScores: KeyValuePair[];
  condensedDirectIntensions: string;
  backLinkScore: number;
  lastLlmCall: number;
}

export interface KeyValuePair {
  k: string;
  v: number;
}

export default class DefinerStore {
  static hoursToMilis = 3600000;
  static defaultLlmUpdatePeriod: number = 15 * 24 * DefinerStore.hoursToMilis; //miliseconds in a day
  static definitions: Map<string, Definition> = new Map();

  static save = async (): Promise<void> => {
    let storedDefinitions: Definition[] = [];

    DefinerStore.definitions.forEach((d) => {
      storedDefinitions.push(d);
    });

    console.log("Save");

    const j = JSON.stringify(storedDefinitions, null, 2);
    console.log(j);
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
      name: name,
      nameWithHyphen: nameWithHyphen,
      iid: iid,
      directIntensions: [],
      backlinkIntensions: [],
      keyConceptsScores: [],
      condensedDirectIntensions: "",
      backLinkScore: 0,
      lastLlmCall: 0,
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
    needsCondensedDirect: boolean
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
        else if (docs.length == 1) console.log("🟡 " + nameWithHyphen);
        else {
          console.log("🟢  " + nameWithHyphen);
          d = DefinerStore.definitions.get(nameWithHyphen)!;
          d.directIntensions = Definer.docsToIntensions(docs);
          DefinerStore.definitions.set(nameWithHyphen, d);
        }
      }
    }

    if (needsBacklink) {
      if (d.backlinkIntensions.length == 0) {
      }
    }

    d = DefinerStore.definitions.get(nameWithHyphen)!;
    // dependes on
    if (needsKeyConcepts) {
      if (Date.now() - d.lastLlmCall > DefinerStore.defaultLlmUpdatePeriod) {
        const keyWordsScores = await Definer.getDefinitionScoredConcepts(
          d.nameWithHyphen,
          Definer.intensionsToText(d.directIntensions)
        );

        d = DefinerStore.definitions.get(nameWithHyphen)!;
        keyWordsScores.forEach((wordWithScore) => {
          if (Referencer.nameWithHyphenToFoamId.has(wordWithScore.k)) {
            d.keyConceptsScores.push(wordWithScore);
          }
        });
        d.lastLlmCall = Date.now();
        DefinerStore.definitions.set(nameWithHyphen, d);
      } else {
        console.log(
          "Not updating " +
            nameWithHyphen +
            " Key Concepts because it was updated only " +
            (Date.now() - d.lastLlmCall) / DefinerStore.hoursToMilis +
            " hours ago"
        );
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
}
