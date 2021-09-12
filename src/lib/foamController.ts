import ErrorController from "./errorController";
import Utils from "./utils";
import matter from "gray-matter";
import * as path from "path";
import { promises as fs } from "fs";
import { NoteType } from "../lib/ipmm";
import IpldController from "./ipldController";
import Tokenizer from "./tokenizer";
import IpmmType from "./ipmmType";
import Referencer from "./referencer";
import { type } from "os";

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

    //console.log("Importing FOAM repository from ",path.resolve(process.cwd(), foamRepo), "...");

    const notes: NoteType[] = [];

    for (let fileName of files) {
      const foamId = Utils.removeFileExtension(fileName).toLowerCase();
      const note: NoteType = await FoamController.makeNote(foamId);
      notes.push(note);
    }
    //console.log(Referencer.iidToCidMap);
  };

  static importFile = async (
    _ipmmRepo: string,
    _foamRepo: string,
    _fileName: string
  ): Promise<NoteType> => {
    foamRepo = _foamRepo;
    ipmmRepo = _ipmmRepo;

    const foamId = Utils.removeFileExtension(_fileName).toLowerCase();
    return await FoamController.makeNote(foamId);
  };

  static makeNote = async (
    foamId: string,
    shouldBeAType: boolean = false
  ): Promise<NoteType> => {
    //console.log("\nImporting " + foamRepo + "/" + fileName);
    let iid = "";
    if (shouldBeAType) iid = await Referencer.makeTypeIid(foamId);
    else iid = await Referencer.makeIid(foamId);

    const filePath = path.join(foamRepo, foamId + ".md");

    //read file
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (e) {
      ErrorController.recordProcessError(
        filePath,
        "reading file",
        "Make sure all files are in lowercase" + e
      );
      return {};
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
      return {};
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

      //prevent the note to have other property types not related to the type
      if (m.content || Object.keys(m.data).length > 1) {
        const e =
          "A Note with a type can't include other properties. Verify the note only contains " +
          Referencer.PROP_TYPE_FOAMID +
          " data and has no content.";
        ErrorController.recordProcessError(filePath, "checking type", e);
        return {};
      }
    }

    //because we can create notes recursively when looking for a type, we need to be able to warn
    //console.log("Is Type", isType, "- Should be a type", shouldBeAType);
    if (shouldBeAType && !isType) {
      const e =
        foamId +
        " is used as a type but " +
        Referencer.PROP_TYPE_FOAMID +
        " was not found.";
      ErrorController.recordProcessError(filePath, "checking type", e);
    }

    let note: NoteType = {};

    //convert property keys into iids

    const typeExistserrorCallback = (error: string) => {
      ErrorController.recordProcessError(
        filePath,
        "checking if type exists",
        error
      );
    };
    if (isType) {
      for (let key in m.data[Referencer.PROP_TYPE_FOAMID]) {
        const prop = await FoamController.processTypeProperty(
          key,
          m.data[Referencer.PROP_TYPE_FOAMID][key]
        );
        note[prop.key] = prop.value;
      }
    } else {
      //process property types into cids and validate its content
      //The content of the .md (view property)
      if (m.content) {
        const removedFoodNotes = m.content.split("[//begin]:")[0];
        const trimmed = removedFoodNotes.trim();
        const view = await Tokenizer.wikilinksToTransclusions(trimmed);

        const viewProp = await FoamController.processProperty(
          Referencer.PROP_VIEW_FOAMID,
          view,
          filePath,
          typeExistserrorCallback
        );
        note[viewProp.key] = viewProp.value;
      }
      //The rest of the properties
      for (let key in m.data) {
        const prop = await FoamController.processProperty(
          key,
          m.data[key],
          filePath,
          typeExistserrorCallback
        );
        note[prop.key] = prop.value;
      }
    }

    const block = await IpldController.anyToDagCborBlock(note);
    const cid = block.cid.toString();
    Referencer.iidToCidMap[iid] = cid;

    //If it contains a type we create and instance to verify properties
    if (isType) {
      //console.log("creating type for", foamId, iid);
      const typeProps = m.data[Referencer.PROP_TYPE_FOAMID];
      const ipmmType = await FoamController.makeType(typeProps, filePath);
      Referencer.iidToTypeMap[iid] = ipmmType;
    }
    return note;
  };

  static makeType = async (
    typeProps: any,
    filePath: string
  ): Promise<IpmmType> => {
    {
      const typeCreateErrorCallback = (error: string) => {
        ErrorController.recordProcessError(
          filePath,
          "creating new type",
          error
        );
      };
      //console.log("\nCreating type for",filePath,typeProps)
      const ipmmType = await IpmmType.create(
        typeProps,
        typeCreateErrorCallback
      );
      return ipmmType;
    }
  };

  /*
  static makeType(typeProps: any, filePath: string): IpmmType {
    if (!typeProps[Referencer.TYPE_PROP_DEFAULT_NAME])
      ErrorController.recordProcessError(
        filePath,
        "creating type",
        Referencer.TYPE_PROP_DEFAULT_NAME + " for Type does not exist"
      );

    if (!typeProps[Referencer.TYPE_PROP_REPRESENTS])
      ErrorController.recordProcessError(
        filePath,
        "creating type",
        Referencer.TYPE_PROP_REPRESENTS + " for Type does not exist"
      );

    if (!typeProps[Referencer.TYPE_PROP_CONSTRAINS])
      ErrorController.recordProcessError(
        filePath,
        "creating type",
        Referencer.TYPE_PROP_CONSTRAINS + " for Type does not exist"
      );

    if (!typeProps[Referencer.TYPE_PROP_CONSTRAINS])
      ErrorController.recordProcessError(
        filePath,
        "creating type",
        Referencer.TYPE_PROP_CONSTRAINS + " for Type does not exist"
      );

    if (!typeProps[Referencer.TYPE_PROP_TYPE_DEPENDENCIES])
      ErrorController.recordProcessError(
        filePath,
        "creating type",
        Referencer.TYPE_PROP_TYPE_DEPENDENCIES + " for Type does not exist"
      );

    const typeCreateErrorCallback = (error: string) => {
      ErrorController.recordProcessError(filePath, "creating new type", error);
    };
    const ipmmType = new IpmmType(
      typeProps[Referencer.TYPE_PROP_DEFAULT_NAME],
      typeProps[Referencer.TYPE_PROP_REPRESENTS],
      typeProps[Referencer.TYPE_PROP_CONSTRAINS],
      typeProps[Referencer.TYPE_PROP_IPLD_SCHEMA],
      typeCreateErrorCallback
    );
    return ipmmType;
  }
  */

  static processProperty = async (
    typeFoamId: string,
    propertyValue: any,
    filePath: string,
    errorCallabck: (error: string) => void
  ): Promise<{ key: string; value: string }> => {
    const typeIId = await Referencer.makeTypeIid(typeFoamId);

    //Create a Type for the propertyId if it doesn't exists yet
    if (!Referencer.iidToTypeMap[typeIId]) {
      //console.log("No type exists for", key, keyIid);
      const foamId = typeFoamId.toLowerCase();
      await FoamController.makeNote(foamId, true);
      if (!Referencer.iidToTypeMap[typeIId]) {
        errorCallabck(
          "The type for " +
            typeFoamId +
            " was not found after attempting its creation"
        );
      }
    }

    let newValue: any = {};
    //recursivelly process sub-properties
    if(typeof propertyValue === "object" && propertyValue !== null){

      for (let subTypeFoamId in propertyValue) {
        const prop = await FoamController.processProperty(
          subTypeFoamId,
          propertyValue[subTypeFoamId],
          filePath,
          errorCallabck
          );
          newValue[prop.key] = prop.value;
        }
      }
      else{
        newValue = propertyValue
      }

    //Verify value agains type ipld-schema
    if (Referencer.typeExists(typeIId))
      Referencer.iidToTypeMap[typeIId].isDataValid(newValue, (error) => {
        ErrorController.recordProcessError(
          filePath,
          "validating the value for property " + typeFoamId + " against schema",
          error
        );
      });
    else {
      ErrorController.recordProcessError(
        filePath,
        "checking if type exists",
        "The type for " + typeFoamId + " does not exist yet"
      );
    }

    return { key: typeIId, value: newValue };
  };

  static processTypeProperty = async (
    key: string,
    value: any
  ): Promise<{ key: string; value: string }> => {
    //const keyCid = await Referencer.makeIid(key);
    return { key: key, value: value };
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
