import { CharacterTextSplitter } from "langchain/text_splitter";
import Publisher from "./publisher";
import Referencer from "./referencer";
import Utils from "./utils";
import { Document } from "langchain/document";
import DocsUtils from "./docsUtils";

import {
  SEARCH_ORIGIN_BACKLINK,
  SEARCH_ORIGIN_DIRECT,
  getConfidenceScore,
} from "./llm";
import ConfigController from "./configController";
import Filter from "./filterController";

export default class DirectSearch {
  static getIidByName = async (name: string): Promise<string> => {
    let notes = Referencer.iidToNoteWrap;

    const PROP_NAME_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_NAME_FILENAME
    );

    for (let [iid, note] of notes.entries()) {
      if (note.block.has(PROP_NAME_IID)) {
        let nameInNote = note.block.get(PROP_NAME_IID);
        //exact name
        if (name.toLowerCase() == nameInNote.toLocaleLowerCase()) {
          return note.iid;
        }
        //TODO: semantic search over name and synonims.
      }
    }
    return "";
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
      property: Referencer.PROP_VIEW_FILENAME,
      exportTemplateId: "txt",
    };

    let repo = Referencer.iidToNoteWrap;

    let jsonFilter = Utils.getFile(ConfigController.botFilterPath);
    let filter = JSON.parse(jsonFilter);
    repo = await Filter.filter(repo, filter);

    if (namesWithHyphen) {
      repo = await Referencer.getRepoWithHyphenNames();
    }

    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1,
      chunkOverlap: 0,
      separator: Referencer.selfDescribingSemanticUntiSeparator,
    });

    let docs: Document<Record<string, any>>[] = [];

    const PROP_NAME_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_NAME_FILENAME
    );

    const PROP_VIEW_IDD = await Referencer.getTypeIdByFileName(
      Referencer.PROP_VIEW_FILENAME
    );

    const PROP_PIR_IDD = await Referencer.getTypeIdByFileName(
      Referencer.PROP_PIR_FILENAME
    );

    for (let [iid, note] of repo.entries()) {
      if (note.block.has(PROP_VIEW_IDD)) {
        let view = note.block.get(PROP_VIEW_IDD).join(); //We make a string of the Interplanetary text

        const notInterested =
          includeBackLinks == false && backLinkIid != note.iid;

        if (view.includes(backLinkIid)) {
          if (notInterested) continue;

          const chunks = await textSplitter.splitText(view);
          let indexesWithIid = [];
          //search chunks in IPT

          for (let idx = 0; idx < chunks.length; idx++) {
            if (chunks[idx].includes(backLinkIid)) {
              indexesWithIid.push(idx);
            }
          }
          //get the same chunks in the compiled text
          let compiled = await Publisher.makePublishRun(
            note.iid,
            config,
            namesWithHyphen
          );
          const compiledChunks = await textSplitter.splitText(compiled);

          for (let i = 0; i < indexesWithIid.length; i++) {
            let chunk = compiledChunks[indexesWithIid[i]];
            // let doc :  Document<Record<string, DocumentMetadata>> = {
            let relevance = backLinkIid == note.iid ? 1 : 0.7; //penalty is high as semantic search will compensate for it.

            let doc: Document<Record<string, any>> = {
              pageContent: chunk,
              metadata: {
                iid: note.iid,
                name: note.block.get(PROP_NAME_IID),
                pir: note.block.get(PROP_PIR_IDD),
                pentalty: DirectSearch.getLongLengthPenalty(chunk),
                relevance: relevance,
                searchOrigin:
                  backLinkIid == note.iid
                    ? SEARCH_ORIGIN_DIRECT
                    : SEARCH_ORIGIN_BACKLINK,
                confidence: getConfidenceScore(
                  relevance * DirectSearch.getLongLengthPenalty(chunk),
                  note.block.get(PROP_PIR_IDD)
                ),
              },
            };
            // console.log(doc);
            docs.push(doc);
          }
        }
      }
    }

    docs = DocsUtils.sortDocsByConfidence(docs);

    return docs;
  };

  static getAllDocsOfIid = async (
    iid: string,
    namesWithHyphen: boolean
  ): Promise<Document<Record<string, any>>[]> => {
    let config = {
      // property: "xavi-YAxr3c/prop-name-1612697362",
      property: Referencer.PROP_VIEW_FILENAME,
      exportTemplateId: "txt",
    };

    let repo = Referencer.iidToNoteWrap;

    const PROP_NAME_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_NAME_FILENAME
    );
    const PROP_VIEW_IDD = await Referencer.getTypeIdByFileName(
      Referencer.PROP_VIEW_FILENAME
    );

    const PROP_PIR_IDD = await Referencer.getTypeIdByFileName(
      Referencer.PROP_PIR_FILENAME
    );

    let docs: Document<Record<string, any>>[] = [];

    const note = repo.get(iid);

    if (!note) return docs;
    if (!note.block.has(PROP_VIEW_IDD)) {
      let emptyDoc: Document<Record<string, any>> = {
        pageContent: "",
        metadata: {},
      };
      return [emptyDoc];
    } else {
      if (note.block.get(PROP_VIEW_IDD) == "") {
        console.log("EMPPTY view for " + iid);
        return [];
      }
    }

    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1,
      chunkOverlap: 0,
      separator: Referencer.selfDescribingSemanticUntiSeparator,
    });

    const compiled = await Publisher.makePublishRun(
      iid,
      config,
      namesWithHyphen
    );
    const compiledChunks = await textSplitter.splitText(compiled);

    for (let i = 0; i < compiledChunks.length; i++) {
      let chunk = compiledChunks[i];

      let doc: Document<Record<string, any>> = {
        pageContent: chunk,
        metadata: {
          iid: note.iid,
          name: note.block.get(PROP_NAME_IID),
          pir: note.block.get(PROP_PIR_IDD),
          pentalty: DirectSearch.getLongLengthPenalty(chunk),
          relevance: 1,
          searchOrigin: "direct",
          confidence: getConfidenceScore(
            1 * DirectSearch.getLongLengthPenalty(chunk),
            note.block.get(PROP_PIR_IDD)
          ),
        },
      };
      // console.log(doc);
      docs.push(doc);
    }
    return docs;
  };

  static getAllNamesWithHyphenDependencies = async (
    nameWithHyphen: string,
    propertyFileName: string
  ): Promise<string[]> => {
    const iid = await DirectSearch.getIidByName(
      Utils.renameFromHyphen(nameWithHyphen)
    );

    const iidDependencies = await DirectSearch.getAllIidsDependencies(
      iid,
      propertyFileName
    );
    const repoWithHyphen = await Referencer.getRepoWithHyphenNames();

    const PROP_NAME_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_NAME_FILENAME
    );

    let nameWithHyphenDependencies = iidDependencies.map((iid) => {
      const note = repoWithHyphen.get(iid);
      if (note && note.block && note.block.has(PROP_NAME_IID)) {
        return note.block.get(PROP_NAME_IID);
      }
    });
    //console.log(nameWithHyphenDependencies);
    return nameWithHyphenDependencies;
  };

  static getAllIidsDependencies = async (
    iid: string,
    propertyFileName: string
  ): Promise<string[]> => {
    let dependencyIids: string[] = [];
    const repoWithHyphen = await Referencer.getRepoWithHyphenNames();
    const note = repoWithHyphen.get(iid);

    const PROP_NAME_IID = await Referencer.getTypeIdByFileName(
      Referencer.PROP_NAME_FILENAME
    );

    const propertyIid = await Referencer.getTypeIdByFileName(propertyFileName);

    if (note && note.block && note.block.has(propertyIid)) {
      const viewIPT = note.block.get(propertyIid);

      for (let run of viewIPT) {
        if (run[0] == "[") {
          let expr = JSON.parse(run);
          if (expr.length == 1) {
            const depIid = expr[0].split("/")[0];

            if (depIid && depIid != iid) dependencyIids.push(depIid);
          }
        }
      }
    } else {
    }
    const noDuplicates = [...new Set(dependencyIids)];

    return noDuplicates;
  };
}
