import IpldController from "./ipldController";
import IpmmType from "./ipmmType";
import Utils from "./utils";

export default class Referencer {
  static readonly PROP_TYPE_FOAMID = "prop-ipfoam-type-1630602741";
  static readonly PROP_VIEW_FOAMID = "prop-view-1612698885";
  static readonly PROP_TITLE_FOAMID = "prop-title-1612697362";
  static readonly TYPE_PROP_DEFAULT_NAME = "$default-name";
  static readonly TYPE_PROP_REPRESENTS = "$represents";
  static readonly TYPE_PROP_CONSTRAINS = "$constrains";
  static readonly TYPE_PROP_IPLD_SCHEMA = "$ipld-schema";

  static iidToCidMap: { [iid: string]: string } = {};
  static iidToTypeMap: { [cid: string]: IpmmType } = {};

  static addIId(iid: string, cid: string): void {
    Referencer.iidToCidMap[iid] = cid;
  }

  static makeIId = async (foamIdOrFileName: string): Promise<any> => {
    const foamId = Utils.removeFileExtension(foamIdOrFileName).toLocaleLowerCase()
    const block = await IpldController.anyToDagCborBlock(foamId)
    return block.cid.toString().slice(-8);
  };

  static iidExists(iid: string): boolean {
    if (Referencer.iidToCidMap[iid]) return true;
    return false;
  }

  static getCid(iid: string): string {
    if (this.iidExists(iid)) return Referencer.iidToCidMap[iid];
    else return "";
  }
}
