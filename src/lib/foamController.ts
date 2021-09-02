import ErrorController from "./errorController";
import Utils from "./utils";
import * as matter from "gray-matter";
import * as path from "path";
import { promises as fs } from "fs";
import { NoteType } from "../lib/ipmm";
import IpldController from "./ipldController";
import Tokenizer from "./tokenizer";

const iidToCidMap: { [iid: string]: string } = {};
const foamIdToIidMap: { [fileName: string]: string } = {};

export default class FoamController {
  static import = async (
    ipmmRepo: String,
    foamRepo: string
  ): Promise<NoteType[]> => {
    let files = await fs.readdir(foamRepo);

    files = Utils.filterByExtensions(files, [".md"]);

    console.log(
      "Importing FOAM repository from ",
      path.resolve(process.cwd(), foamRepo),
      "..."
    );

    /*
    const progressBar = cli.progress({
      format: "{file}, {bar} {value}/{total} Notes",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    });
    progressBar.start(files.length, 0);
*/
    const notes: NoteType[] = [];

    for (let fileName of files) {
      //progressBar.update({ file: fileName });
      // This can be parallelized
      const foamId = Utils.removeFileExtension(fileName);
      const iid = await FoamController.makeIntentIdentifier(foamId);

      const filePath = path.join(foamRepo, fileName);
      const note: NoteType = await FoamController.makeNote(filePath);
      const block = await IpldController.anyToDagCborBlock(note);
      foamIdToIidMap[foamId] = iid;
      iidToCidMap[iid] = block.cid.toString();
      notes.push(note);
    }
    console.log(iidToCidMap);
    return notes;
    // progressBar.stop();
  };

  static makeIntentIdentifier = async (foamId: string): Promise<string> => {
    //TODO: Define how IID should be generated.
    const fileNameCid = await IpldController.anyToDagCborBlock(foamId);
    const iid = fileNameCid.cid.toString();
    return iid;
  };

  static getIidFromFoamId(foamId: string): string {
    const iid = foamIdToIidMap[foamId];
    //console.log("iid of",filename, iid)
    return iid;
  }

  static makeNote = async (filePath: string): Promise<NoteType> => {
    //console.log("Making..."+filePath)
    let note: NoteType = {};
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (e) {
      ErrorController.recordProcessError(filePath, "reading file", e);
    }

    //gray-matter object
    try {
      let m = matter(data);

      Tokenizer.replaceWikilnksWithTransclusions(m.content);

      note.content = m.content;

      for (let prop in m.data) {
        if (m.data[prop] instanceof Date) {
          //DAG-CBOR seralization does not support Date
          note[prop] = m.data[prop].toString();
        } else {
          note[prop] = m.data[prop];
        }
      }

      return note;
    } catch (error) {
      ErrorController.recordProcessError(
        filePath,
        "parsing Front Matter file",
        error
      );
    }

    return note;
  };

  static buildTypes = async (
    ipmmRepo: String,
    foamRepo: string
  ): Promise<void> => {
    const schema = `type Foo string`;
    const data = {};
    IpldController.dataMatchesType(data, schema, "");
  };

  save() {}
}
