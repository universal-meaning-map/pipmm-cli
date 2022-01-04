import ErrorController, { Res } from "./errorController";
import Utils from "./utils";
import matter from "gray-matter";
import * as path from "path";
import { promises as fs, readFile } from "fs";
import { NoteBlock, NoteWrap } from "../lib/ipmm";
import IpldController from "./ipldController";
import Tokenizer from "./tokenizer";
import IpmmType from "./ipmmType";
import Referencer from "./referencer";
import ConfigController from "./configController";

let foamRepo: string;
let ipmmRepo: string;

const foamIdToTypeCid: { [foamId: string]: string } = {};

export default class FoamController {
  static compileAll = async (
    _ipmmRepo: string,
    _foamRepo: string
  ): Promise<void> => {
    foamRepo = _foamRepo;
    ipmmRepo = _ipmmRepo;

    let files = await fs.readdir(foamRepo);
    files = Utils.filterByExtensions(files, [".md"]);

    for (let fileName of files) {
      const foamId = Utils.removeFileExtension(fileName);
      await FoamController.makeNote(foamId);
    }
    
  };

  static compileFile = async (
    _ipmmRepo: string,
    _foamRepo: string,
    _fileName: string
  ): Promise<Res> => {
    foamRepo = _foamRepo;
    ipmmRepo = _ipmmRepo;

    const foamId = Utils.removeFileExtension(_fileName);
    return await FoamController.makeNote(foamId, false, true);
  };

  static makeNote = async (
    foamId: string,
    shouldBeAType: boolean = false,
    forceUpdate: Boolean = false,
    requesterFoamId?: string
  ): Promise<Res> => {
    //read file

    try {
      const filePath = path.join(foamRepo, foamId + ".md");
      FoamController.checkFileName(foamId, filePath);

      const fileData = await Res.async(
        fs.readFile(filePath, "utf8"),
        "Unable to read file: " + filePath + "\tRequester: " + requesterFoamId,
        Res.saveError
      );

      if (fileData.isError()) return fileData;

      const frontMatterRes = Res.sync(
        () => {
          return matter(fileData.value);
        },
        "Unable to parse front-matter for: " + foamId,
        Res.saveError,
        { data: fileData.value }
      );

      if (frontMatterRes.isError()) return frontMatterRes;

      const frontMatter = frontMatterRes.value;

      //check if the note is a type definition
      let isType = false;

      if (frontMatter.data[Referencer.PROP_TYPE_FOAMID]) {
        isType = true;

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
      let iid = "";
      if (isType) iid = await Referencer.makeIid(foamId);
      else iid = await Referencer.makeIid(foamId);

      if (forceUpdate == false && Referencer.iidExists(iid)) {
        return Res.success(Referencer.getNote(iid));
      }

      //create and empty note
      let noteBlock: NoteBlock = {};

      //Iterate trhough all the note properties.
      //If a given note property key has not beeen processed yet it will process it before continuing

      //TYPE properies
      //if the note represents a data Type is processed differently and rest of properties are ignored

      //MAKE TYPE
      //If it contains a type we verify its schema and create and  catch an instance  in order to validate future notes
      if (isType) {
        //console.log("creating type for", foamId, iid);
        const typeProps = frontMatter.data[Referencer.PROP_TYPE_FOAMID];
        const ipmmType = await FoamController.makeType(typeProps, foamId);
        Referencer.iidToTypeMap[iid] = ipmmType;
        noteBlock = ipmmType.getBlock();
      }
      // VIEW property
      else {
        //Process the content of the .md file and convert it into the "view" type
        if (frontMatter.content) {
          const removedFoodNotes = frontMatter.content.split("[//begin]:")[0];
          const trimmed = removedFoodNotes.trim();

          const viewProp = await FoamController.processProperty(
            Referencer.PROP_VIEW_FOAMID,
            trimmed,
            foamId
          );
          noteBlock[viewProp.key] = viewProp.value;
        }
        //ALL other properties
        //The rest of the properties
        for (let key in frontMatter.data) {
          const prop = await FoamController.processProperty(
            key,
            frontMatter.data[key],
            foamId
          );
          noteBlock[prop.key] = prop.value;
        }
      }

      //Get the final CID of the note
      const block = await IpldController.anyToDagJsonBlock(noteBlock);
      const cid = block.cid.toString();
      Referencer.iidToCidMap[iid] = cid;

      const noteWrap: NoteWrap = { iid: iid, cid: cid, block: block.value };
      Referencer.iidToNoteWrap[iid] = noteWrap;

      return Res.success(noteWrap);
    } catch (e) {
      return Res.error(
        "Exception creating note " +
          foamId +
          " requested by " +
          requesterFoamId,
        Res.saveError,
        e
      );
    }
  };

  static makeType = async (
    typeProps: any,
    foamId: string
  ): Promise<IpmmType> => {
    {
      const typeCreateErrorCallback = (error: string) => {
        Res.error("Creating new type for : " + foamId, Res.saveError, error);
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
    requesterFoamId: string
    // errorCallabck: (error: string) => void
  ): Promise<{ key: string; value: string }> => {
    const typeIId = await Referencer.makeIid(typeFoamId);

    //Create a Type for the propertyId if it doesn't exists yet
    if (!Referencer.iidToTypeMap[typeIId]) {
      //console.log("No type exists for", key, keyIid);

      await FoamController.makeNote(typeFoamId, true, false, requesterFoamId);
      if (!Referencer.iidToTypeMap[typeIId]) {
        Res.error(
          "The type for `" +
            typeFoamId +
            "` was not found after attempting its creation. \tRequester: " +
            requesterFoamId,
          Res.saveError
        );
      }
    }

    let newValue: any = {};

    //Frontmatter transformed string to a Date but DAG-CBOR seralization does not support Date
    if (propertyValue instanceof Date) {
      newValue = propertyValue.toString();
    }

    if (Array.isArray(propertyValue)) {
      //We don't want array indexes converted to iids
      newValue = propertyValue;
    }

    //recursivelly process sub-properties
    else if (typeof propertyValue === "object" && propertyValue !== null) {
      for (let subTypeFoamId in propertyValue) {
        const prop = await FoamController.processProperty(
          subTypeFoamId,
          propertyValue[subTypeFoamId],
          requesterFoamId
        );
        newValue[prop.key] = prop.value;
      }
    } else {
      newValue = propertyValue;
    }

    if (Referencer.typeExists(typeIId)) {
      //Verify value agains "constrains" (only interplanetary text for now)

      if (Referencer.iidToTypeMap[typeIId].constrains) {
        if (
          Referencer.iidToTypeMap[typeIId].constrains[0] ==
          Referencer.basicTypeInterplanetaryText
        ) {
          newValue = await Tokenizer.wikilinksToInterplanetaryText(
            newValue,
            requesterFoamId
          );
        } else if (
          Referencer.iidToTypeMap[typeIId].constrains[0] ==
          Referencer.basicTypeAbstractionReference
        ) {
          newValue = await Tokenizer.wikilinkToItent(newValue);
        } else if (
          Referencer.iidToTypeMap[typeIId].constrains[0] ==
          Referencer.basicTypeAbstractionReferenceList
        ) {
          if (Array.isArray(newValue)) {
            let newArray = [];
            for (let e of newValue) {
              let iid = await Tokenizer.wikilinkToItent(e);
              newArray.push(iid);
            }
            newValue = newArray;
          }
        }
      }

      //Verify value agains type ipld-schema
      Referencer.iidToTypeMap[typeIId].isDataValid(
        newValue,
        (errorMessage, errorContext) => {
          Res.error(
            "Data don't match schema for property'" +
              typeFoamId +
              "' for note: " +
              requesterFoamId,

            Res.saveError,
            { ...{ errorMessage: errorMessage }, ...errorContext }
          );
        }
      );
    } else {
      Res.error(
        "The type for " +
          typeFoamId +
          " does not exist yet, \tRequester:" +
          requesterFoamId,
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

  static checkFileName = async (
    foamId: string,
    filePath: string
  ): Promise<void> => {
    //new wikilinks should be formated with timestmap in the back.
    //Super crappy check that will last 5 years
    if (Tokenizer.containsUpperCase(foamId))
      Res.error(
        "File '" +
          foamId +
          "' contains uppercase in its filename. Should be only lowercase characters, numbers and '.'",
        Res.saveError,
        { filepath: filePath }
      );

    if (Tokenizer.containsSpaces(foamId))
      Res.error(
        "File '" +
          foamId +
          "' contains spaces in its filename. Should be only lowercase characters, numbers and '.'",
        Res.saveError,
        { filepath: filePath }
      );
    //No uper case allowed
    if (Tokenizer.foamIdDoesNotContainTimestamp(foamId))
      Res.error(
        "File '" +
          foamId +
          "' does not contain a timestamp in its filename. Is likley an old version",
        Res.saveError,
        { filepath: filePath }
      );
  };
}
