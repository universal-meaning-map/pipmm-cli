import ConfigController from "./configController";
import IpldController from "./ipldController";
import { NoteWrap } from "./ipmm";
import IpmmType from "./ipmmType";
import Utils from "./utils";
import * as path from "path";
import * as ipfs from "ipfs-core";
import Compiler from "./compiler";

export default class Referencer {
  static readonly xaviId = "xavi-YAxr3c";
  static readonly PROP_TYPE_FILENAME = "prop-ipfoam-type";
  static readonly PROP_VIEW_FILENAME = "prop-view";
  static readonly PROP_NAME_FILENAME = "prop-name";
  static readonly PROP_PIR_FILENAME = "prop-pir";
  static readonly PROP_FID = "fid";
  //static readonly SELF_FRIEND_ID = "x";

  static readonly basicTypeInterplanetaryText = "interplanetary-text";
  static readonly basicTypeString = "string";
  static readonly basicTypeDate = "date";
  static readonly basicTypeAbstractionReference = "abstraction-reference";
  static readonly basicTypeAbstractionReferenceList =
    "abstraction-reference-list";
  static readonly basicTypeBoolean = "boolean";
  static readonly basicTypeUrl = "url";
  static readonly basicTypeNumber = "number";

  static readonly selfDescribingSemanticUntiSeparator = "\n\n\n";

  static iidToCidMap: { [iid: string]: string } = {};
  static iidToTypeMap: { [iid: string]: IpmmType } = {};
  static iidToNoteWrap: Map<string, NoteWrap> = new Map();
  static iidToNoteWrapWithHyphen: Map<string, NoteWrap> = new Map(); //to be used with getRepoWithHyphenNames
  static iidToFoamId: Map<string, string> = new Map();
  static fileNameToIid: Map<string, string> = new Map();
  static nameWithHyphenToFoamId: Map<string, string> = new Map();
  static missingFileNames: Map<string, number> = new Map();

  static miidSeparatorToken = "";

  static addIId(iid: string, cid: string): void {
    Referencer.iidToCidMap[iid] = cid;
  }

  static makeIid = async (fid: string): Promise<string> => {
    /*  const foamId = Utils.removeFileExtension(fid);
    let iid = "";

    let runs = foamId.split("/");
    //does not include friendId, therefore is the author
    if (runs.length == 1) {
      let mid = ConfigController._configFile.identity.mid;
      let liid = await Referencer.makeLocalIid(runs[0]);
      iid = mid + Referencer.miidSeparatorToken + liid;
    } else if (runs.length == 2) {
      let mid = await Referencer.getFriendMid(runs[0]);
      let liid = await Referencer.makeLocalIid(runs[1]);
      iid = mid + Referencer.miidSeparatorToken + liid;
    }
    return iid;
    */

    let mid = ConfigController._configFile.identity.mid;
    let liid = await Referencer.makeLocalIid(fid);
    let iid = mid + Referencer.miidSeparatorToken + liid;
    return iid;
  };

  static getIidByFileName = async (
    fileName: string
  ): Promise<string | null> => {
    //We check if we have it
    if (Referencer.fileNameToIid.has(fileName)) {
      const iid = Referencer.fileNameToIid.get(fileName);
      if (iid) return iid;
    }

    //We check if we know it doesn't exist
    if (Referencer.missingFileNames.has(fileName)) {
      Referencer.missingFileNames.set(
        fileName,
        Referencer.missingFileNames.get(fileName)! + 1
      );
      return null;
    }

    //Still compiling, we get  it from the file without creating a
    let iid = null;
    let fid = await Compiler.getFidFromFile(fileName);
    if (fid) {
      iid = await Referencer.makeIid(fid);
      Referencer.fileNameToIid.set(fileName, iid);
      return iid;
    }

    Referencer.missingFileNames.set(fileName, 0);
    return null;
  };

  static getTypeIdByFileName = async (fileName: string): Promise<string> => {
    const typeIid = await Referencer.getIidByFileName(fileName);
    if (!typeIid) {
      throw "Type iid for" + fileName + "could not be found";
    }
    return typeIid;
  };

  static makeLocalIid = async (fid: string): Promise<string> => {
    const block = await IpldController.anyToDagJsonBlock(fid);
    //console.log(onlyTheTimestamp + " - " + foamId + " - " + foamIdOrFileName);
    const trunkated = block.cid.toString().slice(-8);
    //return "i" + trunkated;
    return trunkated;
  };

  static getFID = (foamId: string): string => {
    const onlyTheTimestamp = foamId.slice(-10);
    return onlyTheTimestamp;
  };

  static getLocalIidFromIid(iid: string): string {
    return iid.slice(-8);
  }

  static makeIdObj = async (): Promise<ipfs.PeerId.JSONPeerId> => {
    const id = await ipfs.PeerId.create({ bits: 2048, keyType: "Ed25519" });
    const idObj = id.toJSON();
    //Dirty hack to be able to have IIDs as keys in IPLD Schema as it does not support keys prefixed by numbers
    idObj.id = "i" + idObj.id;
    return idObj;
  };

  static getFriendMid = async (friendFolder: string): Promise<string> => {
    //Check if its not self
    let selfFriendId = Referencer.makeSelfFriendFolderId();
    if (friendFolder == selfFriendId)
      return ConfigController._configFile.identity.mid;

    //Go to the firendFolder, and get the friendConfig file where the mid is set
    let friendConfig = ConfigController.loadFriendConfig(friendFolder);
    if (friendConfig == null) {
      console.log("Trying to get MID of a friend but no friendConfig found");
      console.log("Friend folder: " + friendFolder);
      throw "Can't find friend config: " + friendFolder;
    }
    return friendConfig.identity.mid;
  };

  static makeSelfFriendFolderId(): string {
    // Generate the folderName to be shared to friends
    // Takes the last 6 characters of the MID and stick them at the back of the "myName" defined in the config
    let mid = ConfigController._configFile.identity.mid;
    let friendId = mid.substr(mid.length - 6);
    let folderId = ConfigController._configFile.share.myName + "-" + friendId;
    return folderId;
  }

  /*  return "i" + (await Referencer.makeLocalIid(friendId));
  };
  */

  static makeExpr(iid: string, piid: string) {
    return iid + "/" + piid;
  }

  static iidExists(iid: string): boolean {
    if (Referencer.iidToCidMap[iid]) return true;
    return false;
  }

  static getCid(iid: string): string {
    return Referencer.iidToCidMap[iid];
  }

  static typeExists(iid: string): boolean {
    if (Referencer.iidToTypeMap[iid]) return true;
    return false;
  }

  static getType(iid: string): IpmmType {
    return Referencer.iidToTypeMap[iid];
  }

  /*
  static getFriendIdFromFoamId = (
    foamId: string | undefined
  ): string | undefined => {
    if (foamId) {
      let runs = foamId.split("/");
      if (runs.length == 2) {
        return runs[0];
      }
    }
    return undefined;
  };
  */

  //Ads friend relative path if the requester contains it and no other friendPath is specified

  /*
  static updaterFoamIdWithFriendFolder = (
    fileName: string,
    requesterFoamId: string | undefined
  ): string => {
    let repoFolder = path.basename(
      ConfigController._configFile.resources.notesRepo
    );
    let requesterFolder = Referencer.getFriendIdFromFoamId(requesterFoamId);
    //the containing note lives in a friendFolder
    if (requesterFolder && requesterFolder != repoFolder) {
      //check if the reference is pointing to a friendFolder or to self
      let runs = fileName.split("/");
      if (runs.length == 1) {
        return requesterFolder + "/" + fileName;
      }
    }

    return fileName;
  };

  */

  static getRepoWithHyphenNames = async (): Promise<Map<string, NoteWrap>> => {
    if (Referencer.iidToNoteWrapWithHyphen.size === 0) {
      const newNotes: Map<string, NoteWrap> = new Map();

      const NAME_IID = await Referencer.getTypeIdByFileName(
        Referencer.PROP_NAME_FILENAME
      );
      // let renamed: Map<string, NoteWrap> = new Map();
      for (let [iid, note] of Referencer.iidToNoteWrap.entries()) {
        const newNote: NoteWrap = Utils.deepCloneNoteWrap(note);

        if (newNote.block.has(NAME_IID)) {
          let name: string = newNote.block.get(NAME_IID);
          let newName = Utils.renameToHyphen(name);
          //let newName = Referencer.getLocalIidFromIid(iid); //use iid
          newNote.block.set(NAME_IID, newName);
        }
        newNotes.set(iid, newNote);
      }
      Referencer.iidToNoteWrapWithHyphen = newNotes;
    }

    return Referencer.iidToNoteWrapWithHyphen;
  };
}
