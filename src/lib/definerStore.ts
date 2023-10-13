import Definer from "./definer";
import DirectSearch from "./directSearch";
import { buildContextPromptFromDocs } from "./llm";
import Referencer from "./referencer";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";

export interface Definition {
  //evrything is with hyphen
  name: string;
  nameWithHyphen: string;
  iid: string;
  directIntensions: string[];
  backlinkIntensions: string[];
  keyConcepts: string[];
  condensedDirectIntensions: string;
  backLinks: number;
}

export default class DefinerStore {
  static definitions: Map<string, Definition> = new Map();

  static initDefinition = async (
    nameWithHyphen: string
  ): Promise<Definition | undefined> => {
    const name = nameWithHyphen.split(Tokenizer.hyphenToken).join(" ");

    const iid = await DirectSearch.getIidByName(name);

    if (iid == "") {
      return undefined;
    }

    const definition: Definition = {
      name: name,
      nameWithHyphen: nameWithHyphen,
      iid: iid,
      directIntensions: [],
      backlinkIntensions: [],
      keyConcepts: [],
      condensedDirectIntensions: "",
      backLinks: 0,
    };
    return definition;
  };

  static addBackLink = async (nameWithHyphen: string): Promise<void> => {
    const d = await DefinerStore.getDefinition(
      nameWithHyphen,
      false,
      false,
      false,
      false
    );

    if (!d) {
      console.log(
        nameWithHyphen + ".  Can't be added to backlink bc doesn't exist"
      );

      return;
    }

    d!.backLinks = d!.backLinks + 1;
    console.log(nameWithHyphen + " - " + d!.backLinks);
    DefinerStore.definitions.set(d!.nameWithHyphen, d!);
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
      const du = await DefinerStore.initDefinition(nameWithHyphen);

      if (!du) {
        console.log("FAIl");
        console.log(nameWithHyphen);
        return undefined;
      } else {
        d = du;
        console.log("GO");
        console.log(nameWithHyphen);
      }
    }

    if (needsDirect) {
      if (d.directIntensions.length == 0) {
        const docs = await DirectSearch.getAllDocsOfIid(d.iid, true);
        if (docs.length == 0) console.log("🔴 " + nameWithHyphen);
        else if (docs.length == 1) console.log("🟡 " + nameWithHyphen);
        else {
          console.log("🟢  " + nameWithHyphen);
          d.directIntensions = Definer.docsToIntensions(docs);
        }
      }
    }

    if (needsBacklink) {
      if (d.backlinkIntensions.length == 0) {
      }
    }

    if (needsKeyConcepts) {
      if (d.keyConcepts.length == 0) {
        const keyConcepts = await Definer.getKeyConcepts(
          d.nameWithHyphen,
          Definer.intensionsToText(d.directIntensions)
        );

        keyConcepts.forEach((c) => {
          if (Referencer.nameWithHyphenToFoamId.has(c)) {
            d.keyConcepts.push(c);
          }
        });
      }
    }

    if (needsCondensedDirect) {
      if (d.directIntensions.length > 1)
        d.condensedDirectIntensions =
          await Definer.getCondensedDirectIntensions(d.nameWithHyphen);
      console.log("\n\n");

      console.log(d.name + "(direct)");
      console.log(d.directIntensions);
      console.log(d.name + "(condensed)");
      console.log(d.condensedDirectIntensions);
    }
    DefinerStore.definitions.set(nameWithHyphen, d);
    console.log("CREATING: " + nameWithHyphen);

    //Ads backlinkls after the definition is set.
    if (needsKeyConcepts) {
      d.keyConcepts.forEach((c) => {
        DefinerStore.addBackLink(c);
      });
    }
    return d;

    //directIntensions
  };
}
