import { Res } from "./errorController";
import Utils from "./utils";
import matter from "gray-matter";
import * as path from "path";
import { promises as fs } from "fs";
import { NoteWrap } from "./ipmm";
import IpldController from "./ipldController";
import Tokenizer from "./tokenizer";
import IpmmType from "./ipmmType";
import Referencer from "./referencer";
import ConfigController from "./configController";
import SemanticSearch from "./semanticSearch";

let notesRepo: string;

export default class Compiler {
  static compileArefs: boolean;

  static compileAll = async (
    _ipmmRepo: string,
    _notesRepo: string
  ): Promise<void> => {
    notesRepo = _notesRepo;

    if (ConfigController._configFile.interplanetaryText.compileArefs)
      Compiler.compileArefs = true;

    let files = await fs.readdir(notesRepo);
    files = Utils.filterByExtensions(files, [".md"]);

    for (let fileNameWithExtension of files) {
      const fileName = Utils.removeFileExtension(fileNameWithExtension);
      await Compiler.makeNote(fileName);
    }

    //compile "always compile"
    for (let fileName of ConfigController._configFile.misc.alwaysCompile) {
      await Compiler.makeNote(fileName);
    }
  };

  static compileFile = async (
    _ipmmRepo: string,
    _notesRepo: string,
    _fileName: string
  ): Promise<Res> => {
    notesRepo = _notesRepo;

    if (ConfigController._configFile.interplanetaryText.compileArefs)
      Compiler.compileArefs = true;

    const fileName = Utils.removeFileExtension(_fileName);

    return await Compiler.makeNote(fileName, false, true);
  };

  static makeNote = async (
    fileName: string,
    shouldBeAType: boolean = false,
    forceUpdate: Boolean = false,
    requesterFoamId?: string
  ): Promise<Res> => {
    try {
      //READ FILE
      const filePath = path.join(notesRepo, fileName + ".md");
      // Compiler.checkFileName(fileName, filePath, requesterFoamId);
      const fileData = await Res.async(
        fs.readFile(filePath, "utf8"),
        "Unable to read file: " + filePath + "\tRequester: " + requesterFoamId,
        Res.saveError
      );
      if (fileData.isError()) return fileData;

      //PARSE FRONT MATTER
      const frontMatterRes = Res.sync(
        () => {
          return matter(fileData.value);
        },
        "Unable to parse front-matter for: " + fileName,
        Res.saveError,
        { data: fileData.value }
      );
      if (frontMatterRes.isError()) return frontMatterRes;
      const frontMatter = frontMatterRes.value;

      let fid = "NOT SET";
      if (frontMatter.data.fid) {
        fid = "" + frontMatter.data.fid; //forcing to be a string
      } else {
        // console.log("No fid: " + fileName);
        // fid = Referencer.getFID(fileName);
      }

      //CHECK IF IS A TYPE
      let isType = false;

      if (frontMatter.data[Referencer.PROP_TYPE_FILENAME]) {
        isType = true;
        let content = frontMatter.content.trim();
        if (content) {
          console.log("Types can't have content: " + fileName);
        }

        if (Object.keys(frontMatter.data).length > 2) {
          console.log(
            "Types can only contain `fid`and `prop-ipfoam-type`: " + fileName
          );
        }

        /*return Res.error(
                "A Note with a type can't include other properties (except fir fid). Verify the note only contains " +
                Referencer.PROP_TYPE_FILENAME +
                " data and has no content.",
                Res.saveError
                );*/
      }

      //because we can create notes recursively when looking for a type, we need to be able to warn

      if (shouldBeAType && !isType) {
        Res.error(
          "Note " +
            fid +
            " is used as a type but " +
            Referencer.PROP_TYPE_FILENAME +
            " was not found.",
          Res.saveError
        );
      }

      /////////////////////////////////

      //we set the nameToIid at the begining so when it parses wikilinks it exsts.
      let name = fileName;
      let iid = await Referencer.makeIid(fid);
      Referencer.fileNameToIid.set(name, iid);

      if (forceUpdate == false && Referencer.iidToNoteWrap.has(iid)) {
        return Res.success(Referencer.iidToNoteWrap.get(iid));
      }

      //create and empty note
      let noteBlock: Map<string, any> = new Map();

      //Iterate trhough all the note properties.
      //If a given note property key has not beeen processed yet it will process it before continuing

      //TYPE properies
      //if the note represents a data Type is processed differently and rest of properties are ignored

      //MAKE TYPE
      //If it contains a type we verify its schema and create and  catch an instance  in order to validate future notes

      if (isType) {
        let typeProps = frontMatter.data[Referencer.PROP_TYPE_FILENAME];
        const ipmmType = await Compiler.makeType(typeProps, fid);
        Referencer.iidToTypeMap[iid] = ipmmType;
        noteBlock = ipmmType.getBlock();
      }

      // Content property
      else {
        //First we set the prop-name as filename. Later will override with prop-name
        const prop = await Compiler.processProperty(
          Referencer.PROP_NAME_FILENAME,
          fileName,
          iid,
          fileName,
          false
        );
        noteBlock.set(prop.key, prop.value);

        //Process the content of the .md file and convert it into the the type expressed in the first line or the "view" if not expressed.
        if (frontMatter.content) {
          //let content = Tokenizer.getFirstOrDefaultTypeAndValueForContent(frontMatter.content);

          let contentData = Tokenizer.getContentTypesAndValues(
            frontMatter.content,
            fileName
          );
          for (let prop of contentData) {
            const contentProp = await Compiler.processProperty(
              prop.type,
              prop.value,
              iid,
              fileName,
              false
            );
            noteBlock.set(contentProp.key, contentProp.value);
          }
        }

        //ALL other properties
        //The rest of the properties
        for (let propName in frontMatter.data) {
          const prop = await Compiler.processProperty(
            propName,
            frontMatter.data[propName],
            fileName,
            iid,
            false
          );
          noteBlock.set(prop.key, prop.value);
        }
      }

      //Get the final CID of the note
      let block;
      try {
        block = await IpldController.anyToDagJsonBlock(noteBlock);
      } catch (e) {
        console.log(fileName);
        console.log(e);
      }
      const cid = block.cid.toString();
      Referencer.iidToCidMap[iid] = cid;

      const noteWrap: NoteWrap = { iid: iid, cid: cid, block: block.value };
      Referencer.iidToNoteWrap.set(iid, noteWrap);
      Referencer.iidToFoamId.set(iid, fid);

      //Only once the note is created we can create the notes within the properties, otherwise we can end up in a recursive infinite loop

      if (Compiler.compileArefs && !isType) {
        //itereate through the note properties values and compile the referenced notes
        //view property
        if (frontMatter.content) {
          const removedFoodNotes = frontMatter.content.split("[//begin]:")[0];
          const trimmed = removedFoodNotes.trim();

          const viewProp = await Compiler.processProperty(
            Referencer.PROP_VIEW_FILENAME,
            trimmed,
            iid,
            fileName,
            true
          );
        }
        //rest of properties
        for (let propName in frontMatter.data) {
          if (propName == "iid") {
            continue;
          }
          const prop = await Compiler.processProperty(
            propName,
            frontMatter.data[propName],
            iid,
            fileName,
            true
          );
        }
      }

      return Res.success(noteWrap);
    } catch (e) {
      console.log(e);
      return Res.error(
        "Exception creating note " +
          fileName +
          " requested by " +
          requesterFoamId,
        Res.saveError,
        (e as any).toString()
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
      const ipmmType = await IpmmType.create(
        typeProps,
        typeCreateErrorCallback
      );

      return ipmmType;
    }
  };

  static processProperty = async (
    propertyFileName: string,
    propertyValue: any,
    requesterIid: string,
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
    // errorCallabck: (error: string) => void
  ): Promise<{ key: string; value: string }> => {
    //indexing of name-foamId for LLM

    if (propertyFileName == Referencer.PROP_FID) {
      return { key: "", value: "" };
    }
    if (propertyFileName == Referencer.PROP_NAME_FILENAME) {
      Referencer.nameWithHyphenToFoamId.set(
        Utils.renameToHyphen(propertyValue),
        requesterFoamId
      );
    }

    const typeIId = await Referencer.getIidByFileName(propertyFileName);

    if (!typeIId)
      throw "type `" + propertyFileName + "` fileName could not be found";

    //const typeIId = await Referencer.makeIid(typeFid);

    //Create a Type for the propertyId if it doesn't exists yet
    if (!Referencer.iidToTypeMap[typeIId]) {
      await Compiler.makeNote(propertyFileName, true, false, requesterFoamId);
      if (!Referencer.iidToTypeMap[typeIId]) {
        Res.error(
          "The type for `" +
            propertyFileName +
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
      for (let subPropName in propertyValue) {
        const prop = await Compiler.processProperty(
          subPropName,
          propertyValue[subPropName],
          requesterIid,
          requesterFoamId,
          compileInterplanetaryTextArefs
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
            requesterFoamId,
            compileInterplanetaryTextArefs
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
              propertyFileName +
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
          propertyFileName +
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
    filePath: string,
    requesterFoamId: string | undefined
  ): Promise<void> => {
    //new wikilinks should be formated with timestmap in the back.
    //Super crappy check that will last 5 years

    let localFoamId = Tokenizer.getLocalFoamId(foamId);
    if (Tokenizer.containsUpperCase(localFoamId))
      Res.error(
        "File '" +
          foamId +
          "' contains uppercase in its filename. Should be only lowercase characters, numbers and '.' Requested by " +
          requesterFoamId,
        Res.saveError,
        { filepath: filePath }
      );

    if (Tokenizer.containsSpaces(foamId))
      Res.error(
        "File '" +
          foamId +
          "' contains spaces in its filename. Should be only lowercase characters, numbers and '.'Requested by " +
          requesterFoamId,
        Res.saveError,
        { filepath: filePath }
      );
    //No uper case allowed
    if (Tokenizer.idDoesNotContainTimestamp(localFoamId))
      Res.error(
        "File '" +
          foamId +
          "' does not contain a timestamp in its filename. Requested by " +
          requesterFoamId,
        Res.saveError,
        { filepath: filePath }
      );
  };

  static getFidFromFile = async (fileName: string): Promise<string | null> => {
    //READ FILE
    const filePath = path.join(notesRepo, fileName + ".md");
    let fileData;
    try {
      fileData = await fs.readFile(filePath, "utf8");
    } catch (e) {
      return null;
    }

    let frontMatter = matter(fileData);

    return "" + frontMatter.data.fid;
  };
}
