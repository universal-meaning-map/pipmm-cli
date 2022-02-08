import ConfigController from "./configController";
import IpldController from "./ipldController";
import { NoteWrap } from "./ipmm";
import IpmmType from "./ipmmType";
import Utils from "./utils";
import * as path from "path";

export default class Referencer {
  static readonly xaviId = "xavi-1644219237";
  static readonly PROP_TYPE_FOAMID = "prop-ipfoam-type-1630602741";
  static readonly PROP_VIEW_FOAMID = "prop-view-1612698885";
  static readonly PROP_NAME_FOAMID = "prop-name-1612697362";
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

  static iidToCidMap: { [iid: string]: string } = {};
  static iidToTypeMap: { [iid: string]: IpmmType } = {};
  static iidToNoteWrap: Map<string, NoteWrap> = new Map();

  static miidSeparatorToken = "";

  static addIId(iid: string, cid: string): void {
    Referencer.iidToCidMap[iid] = cid;
  }

  static makeIid = async (foamIdOrFileName: string): Promise<string> => {
    const foamId = Utils.removeFileExtension(foamIdOrFileName);
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
  };

  static makeLocalIid = async (foamId: string): Promise<string> => {
    const onlyTheTimestamp = foamId.slice(-10); //This is to prevent an IID change if the foamId changes
    const block = await IpldController.anyToDagJsonBlock(onlyTheTimestamp);
    //console.log(onlyTheTimestamp + " - " + foamId + " - " + foamIdOrFileName);
    const trunkated = block.cid.toString().slice(-8);
    //return "i" + trunkated;
    return trunkated;
  };

  static getFriendMid = async (friendFolder: string): Promise<string> => {
    //Go to the firendFolder, and get the friendConfig file where the mid is set
    let friendConfig = ConfigController.loadFriendConfig(friendFolder);
    if (friendConfig == null) {
      console.log("Trying to get MID of a friend but no friendConfig found");
      console.log("Friend folder: " + friendFolder);
      throw "Can't find friend config: " + friendFolder;
    }
    return friendConfig.identity.mid;
  };

  /*  return "i" + (await Referencer.makeLocalIid(friendId));
  };
  */

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

  static updaterFoamIdWithFriendFolder = (
    foamId: string,
    requesterFoamId: string | undefined
  ): string => {
    let repoFolder = path.basename(
      ConfigController._configFile.resources.notesRepo
    );
    let requesterFolder = Referencer.getFriendIdFromFoamId(requesterFoamId);
    //the containing note lives in a friendFolder
    if (requesterFolder && requesterFolder != repoFolder) {
      //check if the reference is pointing to a friendFolder or to self
      let runs = foamId.split("/");
      if (runs.length == 1) {
        foamId = requesterFolder + "/" + foamId;
      }
    }
    return foamId;
  };

  static makeFoamIdRelativeToXaviIfIsNotXavi = (foamId: string): string => {
    if (!ConfigController.isXavi) {
      return Referencer.xaviId + "/" + foamId;
    }
    return foamId;
  };
}
