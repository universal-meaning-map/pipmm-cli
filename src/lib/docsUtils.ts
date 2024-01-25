import { Document } from "langchain/document";
import DirectSearch from "./directSearch";
import SemanticSearch from "./semanticSearch";
import Referencer from "./referencer";
import Tokenizer from "./tokenizer";

export default class DocsUtils {
  static docsToIntensions(docs: Document<Record<string, any>>[]): string[] {
    let intensions: string[] = [];

    docs.forEach((r) => {
      intensions.push(r.pageContent);
    });

    return intensions;
  }

  static async getContextDocsForConcept(
    concept: string,
    searchOrigins: string[] //direct, backlink, semantic
  ): Promise<Document<Record<string, any>>[]> {
    let conceptDocs: Document<Record<string, any>>[] = [];
    const namesWithHyphen = true;
    const includeDirectBacklinks = true;

    /*
    const muIidWithSameName = await DirectSearch.getIidByName(concept);
    console.log(muIidWithSameName, concept);
    // console.log("IID match: " + muIidWithSameName);

    if (muIidWithSameName) {
      console.log("Getting back link docs for " + concept);
      let docs = await DirectSearch.getBacklinkDocs(
        muIidWithSameName,
        namesWithHyphen,
        includeDirectBacklinks
      );
      conceptDocs.push(...docs);
    } else {
      //  console.log("No MU with exact name for: " + concept);
    }
*/
    conceptDocs.push(
      ...(await SemanticSearch.search(
        concept,
        Referencer.PROP_VIEW_FILENAME,
        namesWithHyphen
      ))
    );

    // Todo: Eliminate  duplicates and give them more confidence
    //conceptDocs = sortDocsByConfidence(conceptDocs);
    conceptDocs = DocsUtils.filterBySearchOrigin(conceptDocs, searchOrigins);
    //conceptDocs = filterDocsByConfindence(conceptDocs, minConfindence);
    //conceptDocs = pruneDocsForTokens(conceptDocs, maxTokens);
    //console.log(conceptDocs);
    return conceptDocs;
  }

  static getDocsNameIidList(
    docs: Document<Record<string, any>>[]
  ): Map<string, string> {
    const nameToIid = new Map<string, string>();
    docs.forEach((doc) => {
      if (!nameToIid.has(doc.metadata.name)) {
        nameToIid.set(doc.metadata.name, doc.metadata.iid);
      }
    });
    return nameToIid;
  }

  static buildContextPromptFromDocs(
    contextDocs: Document<Record<string, any>>[]
  ): string {
    let context = "";

    contextDocs.forEach((r) => {
      const statement = {
        s: r.pageContent,
        r: Math.round(r.metadata.confidence * 100) / 100,
        a: r.metadata.pir,
      };
      //context = context + JSON.stringify(statement, null, 2);

      context =
        context +
        Tokenizer.beginingOfStatementToken +
        " " +
        r.pageContent +
        "\n";
    });

    return context;
  }

  static pruneDocsForTokens(
    docs: Document<Record<string, any>>[],
    maxTokens: number
  ) {
    const openAITokenPerChar = 0.25;
    let accumulatedChars = 0;
    for (let i = 0; i < docs.length; i++) {
      accumulatedChars += docs[i].pageContent.length;
      if (accumulatedChars * openAITokenPerChar >= maxTokens) {
        docs.splice(i - 1);
        return docs;
      }
    }
    return docs;
  }

  static sortDocsByConfidence(docs: Document<Record<string, any>>[]) {
    docs.sort(
      (docA, docB) => docB.metadata.confidence - docA.metadata.confidence
    );
    return docs;
  }

  static filterDocsByConfindence(
    docs: Document<Record<string, any>>[],
    minConfidence: number
  ) {
    function confidenceFilter(doc: Document<Record<string, any>>): boolean {
      if (doc.metadata.confidence > minConfidence) return true;
      return false;
    }

    return docs.filter(confidenceFilter);
  }

  static filterBySearchOrigin(
    docs: Document<Record<string, any>>[],
    searchOrigins: string[]
  ): Document<Record<string, any>>[] {
    return docs.filter((doc) =>
      searchOrigins.includes(doc.metadata.searchOrigin)
    );
  }

  static filterDocsByMaxLength(
    docs: Document<Record<string, any>>[],
    maxLength: number
  ): Document<Record<string, any>>[] {
    return docs.filter((doc) => {
      if (doc.pageContent.length < maxLength) {
        return doc;
      }
    });
  }

  static logDocsWithHigherConfidenceLast(
    docs: Document<Record<string, any>>[]
  ) {
    docs.sort(
      (docA, docB) => docA.metadata.confidence - docB.metadata.confidence
    );

    //console.log(docs);
  }
}
