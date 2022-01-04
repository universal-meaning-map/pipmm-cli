import * as path from "path";
import * as fs from "fs";
import { NoteWrap } from "./ipmm";

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
      // We don’t escape the key '__proto__'
      // which can cause problems on older engines
      obj[k] = v;
    }
    return obj;
  };

  static notesWrapToObjs(mapNotes: Map<string, NoteWrap>) {
    let objNotes: { [iid: string]: any } = {};

    for (let [iid, note] of mapNotes.entries()) {
      let newNote = note;
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
}
