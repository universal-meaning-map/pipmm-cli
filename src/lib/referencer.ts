import IpldController from "./ipldController";
import { NoteBlock, NoteWrap } from "./ipmm";
import IpmmType from "./ipmmType";
import Utils from "./utils";

export default class Referencer {
  static readonly PROP_TYPE_FOAMID = "prop-ipfoam-type-1630602741";
  static readonly PROP_VIEW_FOAMID = "prop-view-1612698885";
  static readonly PROP_TITLE_FOAMID = "prop-title-1612697362";

  static readonly basicTypeInterplanetaryText = "interplanetary-text";
  static readonly basicTypeString = "string";
  static readonly basicTypeDate = "date";
  static readonly basicTypeAbstractionReference = "abstraction-reference";
  static readonly basicTypeAbstractionReferenceList =
    "abstraction-reference-list";
  static readonly basicTypeBoolean = "boolean";
  static readonly basicTypeUrl = "url";

  static iidToCidMap: { [iid: string]: string } = {};
  static iidToTypeMap: { [iid: string]: IpmmType } = {};
  static iidToNoteWrap: { [iid: string]: NoteWrap } = {};

  static addIId(iid: string, cid: string): void {
    Referencer.iidToCidMap[iid] = cid;
  }

  static makeIid = async (foamIdOrFileName: string): Promise<any> => {
    const foamId = Utils.removeFileExtension(foamIdOrFileName);
    const onlyTheTimestamp = foamId.slice(-10); //This is to prevent an IID change if the foamId changes
    const block = await IpldController.anyToDagJsonBlock(onlyTheTimestamp);
    //console.log(onlyTheTimestamp + " - " + foamId + " - " + foamIdOrFileName);
    return block.cid.toString().slice(-8);
  };

  static makeTypeIid = async (foamId: string): Promise<string> => {
    const iid = await Referencer.makeIid(foamId);
    return "TYPE" + iid;
  };

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

  static getNote(iid: string): NoteBlock {
    return Referencer.iidToNoteWrap[iid];
  }
}
