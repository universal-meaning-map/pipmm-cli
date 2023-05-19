import * as path from "path";
import * as fs from "fs";
import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import { promises as fsPromises, readFile } from "fs";
import ConfigController from "./configController";

export default class Utils {
  static resolveHome = (filepath: string) => {
    if (filepath[0] === "~") {
      if (process.env.HOME)
        return path.join(process.env.HOME, filepath.slice(1));
      else
        throw new Error(
          "process.env.HOME does not exist. Unable to resolve ~ for " + filepath
        );
    }
    return filepath;
  };

  static filterByExtensions = (
    files: string[],
    extensions: string[]
  ): string[] => {
    return files.filter(function (file) {
      for (let extension of extensions) {
        if (path.extname(file).toLowerCase() === extension) return true;
      }
      return false;
    });
  };

  static removeFileExtension = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, "");
  };

  static saveFile = (fileData: string, filePath: string): void => {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, fileData);
  };

  static getFile = (filePath: string): string => {
    const path = Utils.resolveHome(filePath);
    if (fs.existsSync(path)) {
      let data = fs.readFileSync(path, "utf8");
      return data;
    } else {
      throw new Error(" Unable to open " + path);
    }
  };

  static isObject = function (a: any) {
    return !!a && a.constructor === Object;
  };

  static objectIsEmpty = function (a: any) {
    return Object.keys(a).length == 0;
  };

  static strMapToObj = function (strMap: Map<string, any>) {
    let obj = Object.create(null);
    for (let [k, v] of strMap) {
      obj[k] = v;
    }
    return obj;
  };

  static notesWrapToObjs(mapNotes: Map<string, NoteWrap>) {
    let objNotes: { [iid: string]: any } = {};

    for (let [iid, note] of mapNotes.entries()) {
      let newNote = { ...note };
      newNote.block = Utils.strMapToObj(note.block);
      objNotes[iid] = newNote;
    }
    return objNotes;
  }

  static objToStrMap = function (obj: any) {
    let strMap = new Map();
    for (let k of Object.keys(obj)) {
      strMap.set(k, obj[k]);
    }
    return strMap;
  };

  static async saveIpmmRepo() {
    let repo = Referencer.iidToNoteWrap;
    let obj = Utils.notesWrapToObjs(repo);
    let json = JSON.stringify(obj, null, 2);
    await fsPromises.writeFile(
      ConfigController._configFile.resources.ipmmRepo,
      json
    );
  }

  static mapRange = function (
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number
  ): number {
    // Normalize the value within the source range
    const normalizedValue = (value - fromMin) / (fromMax - fromMin);
    // Map the normalized value to the target range
    const mappedValue = normalizedValue * (toMax - toMin) + toMin;

    return mappedValue;
  };

  static hasMultipleOccurances = function (
    corpus: string,
    text: string
  ): boolean {
    const regex = new RegExp(text, "g");
    const matches = corpus.match(regex);
    const occurrences = matches ? matches.length : 0;
    if (occurrences > 1) return true;
    return false;
  };
}
