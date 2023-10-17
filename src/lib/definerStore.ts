import Definer from "./definer";
import DirectSearch from "./directSearch";
import { buildContextPromptFromDocs } from "./llm";
import Referencer from "./referencer";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";
import Utils from "./utils";

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
}

export interface KeyValuePair {
  k: string;
  v: number;
}

export default class DefinerStore {
  static definitions: Map<string, Definition> = new Map();

  static initDefinition = async (
    nameWithHyphen: string
  ): Promise<Definition | undefined> => {
    const name = Utils.renameFromHyphen(nameWithHyphen);

    const iid = await DirectSearch.getIidByName(name);

    if (iid == "") {
      return undefined;
    }
    console.log("INIT " + nameWithHyphen);

    const definition: Definition = {
      name: name,
      nameWithHyphen: nameWithHyphen,
      iid: iid,
      directIntensions: [],
      backlinkIntensions: [],
      keyConceptsScores: [],
      condensedDirectIntensions: "",
      backLinkScore: 0,
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

    console.log("SET backlink: " + nameWithHyphen);
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
      console.log(
        "NEW " + nameWithHyphen + " " + DefinerStore.definitions.size
      );

      const du = await DefinerStore.initDefinition(nameWithHyphen);

      if (!du) {
        return undefined;
      } else {
        d = du;
        DefinerStore.definitions.set(nameWithHyphen, d);
      }
    }

    //After here definitions.has(X) is always true

    if (needsDirect) {
      if (
        DefinerStore.definitions.get(nameWithHyphen)!.directIntensions.length ==
        0
      ) {
        const docs = await DirectSearch.getAllDocsOfIid(d.iid, true);
        if (docs.length == 0) console.log("🔴 " + nameWithHyphen);
        else if (docs.length == 1) console.log("🟡 " + nameWithHyphen);
        else {
          console.log("🟢  " + nameWithHyphen);
          let d = DefinerStore.definitions.get(nameWithHyphen)!;
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
    if (needsKeyConcepts) {
      if (d.keyConceptsScores.length == 0) {
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
}
