import ErrorController from "./errorController";
import Utils from "./utils";
import * as matter from "gray-matter";
import * as path from "path";
import { promises as fs } from "fs";
import { NoteType } from "../lib/ipmm";
import IpldController from "./ipldController";
import Tokenizer from "./tokenizer";
import IpmmType from "./ipmmType";
import Referencer from "./referencer";


let foamRepo: string;
let ipmmRepo: string;
//const foamIdToIidMap: { [foamId: string]: string } = {};
const foamIdToTypeCid: { [foamId: string]: string } = {};

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
    //console.log(Referencer.iidToCidMap);
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

  static makeNote = async (
    fileName: string,
    shouldBeAType: boolean = false
  ): Promise<NoteType> => {
    console.log("\nImporting " + foamRepo + "/" + fileName);
    const foamId = Utils.removeFileExtension(fileName).toLowerCase();
    const iid = await IpldController.makeIIdFromFoamIdOrFileName(foamId);
    const filePath = path.join(foamRepo, fileName);

    //read file
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (e) {
      console.log(e);
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

    //chekc if the note is a type definition
    let isType = false;
    if (m.data[Referencer.PROP_TYPE_FOAMID]) {
      isType = true;

      //¿prevent the note to have other property types not related to the typ
      if (m.content || Object.keys(m.data).length > 1)
        throw (
          foamId +
          " is a type but it has other properties as well, which is not allowed"
        );
    }
    //because we can create notes recursively when looking for a type, we need to be able to warn
    console.log("Is Type", isType, "- Should be a type", shouldBeAType);
    if (shouldBeAType && !isType) {
      throw (
        foamId + " should be a type but " + Referencer.PROP_TYPE_FOAMID + " was not found."
      );
    }

    let note: NoteType = {};

    //process property types into cids and validate its content
    if (m.content) {
      const view = Tokenizer.wikilinksToTransclusions(m.content);
      const viewProp = await FoamController.processProperty(
        Referencer.PROP_VIEW_FOAMID,
        view
      );
      note[viewProp.key] = viewProp.value;
    }

    //convert property keys into iids

    if (isType) {
      for (let key in m.data[Referencer.PROP_TYPE_FOAMID]) {
        const prop = await FoamController.processTypeProperty(
          key,
          m.data[Referencer.PROP_TYPE_FOAMID][key]
        );
        note[prop.key] = prop.value;
      }
    } else {
      for (let key in m.data) {
        const prop = await FoamController.processProperty(key, m.data[key]);
        note[prop.key] = prop.value;
      }
    }

    const block = await IpldController.anyToDagCborBlock(note);
    const cid = block.cid.toString();
    Referencer.iidToCidMap[iid] = cid;

    //If it contains a type we create and instance to verify properties
    if (isType) {
      console.log("creating type for", foamId, iid);
      const typeProps = m.data[Referencer.PROP_TYPE_FOAMID];

      if (!typeProps[Referencer.TYPE_PROP_DEFAULT_NAME])
        console.log(Referencer.TYPE_PROP_DEFAULT_NAME + " for Type does not exist");

      if (!typeProps[Referencer.TYPE_PROP_REPRESENTS])
        console.log(Referencer.TYPE_PROP_REPRESENTS + " for Type does not exist");

      if (!typeProps[Referencer.TYPE_PROP_CONSTRAINS])
        console.log(Referencer.TYPE_PROP_CONSTRAINS + " for Type does not exist");

      if (!typeProps[Referencer.TYPE_PROP_CONSTRAINS])
        console.log(Referencer.TYPE_PROP_CONSTRAINS + " for Type does not exist");

      const ipmmType = new IpmmType(
        typeProps[Referencer.TYPE_PROP_DEFAULT_NAME],
        typeProps[Referencer.TYPE_PROP_REPRESENTS],
        typeProps[Referencer.TYPE_PROP_CONSTRAINS],
        typeProps[Referencer.TYPE_PROP_IPLD_SCHEMA]
      );
      Referencer.iidToTypeMap[iid] = ipmmType;
      //foamIdToTypeCid[foamId] = cid;
    }
    //console.log(iid, block.cid.toString, filePath)
    console.log("\n");
    console.log(note);
    return note;
  };

  

  static processProperty = async (
    key: string,
    value: any
  ): Promise<{ key: string; value: string }> => {
    //get property cid
    const keyIid = await IpldController.makeIIdFromFoamIdOrFileName(key);
    //const typeCid= foamIdToTypeCid[key]

    //check if this property type is known
    if (!Referencer.iidToTypeMap[keyIid]) {
      console.log("No type exists for", key, keyIid);
      await FoamController.makeNote(key.toLowerCase() + ".md", true);
      if (!Referencer.iidToTypeMap[keyIid])
        throw (
          "The type for" +
          keyIid +
          "was not found after attempting its creation"
        );
    }

    //Verify value agains type ipld-schema
    Referencer.iidToTypeMap[keyIid].isDataValid(value);

    return { key: keyIid, value: value };
  };

  static processTypeProperty = async (
    key: string,
    value: any
  ): Promise<{ key: string; value: string }> => {
    const keyCid = await IpldController.makeIIdFromFoamIdOrFileName(key);
    return { key: keyCid, value: value };
  };

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
}
