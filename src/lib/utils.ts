import * as path from "path";
import * as fs from "fs";
import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import { promises as fsPromises, readFile } from "fs";
import ConfigController from "./configController";
import { parse, stringify } from "yaml";
import Tokenizer from "./tokenizer";

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

  static yamlToJsObject = function (yamlString: string): any {
    try {
      const parsedObject = parse(yamlString);
      return parsedObject;
    } catch (error) {
      console.error("Error parsing YAML:", error);
      return null;
    }
  };

  static capitalizeFirstLetter = function (str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  static deepCloneNoteWrap = function (noteWrap: NoteWrap): NoteWrap {
    const clonedNoteWrap: NoteWrap = {
      iid: noteWrap.iid,
      cid: noteWrap.cid,
      block: new Map(),
    };

    // Deep clone the 'block' Map
    for (const [key, value] of noteWrap.block.entries()) {
      clonedNoteWrap.block.set(key, Utils.deepClone(value));
    }
    return clonedNoteWrap;
  };

  static deepClone = function (obj: any): any {
    if (typeof obj === "object" && obj !== null) {
      if (obj instanceof Map) {
        const newMap = new Map();
        for (const [key, value] of obj.entries()) {
          newMap.set(key, Utils.deepClone(value));
        }
        return newMap;
      }
      if (Array.isArray(obj)) {
        return obj.map(Utils.deepClone);
      }
      const newObj: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          newObj[key] = Utils.deepClone(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  };

  static renameToHyphen(name: string): string {
    if (!name.split) {
      console.log("Is not a string" + name);
    }
    return name.split(" ").join(Tokenizer.hyphenToken);
  }

  static renameFromHyphen(name: string): string {
    if (!name.split) {
      console.log("Is not a string" + name);
    }
    return name.split(Tokenizer.hyphenToken).join(" ");
  }

  static round(n: number, precision: number = 1000): number {
    return Math.round(n * precision) / precision;
  }
}
