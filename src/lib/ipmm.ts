import * as fs from "fs";
import ConfigController from "./configController";
import Utils from "./utils";
import * as path from "path";

export default class Ipmm {
  private static repo: NoteType[];

  private static load = (ipmmPath: string): NoteType[] => {
    if (!fs.existsSync(ipmmPath))
      console.error("No IPMM repo exists at " + ipmmPath);

    let data = JSON.parse(fs.readFileSync(ipmmPath, "utf8"));

    let notes: NoteType[] = [];

    for (let n of data) {
      let note: NoteType = {};
      for (let prop in n) {
        note[prop] = n[prop];
      }
    }

    return notes;
  };

  static save(notes: NoteType[], ipmmRepoPath: string) {
    let fullPath = path.resolve(ipmmRepoPath, "ipmm.json");
    console.log("Saving IPMM repository at ", fullPath, "...");
    Utils.saveFile(JSON.stringify(notes), fullPath);
  }
}

export interface NoteType {
  [key: string]: any;
}
