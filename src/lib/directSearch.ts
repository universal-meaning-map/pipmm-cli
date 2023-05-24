import { CharacterTextSplitter } from "langchain/text_splitter";
import Publisher from "./publisher";
import Referencer from "./referencer";
import Utils from "./utils";
import { Document } from "langchain/document";
import { getConfidenceScore } from "./llm";
import SemanticSearch from "./semanticSearch";

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

  static assumeIid = async (text: string): Promise<string> => {
    let notes = Referencer.iidToNoteWrap;
    let propNameIId = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);
    let potentials = [];

    for (let [iid, note] of notes.entries()) {
      if (note.block.has(propNameIId)) {
        let name = note.block.get(propNameIId);
        //exact name
        if (name == text) {
          return note.iid;
        }
        //TODO: semantic search over name and synonims.
      }
    }

    let res = await SemanticSearch.search(text);
    console.log(res);
    console.log(res[0].metadata.name);
    if (res[0].metadata.confidence > 0.7) return res[0].metadata.iid;
    return "";
  };

  static getLongtLengthPenalty(corpus: string): number {
    const score = Utils.mapRange(corpus.length, 200, 450, 1, 0.7);
    return score;
  }

  static getBacklinkDocs = async (
    backLinkIid: string
  ): Promise<Document<Record<string, any>>[]> => {
    let config = {
      // property: "xavi-YAxr3c/prop-name-1612697362",
      property: "xavi-YAxr3c/prop-view-1612698885",
      exportTemplateId: "txt",
    };

    let notes = Referencer.iidToNoteWrap;

    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1,
      chunkOverlap: 0,
      separator: Referencer.selfDescribingSemanticUntiSeparator,
    });

    let docs: Document<Record<string, any>>[] = [];
    let propViewIId = await Referencer.makeIid(Referencer.PROP_VIEW_FOAMID);
    let propNameIId = await Referencer.makeIid(Referencer.PROP_NAME_FOAMID);
    let propPirIId = await Referencer.makeIid(Referencer.PROP_PIR_FOAMID);
    for (let [iid, note] of notes.entries()) {
      if (note.block.has(propViewIId)) {
        let view = note.block.get(propViewIId).join(); //We make a string of the Interplanetary text

        if (view.includes(backLinkIid)) {
          console.log("has iid: " + note.block.get(propNameIId));
          // const consoleLog= console.log;
          // console.log = ()=>{};
          const chunks = await textSplitter.splitText(view);
          // console.log = consoleLog;
          let indexesWithIid = [];
          //search chunks in IPT
          for (let idx = 0; idx < chunks.length; idx++) {
            if (chunks[idx].includes(backLinkIid)) {
              indexesWithIid.push(idx);
            }
          }

          //get the same chunks in the compiled text
          let compiled = await Publisher.makePublishRun(note.iid, config);
          const compiledChunks = await textSplitter.splitText(compiled);
          let texts = [];

          for (let i = 0; i < indexesWithIid.length; i++) {
            let chunk = compiledChunks[indexesWithIid[i]];
            // let doc :  Document<Record<string, DocumentMetadata>> = {
            let relevance = backLinkIid == note.iid ? 1 : 0.8;

            let doc: Document<Record<string, any>> = {
              pageContent: chunk,
              metadata: {
                iid: note.iid,
                name: note.block.get(propNameIId),
                pir: note.block.get(propPirIId),
                pentalty: DirectSearch.getLongtLengthPenalty(chunk),
                confidence: getConfidenceScore(
                  relevance * DirectSearch.getLongtLengthPenalty(chunk),
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
    docs.sort(
      (docA, docB) => docB.metadata.confidence - docA.metadata.confidence
    );

    return docs;
  };
}
