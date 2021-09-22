import * as fs from "fs";
import ConfigController from "./configController";
import Utils from "./utils";
import * as path from "path";

export default class Ipmm {
  /* private static load = (ipmmPath: string): Note[] => {
    if (!fs.existsSync(ipmmPath))
      console.error("No IPMM repo exists at " + ipmmPath);

    let data = JSON.parse(fs.readFileSync(ipmmPath, "utf8"));

    let notes: Note[] = [];

    for (let n of data) {
      let note: Note = {};
      for (let prop in n) {
        note[prop] = n[prop];
      }
    }

    return notes;
  };
  */

  static save(notes: NoteBlock[], ipmmRepoPath: string) {
    let fullPath = path.resolve(ipmmRepoPath, "ipmm.json");
    console.log("Saving IPMM repository at ", fullPath, "...");
    Utils.saveFile(JSON.stringify(notes), fullPath);
  }
}

export interface NoteBlock {
  [key: string]: any;
}

export interface NoteWrap{
  iid: string;
  cid: string;
  block: { [key: string]: any };
}
