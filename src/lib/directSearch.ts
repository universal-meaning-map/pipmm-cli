import { CharacterTextSplitter } from "langchain/text_splitter";
import Publisher from "./publisher";
import Referencer from "./referencer";
import Utils from "./utils";
import { Document } from "langchain/document";
import {
  SEARCH_ORIGIN_BACKLINK,
  SEARCH_ORIGIN_DIRECT,
  getConfidenceScore,
  sortDocsByConfidence,
} from "./llm";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";
import ConfigController from "./configController";
import Filter from "./filterController";

export default class DirectSearch {
  static getViewByFoamId = async (foamId: string): Promise<string> => {
    let iid = await Referencer.makeIid(foamId);

    let config = {
      // property: "xavi-YAxr3c/prop-name-1612697362",
      property: "xavi-YAxr3c/prop-view-1612698885",
      exportTemplateId: "txt",
    };

    let out = await Publisher.makePublishRun(iid, config);
    console.log(out);

    return out;
  };

  static getIidByName = async (text: string): Promise<string> => {
    let notes = Referencer.iidToNoteWrap;
    let propNameIId = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);

    for (let [iid, note] of notes.entries()) {
      if (note.block.has(propNameIId)) {
        let name = note.block.get(propNameIId);
        //exact name
        //console.log(name + " - " + text);
        if (name == text) {
          return note.iid;
        }
        //TODO: semantic search over name and synonims.
      }
    }
    return "";
    /*
    //semantically similar
    let res = await SemanticSearch.search(text);
    console.log(res);
    console.log(res[0].metadata.name);
    if (res[0].metadata.confidence > 0.7) return res[0].metadata.iid;
    return "";
    */
  };

  static getLongLengthPenalty(corpus: string): number {
    const score = Math.min(
      Math.max(Utils.mapRange(corpus.length, 0, 600, 1, 0.65), 0.65),
      1
    );
    return score;
  }

  static getBacklinkDocs = async (
    backLinkIid: string,
    namesWithHyphen: boolean,
    includeBackLinks: boolean
  ): Promise<Document<Record<string, any>>[]> => {
    let config = {
      // property: "xavi-YAxr3c/prop-name-1612697362",
      property: "xavi-YAxr3c/prop-view-1612698885",
      exportTemplateId: "txt",
    };

    let repo = Referencer.iidToNoteWrap;

    let jsonFilter = Utils.getFile(ConfigController.botFilterPath);
    let filter = JSON.parse(jsonFilter);
    repo = await Filter.filter(repo, filter);

    if (namesWithHyphen) {
      repo = await SemanticSearch.getRepoWithHyphenNames(repo);
    }

    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1,
      chunkOverlap: 0,
      separator: Referencer.selfDescribingSemanticUntiSeparator,
    });

    let docs: Document<Record<string, any>>[] = [];
    let propViewIId = await Referencer.makeIid(Referencer.PROP_VIEW_FOAMID);
    let propNameIId = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);
    let propPirIId = await Referencer.makeIid(Referencer.PROP_PIR_FOAMID);

    for (let [iid, note] of repo.entries()) {
      if (note.block.has(propViewIId)) {
        let view = note.block.get(propViewIId).join(); //We make a string of the Interplanetary text

        const notInterested =
          includeBackLinks == false && backLinkIid != note.iid;

        if (view.includes(backLinkIid)) {
          if (notInterested) continue;

          console.log("has iid: " + note.block.get(propNameIId));
          const chunks = await textSplitter.splitText(view);
          let indexesWithIid = [];
          //search chunks in IPT

          for (let idx = 0; idx < chunks.length; idx++) {
            if (chunks[idx].includes(backLinkIid)) {
              console.log("FOUND");
              console.log(idx);
              indexesWithIid.push(idx);
            }
          }
          //get the same chunks in the compiled text
          let compiled = await Publisher.makePublishRun(note.iid, config);
          const compiledChunks = await textSplitter.splitText(compiled);

          for (let i = 0; i < indexesWithIid.length; i++) {
            let chunk = compiledChunks[indexesWithIid[i]];
            // let doc :  Document<Record<string, DocumentMetadata>> = {
            let relevance = backLinkIid == note.iid ? 1 : 0.7; //penalty is high as semantic search will compensate for it.

            let doc: Document<Record<string, any>> = {
              pageContent: chunk,
              metadata: {
                iid: note.iid,
                name: note.block.get(propNameIId),
                pir: note.block.get(propPirIId),
                pentalty: DirectSearch.getLongLengthPenalty(chunk),
                relevance: relevance,
                searchOrigin:
                  backLinkIid == note.iid
                    ? SEARCH_ORIGIN_DIRECT
                    : SEARCH_ORIGIN_BACKLINK,
                confidence: getConfidenceScore(
                  relevance * DirectSearch.getLongLengthPenalty(chunk),
                  note.block.get(propPirIId)
                ),
              },
            };
            // console.log(doc);
            docs.push(doc);
          }
        }
      }
    }

    docs = sortDocsByConfidence(docs);

    return docs;
  };

  static getAllDocsOfIid = async (
    iid: string,
    namesWithHyphen: boolean
  ): Promise<Document<Record<string, any>>[]> => {
    let config = {
      // property: "xavi-YAxr3c/prop-name-1612697362",
      property: "xavi-YAxr3c/prop-view-1612698885",
      exportTemplateId: "txt",
    };

    let repo = Referencer.iidToNoteWrap;
    let propViewIId = await Referencer.makeIid(Referencer.PROP_VIEW_FOAMID);
    let propNameIId = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);
    let propPirIId = await Referencer.makeIid(Referencer.PROP_PIR_FOAMID);
    let docs: Document<Record<string, any>>[] = [];

    const note = repo.get(iid);

    if (!note) return docs;

    if (namesWithHyphen) {
      repo = await SemanticSearch.getRepoWithHyphenNames(repo);
    }

    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1,
      chunkOverlap: 0,
      separator: Referencer.selfDescribingSemanticUntiSeparator,
    });

    const compiled = await Publisher.makePublishRun(iid, config);
    const compiledChunks = await textSplitter.splitText(compiled);

    for (let i = 0; i < compiledChunks.length; i++) {
      let chunk = compiledChunks[i];

      let doc: Document<Record<string, any>> = {
        pageContent: chunk,
        metadata: {
          iid: note.iid,
          name: note.block.get(propNameIId),
          pir: note.block.get(propPirIId),
          pentalty: DirectSearch.getLongLengthPenalty(chunk),
          relevance: 1,
          searchOrigin: "direct",
          confidence: getConfidenceScore(
            1 * DirectSearch.getLongLengthPenalty(chunk),
            note.block.get(propPirIId)
          ),
        },
      };
      // console.log(doc);
      docs.push(doc);
    }
    return docs;
  };
}
