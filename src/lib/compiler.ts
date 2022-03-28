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

let notesRepo: string;

export default class Compiler {
  static compileAll = async (
    _ipmmRepo: string,
    _notesRepo: string
  ): Promise<void> => {
    notesRepo = _notesRepo;

    let files = await fs.readdir(notesRepo);
    files = Utils.filterByExtensions(files, [".md"]);

    for (let fileName of files) {
      const foamId = Utils.removeFileExtension(fileName);
      await Compiler.makeNote(foamId);
    }

    //compile "always compile"
    for (let foamId of ConfigController._configFile.misc.alwaysCompile) {
      let res = await Compiler.makeNote(foamId);
    }
  };

  static compileFile = async (
    _ipmmRepo: string,
    _notesRepo: string,
    _fileName: string
  ): Promise<Res> => {
    notesRepo = _notesRepo;

    const foamId = Utils.removeFileExtension(_fileName);
    return await Compiler.makeNote(foamId, false, true);
  };

  static makeNote = async (
    foamId: string,
    shouldBeAType: boolean = false,
    forceUpdate: Boolean = false,
    requesterFoamId?: string
  ): Promise<Res> => {
    try {
      //UPDATE FOAMID TO INCLUDE FRIENDID
      foamId = Referencer.updaterFoamIdWithFriendFolder(
        foamId,
        requesterFoamId
      );

      // console.log(foamId + "\tby\t" + requesterFoamId);

      //READ FILE
      const filePath = path.join(notesRepo, foamId + ".md");
      Compiler.checkFileName(foamId, filePath, requesterFoamId);
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
        "Unable to parse front-matter for: " + foamId,
        Res.saveError,
        { data: fileData.value }
      );
      if (frontMatterRes.isError()) return frontMatterRes;
      const frontMatter = frontMatterRes.value;

      //CHECK IF IS A TYPE
      let isType = false;
      let propTypeFoamId = Referencer.makeFoamIdRelativeToXaviIfIsNotXavi(
        Referencer.PROP_TYPE_FOAMID
      );

      if (
        frontMatter.data[Referencer.PROP_TYPE_FOAMID] ||
        frontMatter.data[Referencer.xaviId + "/" + Referencer.PROP_TYPE_FOAMID]
      ) {
        isType = true;
        if (frontMatter.content || Object.keys(frontMatter.data).length > 1)
          return Res.error(
            "A Note with a type can't include other properties. Verify the note only contains " +
              propTypeFoamId +
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
            propTypeFoamId +
            " was not found.",
          Res.saveError
        );
      }

      /////////////////////////////////

      let iid = await Referencer.makeIid(foamId);

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
        let typeProps = frontMatter.data[Referencer.PROP_TYPE_FOAMID];
        if (!typeProps)
          typeProps =
            frontMatter.data[
              Referencer.xaviId + "/" + Referencer.PROP_TYPE_FOAMID
            ];

        const ipmmType = await Compiler.makeType(typeProps, foamId);
        Referencer.iidToTypeMap[iid] = ipmmType;
        noteBlock = ipmmType.getBlock();
      }
      // VIEW property
      else {
        //Process the content of the .md file and convert it into the the type expressed in the first line or the "view" if not expressed.
        if (frontMatter.content) {
          //for FOAM repositories
          const removedFoodNotes = frontMatter.content.split("[//begin]:")[0];
          const trimmed = removedFoodNotes.trim();

          let content = Tokenizer.getTypeAndValueForContent(removedFoodNotes);
          const contentProp = await Compiler.processProperty(
            Referencer.makeFoamIdRelativeToXaviIfIsNotXavi(content.type),
            content.value,
            foamId,
            false
          );
          noteBlock.set(contentProp.key, contentProp.value);
        }
        //ALL other properties
        //The rest of the properties
        for (let key in frontMatter.data) {
          const prop = await Compiler.processProperty(
            Referencer.updaterFoamIdWithFriendFolder(key, foamId),
            frontMatter.data[key],
            foamId,
            false
          );
          noteBlock.set(prop.key, prop.value);
        }
      }

      //Get the final CID of the note
      const block = await IpldController.anyToDagJsonBlock(noteBlock);
      const cid = block.cid.toString();
      Referencer.iidToCidMap[iid] = cid;

      const noteWrap: NoteWrap = { iid: iid, cid: cid, block: block.value };
      Referencer.iidToNoteWrap.set(iid, noteWrap);

      //Only once the note is created we can create the notes within the properties, otherwise we can end up in a recursive infinite loop

      if (
        ConfigController._configFile.misc.compileInterplanetaryTextArefs &&
        !isType
      ) {
        //itereate through the note properties values and compile the referenced notes
        //view property
        if (frontMatter.content) {
          const removedFoodNotes = frontMatter.content.split("[//begin]:")[0];
          const trimmed = removedFoodNotes.trim();

          const viewProp = await Compiler.processProperty(
            Referencer.makeFoamIdRelativeToXaviIfIsNotXavi(
              Referencer.PROP_VIEW_FOAMID
            ),
            trimmed,
            foamId,
            true
          );
        }
        //rest of properties
        for (let key in frontMatter.data) {
          const prop = await Compiler.processProperty(
            Referencer.updaterFoamIdWithFriendFolder(key, foamId),
            frontMatter.data[key],
            foamId,
            true
          );
        }
      }

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
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
    // errorCallabck: (error: string) => void
  ): Promise<{ key: string; value: string }> => {
    const typeIId = await Referencer.makeIid(typeFoamId);

    //Create a Type for the propertyId if it doesn't exists yet
    if (!Referencer.iidToTypeMap[typeIId]) {
      await Compiler.makeNote(typeFoamId, true, false, requesterFoamId);
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
        const prop = await Compiler.processProperty(
          Referencer.updaterFoamIdWithFriendFolder(
            subTypeFoamId,
            requesterFoamId
          ),
          propertyValue[subTypeFoamId],
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
    filePath: string,
    requesterFoamId: string | undefined
  ): Promise<void> => {
    //new wikilinks should be formated with timestmap in the back.
    //Super crappy check that will last 5 years
    if (Tokenizer.containsUpperCase(foamId))
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
    if (Tokenizer.foamIdDoesNotContainTimestamp(foamId))
      Res.error(
        "File '" +
          foamId +
          "' does not contain a timestamp in its filename. Requested by " +
          requesterFoamId,
        Res.saveError,
        { filepath: filePath }
      );
  };
}
