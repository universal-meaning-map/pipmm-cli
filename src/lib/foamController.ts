import ErrorController from "./errorController";
import Utils from "./utils";
import * as matter from "gray-matter";
import * as path from "path";
import { promises as fs } from "fs";
import { NoteType } from "../lib/ipmm";
import IpldController from "./ipldController";
import Tokenizer from "./tokenizer";
import IpmmType from "./ipmmType";

const PROP_TYPE_FOAMID = "prop-ipfoam-type-1630602741";
const PROP_VIEW_FOAMID = "prop-view-1612698885";
let foamRepo: string;
let ipmmRepo: string;
const iidToCidMap: { [iid: string]: string } = {};
const foamIdToIidMap: { [fileName: string]: string } = {};
const cidToTypeMap: { [cid: string]: IpmmType } = {};

export default class FoamController {
  static importAll = async (
    _ipmmRepo: string,
    _foamRepo: string
  ): Promise<void> => {
    foamRepo = _foamRepo;
    ipmmRepo = _ipmmRepo;

    let files = await fs.readdir(foamRepo);

    files = Utils.filterByExtensions(files, [".md"]);

    console.log(
      "Importing FOAM repository from ",
      path.resolve(process.cwd(), foamRepo),
      "..."
    );

    const notes: NoteType[] = [];

    for (let fileName of files) {
      const note: NoteType = await FoamController.makeNote(fileName);
      notes.push(note);
    }
    //console.log(iidToCidMap);
  };

  static importFile = async (
    _ipmmRepo: string,
    _foamRepo: string,
    _fileName: string
  ): Promise<void> => {
    foamRepo = _foamRepo;
    ipmmRepo = _ipmmRepo;

    FoamController.makeNote(_fileName);
  };

  static makeNote = async (fileName: string): Promise<NoteType> => {
    console.log("Importing " + foamRepo + "/" + fileName);
    const foamId = Utils.removeFileExtension(fileName).toLowerCase();
    const iid = await FoamController.makeIntentIdentifier(foamId);
    const filePath = path.join(foamRepo, fileName);

    //read file
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (e) {
      ErrorController.recordProcessError(filePath, "reading file", e);
    }

    //process frontmatter
    let m: any;
    try {
      m = matter(data);
    } catch (error) {
      ErrorController.recordProcessError(
        filePath,
        "parsing Front Matter file",
        error
      );
    }

    //make type if exists

    //Dates to strings
    /*
    for (let key in m.data) {
        const property = FoamController.processProperty(key, m.data[key]);
        
        if (m.data[key] instanceof Date) {
          //DAG-CBOR seralization does not support Date
          note[key] = m.data[key].toString();
        } else {
          note[key] = m.data[key];
        }
      }
      */

    let isType = false;
    if (m.data[PROP_TYPE_FOAMID]) isType = true;

    console.log("Istype", isType)

    let note: NoteType = {};

    //process property types into cids and validate its content
    if (m.content) {
      console.log("in content", m.content);
      const view = Tokenizer.wikilinksToTransclusions(m.content);
      const viewProp = await FoamController.processProperty(
        PROP_VIEW_FOAMID,
        view
      );
      note[viewProp.key] = viewProp.value;
      console.log(viewProp);
    }

    if (isType) {
      for (let key in m.data[PROP_TYPE_FOAMID]) {
        console.log(key)
        const prop = await FoamController.processTypeProperty(key, m.data[key]);
        console.log(prop);
        note[prop.key] = prop.value;
      }
    } else {
      for (let key in m.data) {
        const prop = await FoamController.processProperty(key, m.data[key]);
        console.log(prop);
        note[prop.key] = prop.value;
      }
    }

    const block = await IpldController.anyToDagCborBlock(note);
    foamIdToIidMap[foamId] = iid;
    const cid = block.cid.toString();

    //If is contains a type we create it
    if (m.data[PROP_TYPE_FOAMID]) {
      const typeProps = m.data[PROP_TYPE_FOAMID];
      const ipmmType = new IpmmType(
        typeProps["$default-name"],
        typeProps["$represents"],
        typeProps["$constrains"],
        typeProps["$ipld-schema"]
      );
      cidToTypeMap[cid] = ipmmType;
    }
    //console.log(iid, block.cid.toString, filePath)

    //console.log(note);
    return note;
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
  /*
  static makeNote = async (fileName: string): Promise<NoteType> => {

    const filePath = path.join(foamRepo, fileName);
    const foamId = Utils.removeFileExtension(fileName).toLowerCase();
    //console.log("Making..."+filePath)
    let note: NoteType = {};
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (e) {
      ErrorController.recordProcessError(filePath, "reading file", e);
    }

    try {
      let m = matter(data);

      if (m.data["prop-ipfoam-type-1630602741"]) {
        const typeProps = m.data["prop-ipfoam-type-1630602741"];
        const ipmmType = new IpmmType(
          typeProps["$default-name"],
          typeProps["$represents"],
          typeProps["$constrains"],
          typeProps["$ipld-schema"]
        );
        foamIdToTypeMap[foamId]=ipmmType
      }

      //Wikilinks to transclusion
      //Todo: On all types
      note.content = Tokenizer.wikilinksToTransclusions(m.content);

      //Dates to strings
      for (let key in m.data) {
        const property = FoamController.processProperty(key, m.data[key]);

        if (m.data[key] instanceof Date) {
          //DAG-CBOR seralization does not support Date
          note[key] = m.data[key].toString();
        } else {
          note[key] = m.data[key];
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
  };*/

  static processProperty = async (
    key: string,
    value: any
  ): Promise<{ key: string; value: string }> => {
    //get property cid
    const keyBlock = await IpldController.anyToDagCborBlock(key.toLowerCase());
    const keyCid = keyBlock.cid.toString();

    //check if this property type is known
    if (!cidToTypeMap[keyCid]) {
      FoamController.makeNote(key + ".md");
    }

    return { key: keyCid, value: "" };
  };

  static processTypeProperty = async (
    key: string,
    value: any
  ): Promise<{ key: string; value: string }> => {
    console.log(value);
    const keyBlock = await IpldController.anyToDagCborBlock(key.toLowerCase());
    const keyCid = keyBlock.cid.toString();
    return { key: keyCid, value: "" };
  };

  static buildTypes = async (
    ipmmRepo: string,
    foamRepo: string
  ): Promise<void> => {
    const schema = `type Foo string`;
    const data = {};
    IpldController.dataMatchesType(data, schema, "");
  };

  save() {}
}
