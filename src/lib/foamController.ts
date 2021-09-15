import ErrorController, { Res } from "./errorController";
import Utils from "./utils";
import matter from "gray-matter";
import * as path from "path";
import { promises as fs, readFile } from "fs";
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

    //console.log("Importing FOAM repository from ",path.resolve(process.cwd(), foamRepo), "...");

    const notes: NoteType[] = [];

    for (let fileName of files) {
      const foamId = Utils.removeFileExtension(fileName);
      const note: NoteType = await FoamController.makeNote(foamId);
      notes.push(note);
    }
    //console.log(Referencer.iidToCidMap);
  };

  static importFile = async (
    _ipmmRepo: string,
    _foamRepo: string,
    _fileName: string
  ): Promise<Res> => {
    foamRepo = _foamRepo;
    ipmmRepo = _ipmmRepo;

    const foamId = Utils.removeFileExtension(_fileName);
    return await FoamController.makeNote(foamId);
  };

  static makeNote = async (
    foamId: string,
    shouldBeAType: boolean = false
  ): Promise<Res> => {
    let iid = "";
    if (shouldBeAType) iid = await Referencer.makeTypeIid(foamId);
    else iid = await Referencer.makeIid(foamId);

    const filePath = path.join(foamRepo, foamId + ".md");

    //read file
    //let data: string = "";

    //let data = await fs.readFile(filePath, "utf8");

    const fileData = await Res.async(
      fs.readFile(filePath, "utf8"),
      "Unable to read file: " + filePath,
      Res.saveError
    );

    if (fileData.isError()) return fileData;

    /*
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
    */

    //process frontmatter

    /*
      let m: any;
    try {
      m = matter(fileData.value);
    } catch (error) {
      ErrorController.recordProcessError(
        filePath,
        "parsing Front Matter file",
        error
      );
      return {};
    }

    */

    const frontMatterRes = Res.sync(
      () => {
        return matter(fileData.value);
      },
      "Unable to parse front-matter",
      Res.saveError
    );

    if (frontMatterRes.isError()) return frontMatterRes;

    const frontMatter = frontMatterRes.value;

    //check if the note is a type definition
    let isType = false;

    if (frontMatter.data[Referencer.PROP_TYPE_FOAMID]) {
      isType = true;

      //prevent the note to have other property types not related to the type
      /*if (frontMatter.content || Object.keys(frontMatter.data).length > 1) {
        const e =
          "A Note with a type can't include other properties. Verify the note only contains " +
          Referencer.PROP_TYPE_FOAMID +
          " data and has no content.";
        ErrorController.recordProcessError(filePath, "checking type", e);
        return {};
      }*/

      if (frontMatter.content || Object.keys(frontMatter.data).length > 1)
        return Res.error(
          "A Note with a type can't include other properties. Verify the note only contains " +
            Referencer.PROP_TYPE_FOAMID +
            " data and has no content.",
          Res.saveError
        );
    }

    //because we can create notes recursively when looking for a type, we need to be able to warn
    if (shouldBeAType && !isType) {
      Res.error(
        "Note " +
          foamId +
          " is used as a type but " +
          Referencer.PROP_TYPE_FOAMID +
          " was not found.",
        Res.saveError
      );
    }

    /////////////////////////////////
    //create and empty note
    let note: NoteType = {};
    /*const typeExistserrorCallback = (error: string) => {
      ErrorController.recordProcessError(
        filePath,
        "checking if type exists",
        error
      );
    };*/

    //Iterate trhough all the note properties.
    //If a given note property key has not beeen processed yet it will process it before continuing

    //TYPE properies
    //if the note represents a data Type is processed differently and rest of properties are ignored
    if (isType) {
      for (let key in frontMatter.data[Referencer.PROP_TYPE_FOAMID]) {
        const prop = await FoamController.processTypeProperty(
          key,
          frontMatter.data[Referencer.PROP_TYPE_FOAMID][key]
        );
        note[prop.key] = prop.value;
      }
    }
    // VIEW property
    else {
      //Process the content of the .md file and convert it into the "view" type
      if (frontMatter.content) {
        const removedFoodNotes = frontMatter.content.split("[//begin]:")[0];
        const trimmed = removedFoodNotes.trim();
        const view = await Tokenizer.wikilinksToTransclusions(trimmed);

        const viewProp = await FoamController.processProperty(
          Referencer.PROP_VIEW_FOAMID,
          view,
          filePath
        );
        note[viewProp.key] = viewProp.value;
      }
      //ALL other properties
      //The rest of the properties
      for (let key in frontMatter.data) {
        const prop = await FoamController.processProperty(
          key,
          frontMatter.data[key],
          filePath
        );
        note[prop.key] = prop.value;
      }
    }

    //Get the final CID of the note
    const block = await IpldController.anyToDagCborBlock(note);
    const cid = block.cid.toString();
    Referencer.iidToCidMap[iid] = cid;

    //MAKE TYPE
    //If it contains a type we verify its schema and create and  catch an instance  in order to validate future notes
    if (isType) {
      //console.log("creating type for", foamId, iid);
      const typeProps = frontMatter.data[Referencer.PROP_TYPE_FOAMID];
      const ipmmType = await FoamController.makeType(typeProps, filePath);
      Referencer.iidToTypeMap[iid] = ipmmType;
    }
    return Res.success(note);
  };

  static makeType = async (
    typeProps: any,
    filePath: string
  ): Promise<IpmmType> => {
    {
      const typeCreateErrorCallback = (error: string) => {
        Res.error("Creating new type. Filpath: "+filePath, Res.saveError, error)
      };
      //console.log("\nCreating type for",filePath,typeProps)
      const ipmmType = await IpmmType.create(
        typeProps,
        typeCreateErrorCallback
      );
      return ipmmType;
    }
  };

  static processProperty = async (
    typeFoamId: string,
    propertyValue: any,
    filePath: string
    // errorCallabck: (error: string) => void
  ): Promise<{ key: string; value: string }> => {
    const typeIId = await Referencer.makeTypeIid(typeFoamId);

    //Create a Type for the propertyId if it doesn't exists yet
    if (!Referencer.iidToTypeMap[typeIId]) {
      //console.log("No type exists for", key, keyIid);

      await FoamController.makeNote(typeFoamId, true);
      if (!Referencer.iidToTypeMap[typeIId]) {
        Res.error(
          "The type for " +
            typeFoamId +
            " was not found after attempting its creation",
          Res.saveError
        );
      }
    }

    let newValue: any = {};

    //Frontmatter transformed string to a Date but DAG-CBOR seralization does not support Date
    if (propertyValue instanceof Date) {
      newValue = propertyValue.toString();
    }

    //recursivelly process sub-properties
    if (typeof propertyValue === "object" && propertyValue !== null) {
      for (let subTypeFoamId in propertyValue) {
        const prop = await FoamController.processProperty(
          subTypeFoamId,
          propertyValue[subTypeFoamId],
          filePath
        );
        newValue[prop.key] = prop.value;
      }
    } else {
      newValue = propertyValue;
    }

    //Verify value agains type ipld-schema
    if (Referencer.typeExists(typeIId))
      Referencer.iidToTypeMap[typeIId].isDataValid(newValue, (error) => {
        Res.error(
          "validating the value for property " +
            typeFoamId +
            " against schema: " +
            filePath,
          Res.saveError
        );
      });
    else {
      Res.error(
        "The type for " +
          typeFoamId +
          " does not exist yet, filePath:" +
          filePath,
        Res.saveError
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
}
