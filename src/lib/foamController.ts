import ErrorController from "./errorController";
import Utils from "./utils";
import * as matter from "gray-matter";
import * as path from "path";
import { promises as fs } from "fs";
import { NoteType } from "../lib/ipmm";
import IpldController from "./ipldController";
import ConfigController from "./configController";
const dagCBOR = require("ipld-dag-cbor");

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
    let notes: NoteType[] = [];

    for (let fileName of files) {
      //progressBar.update({ file: fileName });
      // This can be parallelized
      let iid = await FoamController.makeIntentIdentifier(fileName);

      let filePath = path.join(foamRepo, fileName);
      let note: NoteType = await FoamController.makeNote(filePath);
      let cid: string = await FoamController.makeIpldNodeAndGetCid(note);

      notes.push(note);
    }

    return notes;
    // progressBar.stop();
  };

  static makeIntentIdentifier = async (fileName: string): Promise<string> => {
    //Using defult IPFS parameters
    //TODO: Define which ones we use, and be explicit when calling the function
    let foamId = Utils.removeFileExtension(fileName);
    let cid = await dagCBOR.util.cid(foamId);
    let iid = cid.toString();
    console.log(iid, foamId);
    return iid;
  };

  static makeNote = async (filePath: string): Promise<NoteType> => {
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

      note.content = m.content;

      for (let prop in m.data) {
        note[prop] = m.data[prop];
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

  static makeIpldNodeAndGetCid = async (note: NoteType): Promise<string> => {
    if (!IpldController.ipld)
      await IpldController.init("ConfigController.ipmmRepoPath");

    const cid = await IpldController.put(note);
    return cid;
  };

  save() {}
}
